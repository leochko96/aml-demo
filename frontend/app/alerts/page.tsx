'use client'

import { useEffect, useState } from 'react'
import { getAlerts } from '@/lib/api'
import type { Alert } from '@/types/alert'
import AlertTable from '@/components/AlertTable'
import StatCard from '@/components/StatCard'

export default function AlertQueuePage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const escalate = alerts.filter((a) => a.recommended_action === 'Escalate').length
  const review = alerts.filter((a) => a.recommended_action === 'Review required').length
  const dismiss = alerts.filter((a) => a.recommended_action === 'Dismiss').length
  const avgScore =
    alerts.length > 0
      ? (alerts.reduce((s, a) => s + a.score, 0) / alerts.length).toFixed(3)
      : '—'

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-semibold mb-0.5"
            style={{ fontSize: '1.375rem', color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
          >
            Alert Queue
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {alerts.length > 0 ? `${alerts.length} alerts · sorted by risk score` : 'Loading alerts…'}
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{
            background: 'rgba(13,159,110,0.10)',
            color: '#0a7a55',
            border: '1px solid rgba(13,159,110,0.18)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#0d9f6e', display: 'inline-block' }}
          />
          Model active
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard value={String(escalate)} label="Escalate" accent="red" />
        <StatCard value={String(review)} label="Review Required" accent="amber" />
        <StatCard value={String(dismiss)} label="Dismissed" accent="green" />
        <StatCard value={String(avgScore)} label="Avg. Risk Score" />
      </div>

      {/* Table */}
      {loading && (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
          Loading alerts…
        </div>
      )}
      {error && !loading && (
        <div className="text-sm py-12 text-center" style={{ color: 'var(--red)' }}>
          Failed to load alerts: {error}
        </div>
      )}
      {!loading && !error && <AlertTable alerts={alerts} />}
    </div>
  )
}
