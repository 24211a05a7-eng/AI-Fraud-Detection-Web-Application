# ShieldFraud AI: Real-Time Fraud Ingestion & ML Consensus Engine

ShieldFraud AI is an enterprise-grade, real-time fraud detection and risk operations center. The platform leverages an ensemble of machine learning classifiers to audit and classify financial transactions (UPI, IMPS, NEFT, RTGS, and Cash-Outs) in real-time, providing risk operations teams with an intuitive, human-in-the-loop dashboard.

Designed with a clean, professional, light-themed aesthetic, the system is engineered to handle extreme class imbalances and evaluate consensus risk metrics with sub-second latency.

---

## 🏗️ System Architecture

The application is split into two decoupled layers linked via asynchronous channels:

```
+-----------------------------------------------------------------------------------+
|                              REACT FRONTEND CLIENT                                |
|    (Overview Dashboard, Ledger, Bulk Scan Uploader, Model Performance tab)        |
+-----------------------------------------------------------------------------------+
                                   |                     ▲
                 REST APIs (HTTPS) |                     | WebSockets (WSS)
                                   ▼                     |
+-----------------------------------------------------------------------------------+
|                             FASTAPI BACKEND SERVICE                               |
|        - REST Endpoints (Predict, Bulk Predict, Status Auditing, Stats APIs)      |
|        - WebSocket Broadcaster & Background Transaction Ingestion Loop            |
+-----------------------------------------------------------------------------------+
                                   |                     ▲
               SQLAlchemy ORM (DB) |                     | Loads Scikit-Learn/XGBoost
                                   ▼                     |
+----------------------------------+       +----------------------------------------+
|       SQLITE / POSTGRES DB       |       |           ML INFERENCE PIPELINE        |
| (Transaction logs, Audit Trails) |       | (Logistic Reg, RF, XGBoost, I-Forest)  |
+----------------------------------+       +----------------------------------------+
```

### 1. Backend Service (FastAPI & SQLAlchemy)
- Exposes high-performance REST endpoints for batch scanning, ledger filtering, and human auditing.
- Implements an asynchronous background streaming loop simulating real-time transactional flows.
- Features a WebSocket broadcast server transmitting real-time transaction objects and ML risk ratings directly to clients.
- Defaults to SQLite for local portable setup, fully migrations-ready for PostgreSQL.

### 2. Machine Learning & Engineering Pipeline
- **Preprocessing Engine**: Numerical features are scaled using `StandardScaler`. Categorical features (transaction types) are transformed via `OneHotEncoder`.
- **Ensemble Consensus Design**: Evaluates risk across four models:
  - **Logistic Regression**: Linear baseline with class weights balanced.
  - **Random Forest**: Tree classifier capturing complex non-linear feature splits.
  - **XGBoost**: Gradient-boosted trees optimized for high precision and recall on heavily imbalanced datasets.
  - **Isolation Forest**: Unsupervised anomaly detection algorithm flagging out-of-pattern structural profiles.
- **Mathematical Consensus**:
  The final consensus risk score is calculated as a weighted ensemble:
  \[
  \text{Risk Score} = 0.20 \cdot P_{\text{LR}} + 0.35 \cdot P_{\text{RF}} + 0.40 \cdot P_{\text{XGB}} + 0.05 \cdot P_{\text{IF}}
  \]
  Transactions exceeding $\ge 0.70$ are automatically flagged for active fraud operations review.

### 3. Frontend Operations Dashboard (React & Tailwind CSS v4)
- Built on Vite for high-speed client-side serving.
- Incorporates Recharts for rendering real-time area graphs, pie risk splits, and method distributions.
- Includes a Historical Ledger table with a slide-out drawer rendering account balances, metadata, and individual model flags.

---

## 📁 Repository Structure

```
├── backend/
│   ├── database.py         # DB connection pool (SQLite / PostgreSQL auto-switch)
│   ├── models.py           # SQLAlchemy Transaction entity model
│   ├── schemas.py          # Pydantic schemas validating request/response shapes
│   ├── generator.py        # INR Transaction generator & live stream simulator
│   ├── ml_pipeline.py      # Feature preprocessor, model training, and consensus inference
│   ├── main.py             # FastAPI router, WebSocket manager, and background streamer
│   └── requirements.txt    # Python backend package dependencies
│
├── frontend/
│   ├── package.json        # Node configurations (React 19, Tailwind CSS v4, Recharts)
│   ├── vite.config.js      # Vite server configuration (reverse API/WS proxies, allowedHosts)
│   └── src/
│       ├── main.jsx        # App entrypoint
│       ├── index.css       # Root style sheet with custom alert animations
│       ├── App.jsx         # Main router, websocket listener, and stats calculator
│       └── components/
│           ├── Dashboard.jsx        # Operations Center, Recharts plots, streamer controls
│           ├── TransactionsTable.jsx# Searchable grid with slide-out audit report panel
│           ├── BatchUpload.jsx      # CSV uploader for batch offline scanning
│           └── ModelPerformance.jsx # Performance metrics, confusion matrices, and importances
│
├── render.yaml             # Render cloud deployment Blueprint specification
├── run_app.py              # Automated environment configuration and server runner
└── README.md               # User documentation
```

---

