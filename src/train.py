"""
Train an XGBoost binary classifier to detect money laundering.

Key decisions explained:
- scale_pos_weight: The IBM dataset is heavily imbalanced (~17% fraud). This parameter
  tells XGBoost to weight each positive (fraud) sample as if it appeared N times more
  often, where N = count(legit) / count(fraud). This prevents the model from just
  predicting "legit" for everything.
- Stratified split: Keeps the same fraud-to-legit ratio in both train and test sets.
- Hyperparameters: Conservative defaults (max_depth=6, subsample=0.8) to avoid
  overfitting on the synthetic features.
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
MODELS_DIR = Path(__file__).parent.parent / "models"

# Features the model uses — excludes raw IDs, timestamps, and the label
FEATURE_COLUMNS = [
    "amount_received",
    "amount_paid",
    "amount_ratio",
    "is_cross_currency",
    "day_of_week",
    "hour_of_day",
    "customer_risk_tier",
    "merchant_category_risk",
    "counterparty_jurisdiction_risk",
    "account_age_days",
]

LABEL_COLUMN = "is_laundering"


def load_features() -> pd.DataFrame:
    features_path = PROCESSED_DIR / "features.csv"
    if not features_path.exists():
        raise FileNotFoundError(
            "features.csv not found. Run src/features.py first:\n"
            "  python src/features.py"
        )
    return pd.read_csv(features_path)


def build_model(scale_pos_weight: float) -> XGBClassifier:
    """Construct the XGBoost classifier.

    - n_estimators=200: number of trees. More trees = more accuracy but slower.
    - max_depth=6: how deep each tree can grow. Deeper = captures more patterns
      but risks memorizing noise.
    - learning_rate=0.1: how much each tree corrects the previous one's mistakes.
      Lower = safer but needs more trees.
    - subsample=0.8: each tree only sees 80% of training rows, randomly selected.
      Prevents any one tree from dominating.
    - colsample_bytree=0.8: each tree only sees 80% of features. Adds diversity.
    - eval_metric="auc": optimise for area under the ROC curve internally.
    """
    return XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        eval_metric="auc",
        use_label_encoder=False,
        random_state=42,
        n_jobs=-1,
    )


def main():
    print("Loading feature matrix...")
    df = load_features()

    X = df[FEATURE_COLUMNS]
    y = df[LABEL_COLUMN]

    print(f"  Total samples: {len(df):,}")
    print(f"  Fraud samples: {y.sum():,} ({y.mean():.1%})")

    # Stratified split preserves the fraud ratio in both train and test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")

    # scale_pos_weight compensates for the class imbalance
    n_neg = (y_train == 0).sum()
    n_pos = (y_train == 1).sum()
    spw = n_neg / n_pos
    print(f"  scale_pos_weight: {spw:.2f} ({n_neg:,} legit / {n_pos:,} fraud)")

    print("\nTraining XGBoost model...")
    model = build_model(scale_pos_weight=spw)
    model.fit(X_train, y_train)

    print("\n--- Evaluation on held-out test set ---")
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    print(classification_report(y_test, y_pred, target_names=["Legit", "Fraud"]))

    auc = roc_auc_score(y_test, y_prob)
    print(f"AUC-ROC: {auc:.4f}")

    if auc < 0.85:
        print("WARNING: AUC-ROC is below target of 0.85. Consider tuning hyperparameters.")
    else:
        print("AUC-ROC target (>0.85) met.")

    # Save model and feature list so explain.py and pipeline.py can reload them
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / "xgb_model.json"
    model.save_model(str(model_path))
    print(f"\nModel saved to {model_path}")

    feature_path = MODELS_DIR / "feature_names.json"
    with open(feature_path, "w") as f:
        json.dump(FEATURE_COLUMNS, f)
    print(f"Feature names saved to {feature_path}")

    # Save the test set for pipeline.py to run predictions on
    test_df = X_test.copy()
    test_df[LABEL_COLUMN] = y_test.values
    test_path = PROCESSED_DIR / "test_features.csv"
    test_df.to_csv(test_path, index=False)
    print(f"Test features saved to {test_path}")


if __name__ == "__main__":
    main()
