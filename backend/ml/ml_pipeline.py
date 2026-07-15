import os
import json
import hmac
import hashlib
import joblib
import pandas as pd
import numpy as np
import shap
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# 1. Establish Database Connection
def get_db_engine():
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
    else:
        load_dotenv()

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment variables.")
    
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
    return create_engine(database_url, pool_pre_ping=True)

# 2. SQL Query to fetch raw metrics AND webhook configs
def fetch_feature_data(engine):
    query = """
    WITH business_stats AS (
        SELECT 
            business_id, 
            AVG(monthly_contract_value) AS avg_mcv
        FROM customers
        GROUP BY business_id
    ),
    events_30d AS (
        SELECT 
            business_id,
            external_user_id,
            COUNT(*) AS total_events_30d,
            MAX(created_at) AS last_event_time,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS events_7d,
            COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' AND standardized_metric_type = 'ENGAGEMENT_DROP' THEN 1 END) AS negative_events_7d
        FROM usage_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY business_id, external_user_id
    )
    SELECT 
        c.id AS customer_id,
        c.business_id,
        c.external_user_id,
        c.monthly_contract_value,
        c.webhook_fired_at,
        b.webhook_url,
        b.webhook_secret,
        COALESCE(bs.avg_mcv, 1.0) AS business_avg_mcv,
        COALESCE(e.total_events_30d, 0) AS total_events_30d,
        COALESCE(e.events_7d, 0) AS events_7d,
        COALESCE(e.negative_events_7d, 0) AS negative_events_7d,
        e.last_event_time
    FROM customers c
    JOIN businesses b ON c.business_id = b.id
    LEFT JOIN business_stats bs ON c.business_id = bs.business_id
    LEFT JOIN events_30d e ON c.business_id = e.business_id AND c.external_user_id = e.external_user_id
    """
    return pd.read_sql(query, engine)

# 3. Feature Engineering
def compute_features(df):
    df = df.copy()
    weekly_avg = (df['total_events_30d'] / 30.0) * 7.0
    df['engagement_delta_7d'] = (df['events_7d'] + 0.001) / (weekly_avg + 0.001)
    df['negative_event_ratio'] = (df['negative_events_7d'] + 0.001) / (df['events_7d'] + 0.001)

    now_utc = pd.Timestamp.now(tz='UTC')
    def calc_days(x):
        if pd.isnull(x):
            return 30.0
        dt = pd.to_datetime(x)
        if dt.tzinfo is None:
            dt = dt.tz_localize('UTC')
        else:
            dt = dt.tz_convert('UTC')
        return (now_utc - dt).total_seconds() / 86400.0

    df['days_since_last_interaction'] = df['last_event_time'].apply(calc_days)
    df['contract_weight_index'] = df['monthly_contract_value'].astype(float) / df['business_avg_mcv'].astype(float)
    return df

# 4. Generate explanations
def make_explanation_label(feature, val, shap_val):
    if feature == 'engagement_delta_7d':
        if val < 0.5:
            percent_drop = round((1 - val) * 100)
            return f"Weekly activity dropped by {percent_drop}% compared to 30-day average."
        else:
            return "Weekly usage frequency is stable or higher than normal."
    elif feature == 'negative_event_ratio':
        if val > 0.05:
            percent_neg = round(val * 100)
            return f"Elevated ratio of negative feedback/error events ({percent_neg}% of total)."
        else:
            return "Low occurrence of platform failure or drop-off events."
    elif feature == 'days_since_last_interaction':
        days = round(val, 1)
        return f"No tracked platform interaction in the last {days} days."
    elif feature == 'contract_weight_index':
        if val > 1.2:
            pct_diff = round((val - 1) * 100)
            return f"High-value account: Monthly revenue value is {pct_diff}% higher than average."
        else:
            return "Monthly contract value aligns with average client accounts."
    return f"{feature}: Value is {val}"

