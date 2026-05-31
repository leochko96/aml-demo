interface ScoreBadgeProps {
  score: number
  showBar?: boolean
}

export function scoreColor(score: number): string {
  if (score < 0.3) return '#0d9f6e'
  if (score < 0.6) return '#d97706'
  return '#dc2626'
}

export default function ScoreBadge({ score, showBar = true }: ScoreBadgeProps) {
  const color = scoreColor(score)
  const pct = Math.round(score * 100)

  return (
    <div className="flex items-center gap-2">
      {showBar && (
        <div className="w-20 h-1.5 rounded-full bg-gray-100 flex-shrink-0">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      )}
      <span
        className="text-xs tabular-nums w-10 text-right font-medium"
        style={{
          color,
          fontFamily: 'var(--font-ibm-mono), "IBM Plex Mono", monospace',
        }}
      >
        {score.toFixed(3)}
      </span>
    </div>
  )
}
