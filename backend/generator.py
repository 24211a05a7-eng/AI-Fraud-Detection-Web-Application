import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# List of major cities for geolocations
CITIES = ["Mumbai, IN", "Delhi, IN", "Bengaluru, IN", "Hyderabad, IN", "Chennai, IN", 
          "Kolkata, IN", "Pune, IN", "Ahmedabad, IN", "Jaipur, IN", "Kochi, IN"]

TYPES = ["UPI", "IMPS", "RTGS", "NEFT", "CASH_OUT"]

def generate_ip():
    """Generates a random simulated IP address."""
    return f"{random.randint(1, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"

def generate_single_transaction(is_fraud_override=None, base_time=None):
    """
    Generates a single synthetic transaction in Indian Rupees (INR).
    If is_fraud_override is set, forces the transaction to be fraud (True) or legit (False).
    Otherwise, determines randomly based on a 1.5% fraud probability.
    """
    is_fraud = is_fraud_override if is_fraud_override is not None else (random.random() < 0.015)
    txn_type = random.choice(TYPES)
    
    # Legitimate transactions in INR: lognormal centered around ₹2,000 to ₹10,000
    amount = float(np.round(np.random.lognormal(mean=7.2, sigma=1.3), 2))
    if amount <= 0:
        amount = 100.00

    old_balance_org = float(np.round(amount + np.random.lognormal(mean=8.5, sigma=1.5), 2))
    new_balance_orig = float(np.round(old_balance_org - amount, 2))
    
    old_balance_dest = float(np.round(np.random.lognormal(mean=8.0, sigma=1.8), 2))
    new_balance_dest = float(np.round(old_balance_dest + amount, 2))
    
    origin_id = f"C{random.randint(100000000, 999999999)}"
    dest_id = f"C{random.randint(100000000, 999999999)}"
    
    merchant_dest = False
    geo_mismatch = random.random() < 0.05
    velocity = random.randint(1, 3)
    location = random.choice(CITIES)
    ip_address = generate_ip()
    
    # Force fraud characteristics if marked as fraud
    if is_fraud:
        # Fraud types are usually UPI, IMPS or CASH_OUT
        txn_type = random.choice(["UPI", "IMPS", "CASH_OUT"])
        geo_mismatch = random.random() < 0.70  # High probability of location mismatch
        velocity = random.randint(5, 12)       # High velocity
        
        # High amount or emptying out of account (INR scales: e.g. ₹50k to ₹5 Lakhs)
        if random.random() < 0.6:
            amount = float(np.round(random.uniform(50000, 500000), 2))
            old_balance_org = float(np.round(amount + random.uniform(0, 10000), 2))
            new_balance_orig = float(np.round(old_balance_org - amount, 2))
            if random.random() < 0.8:
                new_balance_orig = 0.0
        else:
            # Emptying out a smaller account (INR scale)
            old_balance_org = float(np.round(random.uniform(5000, 50000), 2))
            amount = old_balance_org
            new_balance_orig = 0.0
            
        if txn_type in ["UPI", "IMPS"] and random.random() < 0.7:
            # Frequently transfers to merchant VPA or foreign account
            dest_id = f"M{random.randint(100000000, 999999999)}"
            merchant_dest = True
            
        # Ensure destination balances reflect the fraud
        new_balance_dest = float(np.round(old_balance_dest + amount, 2))
    else:
        # Adjust for legitimate UPI merchant payment
        if txn_type == "UPI" and random.random() < 0.50:
            dest_id = f"M{random.randint(100000000, 999999999)}"
            merchant_dest = True
            # Payment destination balance is often untracked (stays 0)
            if random.random() < 0.8:
                old_balance_dest = 0.0
                new_balance_dest = 0.0
        elif txn_type == "NEFT" or txn_type == "RTGS":
            # Direct bank transfers
            pass

    timestamp = base_time if base_time else datetime.utcnow()
    # If fraud, sometimes push timestamp to weird night hours
    if is_fraud and not base_time and random.random() < 0.5:
        # set hour to 1-4 AM
        current_date = datetime.utcnow().date()
        timestamp = datetime.combine(current_date, datetime.min.time()) + timedelta(
            hours=random.randint(1, 4), 
            minutes=random.randint(0, 59), 
            seconds=random.randint(0, 59)
        )

    return {
        "timestamp": timestamp,
        "amount": amount,
        "type": txn_type,
        "origin_id": origin_id,
        "dest_id": dest_id,
        "old_balance_org": old_balance_org,
        "new_balance_orig": new_balance_orig,
        "old_balance_dest": old_balance_dest,
        "new_balance_dest": new_balance_dest,
        "merchant_dest": merchant_dest,
        "geo_mismatch": geo_mismatch,
        "velocity": velocity,
        "location": location,
        "ip_address": ip_address,
        "is_fraud": is_fraud
    }

def generate_synthetic_dataset(n_samples=10000):
    """
    Generates a historical dataset of transactions spanning the last 30 days.
    """
    print(f"Generating synthetic dataset of {n_samples} transactions...")
    np.random.seed(42)
    random.seed(42)
    
    start_time = datetime.utcnow() - timedelta(days=30)
    txns = []
    
    for i in range(n_samples):
        # Evenly spread transactions over 30 days
        seconds_offset = random.randint(0, 30 * 24 * 3600)
        txn_time = start_time + timedelta(seconds=seconds_offset)
        
        # 1.5% average fraud rate
        is_fraud = random.random() < 0.015
        txn = generate_single_transaction(is_fraud_override=is_fraud, base_time=txn_time)
        txns.append(txn)
        
    df = pd.DataFrame(txns)
    # Sort by timestamp
    df = df.sort_values(by="timestamp").reset_index(drop=True)
    return df

if __name__ == "__main__":
    df = generate_synthetic_dataset(100)
    print(df.head())
    print("Fraud count:", df["is_fraud"].sum())
