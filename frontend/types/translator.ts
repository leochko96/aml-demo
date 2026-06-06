export type RiskRating = 'low' | 'medium' | 'medium-high' | 'high'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type RuleStatus = 'recommended' | 'pending_data' | 'requires_mlro_input'
export type Availability = 'yes' | 'sometimes' | 'no'
export type InteractionType = 'complementary' | 'must_calibrate_together' | 'sequencing_dependency'

export interface AMLRule {
  rule_id: string
  rule_name: string
  priority: Priority
  status: RuleStatus
  rationale: string
  trigger_description: string
  suggested_threshold: string
  calibration_too_tight: string
  calibration_too_loose: string
  depends_on: string[]
  data_fields_required: string[]
  open_questions: string[]
}

export interface CrossRuleInteraction {
  rules: string[]
  interaction_type: InteractionType
  description: string
}

export interface DataGap {
  field: string
  required_by_rules: string[]
  typically_available: Availability
  risk_if_absent: string
}

export interface OpenQuestion {
  question_id: string
  question: string
  affects_rules: string[]
  why_it_matters: string
}

export interface TranslatorResult {
  configuration_version: string
  company: string
  overall_risk_rating: RiskRating
  risk_profile_summary: string
  rules: AMLRule[]
  cross_rule_interactions: CrossRuleInteraction[]
  data_gaps: DataGap[]
  open_questions: OpenQuestion[]
}
