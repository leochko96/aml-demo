"""
Unit tests for the AML pipeline.

All tests mock the Claude API so no real API calls are made.
explain_alert is also mocked so the XGBoost model is not required.

Run with:
  cd aml-demo
  pytest tests/test_pipeline.py -v
"""

import json
import logging
import os
import sys
from pathlib import Path
from unittest import mock

import pandas as pd
import pytest

# Ensure src/ is on the path before any project imports
SRC_DIR = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(SRC_DIR))

# Set a dummy API key before importing narrative so Anthropic() construction succeeds
os.environ.setdefault("ANTHROPIC_API_KEY", "test-dummy-key-for-unit-tests")

import narrative  # noqa: E402 — must come after sys.path and env setup
import pipeline  # noqa: E402
from pipeline import run_pipeline, LARGE_TRANSACTION_THRESHOLD  # noqa: E402
from narrative import generate_narrative  # noqa: E402

OUTPUTS_DIR = Path(__file__).parent.parent / "outputs"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_alert_row(**overrides) -> pd.Series:
    """Return a minimal valid alert row, with any field overridable."""
    defaults = {
        "amount_paid": 5_000,
        "amount_received": 5_000,
        "payment_currency": "USD",
        "receiving_currency": "USD",
        "payment_format": "Wire",
        "is_cross_currency": 0,
        "customer_risk_tier": 0,
        "counterparty_jurisdiction_risk": 0.2,
        "day_of_week": 1,
        "hour_of_day": 10,
        "account_age_days": 730,
        "amount_ratio": 1.0,
        "merchant_category_risk": 1,
    }
    defaults.update(overrides)
    return pd.Series(defaults)


def _fake_explanation(score: float = 0.45) -> dict:
    return {
        "score": score,
        "top_features": [
            {"feature": "amount_paid", "direction": "increases_risk", "magnitude": 0.1}
        ],
    }


def _mock_narrative(narrative_text: str, action: str) -> dict:
    return {"narrative": narrative_text, "recommended_action": action}


# ---------------------------------------------------------------------------
# Test 1 — narrative_action_consistency
# ---------------------------------------------------------------------------

def test_narrative_action_consistency():
    """Pipeline output recommended_action must match what generate_narrative returned.

    Runs across the same 50 alerts used to generate sample_predictions.json.
    The large-transaction override is the only permitted divergence (it forces
    'Review required', which is still safe).
    """
    test_csv = PROCESSED_DIR / "test_features.csv"
    if not test_csv.exists():
        pytest.skip("test_features.csv not found — run src/train.py first")

    df = pd.read_csv(test_csv).head(50)

    for idx, row in df.iterrows():
        expected_action = "Review required"
        mocked_result = _mock_narrative("Test narrative.", expected_action)
        fake_expl = _fake_explanation(score=0.45)

        with mock.patch("pipeline.explain_alert", return_value=fake_expl), \
             mock.patch("pipeline.generate_narrative", return_value=mocked_result):
            result = run_pipeline(row, alert_id=idx)

        # Large-transaction override forces "Review required" — still consistent
        amount_paid = float(row.get("amount_paid", 0))
        amount_received = float(row.get("amount_received", 0))
        large_tx = max(amount_paid, amount_received) > LARGE_TRANSACTION_THRESHOLD

        if large_tx:
            assert result["recommended_action"] == "Review required"
        else:
            assert result["recommended_action"] == expected_action, (
                f"Alert {idx}: pipeline returned '{result['recommended_action']}' "
                f"but generate_narrative returned '{expected_action}'"
            )


# ---------------------------------------------------------------------------
# Test 2 — high_jurisdiction_low_score  (alert 9 regression)
# ---------------------------------------------------------------------------

def test_high_jurisdiction_low_score():
    """score=0.003 + counterparty_jurisdiction_risk=0.96 must NOT produce 'Dismiss'."""
    alert = _make_alert_row(counterparty_jurisdiction_risk=0.96)
    fake_expl = _fake_explanation(score=0.003)
    mocked_result = _mock_narrative(
        "Despite a low model score, the counterparty is in a very high-risk "
        "jurisdiction. This alert requires manual review.",
        "Review required",
    )

    with mock.patch("pipeline.explain_alert", return_value=fake_expl), \
         mock.patch("pipeline.generate_narrative", return_value=mocked_result):
        result = run_pipeline(alert, alert_id=9)

    assert result["recommended_action"] != "Dismiss", (
        f"Alert 9: expected NOT 'Dismiss' for high jurisdiction risk, "
        f"got '{result['recommended_action']}'"
    )


# ---------------------------------------------------------------------------
# Test 3 — high_risk_customer_low_score  (alert 26 regression)
# ---------------------------------------------------------------------------

