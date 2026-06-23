import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Default to local SQLite database if no DATABASE_URL is configured.
# This ensures out-of-the-box functionality without needing a running PostgreSQL server.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fraud_detection_inr.db")

# For SQLite, we need to allow multi-threaded access for uvicorn & WebSockets.
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency injection utility for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
