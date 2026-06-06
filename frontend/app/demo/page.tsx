'use client'

import Link from 'next/link'

interface DemoCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
}

function DemoCard({ title, description, href, icon }: DemoCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 p-6 bg-white rounded-lg border transition-all"
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--navy)'
        ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 12px rgba(15,31,61,0.08)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none'
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h2
          className="font-semibold mb-1.5"
          style={{ fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
        >
          {title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--navy)' }}>
        Open demo
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </div>
    </Link>
  )
}

export default function DemoPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1
          className="font-semibold mb-1"
          style={{ fontSize: '1.375rem', color: 'var(--text-primary)', letterSpacing: '-0.015em' }}
        >
          ClearSignal Demos
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Two AI-powered compliance tools for AML operations teams.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5 max-w-3xl">
        <DemoCard
          title="False positive reduction"
          description="Paste a transaction alert. ClearSignal scores it, explains the key risk factors in plain English, and recommends Dismiss, Review, or Escalate."
          href="/"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="var(--navy)" strokeWidth="1.5" />
              <path d="M7 10l2 2 4-4" stroke="#0d9f6e" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <DemoCard
          title="Risk assessment → rule configuration"
          description="Paste your AML Business Risk Assessment. ClearSignal generates a prioritised rule configuration, cross-rule interaction analysis, data gap audit, and a JSON export ready for your transaction monitoring system."
          href="/demo/rule-translator"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="2" width="14" height="16" rx="2" stroke="var(--navy)" strokeWidth="1.5" />
              <path d="M6 7h8M6 10h8M6 13h5" stroke="#0d9f6e" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
      </div>
    </div>
  )
}
