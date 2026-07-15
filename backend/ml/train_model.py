import os
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, classification_report
import xgboost as xgb

# Import pipeline helper functions
from ml_pipeline import get_db_engine, fetch_feature_data, compute_features

def main():
    print("Starting Model Training Script...")
    engine = get_db_engine()
    
    # 1. Fetch raw data
    print("Fetching training dataset from database...")
    raw_df = fetch_feature_data(engine)
    if raw_df.empty:
        print("Error: No customer data found in the database. Please seed the database first.")
        return

    # 2. Compute features
    print(f"Fetched {len(raw_df)} customers. Computing features...")
    df = compute_features(raw_df)

    # 3. Label customers: Customers whose external_user_id suffix is divisible by 4 are churners (i % 4 == 0)
    def label_customer(row):
        try:
            parts = row['external_user_id'].split('_')
            if len(parts) > 1 and int(parts[1]) % 4 == 0:
                return 1
        except Exception:
            pass
        return 0

    df['is_churned'] = df.apply(label_customer, axis=1)

    features = ['engagement_delta_7d', 'negative_event_ratio', 'days_since_last_interaction', 'contract_weight_index']
    X = df[features]
    y = df['is_churned']

    print(f"Feature dataset shape: {X.shape}")
    print(f"Target distribution (0=Healthy, 1=Churned): {y.value_counts(normalize=True).to_dict()}")

    # 4. Train/Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 5. Train RandomForest Classifier (Baseline)
    print("\nTraining RandomForestClassifier...")
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=5)
    rf_model.fit(X_train, y_train)

    rf_preds = rf_model.predict(X_test)
    rf_f1 = f1_score(y_test, rf_preds)
    print(f"RandomForest Test F1-Score: {rf_f1:.4f}")

    model = rf_model
    model_type = "RandomForest"

    # 6. Upgrade to XGBoost if RandomForest performance does not meet F1 >= 0.85
    if rf_f1 < 0.85:
        print("\nRandomForest F1-Score is below 0.85. Upgrading to XGBoost...")
        xgb_model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.1,
            random_state=42,
            eval_metric='logloss'
        )
        xgb_model.fit(X_train, y_train)
        xgb_preds = xgb_model.predict(X_test)
        xgb_f1 = f1_score(y_test, xgb_preds)
        print(f"XGBoost Test F1-Score: {xgb_f1:.4f}")
        
        if xgb_f1 >= rf_f1:
            model = xgb_model
            model_type = "XGBoost"
            print("Selected XGBoost as the final model.")
        else:
            print("Selected RandomForest as final model (outperformed XGBoost).")
    else:
        print("RandomForest met F1 targets. Selected RandomForest.")

    # Final validation report
    final_preds = model.predict(X_test)
    print("\nFinal Model Classification Report:")
    print(classification_report(y_test, final_preds))

    # 7. Save trained model
    models_dir = os.path.join(os.path.dirname(__file__), 'models')
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, 'churnshield_v1.joblib')
    
    print(f"Saving model file to: {model_path}")
    joblib.dump(model, model_path)
    print("Model training script completed successfully!")

if __name__ == "__main__":
    main()