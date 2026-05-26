"""
Claude API layer: generates plain-English compliance analyst narratives.

IMPORTANT: This module reads ANTHROPIC_API_KEY from the environment.
Never hardcode API keys. Set the key before running:
  export ANTHROPIC_API_KEY=sk-ant-...
"""

import json
import logging
import os

import anthropic

logger = logging.getLogger(__name__)

# anthropic.Anthropic() automatically reads ANTHROPIC_API_KEY from the environment.
# Do not pass the key explicitly — that would risk it appearing in logs or tracebacks.
client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are a compliance analyst assistant at a financial institution. \
Your job is to assess transaction alerts flagged by the AML monitoring system.

Respond ONLY with a valid JSON object in exactly this format, with no other text before or after:
{"narrative": "...", "recommended_action": "..."}

--- ACTION DEFINITIONS ---

"Dismiss": The alert is a likely false positive with no genuine risk factors. \
Missing currency or payment method fields are documentation gaps only — note them in the \
narrative but do NOT use them as a reason to choose "Review required" over "Dismiss". \
Missing data only contributes to escalation when combined with at least one genuine risk \
factor: high jurisdiction risk, high customer tier, anomalous transaction size, or \
contradictory model behaviour.

"Review required": Genuine ambiguity where a human analyst should decide. Use when there \
are conflicting signals or missing data combined with at least one genuine risk factor. \
Do NOT default here just because data fields are missing.

"Escalate": Clear high-risk signals requiring immediate compliance action. Use "Escalate" \
(not "Review required") when ANY of the following are true:
1. Score > 0.80 AND two or more features are risk-increasing.
2. Transaction amount > 100,000 in any currency AND score > 0.50.
3. Counterparty jurisdiction risk > 0.90, regardless of model score.
4. Transaction amount falls within 10% below a round reporting threshold \
(e.g. $9,000–$10,000 or $45,000–$50,000) AND score > 0.30. \
Criterion 4 requires BOTH conditions to be true simultaneously: \
(a) amount within 10% below a round threshold AND (b) score > 0.30. \
If the score is below 0.30, criterion 4 is NOT triggered regardless of the transaction amount.
5. Model behaviour is internally inconsistent: a high-risk input \
(jurisdiction_risk > 0.85) is being scored as risk-lowering AND jurisdiction risk > 0.85.
6. Transaction amount > 1,000,000, regardless of score.

After writing the narrative, re-check every escalation criterion independently. \
If ANY criterion is met, recommended_action MUST be "Escalate", regardless of what \
the narrative reasoning concluded for the overall risk picture.

--- ADDITIONAL RULES ---

Soft review threshold: If transaction amount > 100,000 in any currency AND score < 0.50, \
recommended_action should be "Review required" (not "Dismiss", not "Escalate") unless \
jurisdiction risk is below 0.20 AND customer risk tier is 0 — in that case "Dismiss" \
may be appropriate if all other factors are clearly low risk.

Tier 2 customer minimum: If customer_risk_tier is 2 (highest tier), \
recommended_action must be minimum "Review required", regardless of model score.

--- INSTRUCTIONS ---