def test_high_risk_customer_low_score():
    """score=0.046 + customer_risk_tier=2 + jurisdiction=0.60 must NOT produce 'Dismiss'."""
    alert = _make_alert_row(customer_risk_tier=2, counterparty_jurisdiction_risk=0.60)
    fake_expl = _fake_explanation(score=0.046)
    mocked_result = _mock_narrative(
        "This customer is classified as high risk tier 2. Even with a low model "
        "score, the elevated customer risk warrants manual review.",
        "Review required",
    )

    with mock.patch("pipeline.explain_alert", return_value=fake_expl), \
         mock.patch("pipeline.generate_narrative", return_value=mocked_result):
        result = run_pipeline(alert, alert_id=26)

    assert result["recommended_action"] != "Dismiss", (
        f"Alert 26: expected NOT 'Dismiss' for high-risk customer, "
        f"got '{result['recommended_action']}'"
    )


# ---------------------------------------------------------------------------
# Test 4 — large_transaction_override
# ---------------------------------------------------------------------------

def test_large_transaction_override(caplog):
    """amount_paid=28,100,000 must override to 'Review required' and emit a log."""
    alert = _make_alert_row(amount_paid=28_100_000, amount_received=28_100_000)
    fake_expl = _fake_explanation(score=0.1)
    # Claude says Dismiss — override must fire regardless
    mocked_result = _mock_narrative("This transaction appears legitimate.", "Dismiss")

    with caplog.at_level(logging.INFO, logger="pipeline"), \
         mock.patch("pipeline.explain_alert", return_value=fake_expl), \
         mock.patch("pipeline.generate_narrative", return_value=mocked_result):
        result = run_pipeline(alert, alert_id="test-large")

    assert result["recommended_action"] == "Review required", (
        f"Expected 'Review required' after large-tx override, "
        f"got '{result['recommended_action']}'"
    )
    assert "large transaction" in caplog.text.lower(), (
        "Expected a log message about the large transaction threshold"
    )


# ---------------------------------------------------------------------------
# Test 5 — narrative_action_no_contradiction
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("score,narrative_text,action,forbidden", [
    (0.80, "This transaction requires enhanced due diligence given the risk profile.", "Review required", "Dismiss"),
    (0.90, "We recommend escalating this for SAR consideration.", "Escalate", "Dismiss"),
    (0.70, "This alert should be escalated to the compliance team.", "Escalate", "Dismiss"),
    (0.10, "No further review required; this appears to be a legitimate transaction.", "Dismiss", "Escalate"),
    (0.05, "You can clear the alert as no suspicious activity was detected.", "Dismiss", "Escalate"),
    (0.50, "Conflicting signals present — SAR investigation warranted.", "Escalate", "Dismiss"),
    (0.30, "This transaction warrants enhanced due diligence from the analyst team.", "Review required", "Dismiss"),
    (0.60, "Manual review required due to ambiguous counterparty signals.", "Review required", "Dismiss"),
    (0.20, "No further review required for this low-risk transfer.", "Dismiss", "Escalate"),
    (0.95, "Clear risk indicators present; escalate immediately for SAR filing.", "Escalate", "Dismiss"),
])
def test_narrative_action_no_contradiction(score, narrative_text, action, forbidden):
    """Narrative keyword content must never contradict recommended_action."""
    alert = _make_alert_row()
    fake_expl = _fake_explanation(score=score)
    mocked_result = _mock_narrative(narrative_text, action)

    with mock.patch("pipeline.explain_alert", return_value=fake_expl), \
         mock.patch("pipeline.generate_narrative", return_value=mocked_result):
        result = run_pipeline(alert)

    rec = result["recommended_action"]
    text = result["narrative"].lower()

    # Escalation language → must never be Dismiss
    escalation_phrases = ["enhanced due diligence", "escalate", "sar"]
    if any(p in text for p in escalation_phrases):
        assert rec != "Dismiss", (
            f"Narrative contains escalation language but action is '{rec}': {narrative_text}"
        )

    # Clear/dismiss language → must never be Escalate
    clear_phrases = ["no further review required", "clear the alert"]
    if any(p in text for p in clear_phrases):
        assert rec != "Escalate", (
            f"Narrative contains clear language but action is '{rec}': {narrative_text}"
        )

    # The mocked action must have passed through (not replaced with the forbidden one)
    assert rec != forbidden, (
        f"Action should not be '{forbidden}' when narrative says: {narrative_text}"
    )


# ---------------------------------------------------------------------------
# Test 6 — json_parse_failure_defaults_to_review
# ---------------------------------------------------------------------------

def test_json_parse_failure_defaults_to_review(caplog):
    """Malformed JSON from Claude must not crash and must default to 'Review required'."""
    mock_response = mock.MagicMock()
    mock_response.content = [mock.MagicMock()]
    mock_response.content[0].text = "This is plain text, not JSON at all."

    alert = _make_alert_row()
    fake_explanation = _fake_explanation(score=0.3)

    with caplog.at_level(logging.ERROR, logger="narrative"), \
         mock.patch.object(narrative.client.messages, "create", return_value=mock_response):
        result = generate_narrative(alert, fake_explanation)

    assert result["recommended_action"] == "Review required", (
        f"Expected 'Review required' on parse failure, got '{result['recommended_action']}'"
    )
    assert "narrative" in result
    assert any(
        "parse" in r.getMessage().lower() or "json" in r.getMessage().lower()
        for r in caplog.records
    ), "Expected an error log message about JSON parse failure"
