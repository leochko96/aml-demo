'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getAlert } from '@/lib/api'
import type { Alert } from '@/types/alert'
import ActionBadge from '@/components/ActionBadge'
import FeatureChart from '@/components/FeatureChart'

function scoreColor(score: number): string {
  if (score < 0.3) return '#0d9f6e'
  if (score < 0.6) return '#d97706'
  return '#dc2626'
}

function formatAmount(val?: number): string {
  if (val === undefined || val === null) return '—'
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ScoreRing({ score }: { score: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const fill = circ * score
  const gap = circ - fill
  const color = scoreColor(score)

  return (
    <div className="relative flex items-center justify-center" style={{ width: 136, height: 136 }}>
      <svg width="136" height="136" viewBox="0 0 136 136">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle
          cx="68"
          cy="68"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${gap}`}
          transform="rotate(-90 68 68)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-semibold tabular-nums"
          style={{
            fontSize: '1.625rem',
            color,
            fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
            lineHeight: 1,
          }}
        >
          {(score * 100).toFixed(0)}
        </span>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          risk score
        </span>
      </div>
    </div>
  )
}

interface DetailRowProps {
  label: string
  value: string
  mono?: boolean
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className="text-sm font-medium"
        style={{
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-ibm-mono), "IBM Plex Mono", monospace' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  )
}

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [alert, setAlert] = useState<Alert | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getAlert(id)
      .then(setAlert)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="px-8 py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Loading alert…
      </div>
    )
  }
  if (error || !alert) {
    return (
      <div className="px-8 py-8 text-sm" style={{ color: 'var(--red)' }}>
        {error ?? 'Alert not found'}
      </div>
    )
  }

  const confidenceLabel = alert.confidence === 'high' ? 'High' : alert.confidence === 'medium' ? 'Medium' : 'Low'
  const jurisdictionPct =
    alert.counterparty_jurisdiction_risk !== undefined
      ? (alert.counterparty_jurisdiction_risk * 100).toFixed(0) + '%'
      : '—'
  const tierLabel =
    alert.customer_risk_tier !== undefined
      ? alert.customer_risk_tier === 0
        ? 'Tier 0 (Standard)'
        : alert.customer_risk_tier === 1
        ? 'Tier 1 (Enhanced)'
        : 'Tier 2 (High Risk)'
      : '—'

  return (
    <div className="px-8 py-8">
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <span style={{ fontSize: '0.9rem' }}>←</span>
        Alert Queue
      </button>

      {/* Title row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-semibold mb-0.5"
            style={{ fontSize: '1.375rem', color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
          >
            Alert{' '}
            <span style={{ fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace' }}>
              #{alert.alert_id}
            </span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {alert.label}
          </p>
        </div>
        <ActionBadge action={alert.recommended_action} />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '3fr 2fr' }}>
        {/* LEFT — AI narrative + feature chart */}
        <div className="space-y-5">
          {/* Narrative */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              AI Compliance Narrative
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {alert.narrative}
            </p>
          </div>

          {/* Feature chart */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              Risk Factor Attribution
            </h2>
            <FeatureChart features={alert.top_features} />
          </div>
        </div>

        {/* RIGHT — Score ring + transaction details + action card */}
        <div className="space-y-5">
          {/* Score ring */}
          <div
            className="bg-white rounded-lg border p-5 flex flex-col items-center gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-wide self-start"
              style={{ color: 'var(--text-secondary)' }}
            >
              Model Score
            </h2>
            <ScoreRing score={alert.score} />
            <div className="w-full pt-1">
              <DetailRow label="Confidence" value={confidenceLabel} />
              <DetailRow label="Model score" value={alert.score.toFixed(4)} mono />
            </div>
          </div>

          {/* Transaction details */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Transaction Details
            </h2>
            <DetailRow label="Amount paid" value={formatAmount(alert.amount_paid)} mono />
            <DetailRow label="Amount received" value={formatAmount(alert.amount_received)} mono />
            <DetailRow label="Customer tier" value={tierLabel} />
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Jurisdiction risk
              </span>
              <span
                className="text-sm font-medium"
                style={{
                  color:
                    alert.counterparty_jurisdiction_risk !== undefined &&
                    alert.counterparty_jurisdiction_risk >= 0.9
                      ? '#dc2626'
                      : 'var(--text-primary)',
                  fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
                }}
              >
                {jurisdictionPct}
              </span>
            </div>
          </div>

          {/* Recommended action card */}
          <div
            className="bg-white rounded-lg border p-5"
            style={{ borderColor: 'var(--border)' }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              Recommended Action
            </h2>
            <ActionBadge action={alert.recommended_action} size="md" />
          </div>
        </div>
      </div>
    </div>
  )
}
