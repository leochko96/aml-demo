import type { Alert } from '@/types/alert'

interface ActionBadgeProps {
  action: Alert['recommended_action']
  size?: 'sm' | 'md'
}

const config = {
  Dismiss: {
    bg: 'rgba(13,159,110,0.10)',
    border: 'rgba(13,159,110,0.30)',
    text: '#0a7a55',
    dot: '#0d9f6e',
  },
  'Review required': {
    bg: 'rgba(217,119,6,0.10)',
    border: 'rgba(217,119,6,0.30)',
    text: '#92400e',
    dot: '#d97706',
  },
  Escalate: {
    bg: 'rgba(220,38,38,0.10)',
    border: 'rgba(220,38,38,0.30)',
    text: '#991b1b',
    dot: '#dc2626',
  },
}

export default function ActionBadge({ action, size = 'sm' }: ActionBadgeProps) {
  const c = config[action]
  const padding = size === 'sm' ? '2px 10px' : '4px 14px'
  const fontSize = size === 'sm' ? '0.75rem' : '0.8125rem'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        padding,
        fontSize,
      }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: 6, height: 6, background: c.dot }}
      />
      {action}
    </span>
  )
}
