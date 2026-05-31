'use client'

import { useEffect, useState } from 'react'
import { getAlerts } from '@/lib/api'
import type { Alert } from '@/types/alert'
import StatCard from '@/components/StatCard'

function formatAmount(val: number): string {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M'
  if (val >= 1_000) return (val / 1_000).toFixed(0) + 'K'
  return val.toFixed(0)
}

interface BarSegmentProps {
  count: number
  total: number
  color: string
  label: string
}

function BarSegment({ count, total, color, label }: BarSegmentProps) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-28 shrink-0" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-3 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-xs tabular-nums w-8 text-right"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace' }}
      >
        {count}
      </span>
      <span
        className="text-xs tabular-nums w-10 text-right"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace' }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

export default function SummaryPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .finally(() => setLoading(false))
  }, [])

  const total = alerts.length
  const escalate = alerts.filter((a) => a.recommended_action === 'Escalate').length
  const review = alerts.filter((a) => a.recommended_action === 'Review required').length
  const dismiss = alerts.filter((a) => a.recommended_action === 'Dismiss').length

  const highConf = alerts.filter((a) => a.confidence === 'high').length
  const medConf = alerts.filter((a) => a.confidence === 'medium').length
  const lowConf = alerts.filter((a) => a.confidence === 'low').length

  const avgScore =
    total > 0
      ? (alerts.reduce((s, a) => s + a.score, 0) / total).toFixed(3)
      : '—'

  const totalVolume = alerts.reduce((s, a) => s + (a.amount_paid ?? 0), 0)
  const escalatedVolume = alerts
    .filter((a) => a.recommended_action === 'Escalate')
    .reduce((s, a) => s + (a.amount_paid ?? 0), 0)

  // ROI: manual review avoided = dismiss + review
  const manualAvoided = dismiss
  const hoursSaved = (manualAvoided * 0.5).toFixed(1)

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1
          className="font-semibold mb-0.5"
          style={{ fontSize: '1.375rem', color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
        >
          Batch Summary
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {total > 0 ? `${total} alerts processed · current batch` : 'Loading…'}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard value={String(total)} label="Total Alerts" />
        <StatCard value={String(escalate)} label="Escalated" accent="red" />
        <StatCard value={avgScore} label="Avg. Risk Score" />
        <StatCard value={'$' + formatAmount(totalVolume)} label="Total Volume" />
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '3fr 2fr' }}>
        {/* Left column */}
        <div className="space-y-5">
          {/* Action breakdown */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              Action Breakdown
            </h2>
            {loading ? (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
            ) : (
              <div className="space-y-3">
                <BarSegment count={escalate} total={total} color="#dc2626" label="Escalate" />
                <BarSegment count={review} total={total} color="#d97706" label="Review Required" />
                <BarSegment count={dismiss} total={total} color="#0d9f6e" label="Dismiss" />
              </div>
            )}
          </div>

          {/* Confidence breakdown */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              Model Confidence
            </h2>
            {loading ? (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
            ) : (
              <div className="space-y-3">
                <BarSegment count={highConf} total={total} color="#0d9f6e" label="High" />
                <BarSegment count={medConf} total={total} color="#d97706" label="Medium" />
                <BarSegment count={lowConf} total={total} color="#dc2626" label="Low" />
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* ROI callout */}
          <div
            className="rounded-lg border p-5"
            style={{
              borderColor: 'rgba(13,159,110,0.30)',
              background: 'rgba(13,159,110,0.04)',
            }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: '#0a7a55' }}
            >
              Analyst Time Saved
            </h2>
            <div
              className="font-semibold mb-1"
              style={{
                fontSize: '2rem',
                color: '#0a7a55',
                fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
                lineHeight: 1,
              }}
            >
              {hoursSaved}h
            </div>
            <p className="text-xs mt-2" style={{ color: '#0a7a55', opacity: 0.8 }}>
              Based on {manualAvoided} alerts auto-dismissed at ~30 min each
            </p>
          </div>

          {/* Escalated volume */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              Escalated Volume
            </h2>
            <div
              className="font-semibold mb-1"
              style={{
                fontSize: '1.75rem',
                color: '#dc2626',
                fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
                lineHeight: 1,
              }}
            >
              ${formatAmount(escalatedVolume)}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Across {escalate} escalated alert{escalate !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Batch stats */}
          <div className="bg-white rounded-lg border p-5" style={{ borderColor: 'var(--border)' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Batch Stats
            </h2>
            {[
              { label: 'Alerts processed', value: String(total) },
              { label: 'Auto-dismissed', value: String(dismiss) },
              { label: 'Needs review', value: String(review) },
              { label: 'Escalated', value: String(escalate) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </span>
                <span
                  className="text-sm font-medium tabular-nums"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
