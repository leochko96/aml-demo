import type { Feature } from '@/types/alert'

const FEATURE_LABELS: Record<string, string> = {
  merchant_category_risk: 'Merchant Category Risk',
  counterparty_jurisdiction_risk: 'Jurisdiction Risk',
  customer_risk_tier: 'Customer Risk Tier',
  amount_paid: 'Amount Paid',
  amount_received: 'Amount Received',
  amount_ratio: 'Amount Ratio',
  is_cross_currency: 'Cross-Currency',
  day_of_week: 'Day of Week',
  hour_of_day: 'Hour of Day',
  account_age_days: 'Account Age',
}

function humanize(name: string): string {
  return (
    FEATURE_LABELS[name] ??
    name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

interface FeatureChartProps {
  features: Feature[]
}

export default function FeatureChart({ features }: FeatureChartProps) {
  const maxMag = Math.max(...features.map((f) => f.magnitude), 0.001)

  return (
    <div className="space-y-3">
      {features.map((f) => {
        const pct = (f.magnitude / maxMag) * 100
        const isRisk = f.direction === 'increases_risk'
        const barColor = isRisk ? '#dc2626' : '#0d9f6e'
        const barBg = isRisk ? 'rgba(220,38,38,0.08)' : 'rgba(13,159,110,0.08)'

        return (
          <div key={f.feature}>
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {humanize(f.feature)}
              </span>
              <span
                className="text-xs tabular-nums"
                style={{
                  color: barColor,
                  fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
                }}
              >
                {isRisk ? '+' : '−'}{f.magnitude.toFixed(3)}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: barColor, background: `linear-gradient(90deg, ${barBg}, ${barColor})` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
