import type { Alert } from '@/types/alert'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function fetchStatic(): Promise<Alert[]> {
  const res = await fetch('/alerts_v5.json')
  if (!res.ok) throw new Error('Static fallback also failed')
  return res.json()
}

export async function getAlerts(): Promise<Alert[]> {
  try {
    const res = await fetch(`${BASE_URL}/alerts`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`API returned ${res.status}`)
    return res.json()
  } catch (err) {
    console.warn('[api] FastAPI unavailable, falling back to static JSON:', err)
    return fetchStatic()
  }
}

export async function getAlert(id: string): Promise<Alert> {
  try {
    const res = await fetch(`${BASE_URL}/alerts/${id}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`API returned ${res.status}`)
    return res.json()
  } catch (err) {
    console.warn(`[api] FastAPI unavailable for alert ${id}, falling back to static JSON:`, err)
    const all = await fetchStatic()
    const found = all.find(a => String(a.alert_id) === String(id))
    if (!found) throw new Error(`Alert ${id} not found`)
    return found
  }
}
