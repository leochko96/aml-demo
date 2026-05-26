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
  thresholds
- On parse failure, default to "Review required" (never "Dismiss")
- Transactions over 500,000 in any currency → override to 
  "Review required" regardless of score

## Three-tier action definitions

**"Dismiss"**: Low risk, no genuine anomalous factors. Missing currency 
or payment method fields are documentation gaps only — note them in the 
narrative but do NOT use them as a reason to escalate. Missing data 
alone is insufficient to choose "Review required" over "Dismiss".

**"Review required"**: Genuine ambiguity where a human analyst should 
decide. Use when there are conflicting signals, OR when missing data is 
combined with at least one genuine risk factor (high jurisdiction risk, 
high customer tier, anomalous transaction size, or contradictory model 
behaviour).

**"Escalate"**: Clear high-risk signals requiring immediate compliance 
action. Must be used (not "Review required") when ANY of the following 
are true:
1. Score > 0.80 AND two or more features are risk-increasing
2. Transaction amount > 100,000 in any currency AND score > 0.50
3. Counterparty jurisdiction risk > 0.90, regardless of model score
4. Transaction amount falls within 10% below a round reporting threshold
   (e.g. $9,000–$10,000 or $45,000–$50,000) AND score > 0.30
5. Model behaviour is internally inconsistent: a high-risk input
   (jurisdiction_risk > 0.80) is being scored as risk-lowering AND
   jurisdiction risk > 0.80
6. Transaction amount > 1,000,000, regardless of score

## Missing data handling
Missing currency or payment method fields ("N/A") are dataset artefacts.
Note them in the narrative as documentation gaps. Do NOT treat them as 
escalation triggers on their own. They only contribute to "Review 
required" when combined with at least one genuine risk factor.

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

## Version history
- v1: recommended_action derived from score thresholds independently 
  of narrative — caused contradictions in alerts 9 and 26
- v2: fixed ownership (Claude owns the action), but over-triggered 
  "Review required" on missing data fields — ~45/50 alerts were 
  "Review required"
- v3: refined escalation criteria with explicit Escalate rules, 
  demoted missing data fields to documentation gaps only — 
  outputs/sample_predictions_v3.json is the current baseline

## Do not change
- Model choice (XGBoost + SHAP + Claude)
- Core feature set in features.py
- The IBM dataset processing logic in train.py
- temperature and max_tokens settings unless explicitly instructed
