import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

MODELS_DIR = os.path.join(os.path.dirname(__file__), "data", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# Define feature columns
NUMERICAL_COLS = ["amount", "old_balance_org", "new_balance_orig", "old_balance_dest", "new_balance_dest", "velocity"]
CATEGORICAL_COLS = ["type"]
BOOLEAN_COLS = ["merchant_dest", "geo_mismatch"]

def get_preprocessor():
    """Returns a new ColumnTransformer preprocessor."""
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_COLS),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_COLS)
        ],
        remainder="passthrough" # leaves boolean columns as is
    )

def train_models(df: pd.DataFrame):
    """
    Trains all four ML models:
    1. Logistic Regression (Baseline)
    2. Random Forest (Robust Classifier)
    3. XGBoost (High Accuracy Tree Ensemble)
    4. Isolation Forest (Anomaly Detector)
    Saves models, preprocessor, and metrics to disk.
    """
    print("Pre-processing dataset for training...")
    
    # Separate features and labels
    feature_cols = NUMERICAL_COLS + CATEGORICAL_COLS + BOOLEAN_COLS
    X = df[feature_cols].copy()
    y = df["is_fraud"].astype(int).values
    
    # Initialize and fit the preprocessor
    preprocessor = get_preprocessor()
    X_preprocessed = preprocessor.fit_transform(X)
    
    # Capture feature names after transformation
    ohe_feature_names = preprocessor.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_COLS)
    feature_names = NUMERICAL_COLS + list(ohe_feature_names) + BOOLEAN_COLS
    
    # Train-test split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(X_preprocessed, y, test_size=0.2, random_state=42, stratify=y)
    
    # Calculate scale factor for XGBoost class imbalance
    neg_count = np.sum(y_train == 0)
    pos_count = np.sum(y_train == 1)
    scale_pos_weight = neg_count / pos_count if pos_count > 0 else 1.0
    
    # 1. Initialize models
    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    rf = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
    xgb = XGBClassifier(scale_pos_weight=scale_pos_weight, random_state=42, eval_metric="logloss", n_jobs=-1)
    # Isolation Forest is unsupervised; we fit on normal training data (contamination reflects target fraud rate)
    contamination = max(0.005, pos_count / len(y_train))
    iforest = IsolationForest(contamination=contamination, random_state=42, n_jobs=-1)
    
    # 2. Train models
    print("Training Logistic Regression...")
    lr.fit(X_train, y_train)
    
    print("Training Random Forest...")
    rf.fit(X_train, y_train)
    
    print("Training XGBoost...")
    xgb.fit(X_train, y_train)
    
    print("Training Isolation Forest (Anomaly Detection)...")
    # Fit Isolation Forest (ideally on normal/legitimate transactions, but fitting on train set is standard)
    iforest.fit(X_train)
    
    # 3. Evaluate models
    metrics = {}
    
    # Helper to evaluate classifier
    def evaluate_classifier(model, name, is_unsupervised=False):
        if is_unsupervised:
            # For Isolation Forest, outlier predictions are -1, normal are 1
            preds_raw = model.predict(X_test)
            preds = np.where(preds_raw == -1, 1, 0)
            # decision function returns anomaly scores (lower is more anomalous)
            decision_scores = model.decision_function(X_test)
            # Map decision function to a 0-1 scale where higher is more anomalous
            probs = 1.0 - (decision_scores - decision_scores.min()) / (decision_scores.max() - decision_scores.min() + 1e-9)
        else:
            preds = model.predict(X_test)
            probs = model.predict_proba(X_test)[:, 1]
            
        acc = accuracy_score(y_test, preds)
        prec = precision_score(y_test, preds, zero_division=0)
        rec = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        auc = roc_auc_score(y_test, probs)
        cm = confusion_matrix(y_test, preds).tolist()
        
        return {
            "model_name": name,
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_score": float(f1),
            "roc_auc": float(auc),
            "confusion_matrix": cm
        }
        
    metrics["Logistic Regression"] = evaluate_classifier(lr, "Logistic Regression")
    metrics["Random Forest"] = evaluate_classifier(rf, "Random Forest")
    metrics["XGBoost"] = evaluate_classifier(xgb, "XGBoost")
    metrics["Isolation Forest"] = evaluate_classifier(iforest, "Isolation Forest", is_unsupervised=True)
    
    # 4. Extract Feature Importances (using Random Forest & XGBoost average)
    rf_importances = rf.feature_importances_
    xgb_importances = xgb.feature_importances_
    # Average them
    avg_importances = (rf_importances + xgb_importances) / 2.0
    
    feature_importance_dict = {
        name: float(imp) for name, imp in zip(feature_names, avg_importances)
    }
    
    # Save objects to disk
    joblib.dump(preprocessor, os.path.join(MODELS_DIR, "preprocessor.joblib"))
    joblib.dump(lr, os.path.join(MODELS_DIR, "logistic_regression.joblib"))
    joblib.dump(rf, os.path.join(MODELS_DIR, "random_forest.joblib"))
    joblib.dump(xgb, os.path.join(MODELS_DIR, "xgboost.joblib"))
    joblib.dump(iforest, os.path.join(MODELS_DIR, "isolation_forest.joblib"))
    
    # Save metrics metadata
    results = {
        "metrics": metrics,
        "feature_importance": feature_importance_dict
    }
    joblib.dump(results, os.path.join(MODELS_DIR, "metrics.joblib"))
    
    print("Model training successfully completed!")
    return results

