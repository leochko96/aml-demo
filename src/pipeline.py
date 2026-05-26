"""
End-to-end AML alert pipeline: score → explain → narrate → report.

Processes transaction alerts through the full stack:
  1. XGBoost model scores the transaction
  2. SHAP explains which features drove the score
  3. Claude generates a plain-English compliance narrative and recommended action
  4. Output is a structured JSON report for the analyst queue
"""

import json
import logging
import os
import pandas as pd
from pathlib import Path

from explain import explain_alert
from narrative import generate_narrative

logger = logging.getLogger(__name__)

PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"

# Transactions above this amount (in any currency) are always escalated to human review,
# regardless of model score or Claude's assessment.
LARGE_TRANSACTION_THRESHOLD = 500_000


def _score_to_label(score: float) -> str:
    """Convert a raw fraud probability to a human-readable risk label."""
    if score >= 0.7:
        return "Likely true positive"
    elif score >= 0.3:
        return "Review required"
    else:
        return "Likely false positive"


def _get_amount(row, field: str) -> float:
    """Safely extract a numeric amount from a pandas Series or dict-like row."""
    val = row.get(field, 0) if hasattr(row, "get") else getattr(row, field, 0)
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def run_pipeline(alert_row: pd.Series, alert_id: str = None) -> dict:
    """
    Run the full AML pipeline for a single transaction alert.

    Args:
        alert_row: A pandas Series with all feature columns.
        alert_id:  Optional identifier for this alert. Defaults to row index.

    Returns:
        {
          "alert_id": str,
          "score": float,
          "label": str,
          "confidence": str,            # high / medium / low based on distance from 0.5
          "top_features": [...],        # top 5 SHAP features
          "narrative": str,             # Claude's plain-English assessment
          "recommended_action": str     # owned by Claude; overridden if large transaction
        }
    """
    explanation = explain_alert(alert_row)
    score = explanation["score"]

    # Confidence: how far the score is from 0.5 (the decision boundary).
    # A score of 0.95 is high confidence; 0.52 is low confidence.
    distance = abs(score - 0.5)
    if distance >= 0.3:
        confidence = "high"
    elif distance >= 0.15:
        confidence = "medium"
    else:
        confidence = "low"

    narrative = ""
    recommended_action = "Review required"

    try:
        result = generate_narrative(alert_row, explanation)
        narrative = result["narrative"]
        recommended_action = result["recommended_action"]
    except Exception as e:
        if "ANTHROPIC_API_KEY" in str(e) or "authentication" in str(e).lower():
            narrative = (
                "Narrative unavailable: ANTHROPIC_API_KEY environment variable is not set. "
                "Set it and re-run to generate compliance narratives."
            )
        else:
            narrative = f"Narrative generation failed: {str(e)}"
        recommended_action = "Review required"

    # Safety floor: large transactions must go to at least a human review.
    # "Escalate" is preserved — the large amount reinforces escalation rather than
    # overriding it. Only "Dismiss" is upgraded to "Review required".
    amount_paid = _get_amount(alert_row, "amount_paid")
    amount_received = _get_amount(alert_row, "amount_received")
    if max(amount_paid, amount_received) > LARGE_TRANSACTION_THRESHOLD:
        if recommended_action == "Dismiss":
            logger.info(
                "Alert %s: large transaction floor fired (amount_paid=%.2f, "
                "amount_received=%.2f). Upgrading recommended_action from 'Dismiss' to "
                "'Review required'.",
                alert_id, amount_paid, amount_received,
            )
            recommended_action = "Review required"
        else:
            logger.info(
                "Alert %s: large transaction threshold met (amount_paid=%.2f, "
                "amount_received=%.2f). recommended_action is already '%s'.",
                alert_id, amount_paid, amount_received, recommended_action,
            )

    # Label/action consistency check: the XGBoost-derived label acts as a lower bound.
    # A "Likely true positive" or "Review required" label is incompatible with "Dismiss"
    # because that would mean the pipeline is simultaneously flagging and clearing an alert.
    label = _score_to_label(score)
    if recommended_action == "Dismiss" and ("true positive" in label or label == "Review required"):
        logger.warning(
            "Alert %s: label/action contradiction — label '%s' is incompatible with "
            "action 'Dismiss'. Overriding to 'Review required'.",
            alert_id, label,
        )
        recommended_action = "Review required"

    return {
        "alert_id": str(alert_id) if alert_id is not None else "unknown",
        "score": round(score, 4),
        "label": _score_to_label(score),
        "confidence": confidence,
        "top_features": explanation["top_features"],
        "narrative": narrative,
        "recommended_action": recommended_action,
    }


def run_batch(n_samples: int = 50) -> list[dict]:
    """Run pipeline on the first n_samples rows of the test set."""
    test_path = PROCESSED_DIR / "test_features.csv"
    if not test_path.exists():
        raise FileNotFoundError(
            "test_features.csv not found. Run src/train.py first:\n  python src/train.py"
        )

    df = pd.read_csv(test_path).head(n_samples)
    results = []

    for i, (idx, row) in enumerate(df.iterrows()):
        print(f"  Processing alert {i+1}/{n_samples} (index {idx})...", end="\r")
        result = run_pipeline(row, alert_id=idx)
        results.append(result)

    print(f"\n  Done. Processed {len(results)} alerts.")
    return results


def main():
    print("Running AML pipeline on 50 test samples...")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "\nWARNING: ANTHROPIC_API_KEY is not set. Narratives will be skipped.\n"
            "  Set it with: export ANTHROPIC_API_KEY=sk-ant-...\n"
        )

    results = run_batch(n_samples=50)

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUTS_DIR / "sample_predictions.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved {len(results)} predictions to {out_path}")

    labels = [r["label"] for r in results]
    print("\nLabel distribution:")
    for label in ["Likely true positive", "Review required", "Likely false positive"]:
        count = labels.count(label)
        print(f"  {label}: {count}")


if __name__ == "__main__":
    main()