# 5. HMAC Signing and HTTP POST Request Execution
def fire_webhook(url, secret, payload):
    payload_str = json.dumps(payload)
    
    # Calculate HMAC SHA256 Signature
    signature = hmac.new(
        secret.encode('utf-8'),
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    headers = {
        "Content-Type": "application/json",
        "X-ChurnShield-Signature": f"sha256={signature}"
    }
    
    try:
        response = requests.post(url, data=payload_str, headers=headers, timeout=5)
        response.raise_for_status()
        print(f"Successfully sent Webhook alert to {url} for customer {payload['external_user_id']}.")
        return True
    except Exception as e:
        print(f"Failed sending Webhook to {url} for customer {payload['external_user_id']}: {e}")
        return False

# 6. Prediction and Alert Trigger Loop
def run_pipeline():
    print("Initializing Nightly Prediction and Webhook Pipeline...")
    engine = get_db_engine()
    
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'churnshield_v1.joblib')
    if not os.path.exists(model_path):
        print(f"Error: Model file '{model_path}' not found. Train it first using 'train_model.py'.")
        return

    model = joblib.load(model_path)
    raw_df = fetch_feature_data(engine)
    if raw_df.empty:
        print("No customers found in database. Pipeline terminating.")
        return
        
    df = compute_features(raw_df)
    features = ['engagement_delta_7d', 'negative_event_ratio', 'days_since_last_interaction', 'contract_weight_index']

    predictions_results = []
    
    # Apply Inactivity rule (>14 days inactive)
    inactive_mask = df['days_since_last_interaction'] > 14
    inactive_df = df[inactive_mask]
    active_df = df[~inactive_mask]

    # Process Inactive customers
    for _, row in inactive_df.iterrows():
        explanation = [{
            "feature": "days_since_last_interaction",
            "value": round(row['days_since_last_interaction'], 1),
            "impact": 1.0,
            "label": f"Critical inactivity: No activity recorded for over 14 days ({round(row['days_since_last_interaction'], 1)} days)."
        }]
        predictions_results.append({
            "customer_id": row['customer_id'],
            "external_user_id": row['external_user_id'],
            "monthly_contract_value": float(row['monthly_contract_value']),
            "business_id": row['business_id'],
            "churn_risk_probability": 1.0,
            "risk_classification_status": "CRITICAL",
            "shap_explanation": explanation,
            "webhook_url": row['webhook_url'],
            "webhook_secret": row['webhook_secret'],
            "webhook_fired_at": row['webhook_fired_at']
        })

    # Process Active customers using Model + SHAP
    if not active_df.empty:
        X_active = active_df[features]
        probs = model.predict_proba(X_active)[:, 1] if hasattr(model, 'predict_proba') else model.predict(X_active)
        
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_active)

        if isinstance(shap_values, list):
            shap_matrix = shap_values[1] if len(shap_values) > 1 else shap_values[0]
        elif len(shap_values.shape) == 3:
            shap_matrix = shap_values[:, :, 1]
        else:
            shap_matrix = shap_values

        for idx, (_, row) in enumerate(active_df.iterrows()):
            prob = float(probs[idx])
            status = "HEALTHY"
            if prob >= 0.75:
                status = "CRITICAL"
            elif prob >= 0.40:
                status = "AT_RISK"

            shap_exps = []
            for f_idx, f_name in enumerate(features):
                val = float(row[f_name])
                impact = float(shap_matrix[idx, f_idx])
                shap_exps.append({
                    "feature": f_name,
                    "value": round(val, 3),
                    "impact": round(impact, 4),
                    "label": make_explanation_label(f_name, val, impact)
                })

            shap_exps = sorted(shap_exps, key=lambda x: x['impact'], reverse=True)[:3]

            predictions_results.append({
                "customer_id": row['customer_id'],
                "external_user_id": row['external_user_id'],
                "monthly_contract_value": float(row['monthly_contract_value']),
                "business_id": row['business_id'],
                "churn_risk_probability": prob,
                "risk_classification_status": status,
                "shap_explanation": shap_exps,
                "webhook_url": row['webhook_url'],
                "webhook_secret": row['webhook_secret'],
                "webhook_fired_at": row['webhook_fired_at']
            })

    # Execute Webhooks & Prepare SQL Updates
    now_ts = pd.Timestamp.now(tz='UTC')
    
    print("Processing webhook triggers and updates...")
    for res in predictions_results:
        # Check if score crosses critical threshold (0.75) and webhooks are configured
        if res['churn_risk_probability'] >= 0.75 and res['webhook_url']:
            # Fire webhook ONLY if we haven't already fired an alert (webhook_fired_at is null)
            if pd.isnull(res['webhook_fired_at']):
                payload = {
                    "event": "churn_alert",
                    "business_id": str(res['business_id']),
                    "customer_id": str(res['customer_id']),
                    "external_user_id": res['external_user_id'],
                    "monthly_contract_value": res['monthly_contract_value'],
                    "churn_risk_probability": round(res['churn_risk_probability'], 4),
                    "risk_classification_status": res['risk_classification_status'],
                    "fired_at": now_ts.isoformat(),
                    "shap_explanation": res['shap_explanation']
                }
                
                secret = res['webhook_secret'] if res['webhook_secret'] else "default_secret"
                success = fire_webhook(res['webhook_url'], secret, payload)
                if success:
                    res['webhook_fired_at'] = now_ts
            else:
                # Webhook has already been fired for this critical status, skip sending again
                pass
        
        # Reset firing trigger if the risk drops below critical (0.75)
        elif res['churn_risk_probability'] < 0.75:
            res['webhook_fired_at'] = None

    # Write changes to PostgreSQL
    print(f"Updating risk scores and explanations in database...")
    with engine.begin() as conn:
        for res in predictions_results:
            # Convert timestamp to timestamp string or None for SQL insertion
            fired_at_val = res['webhook_fired_at'].isoformat() if res['webhook_fired_at'] is not None else None
            
            # Write changes to PostgreSQL
            conn.execute(
                text("""
                    UPDATE customers
                    SET churn_risk_probability = :prob,
                        risk_classification_status = :status,
                        shap_explanation = :shap,
                        webhook_fired_at = :fired_at,
                        last_computed_at = NOW()
                    WHERE id = :id
                """),
                {
                    "prob": res['churn_risk_probability'],
                    "status": res['risk_classification_status'],
                    "shap": json.dumps(res['shap_explanation']),
                    "fired_at": fired_at_val,
                    "id": res['customer_id']
                }
            )

            # Log score to time-series history table (Day 7 Addition)
            conn.execute(
                text("""
                    INSERT INTO customer_risk_history (customer_id, business_id, churn_risk_probability)
                    VALUES (:id, :business_id, :prob)
                """),
                {
                    "id": res['customer_id'],
                    "business_id": res['business_id'],
                    "prob": res['churn_risk_probability']
                }
            )
    print("Database updates finished successfully.")

if __name__ == "__main__":
    run_pipeline()