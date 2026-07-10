import sys
import os
import json
import joblib
import pandas as pd

def main():
    try:
        # Expect arguments: simulate_inference.py <engagement_delta_7d> <negative_event_ratio> <days_since_last_interaction> <contract_weight_index>
        if len(sys.argv) < 5:
            print(json.dumps({"error": "Insufficient arguments. Expected 4 feature values."}))
            return

        features = [
            float(sys.argv[1]),
            float(sys.argv[2]),
            float(sys.argv[3]),
            float(sys.argv[4])
        ]

        model_path = os.path.join(os.path.dirname(__file__), 'models', 'churnshield_v1.joblib')
        if not os.path.exists(model_path):
            print(json.dumps({"error": f"ML Model file not found at {model_path}. Train it first."}))
            return

        model = joblib.load(model_path)
        
        # Format as input DataFrame
        columns = ['engagement_delta_7d', 'negative_event_ratio', 'days_since_last_interaction', 'contract_weight_index']
        X = pd.DataFrame([features], columns=columns)

        # 14-day Inactivity Hard Rule override
        if features[2] > 14:
            prob = 1.0
        else:
            prob = float(model.predict_proba(X)[:, 1][0])

        print(json.dumps({"churn_risk_probability": prob}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()