"""
SHAP-based explainability for the XGBoost AML model.

SHAP (SHapley Additive exPlanations) answers the question: "For this specific
transaction, how much did each feature push the fraud score up or down?"

A positive SHAP value means that feature increased the fraud probability.
A negative SHAP value means it decreased it (i.e., made the transaction look
more legitimate).

TreeExplainer is the right SHAP explainer for tree-based models (XGBoost,
LightGBM, RandomForest). It's exact and fast — no approximations needed.
"""

import json
import numpy as np
import pandas as pd
import shap
from pathlib import Path
from xgboost import XGBClassifier

MODELS_DIR = Path(__file__).parent.parent / "models"

_model = None
_explainer = None
_feature_names = None


def _load_model_and_explainer():
    """Lazy-load so imports don't block when the model file doesn't exist yet."""
    global _model, _explainer, _feature_names

    if _model is not None:
        return

    model_path = MODELS_DIR / "xgb_model.json"
    feature_path = MODELS_DIR / "feature_names.json"

    if not model_path.exists():
        raise FileNotFoundError(
            "Model not found. Run src/train.py first:\n  python src/train.py"
        )

    _model = XGBClassifier()
    _model.load_model(str(model_path))

    with open(feature_path) as f:
        _feature_names = json.load(f)

    # TreeExplainer computes exact SHAP values using the tree structure directly.
    # It's much faster and more accurate than KernelExplainer for tree models.
    _explainer = shap.TreeExplainer(_model)


def explain_alert(alert_row: pd.Series | pd.DataFrame) -> dict:
    """
    Compute a SHAP explanation for a single transaction alert.

    Args:
        alert_row: A pandas Series or single-row DataFrame with feature values.
                   Must contain all columns in feature_names.json.

    Returns:
        {
          "score": float,          # model's fraud probability (0.0–1.0)
          "top_features": [
            {
              "feature": str,
              "direction": "increases_risk" | "decreases_risk",
              "magnitude": float   # absolute SHAP value, always positive
            },
            ...                    # sorted descending by magnitude, top 5
          ]
        }
    """
    _load_model_and_explainer()

    # Normalise to DataFrame so SHAP gets a consistent input shape
    if isinstance(alert_row, pd.Series):
        row_df = alert_row[_feature_names].to_frame().T
    else:
        row_df = alert_row[_feature_names]

    # shap_values shape for binary classification: (n_samples, n_features)
    # We want the values for the positive class (fraud), index [0] for single row.
    shap_values = _explainer.shap_values(row_df)

    # XGBoost with TreeExplainer returns a 2D array (n_samples, n_features)
    if isinstance(shap_values, list):
        # Older SHAP versions return a list of [neg_class, pos_class]
        sv = shap_values[1][0]
    else:
        sv = shap_values[0]

    fraud_score = float(_model.predict_proba(row_df)[0, 1])

    # Build feature importance list, sorted by absolute impact
    feature_impacts = []
    for feat, val in zip(_feature_names, sv):
        feature_impacts.append({
            "feature": feat,
            "direction": "increases_risk" if val > 0 else "decreases_risk",
            "magnitude": float(abs(val)),
            "_raw_shap": float(val),
        })

    feature_impacts.sort(key=lambda x: x["magnitude"], reverse=True)

    # Strip the internal _raw_shap field before returning
    top_features = [
        {k: v for k, v in f.items() if k != "_raw_shap"}
        for f in feature_impacts[:5]
    ]

    return {
        "score": fraud_score,
        "top_features": top_features,
    }


if __name__ == "__main__":
    # Quick smoke test: load the test set and explain the first row
    from pathlib import Path
    test_path = Path(__file__).parent.parent / "data" / "processed" / "test_features.csv"
    df = pd.read_csv(test_path)
    result = explain_alert(df.iloc[0])
    print(f"Score: {result['score']:.4f}")
    for f in result["top_features"]:
        print(f"  {f['feature']}: {f['direction']} (magnitude {f['magnitude']:.4f})")
