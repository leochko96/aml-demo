'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Alert } from '@/types/alert'
import ScoreBadge from './ScoreBadge'
import ActionBadge from './ActionBadge'

function topRiskFactor(alert: Alert): string {
  const risky = alert.top_features.find((f) => f.direction === 'increases_risk')
  if (!risky) return 'All factors clear'
  const labels: Record<string, string> = {
    merchant_category_risk: 'Merchant Category',
    counterparty_jurisdiction_risk: 'Jurisdiction Risk',
    customer_risk_tier: 'Customer Tier',
    amount_paid: 'Amount Paid',
    amount_received: 'Amount Received',
    amount_ratio: 'Amount Ratio',
    is_cross_currency: 'Cross-Currency',
    day_of_week: 'Day of Week',
    hour_of_day: 'Hour of Day',
    account_age_days: 'Account Age',
  }
  return labels[risky.feature] ?? risky.feature.replace(/_/g, ' ')
}

function formatAmount(val?: number): string {
  if (val === undefined || val === null) return '—'
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface AlertTableProps {
  alerts: Alert[]
}

export default function AlertTable({ alerts }: AlertTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<'score' | 'amount' | 'action'>('score')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  function handleSort(key: typeof sortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...alerts].sort((a, b) => {
      let av: number, bv: number
      if (sortKey === 'score') {
        av = a.score; bv = b.score
      } else if (sortKey === 'amount') {
        av = a.amount_paid ?? 0; bv = b.amount_paid ?? 0
      } else {
        const order = { Escalate: 2, 'Review required': 1, Dismiss: 0 }
        av = order[a.recommended_action]; bv = order[b.recommended_action]
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [alerts, sortKey, sortDir])

  const ThButton = ({ label, k }: { label: string; k: typeof sortKey }) => (
    <button
      onClick={() => handleSort(k)}
      className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1"
      style={{ color: sortKey === k ? 'var(--text-primary)' : 'var(--text-secondary)' }}
    >
      {label}
      <span style={{ opacity: sortKey === k ? 1 : 0.3 }}>
        {sortDir === 'desc' ? '↓' : '↑'}
      </span>
    </button>
  )

  return (
    <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <th className="text-left px-4 py-3 w-24">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Alert ID
              </span>
            </th>
            <th className="text-right px-4 py-3 w-36">
              <div className="flex justify-end">
                <ThButton label="Amount" k="amount" />
              </div>
            </th>
            <th className="px-4 py-3 w-44">
              <ThButton label="Score" k="score" />
            </th>
            <th className="text-left px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Top Risk Factor
              </span>
            </th>
            <th className="px-4 py-3 w-40">
              <div className="flex justify-center">
                <ThButton label="Action" k="action" />
              </div>
            </th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((alert, i) => (
            <tr
              key={alert.alert_id}
              onClick={() => router.push(`/alerts/${alert.alert_id}`)}
              className="cursor-pointer transition-colors"
              style={{
                borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="px-4 py-3">
                <span
                  className="text-xs"
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
                  }}
                >
                  #{alert.alert_id}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className="text-sm tabular-nums"
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
                  }}
                >
                  {formatAmount(alert.amount_paid)}
                </span>
              </td>
              <td className="px-4 py-3">
                <ScoreBadge score={alert.score} />
              </td>
              <td className="px-4 py-3">
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                  {topRiskFactor(alert)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-center">
                  <ActionBadge action={alert.recommended_action} />
                </div>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/alerts/${alert.alert_id}`)
                  }}
                  className="text-xs font-medium px-3 py-1 rounded border transition-colors"
                  style={{
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--navy)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
