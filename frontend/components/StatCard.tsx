interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  accent?: 'green' | 'amber' | 'red' | 'default'
}

const accentColors: Record<string, string> = {
  green: '#0d9f6e',
  amber: '#d97706',
  red: '#dc2626',
  default: '#0f1f3d',
}

export default function StatCard({ label, value, unit, accent = 'default' }: StatCardProps) {
  const color = accentColors[accent]
  return (
    <div className="bg-white rounded-lg border px-5 py-4" style={{ borderColor: 'var(--border)' }}>
      <div
        className="font-mono text-3xl font-semibold leading-none mb-1"
        style={{ color, fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace' }}
      >
        {value}
        {unit && (
          <span className="text-base font-normal ml-1" style={{ color: 'var(--text-secondary)' }}>
            {unit}
          </span>
        )}
      </div>
      <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>
    </div>
  )
}