The recommended_action MUST be consistent with the narrative reasoning. \
Write the narrative in plain English — no jargon. Reference the specific risk factors provided. \
Keep it defensible for regulators. 3–5 sentences maximum."""

_VALID_ACTIONS = {"Dismiss", "Review required", "Escalate"}


def _build_user_prompt(alert_row, explanation: dict) -> str:
    """Format transaction details and SHAP factors into a structured prompt."""
    score = explanation["score"]
    top = explanation["top_features"][:3]  # only top 3 factors for conciseness

    # Build a readable summary of the top risk drivers
    factor_lines = []
    for f in top:
        direction = "raises" if f["direction"] == "increases_risk" else "lowers"
        factor_lines.append(
            f"  - {f['feature']}: {direction} risk (impact {f['magnitude']:.3f})"
        )
    factors_text = "\n".join(factor_lines) if factor_lines else "  - No significant factors"

    # Pull key transaction fields, using .get() for safety if field is missing
    amount_paid = alert_row.get("amount_paid", "N/A") if hasattr(alert_row, "get") else getattr(alert_row, "amount_paid", "N/A")
    payment_currency = alert_row.get("payment_currency", "N/A") if hasattr(alert_row, "get") else getattr(alert_row, "payment_currency", "N/A")
    payment_format = alert_row.get("payment_format", "N/A") if hasattr(alert_row, "get") else getattr(alert_row, "payment_format", "N/A")
    is_cross = alert_row.get("is_cross_currency", 0) if hasattr(alert_row, "get") else getattr(alert_row, "is_cross_currency", 0)
    cust_risk = alert_row.get("customer_risk_tier", "N/A") if hasattr(alert_row, "get") else getattr(alert_row, "customer_risk_tier", "N/A")
    juris_risk = alert_row.get("counterparty_jurisdiction_risk", "N/A") if hasattr(alert_row, "get") else getattr(alert_row, "counterparty_jurisdiction_risk", "N/A")

    risk_label = (
        "HIGH" if score >= 0.7
        else "MEDIUM" if score >= 0.3
        else "LOW"
    )

    prompt = f"""Transaction Alert — Risk Score: {score:.3f} ({risk_label})

Transaction Details:
  Amount: {amount_paid} {payment_currency}
  Payment method: {payment_format}
  Cross-currency transfer: {"Yes" if is_cross else "No"}
  Customer risk tier: {cust_risk} (0=low, 1=medium, 2=high)
  Counterparty jurisdiction risk: {float(juris_risk):.2f} (0=low, 1=high) if numeric else {juris_risk}

Top risk factors from model:
{factors_text}

Please provide a compliance analyst assessment of this alert."""

    return prompt


def generate_narrative(alert_row, explanation: dict) -> dict:
    """
    Call Claude to generate a compliance assessment and recommended action.

    Args:
        alert_row: pandas Series or dict-like with transaction fields.
        explanation: output of explain.explain_alert() — score + top_features.

    Returns:
        {
          "narrative": str,
          "recommended_action": "Dismiss" | "Review required" | "Escalate"
        }
        On JSON parse failure, logs the raw response and defaults
        recommended_action to "Review required".
    """
    user_prompt = _build_user_prompt(alert_row, explanation)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        temperature=0.3,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_text = response.content[0].text
    # Strip markdown code fences if Claude wraps the JSON despite instructions
    clean_text = raw_text.strip()
    if clean_text.startswith("```"):
        clean_text = clean_text.split("\n", 1)[-1]  # drop opening fence line
        clean_text = clean_text.rsplit("```", 1)[0]  # drop closing fence
        clean_text = clean_text.strip()
    try:
        parsed = json.loads(clean_text)
        narrative = parsed.get("narrative", raw_text)
        recommended_action = parsed.get("recommended_action", "Review required")
        if recommended_action not in _VALID_ACTIONS:
            logger.warning(
                "Claude returned unexpected recommended_action %r; "
                "defaulting to 'Review required'. Raw: %s",
                recommended_action, raw_text,
            )
            recommended_action = "Review required"
        return {"narrative": narrative, "recommended_action": recommended_action}
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error(
            "Failed to parse Claude JSON response (%s). Raw response: %s",
            exc, raw_text,
        )
        return {"narrative": raw_text, "recommended_action": "Review required"}


if __name__ == "__main__":
    # Smoke test with a synthetic alert
    import pandas as pd

    fake_alert = pd.Series({
        "amount_paid": 25000,
        "payment_currency": "USD",
        "payment_format": "Wire",
        "is_cross_currency": 1,
        "customer_risk_tier": 2,
        "counterparty_jurisdiction_risk": 0.85,
    })
    fake_explanation = {
        "score": 0.82,
        "top_features": [
            {"feature": "counterparty_jurisdiction_risk", "direction": "increases_risk", "magnitude": 0.45},
            {"feature": "customer_risk_tier", "direction": "increases_risk", "magnitude": 0.30},
            {"feature": "is_cross_currency", "direction": "increases_risk", "magnitude": 0.18},
        ],
    }

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set — skipping live API call.")
    else:
        result = generate_narrative(fake_alert, fake_explanation)
        print(result["narrative"])
        print(f"Recommended action: {result['recommended_action']}")
