# AML Demo — Claude Code Context

## What this project is
An AML false positive reduction pipeline for a fintech compliance 
demo. Takes an alert row, returns a risk score, SHAP feature 
attribution, and a plain-English compliance narrative.

## Project structure
- src/features.py     — feature engineering on IBM AML dataset
- src/train.py        — XGBoost classifier training
- src/explain.py      — SHAP TreeExplainer, exposes explain_alert()
- src/narrative.py    — Claude API call, exposes generate_narrative()
- src/pipeline.py     — end-to-end: alert row → JSON output
- tests/              — pytest unit tests
- data/raw/           — IBM AML dataset CSVs (not committed to git)
- data/processed/     — engineered features CSV
- models/             — saved XGBoost model (xgb_model.json)
- outputs/            — pipeline output JSONs

## Key conventions
- Python 3.11+
- All ML decisions explained in plain English in code comments
- Never hardcode API keys — use ANTHROPIC_API_KEY env variable
- Model: claude-sonnet-4-6, temperature: 0.3, max_tokens: 400
- recommended_action must always come from Claude, never from score 
  thresholds — this is a known bug that was fixed in v2
- On parse failure, default to "Review required" (never "Dismiss")
- Transactions over 500,000 in any currency → override to 
  "Review required" regardless of score

## Output JSON schema
{
  "alert_id": str,
  "score": float,
  "label": str,
  "confidence": str,
  "top_features": [
    {"feature": str, "direction": str, "magnitude": float}
  ],
  "narrative": str,
  "recommended_action": "Dismiss" | "Review required" | "Escalate"
}

## Testing
- pytest for all tests
- Mock Claude API in all tests — no real API calls in test suite
- Test files in tests/
- Run with: pytest tests/ -v

## Current known issues (as of last session)
- v1 pipeline had recommended_action derived from score thresholds 
  independently of narrative — this caused contradictions in alerts 
  9 and 26. Fixed in v2.

## Do not change
- Model choice (XGBoost + SHAP + Claude)
- Core feature set in features.py
- The IBM dataset processing logic in train.py
- temperature and max_tokens settings unless explicitly instructed