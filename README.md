# ClearSignal AML Demo

A working demo of two AI-assisted workflows for AML compliance teams at fintechs and payment institutions:

1. **Alert triage (false positive reduction).** An XGBoost model scores transaction monitoring alerts, SHAP explains which factors drove each score, and Claude writes a plain English narrative with a recommended action: Dismiss, Review required or Escalate.
2. **Risk assessment to rule configuration.** Paste an AML Business Risk Assessment (BRA) and Claude turns it into a prioritised transaction monitoring rule configuration, with thresholds, calibration trade-offs, data gaps, open questions for the MLRO and a JSON export.

Both features run in a Next.js web app. The alert triage data comes from a FastAPI backend (or a bundled static file); the risk assessment feature calls the Anthropic API from a server-side Next.js route.

> **This is a demo, not a compliance product.** Outputs are suggestions for a qualified analyst or MLRO to review. They are not regulatory or legal advice and must not be used to make decisions on their own.

---

## Contents

- [Architecture](#architecture)
- [Feature 1: Alert triage](#feature-1-alert-triage)
- [Feature 2: Risk assessment to rule configuration](#feature-2-risk-assessment-to-rule-configuration)
- [Prerequisites](#prerequisites)
- [Running the ML pipeline](#running-the-ml-pipeline)
- [Running the API and web app locally](#running-the-api-and-web-app-locally)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [Tests](#tests)
- [Project structure](#project-structure)
- [Notes and limitations](#notes-and-limitations)

---

## Architecture

```
Web app (Next.js on Vercel)
│
├── Alert triage: /alerts, /alerts/[id], /summary
│     ├── GET ──▶ FastAPI on Fly.io ──▶ outputs/alerts_enriched.json
│     └── if the API is unreachable ──▶ frontend/public/alerts_v5.json
│
└── Risk assessment: /demo/rule-translator
      └── POST ──▶ /api/translate (server-side route) ──▶ Anthropic Messages API

Offline, on your machine:
  IBM AML data ──▶ features.py ──▶ train.py ──▶ pipeline.py (XGBoost + SHAP + Claude)
```

Alert triage results are generated offline by the Python pipeline and served as pre-computed JSON; the web app does not call the model live for alerts. The risk assessment feature is the only live Claude call from the web app.

---

## Feature 1: Alert triage

### What it does

For each alert, the pipeline:

1. **Scores** it with an XGBoost binary classifier trained on the IBM AML dataset (probability the transaction is laundering).
2. **Explains** the score with SHAP (`TreeExplainer`), returning the top 5 features, each with a direction (`increases_risk` / `decreases_risk`) and magnitude.
3. **Narrates** it with Claude (`src/narrative.py`): a 3 to 5 sentence plain English explanation plus a `recommended_action`.
4. **Validates** the result with deterministic checks in `src/pipeline.py` (see below).

### How the recommended action is decided

Claude chooses between three actions using rules written into its system prompt:

| Action | When |
|---|---|
| **Dismiss** | Likely false positive with no genuine risk factors. Missing fields alone are a documentation gap, not a reason to review. |
| **Review required** | Genuine ambiguity: conflicting signals, or missing data combined with at least one real risk factor. |
| **Escalate** | Any of the six escalation criteria below is met. |

Escalation criteria (any one is enough):

1. Score > 0.80 and two or more features are risk-increasing.
2. Amount > 100,000 (any currency) and score > 0.50.
3. Counterparty jurisdiction risk > 0.90, regardless of score.
4. Amount within 10% below a round reporting threshold (for example 9,000 to 10,000) **and** score > 0.30 (possible structuring).
5. Inconsistent model behaviour: jurisdiction risk > 0.85 being scored as risk-lowering.
6. Amount > 1,000,000, regardless of score.

Additional rules: amounts over 100,000 with a score under 0.50 default to Review required (unless jurisdiction risk < 0.20 and customer tier is 0), and tier 2 customers are never dismissed.

After Claude responds, `pipeline.py` applies deterministic guardrails:

- Transactions over **500,000** are never dismissed (upgraded to Review required).
- A Dismiss action is overridden to Review required if the score band is "Review required" or "Likely true positive".
- If the action is Review required but the score band is "Likely true positive", the label is aligned to the action.
- If Claude's response cannot be parsed, the action defaults to Review required.

### Score bands

| Score | Label |
|---|---|
| ≥ 0.70 | Likely true positive |
| 0.30 to 0.69 | Review required |
| < 0.30 | Likely false positive |

The label describes the model score. The recommended action is Claude's judgement after the rules above, so the two can differ.

### Confidence

Confidence measures distance from the 0.5 decision boundary: **high** at 0.3 or more away (score ≤ 0.20 or ≥ 0.80), **medium** at 0.15 or more, otherwise **low**.

### Output format

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
  "recommended_action": "Escalate"
}
```

### Screens

- **Alert Queue** (`/alerts`): all alerts with score, label and recommended action.
- **Alert detail** (`/alerts/[id]`): narrative, SHAP feature chart and transaction details.
- **Batch Summary** (`/summary`): totals by action and label across the batch.

---

## Feature 2: Risk assessment to rule configuration

### What it does

Compliance teams write an AML Business Risk Assessment describing their business, customers, products, geographies and controls. Turning that document into transaction monitoring rules is normally a manual, judgement-heavy job. This feature produces a first draft of that rule set for the compliance team to review.

Open **Risk assessment** in the sidebar (`/demo/rule-translator`), then:

1. Paste a BRA (or similar compliance document) into the text box, or click **Load demo document** to use a fictional sample (*ACME Payments Ltd*, a B2B card-not-present processor for EU e-commerce merchants).
2. Click **Analyse document**. The text is sent to `/api/translate`, a server-side Next.js route that calls Claude. The API key never reaches the browser.
3. Review the results in six tabs.

### Result tabs

| Tab | Contents |
|---|---|
| **Risk profile** | Overall risk rating (low / medium / medium-high / high), a 5 to 8 sentence summary of the business model, highest-risk products, geographic exposure, control strengths and gaps, plus counts of rules, data gaps and open questions. |
| **Rules** | 8 to 12 recommended rules ordered by priority. Each has a trigger description, suggested threshold, rationale tied to the document, what happens if it is calibrated too tight (false positives) or too loose (missed cases), dependencies and required data fields. |
| **Interactions** | Rules that must be calibrated together, complement each other or depend on each other's sequencing. |
| **Data gaps** | Data fields the rules need, which rules need them, whether fintechs typically have them, and the risk if they are missing. |
| **MLRO questions** | Questions the document does not answer, which rules they affect and why they matter. |
| **JSON config** | The full output as JSON, with a copy button. |

### Rule status

Each rule is tagged:

- `recommended`: supported by the document and ready to configure.
- `pending_data`: sensible, but depends on data the institution may not capture.
- `requires_mlro_input`: depends on a risk appetite decision that only the MLRO can make.

### Grounding

The system prompt instructs Claude to use only what the document says, to state explicitly where the document is silent instead of filling gaps, and to turn unresolved points into MLRO questions rather than assumptions.

### Output schema

```json
{
  "configuration_version": "1.0",
  "company": "ACME Payments Ltd",
  "overall_risk_rating": "medium-high",
  "risk_profile_summary": "...",
  "rules": [
    {
      "rule_id": "R01",
      "rule_name": "High-risk MCC velocity",
      "priority": "critical",
      "status": "recommended",
      "rationale": "...",
      "trigger_description": "...",
      "suggested_threshold": "...",
      "calibration_too_tight": "...",
      "calibration_too_loose": "...",
      "depends_on": [],
      "data_fields_required": ["merchant_category_code"],
      "open_questions": []
    }
  ],
  "cross_rule_interactions": [
    {"rules": ["R01", "R02"], "interaction_type": "must_calibrate_together", "description": "..."}
  ],
  "data_gaps": [
    {"field": "ubo_nationality", "required_by_rules": ["R04"], "typically_available": "sometimes", "risk_if_absent": "..."}
  ],
  "open_questions": [
    {"question_id": "Q1", "question": "...", "affects_rules": ["R03"], "why_it_matters": "..."}
  ]
}
```

Allowed values: `priority` is `critical | high | medium | low`; `interaction_type` is `complementary | must_calibrate_together | sequencing_dependency`; `typically_available` is `yes | sometimes | no`. TypeScript types are in `frontend/types/translator.ts`.

### API

```
POST /api/translate
Content-Type: application/json

{ "document": "<full BRA text>" }
```

Returns the JSON configuration above, or `{ "error": "..." }` with status 400 (empty document) or 500 (missing API key, Anthropic error or unparseable model output). Model: `claude-sonnet-4-6`, `max_tokens` 16000.

### Cost and abuse warning

Every **Analyse document** click is a live, paid Anthropic API call with a long input and a large output. On a public deployment, anyone with the URL can trigger it. Before sharing the link widely:

- Set a monthly spend limit on the API key in the Anthropic Console.
- Consider adding rate limiting or a simple password to `/api/translate`.

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- An Anthropic API key
- The IBM AML dataset from Kaggle (only needed to retrain or regenerate alerts)

---

## Running the ML pipeline

Only needed to regenerate alert triage results. The web app works without it using the bundled `frontend/public/alerts_v5.json`.

### 1. Install dependencies

```bash
pip install -r requirements.txt
pip install pytest   # for tests
```

### 2. Set your Anthropic API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Never hardcode the key. `src/narrative.py` reads it from the environment.

### 3. Download the IBM dataset

1. On Kaggle, search **"IBM Transaction for Anti Money Laundering AML"**.
2. Download `HI-Small_Trans.csv` (about 5.5M transactions, manageable on a laptop).
3. Place it at `data/raw/HI-Small_Trans.csv`.

### 4. Run the steps in order

```bash
jupyter notebook notebooks/01_eda.ipynb   # optional: EDA, saves data/processed/eda_summary.json
python src/features.py                    # feature engineering, saves data/processed/features.csv
python src/train.py                       # trains XGBoost, prints precision, recall, F1, AUC-ROC
cd src && python pipeline.py              # scores, explains and narrates 50 test alerts
```

`train.py` saves `models/xgb_model.json`, `models/feature_names.json` and `data/processed/test_features.csv`.
`pipeline.py` saves `outputs/sample_predictions.json`.

---

## Running the API and web app locally

### Backend (FastAPI)

```bash
uvicorn src.api:app --reload --port 8000
```

| Endpoint | Returns |
|---|---|
| `GET /alerts` | All alerts |
| `GET /alerts/{alert_id}` | One alert, or 404 |

The API serves `outputs/alerts_enriched.json` (the pipeline output plus transaction details for the UI). The `outputs/` folder is gitignored, so this file must exist locally.

### Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local
# edit .env.local: set NEXT_PUBLIC_API_URL and add ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

If the FastAPI backend is unreachable, the alert screens fall back to `frontend/public/alerts_v5.json` automatically (a warning appears in the browser console). The risk assessment feature needs `ANTHROPIC_API_KEY` in `.env.local` and does not use the backend.

---

## Deployment

### Backend on Fly.io

`fly.toml` deploys the app `clearsignal-aml` in Frankfurt (`fra`) using `Dockerfile.api`, on a shared 512 MB machine that stops when idle.

```bash
fly deploy
```

The Docker image copies `outputs/alerts_enriched.json`, so it must exist locally before deploying. The API needs no secrets: it only serves pre-computed JSON.

### Frontend on Vercel

Deploy the `frontend/` directory as a Next.js project and set these environment variables in the Vercel dashboard:

- `NEXT_PUBLIC_API_URL`: your Fly.io URL, with no trailing slash.
- `ANTHROPIC_API_KEY`: required for the risk assessment feature. Set it in the dashboard only, never in a committed file.

---

## Environment variables

| Variable | Where | Used by | Required |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Shell (pipeline), `frontend/.env.local` (local), Vercel (production) | `src/narrative.py`, `/api/translate` | Yes, for narratives and risk assessment |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local`, Vercel | Alert screens | No; defaults to `http://localhost:8000`, with static fallback |

`.env` and `.env.local` are gitignored. `frontend/.env.example` contains placeholders only.

---

## Tests

```bash
pytest tests/ -v
```

`tests/test_pipeline.py` covers the action logic and guardrails: narrative and action consistency, high jurisdiction risk with a low score, high-risk customers with a low score, the large transaction override, and defaulting to Review required when Claude's response cannot be parsed. Tests use a dummy API key and do not call Anthropic.

---

## Project structure

```
aml-demo/
├── data/                         # gitignored
│   ├── raw/                      # Place HI-Small_Trans.csv here
│   └── processed/                # Features, test set, EDA summary
├── models/                       # gitignored: xgb_model.json, feature_names.json
├── outputs/                      # gitignored: sample_predictions.json, alerts_enriched.json
├── notebooks/
│   └── 01_eda.ipynb
├── src/
│   ├── features.py               # Feature engineering
│   ├── train.py                  # XGBoost training
│   ├── explain.py                # SHAP explanations
│   ├── narrative.py              # Claude narrative and recommended action
│   ├── pipeline.py               # Orchestration and validation guardrails
│   └── api.py                    # FastAPI backend
├── tests/
│   └── test_pipeline.py
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Home: links to both features
│   │   ├── alerts/               # Alert Queue and alert detail
│   │   ├── summary/              # Batch Summary
│   │   ├── demo/rule-translator/ # Risk assessment to rule configuration
│   │   └── api/translate/        # Server route that calls Claude
│   ├── components/               # AlertTable, FeatureChart, RuleTranslator, Sidebar, ...
│   ├── lib/api.ts                # FastAPI client with static fallback
│   ├── types/                    # alert.ts, translator.ts
│   ├── public/alerts_v5.json     # Static alert data fallback
│   └── .env.example
├── Dockerfile.api
├── fly.toml
├── CLAUDE.md                     # Conventions for Claude Code
└── requirements.txt
```

---

## Notes and limitations

- **Synthetic features.** `customer_risk_tier`, `merchant_category_risk`, `counterparty_jurisdiction_risk` and `account_age_days` are randomly generated with fixed seeds (42/43) to simulate CRM and KYC data. They are reproducible but not real.
- **Class imbalance.** Laundering cases are a small minority of the dataset, so training uses `scale_pos_weight` to stop the model predicting "legit" for everything.
- **SHAP values.** Positive values increase the laundering probability; negative values decrease it. The pipeline reports absolute magnitudes with a direction label.
- **Simulated data.** The IBM dataset is synthetic. Model performance here says nothing about performance on a real institution's alerts.
- **Rule configurations are drafts.** Thresholds are suggestions grounded in the document, not calibrated against the institution's transaction data. Calibration and sign-off remain the MLRO's responsibility.
