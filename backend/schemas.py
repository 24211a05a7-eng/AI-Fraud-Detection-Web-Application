from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in currency units")
    type: str = Field(..., description="UPI, IMPS, RTGS, NEFT, or CASH_OUT")
    origin_id: str = Field(..., description="Origin account identifier")
    dest_id: str = Field(..., description="Destination account identifier")
    old_balance_org: float = Field(..., ge=0, description="Balance before transaction at origin")
    new_balance_orig: float = Field(..., ge=0, description="Balance after transaction at origin")
    old_balance_dest: float = Field(..., ge=0, description="Balance before transaction at destination")
    new_balance_dest: float = Field(..., ge=0, description="Balance after transaction at destination")
    location: Optional[str] = "Unknown"
    ip_address: Optional[str] = "0.0.0.0"
    timestamp: Optional[datetime] = None

class TransactionResponse(TransactionCreate):
    id: int
    timestamp: datetime
    merchant_dest: bool
    geo_mismatch: bool
    velocity: int
    is_fraud: Optional[bool] = None
    predicted_fraud_lr: Optional[bool] = None
    predicted_fraud_rf: Optional[bool] = None
    predicted_fraud_xgb: Optional[bool] = None
    predicted_fraud_iforest: Optional[bool] = None
    risk_score: float
    status: str

    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str = Field(..., description="Must be 'flagged_fraud' or 'cleared_legitimate'")

class DailyStat(BaseModel):
    date: str
    total_count: int
    fraud_count: int
    total_amount: float

class DashboardStats(BaseModel):
    total_transactions: int
    flagged_count: int
    cleared_count: int
    pending_count: int
    fraud_rate: float
    total_amount: float
    avg_risk_score: float
    daily_stats: List[DailyStat]
    type_stats: Dict[str, int]
    risk_distribution: Dict[str, int]

class SingleModelMetrics(BaseModel):
    model_name: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    roc_auc: float
    confusion_matrix: List[List[int]]

class ModelMetricsResponse(BaseModel):
    metrics: Dict[str, SingleModelMetrics]
    feature_importance: Dict[str, float]
