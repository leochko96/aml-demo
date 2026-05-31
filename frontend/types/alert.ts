export interface Feature {
  feature: string
  direction: 'increases_risk' | 'decreases_risk'
  magnitude: number
}

export interface Alert {
  alert_id: string
  score: number
  label: string
  confidence: 'high' | 'medium' | 'low'
  top_features: Feature[]
  narrative: string
  recommended_action: 'Dismiss' | 'Review required' | 'Escalate'
  // Enriched fields added by the pipeline at output time
  amount_paid?: number
  amount_received?: number
  customer_risk_tier?: number
  counterparty_jurisdiction_risk?: number
}
