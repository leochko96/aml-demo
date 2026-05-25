# AML False Positive Reduction Demo

End-to-end demo: XGBoost classifier + SHAP explainability + Claude API narrative generation for AML transaction alert triage.

## Prerequisites

- Python 3.10+
- An Anthropic API key (for narrative generation)
- The IBM AML dataset from Kaggle

## Setup

### 1. Install dependencies

```bash
cd aml-demo
pip install -r requirements.txt
```

### 2. Set your Anthropic API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Never hardcode the key. The `src/narrative.py` module reads it from the environment automatically.

### 3. Download the IBM dataset

1. Go to Kaggle and search: **"IBM Transaction for Anti Money Laundering AML"**
2. Download `HI-Small_Trans.csv`
3. Place it at: `data/raw/HI-Small_Trans.csv`

The HI-Small variant has ~5.5M transactions, which is manageable on a laptop.

## Running the Pipeline

Run these steps in order:

### Step 1: Exploratory Data Analysis (optional but recommended)

```bash
jupyter notebook notebooks/01_eda.ipynb
```

Saves a summary to `data/processed/eda_summary.json`.

### Step 2: Feature Engineering

```bash
python src/features.py
```

Loads the raw IBM data, adds derived and synthetic features, saves to `data/processed/features.csv`.

### Step 3: Train the Model

```bash
python src/train.py
```

Trains an XGBoost binary classifier. Prints precision, recall, F1, and AUC-ROC.
Saves:
- `models/xgb_model.json` — trained model
- `models/feature_names.json` — ordered feature list
- `data/processed/test_features.csv` — held-out test set for pipeline

### Step 4: Run the End-to-End Pipeline

```bash
cd src && python pipeline.py
```

Scores 50 test alerts, explains each with SHAP, generates Claude narratives, and saves results to `outputs/sample_predictions.json`.

## Output Format

Each entry in `sample_predictions.json` looks like:

```json
{
  "alert_id": "12345",
  "score": 0.8723,
  "label": "Likely true positive",
  "confidence": "high",
  "top_features": [
    {"feature": "counterparty_jurisdiction_risk", "direction": "increases_risk", "magnitude": 0.45},
    {"feature": "customer_risk_tier", "direction": "increases_risk", "magnitude": 0.30},
    {"feature": "is_cross_currency", "direction": "increases_risk", "magnitude": 0.18},
    {"feature": "amount_ratio", "direction": "decreases_risk", "magnitude": 0.09},
    {"feature": "account_age_days", "direction": "decreases_risk", "magnitude": 0.04}
  ],
  "narrative": "This wire transfer of $25,000 to a high-risk jurisdiction warrants immediate review...",
  "recommended_action": "Escalate for SAR filing"
}
```

## Risk Thresholds

| Score | Label | Action |
|-------|-------|--------|
| ≥ 0.70 | Likely true positive | Escalate for SAR filing |
| 0.30–0.69 | Review required | Manual review by compliance analyst |
| < 0.30 | Likely false positive | Dismiss alert |

## Project Structure

```
aml-demo/
├── data/
│   ├── raw/                  # Place HI-Small_Trans.csv here
│   └── processed/            # Engineered features, test set, EDA summary
├── models/
│   ├── xgb_model.json        # Trained XGBoost model
│   └── feature_names.json    # Feature column order
├── notebooks/
│   └── 01_eda.ipynb          # Exploratory data analysis
├── outputs/
│   └── sample_predictions.json
├── src/
│   ├── features.py           # Feature engineering
│   ├── train.py              # Model training
│   ├── explain.py            # SHAP explainability
│   ├── narrative.py          # Claude API narrative generation
│   └── pipeline.py           # End-to-end orchestration
└── requirements.txt
```

## Notes

- **Synthetic features**: `customer_risk_tier`, `merchant_category_risk`, `counterparty_jurisdiction_risk`, and `account_age_days` are randomly generated with fixed seeds (42/43) to simulate data that would come from CRM/KYC systems in production. They are reproducible.
- **Class imbalance**: The IBM dataset is ~17% fraud. The model uses `scale_pos_weight` to compensate, so it doesn't just predict "legit" for everything.
- **SHAP values**: Positive values increase the fraud probability; negative values decrease it. The pipeline reports absolute magnitudes with a direction label for readability.
