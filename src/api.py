"""FastAPI backend for the ClearSignal AML demo frontend.

Run with:
  uvicorn src.api:app --reload --port 8000
"""

import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(title="ClearSignal AML API", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

DATA_PATH = Path(__file__).parent.parent / "outputs" / "alerts_enriched.json"


def _load_alerts() -> list[dict]:
    if not DATA_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Alert data not found. Run src/pipeline.py first.",
        )
    return json.loads(DATA_PATH.read_text())


@app.get("/alerts")
def get_alerts():
    """Return all scored alerts."""
    return _load_alerts()


@app.get("/alerts/{alert_id}")
def get_alert(alert_id: str):
    """Return a single alert by ID."""
    alerts = _load_alerts()
    for alert in alerts:
        if str(alert["alert_id"]) == str(alert_id):
            return alert
    raise HTTPException(status_code=404, detail=f"Alert {alert_id!r} not found")