def load_pipeline():
    """Loads all models, preprocessor, and metrics from disk."""
    try:
        preprocessor = joblib.load(os.path.join(MODELS_DIR, "preprocessor.joblib"))
        lr = joblib.load(os.path.join(MODELS_DIR, "logistic_regression.joblib"))
        rf = joblib.load(os.path.join(MODELS_DIR, "random_forest.joblib"))
        xgb = joblib.load(os.path.join(MODELS_DIR, "xgboost.joblib"))
        iforest = joblib.load(os.path.join(MODELS_DIR, "isolation_forest.joblib"))
        metrics = joblib.load(os.path.join(MODELS_DIR, "metrics.joblib"))
        
        return {
            "preprocessor": preprocessor,
            "lr": lr,
            "rf": rf,
            "xgb": xgb,
            "iforest": iforest,
            "metrics": metrics
        }
    except Exception as e:
        print(f"Error loading models: {e}")
        return None

def predict_transaction(txn_dict: dict, pipeline: dict) -> dict:
    """
    Given a single transaction dictionary, runs inference through the pipeline
    and returns predictions and consensus risk score.
    """
    preprocessor = pipeline["preprocessor"]
    lr = pipeline["lr"]
    rf = pipeline["rf"]
    xgb = pipeline["xgb"]
    iforest = pipeline["iforest"]
    
    # Create DataFrame with correct feature names and columns order
    feature_cols = NUMERICAL_COLS + CATEGORICAL_COLS + BOOLEAN_COLS
    df_txn = pd.DataFrame([txn_dict])[feature_cols]
    
    # Preprocess
    x_preprocessed = preprocessor.transform(df_txn)
    
    # Get individual predictions
    pred_lr = bool(lr.predict(x_preprocessed)[0])
    pred_rf = bool(rf.predict(x_preprocessed)[0])
    pred_xgb = bool(xgb.predict(x_preprocessed)[0])
    
    # Isolation forest prediction (anomaly is -1)
    pred_if = bool(iforest.predict(x_preprocessed)[0] == -1)
    
    # Get probabilities
    p_lr = float(lr.predict_proba(x_preprocessed)[0][1])
    p_rf = float(rf.predict_proba(x_preprocessed)[0][1])
    p_xgb = float(xgb.predict_proba(x_preprocessed)[0][1])
    
    # Map isolation forest decision score to a 0-1 scale
    # (Unsupervised models don't have standard predict_proba)
    dec_score = iforest.decision_function(x_preprocessed)[0]
    # Isolation Forest score is generally between -0.5 and 0.5. Let's convert to an anomaly likelihood
    p_if = float(np.clip(1.0 - (dec_score + 0.5) / 1.0, 0.0, 1.0))
    
    # Weighted average consensus risk score
    # Giving more weight to Tree Models (XGBoost and Random Forest)
    risk_score = float(0.20 * p_lr + 0.35 * p_rf + 0.40 * p_xgb + 0.05 * p_if)
    
    return {
        "predicted_fraud_lr": pred_lr,
        "predicted_fraud_rf": pred_rf,
        "predicted_fraud_xgb": pred_xgb,
        "predicted_fraud_iforest": pred_if,
        "risk_score": round(risk_score, 4)
    }
