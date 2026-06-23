from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from datetime import datetime
from database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False) # e.g. TRANSFER, CASH_OUT, PAYMENT, DEBIT, CASH_IN
    origin_id = Column(String, nullable=False)
    dest_id = Column(String, nullable=False)
    old_balance_org = Column(Float, nullable=False)
    new_balance_orig = Column(Float, nullable=False)
    old_balance_dest = Column(Float, nullable=False)
    new_balance_dest = Column(Float, nullable=False)
    
    # Extracted feature tags
    merchant_dest = Column(Boolean, default=False)
    geo_mismatch = Column(Boolean, default=False)
    velocity = Column(Integer, default=1)
    
    # Ground truth: None (unlabeled), True (fraud), False (legitimate)
    is_fraud = Column(Boolean, nullable=True)
    
    # Individual model predictions
    predicted_fraud_lr = Column(Boolean, nullable=True)
    predicted_fraud_rf = Column(Boolean, nullable=True)
    predicted_fraud_xgb = Column(Boolean, nullable=True)
    predicted_fraud_iforest = Column(Boolean, nullable=True)
    
    # Consensus risk score (0.0 - 1.0)
    risk_score = Column(Float, default=0.0)
    
    # Review status: "pending_review", "flagged_fraud", "cleared_legitimate"
    status = Column(String, default="pending_review", index=True)
    
    # Simulated metadata
    location = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
