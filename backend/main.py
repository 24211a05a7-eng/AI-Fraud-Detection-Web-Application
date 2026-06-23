import os
import asyncio
import random
import io
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func

import database
import models
import schemas
import generator
import ml_pipeline

# Initialize FastAPI App
app = FastAPI(title="AI-Powered Fraud Detection API", version="1.0.0")

# Add CORS Middleware to enable communication with the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for ML Pipeline & Background Streamer
pipeline = None
streaming_task = None
is_streaming = False
stream_delay = 1.0
stream_fraud_rate = 0.05

# Initialize database tables
models.Base.metadata.create_all(bind=database.engine)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Handle disconnected or stale connections
                pass

manager = ConnectionManager()

# Background stream simulator loop
async def stream_simulator_loop(db_session_factory):
    global is_streaming, stream_delay, stream_fraud_rate, pipeline
    print("Background transaction streamer started.")
    try:
        while is_streaming:
            if pipeline is None:
                await asyncio.sleep(1)
                continue

            # 1. Generate transaction
            force_fraud = (random.random() < stream_fraud_rate)

            txn_data = generator.generate_single_transaction(is_fraud_override=force_fraud)
            
            # 2. Run inference
            pred_results = ml_pipeline.predict_transaction(txn_data, pipeline)
            txn_data.update(pred_results)
            
            # Set initial review status based on risk score
            # High risk (>0.7) immediately flagged, else pending review
            if txn_data["risk_score"] >= 0.7:
                txn_data["status"] = "flagged_fraud"
            elif txn_data["risk_score"] >= 0.3:
                txn_data["status"] = "pending_review"
            else:
                txn_data["status"] = "cleared_legitimate"

            # 3. Store in Database
            db = db_session_factory()
            db_txn = models.Transaction(**txn_data)
            db.add(db_txn)
            db.commit()
            db.refresh(db_txn)
            
            # 4. Convert response and Broadcast via WebSocket
            resp_data = schemas.TransactionResponse.model_validate(db_txn).model_dump()
            # Convert datetime to ISO string for JSON serialization
            resp_data["timestamp"] = resp_data["timestamp"].isoformat()
            
            await manager.broadcast({
                "type": "NEW_TRANSACTION",
                "data": resp_data
            })
            
            db.close()
            await asyncio.sleep(stream_delay)
    except asyncio.CancelledError:
        print("Background streamer task cancelled.")
    except Exception as e:
        print(f"Error in streaming simulation: {e}")
    finally:
        is_streaming = False
        print("Background transaction streamer stopped.")

@app.on_event("startup")
async def startup_event():
    global pipeline
    # Ensure tables are created
    models.Base.metadata.create_all(bind=database.engine)
    
    # Check if models are trained, if not run generator & training
    pipeline = ml_pipeline.load_pipeline()
    
    db = database.SessionLocal()
    transaction_count = db.query(models.Transaction).count()
    
    if pipeline is None or transaction_count == 0:
        print("Initial setup: Generating historical data and training models...")
        # Generate baseline dataset
        df_history = generator.generate_synthetic_dataset(n_samples=1000)
        
        # Train ML pipeline
        results = ml_pipeline.train_models(df_history)
        pipeline = ml_pipeline.load_pipeline()
        
        # Populate DB with generated historical data
        print("Populating database with historical records...")
        db_records = []
        for _, row in df_history.iterrows():
            txn_dict = row.to_dict()
            
            # Populate predictions instantly based on ground truth to bypass slow sequential inference
            is_f = bool(txn_dict["is_fraud"])
            txn_dict["predicted_fraud_lr"] = is_f
            txn_dict["predicted_fraud_rf"] = is_f
            txn_dict["predicted_fraud_xgb"] = is_f
            txn_dict["predicted_fraud_iforest"] = is_f
            txn_dict["risk_score"] = 0.94 if is_f else 0.04
            
            # Assign status based on ground truth
            if is_f:
                txn_dict["status"] = "flagged_fraud"
            else:
                txn_dict["status"] = "cleared_legitimate"
                
            db_records.append(models.Transaction(**txn_dict))
            
        # Batch insert for speed
        db.bulk_save_objects(db_records)
        db.commit()
        print(f"Populated database with {len(db_records)} records.")
        
    db.close()
    print("Application startup complete. Ready for requests.")

# API Routes

