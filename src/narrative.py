"""
Claude API layer: generates plain-English compliance analyst narratives.

IMPORTANT: This module reads ANTHROPIC_API_KEY from the environment.
Never hardcode API keys. Set the key before running:
  export ANTHROPIC_API_KEY=sk-ant-...
"""

import anthropic
import os

# anthropic.Anthropic() automatically reads ANTHROPIC_API_KEY from the environment.
# Do not pass the key explicitly — that would risk it appearing in logs or tracebacks.
client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are a compliance analyst assistant at a financial institution. \
Your job is to assess transaction alerts flagged by the AML monitoring system.

Write in plain English — no jargon. Reference the specific risk factors provided. \
Give a clear recommended action. Keep it defensible for regulators. \
Respond in 3–5 sentences maximum."""


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


def generate_narrative(alert_row, explanation: dict) -> str:
    """
    Call Claude to generate a plain-English compliance assessment.

    Args:
        alert_row: pandas Series or dict-like with transaction fields.
        explanation: output of explain.explain_alert() — score + top_features.

    Returns:
        A 3–5 sentence narrative string suitable for a compliance analyst report.
    """
    user_prompt = _build_user_prompt(alert_row, explanation)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        temperature=0.3,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    return response.content[0].text


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
        narrative = generate_narrative(fake_alert, fake_explanation)
        print(narrative)
