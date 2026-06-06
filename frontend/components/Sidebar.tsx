'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    label: 'False positive reduction',
    icon: '⚑',
    children: [
      { label: 'Alert Queue', href: '/alerts' },
      { label: 'Batch Summary', href: '/summary' },
    ],
  },
  {
    label: 'Risk assessment',
    icon: '▤',
    href: '/demo/rule-translator',
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  function isSectionActive(item: typeof NAV[number]) {
    if ('href' in item && item.href) return isActive(item.href)
    if ('children' in item) return item.children.some((c) => isActive(c.href))
    return false
  }

  return (
    <aside
      className="flex flex-col flex-shrink-0 h-full"
      style={{ width: 220, background: 'var(--navy)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 2L3 6v5c0 4.418 3.358 8.545 8 9.8C16.642 19.545 20 15.418 20 11V6l-9-4z"
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M7.5 11l2.5 2.5 5-5"
              stroke="#0d9f6e"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="font-semibold text-white tracking-tight"
            style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}
          >
            ClearSignal
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const sectionActive = isSectionActive(item)

          if ('children' in item) {
            return (
              <div key={item.label}>
                {/* Section header */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: sectionActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.40)' }}
                >
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{item.icon}</span>
                  {item.label}
                </div>
                {/* Children */}
                <div className="ml-4 space-y-0.5">
                  {item.children.map((child) => {
                    const active = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        style={{
                          color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                          background: active ? 'var(--navy-light)' : 'transparent',
                          borderLeft: active ? '2px solid #0d9f6e' : '2px solid transparent',
                        }}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          }

          const active = isActive(item.href!)
          return (
            <Link
              key={item.href}
              href={item.href!}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
              style={{
                color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                background: active ? 'var(--navy-light)' : 'transparent',
                borderLeft: active ? '3px solid #0d9f6e' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Version */}
      <div
        className="px-5 py-4 text-xs"
        style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        Demo v0.5
      </div>
    </aside>
  )
}