@app.post("/api/predict", response_model=schemas.TransactionResponse)
def predict_single(txn: schemas.TransactionCreate, db: Session = Depends(database.get_db)):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="ML Models are not initialized or loaded.")
        
    txn_dict = txn.model_dump()
    if txn_dict.get("timestamp") is None:
        txn_dict["timestamp"] = datetime.utcnow()
        
    # Extracted feature tags
    txn_dict["merchant_dest"] = txn_dict["dest_id"].startswith("M")
    
    # Run predictions
    pred_results = ml_pipeline.predict_transaction(txn_dict, pipeline)
    txn_dict.update(pred_results)
    
    # Set default status based on risk score
    if txn_dict["risk_score"] >= 0.7:
        txn_dict["status"] = "flagged_fraud"
    elif txn_dict["risk_score"] >= 0.3:
        txn_dict["status"] = "pending_review"
    else:
        txn_dict["status"] = "cleared_legitimate"
        
    db_txn = models.Transaction(**txn_dict)
    db.add(db_txn)
    db.commit()
    db.refresh(db_txn)
    
    return db_txn

@app.post("/api/predict-bulk")
async def predict_bulk(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if pipeline is None:
        raise HTTPException(status_code=503, detail="ML Models are not initialized.")
        
    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file format: {e}")
        
    required_cols = ["amount", "type", "origin_id", "dest_id", "old_balance_org", "new_balance_orig", "old_balance_dest", "new_balance_dest"]
    for col in required_cols:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Missing required column in CSV: {col}")
            
    db_records = []
    flagged_count = 0
    
    for _, row in df.iterrows():
        txn_dict = row.to_dict()
        if "timestamp" not in txn_dict or pd.isna(txn_dict["timestamp"]):
            txn_dict["timestamp"] = datetime.utcnow()
        else:
            txn_dict["timestamp"] = pd.to_datetime(txn_dict["timestamp"])
            
        txn_dict["merchant_dest"] = str(txn_dict["dest_id"]).startswith("M")
        txn_dict["geo_mismatch"] = bool(txn_dict.get("geo_mismatch", False))
        txn_dict["velocity"] = int(txn_dict.get("velocity", 1))
        
        # Run ML predictions
        pred_results = ml_pipeline.predict_transaction(txn_dict, pipeline)
        txn_dict.update(pred_results)
        
        # Set status
        if txn_dict["risk_score"] >= 0.7:
            txn_dict["status"] = "flagged_fraud"
            flagged_count += 1
        elif txn_dict["risk_score"] >= 0.3:
            txn_dict["status"] = "pending_review"
        else:
            txn_dict["status"] = "cleared_legitimate"
            
        db_records.append(models.Transaction(**txn_dict))
        
    db.bulk_save_objects(db_records)
    db.commit()
    
    return {
        "status": "success",
        "processed_records": len(db_records),
        "flagged_fraud_records": flagged_count,
        "detail": f"Bulk import complete. Processed {len(db_records)} transactions, flagged {flagged_count} as high risk."
    }

@app.get("/api/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(
    status: Optional[str] = None,
    min_risk: Optional[float] = None,
    txn_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Transaction)
    
    if status:
        query = query.filter(models.Transaction.status == status)
    if min_risk is not None:
        query = query.filter(models.Transaction.risk_score >= min_risk)
    if txn_type:
        query = query.filter(models.Transaction.type == txn_type)
        
    return query.order_by(models.Transaction.timestamp.desc()).limit(limit).offset(offset).all()

@app.put("/api/transactions/{txn_id}/status", response_model=schemas.TransactionResponse)
def update_transaction_status(txn_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(database.get_db)):
    db_txn = db.query(models.Transaction).filter(models.Transaction.id == txn_id).first()
    if not db_txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if status_update.status not in ["flagged_fraud", "cleared_legitimate"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'flagged_fraud' or 'cleared_legitimate'.")
        
    db_txn.status = status_update.status
    # Update ground truth label
    db_txn.is_fraud = (status_update.status == "flagged_fraud")
    db.commit()
    db.refresh(db_txn)
    
    return db_txn

@app.get("/api/dashboard-stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(database.get_db)):
    total = db.query(models.Transaction).count()
    flagged = db.query(models.Transaction).filter(models.Transaction.status == "flagged_fraud").count()
    cleared = db.query(models.Transaction).filter(models.Transaction.status == "cleared_legitimate").count()
    pending = db.query(models.Transaction).filter(models.Transaction.status == "pending_review").count()
    
    avg_risk = db.query(func.avg(models.Transaction.risk_score)).scalar() or 0.0
    total_amount = db.query(func.sum(models.Transaction.amount)).scalar() or 0.0
    
    fraud_rate = (flagged / total * 100) if total > 0 else 0.0
    
    # Group counts by type
    type_counts = db.query(models.Transaction.type, func.count(models.Transaction.id)).group_by(models.Transaction.type).all()
    type_stats = {t_type: count for t_type, count in type_counts}
    
    # Calculate Risk distribution counts
    low_risk = db.query(models.Transaction).filter(models.Transaction.risk_score < 0.3).count()
    med_risk = db.query(models.Transaction).filter(models.Transaction.risk_score >= 0.3, models.Transaction.risk_score < 0.7).count()
    high_risk = db.query(models.Transaction).filter(models.Transaction.risk_score >= 0.7).count()
    
    risk_distribution = {
        "Low Risk": low_risk,
        "Medium Risk": med_risk,
        "High Risk": high_risk
    }
    
    # Calculate Daily Stats (for charts) spanning the last 15 days
    daily_stats = []
    today = datetime.utcnow().date()
    for i in range(14, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        day_total = db.query(models.Transaction).filter(models.Transaction.timestamp.between(day_start, day_end)).count()
        day_fraud = db.query(models.Transaction).filter(
            models.Transaction.timestamp.between(day_start, day_end),
            models.Transaction.status == "flagged_fraud"
        ).count()
        day_amount = db.query(func.sum(models.Transaction.amount)).filter(models.Transaction.timestamp.between(day_start, day_end)).scalar() or 0.0
        
        daily_stats.append({
            "date": day.strftime("%b %d"),
            "total_count": day_total,
            "fraud_count": day_fraud,
            "total_amount": float(day_amount)
        })
        
    return {
        "total_transactions": total,
        "flagged_count": flagged,
        "cleared_count": cleared,
        "pending_count": pending,
        "fraud_rate": round(fraud_rate, 2),
        "total_amount": round(total_amount, 2),
        "avg_risk_score": round(avg_risk, 4),
        "daily_stats": daily_stats,
        "type_stats": type_stats,
        "risk_distribution": risk_distribution
    }

@app.get("/api/metrics", response_model=schemas.ModelMetricsResponse)
def get_metrics():
    if pipeline is None:
        raise HTTPException(status_code=503, detail="ML Models are not initialized.")
    return pipeline["metrics"]

@app.post("/api/stream/start")
def start_stream(delay: float = 1.0, fraud_rate: float = 0.05):
    global is_streaming, streaming_task, stream_delay, stream_fraud_rate
    if is_streaming:
        return {"status": "already_streaming", "detail": "Simulation is already running."}
        
    is_streaming = True
    stream_delay = max(0.1, delay) # prevent locking CPU
    stream_fraud_rate = min(1.0, max(0.0, fraud_rate))
    
    # We pass the db session maker down to the background loop
    session_factory = database.SessionLocal
    streaming_task = asyncio.create_task(stream_simulator_loop(session_factory))
    
    return {"status": "started", "detail": f"Stream started with speed {stream_delay}s and fraud probability {stream_fraud_rate*100}%."}

@app.post("/api/stream/stop")
def stop_stream():
    global is_streaming, streaming_task
    if not is_streaming:
        return {"status": "not_streaming", "detail": "Simulation is not running."}
        
    is_streaming = False
    if streaming_task:
        streaming_task.cancel()
        streaming_task = None
        
    return {"status": "stopped", "detail": "Simulation has been stopped."}

@app.post("/api/train")
def train_models_endpoint(db: Session = Depends(database.get_db)):
    global pipeline
    # Fetch all labeled transactions from database to retrain
    query_txns = db.query(models.Transaction).all()
    if len(query_txns) < 100:
        raise HTTPException(status_code=400, detail="Not enough data in database to train. Need at least 100 records.")
        
    # Convert database records to Pandas DataFrame
    records = []
    for t in query_txns:
        r = {
            "timestamp": t.timestamp,
            "amount": t.amount,
            "type": t.type,
            "origin_id": t.origin_id,
            "dest_id": t.dest_id,
            "old_balance_org": t.old_balance_org,
            "new_balance_orig": t.new_balance_orig,
            "old_balance_dest": t.old_balance_dest,
            "new_balance_dest": t.new_balance_dest,
            "merchant_dest": t.merchant_dest,
            "geo_mismatch": t.geo_mismatch,
            "velocity": t.velocity,
            # If the admin verified it (status is marked), use that.
            # Otherwise use the original label, otherwise default to a heuristic.
            "is_fraud": t.is_fraud if t.is_fraud is not None else (t.status == "flagged_fraud")
        }
        records.append(r)
        
    df = pd.DataFrame(records)
    results = ml_pipeline.train_models(df)
    pipeline = ml_pipeline.load_pipeline()
    
    return {"status": "success", "detail": "Models retrained successfully.", "metrics": results["metrics"]}

@app.websocket("/api/stream/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We keep the connection alive. Standard WebSocket protocol.
            # If client sends anything, discard or log.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
