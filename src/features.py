"""
Feature engineering for the IBM AML dataset.

The IBM dataset has a quirk: both the sender and receiver columns are named "Account",
so we rename all columns explicitly on load to avoid ambiguity.

Synthetic features are added to simulate the kind of risk signals a real AML system
would pull from CRM, KYC, and sanctions databases. They use fixed random seeds so
results are reproducible across runs.
"""

import pandas as pd
import numpy as np
from pathlib import Path

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"

# IBM HI-Small dataset filename — place this file in data/raw/ before running
IBM_FILENAME = "HI-Small_Trans.csv"

# Explicit column names to handle the duplicate "Account" column in the IBM CSV
IBM_COLUMNS = [
    "timestamp",
    "from_bank",
    "from_account",
    "to_bank",
    "to_account",
    "amount_received",
    "receiving_currency",
    "amount_paid",
    "payment_currency",
    "payment_format",
    "is_laundering",
]

# payment_format → risk tier: 0=low, 1=medium, 2=high
# Cash and crypto are hardest to trace; wire/cheque have moderate audit trails;
# credit card and ACH have the strongest paper trails.
PAYMENT_FORMAT_RISK = {
    "Cash": 2,
    "Bitcoin": 2,
    "Wire": 1,
    "Cheque": 1,
    "Credit Card": 0,
    "ACH": 0,
    "Reinvestment": 0,
    "Other": 1,
}


def load_raw_data() -> pd.DataFrame:
    """Load raw IBM CSV with explicit column names to handle the duplicate Account column."""
    raw_path = RAW_DIR / IBM_FILENAME
    if not raw_path.exists():
        raise FileNotFoundError(
            f"IBM dataset not found. Please download HI-Small_Trans.csv from Kaggle "
            f"(search: 'IBM Transaction for Anti Money Laundering AML') and place it at:\n"
            f"  {raw_path}"
        )
    df = pd.read_csv(raw_path, header=0)
    df.columns = IBM_COLUMNS
    return df


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """Extract day-of-week and hour from the timestamp string."""
    dt = pd.to_datetime(df["timestamp"])
    # day_of_week: 0=Monday … 6=Sunday. Weekend transactions are a weak fraud signal.
    df["day_of_week"] = dt.dt.dayofweek
    df["hour_of_day"] = dt.dt.hour
    return df


def add_currency_feature(df: pd.DataFrame) -> pd.DataFrame:
    """Flag transactions where the payment currency differs from the receiving currency.
    Currency conversion adds a layer of opacity that laundering schemes exploit."""
    df["is_cross_currency"] = (
        df["payment_currency"] != df["receiving_currency"]
    ).astype(int)
    return df


def add_amount_ratio(df: pd.DataFrame) -> pd.DataFrame:
    """Ratio of received-to-paid amount. Values far from 1.0 can signal round-tripping
    or layering where amounts are deliberately inflated/deflated."""
    df["amount_ratio"] = df["amount_received"] / (df["amount_paid"] + 1e-9)
    return df


def add_customer_risk_tier(df: pd.DataFrame) -> pd.DataFrame:
    """Synthetic KYC risk tier: 0=low (70%), 1=medium (20%), 2=high (10%).
    In production this would come from the bank's KYC/onboarding system.
    Fixed seed 42 makes this deterministic."""
    np.random.seed(42)
    df["customer_risk_tier"] = np.random.choice(
        [0, 1, 2], size=len(df), p=[0.70, 0.20, 0.10]
    )
    return df


def add_merchant_category_risk(df: pd.DataFrame) -> pd.DataFrame:
    """Map payment format to a risk tier using the lookup table at module level.
    Unmapped formats default to 1 (medium) — unknown is treated as suspicious."""
    df["merchant_category_risk"] = (
        df["payment_format"].map(PAYMENT_FORMAT_RISK).fillna(1).astype(int)
    )
    return df


def add_counterparty_jurisdiction_risk(df: pd.DataFrame) -> pd.DataFrame:
    """Assign a jurisdiction risk score (0.0–1.0) to each destination bank.

    The IBM dataset uses numeric bank IDs rather than country codes, so we use a
    deterministic hash of the bank ID to produce a stable score. In production
    this would be driven by an actual FATF (Financial Action Task Force) country
    risk database. We bucket scores into high/medium/low tiers to avoid pure noise.
    """
    unique_banks = df["to_bank"].unique()
    risk_map = {}
    for bank_id in unique_banks:
        # Use bank_id modulo 2^16 as the seed so each bank always gets the same score
        rng = np.random.RandomState(int(bank_id) % (2**16))
        roll = rng.uniform()
        # 15% of banks are high risk (0.7–1.0), 30% medium (0.3–0.7), 55% low (0.0–0.3)
        if roll < 0.15:
            risk_map[bank_id] = 0.70 + rng.uniform() * 0.30
        elif roll < 0.45:
            risk_map[bank_id] = 0.30 + rng.uniform() * 0.40
        else:
            risk_map[bank_id] = rng.uniform() * 0.30
    df["counterparty_jurisdiction_risk"] = df["to_bank"].map(risk_map)
    return df


def add_account_age_days(df: pd.DataFrame) -> pd.DataFrame:
    """Synthetic account age in days, drawn from N(730, 365) and clipped to [1, 3650].
    New accounts (<90 days) are a classic fraud signal. Fixed seed 43."""
    np.random.seed(43)
    ages = np.abs(np.random.normal(loc=730, scale=365, size=len(df)))
    df["account_age_days"] = np.clip(ages, 1, 3650).astype(int)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Apply all feature engineering steps in sequence."""
    df = add_time_features(df)
    df = add_currency_feature(df)
    df = add_amount_ratio(df)
    df = add_customer_risk_tier(df)
    df = add_merchant_category_risk(df)
    df = add_counterparty_jurisdiction_risk(df)
    df = add_account_age_days(df)
    return df


def main():
    print("Loading raw IBM AML data...")
    df = load_raw_data()
    print(f"  Loaded {len(df):,} rows")

    print("Engineering features...")
    df = engineer_features(df)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PROCESSED_DIR / "features.csv"
    df.to_csv(out_path, index=False)
    print(f"  Saved features to {out_path}")
    print(f"  Columns: {list(df.columns)}")
    print(f"  Fraud rate: {df['is_laundering'].mean():.1%}")


if __name__ == "__main__":
    main()
