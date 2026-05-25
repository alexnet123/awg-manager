import type { FirewallMapItem, FirewallRule, FirewallSetItem } from '../api'

type CollectionRow = (FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }) | (FirewallMapItem & { kind: 'map' | 'vmap' })

export function formatCounter(value?: number) {
  const n = Number(value || 0)
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1_000_000_000).toFixed(1)}G`
}

export function formatBytesIEC(bytes?: number) {
  const n = Math.max(0, Number(bytes || 0))
  if (n < 1024) return `${n.toFixed(0)} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`
  if (n < 1024 ** 3) return `${(n / (1024 ** 2)).toFixed(1)} MiB`
  return `${(n / (1024 ** 3)).toFixed(2)} GiB`
}

export function formatBitrate(bitsPerSec?: number) {
  const n = Math.max(0, Number(bitsPerSec || 0))
  if (n < 1000) return `${n.toFixed(0)} bps`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} kbps`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)} Mbps`
  return `${(n / 1_000_000_000).toFixed(2)} Gbps`
}

export function formatPacketRate(packetsPerSec?: number) {
  const n = Math.max(0, Number(packetsPerSec || 0))
  if (n < 10) return `${n.toFixed(1)} p/s`
  if (n < 1000) return `${Math.round(n)} p/s`
  return `${(n / 1000).toFixed(1)} Kp/s`
}

export function formatDurationClock(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return '—'
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  const days = Math.floor(s / 86400)
  const hh = Math.floor((s % 86400) / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return days > 0 ? `${days}d ${clock}` : clock
}

export function formatDateTime(sec?: number | null) {
  if (!sec) return '—'
  const dt = new Date(Number(sec) * 1000)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  const ss = String(dt.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

export function getCollectionRemainingSeconds(row: CollectionRow, nowSec: number): number | null {
  if (row.enabled === false) return null
  const timeoutSec = Number(row.timeout_seconds || 0)
  if (!timeoutSec) return null
  const started = Number(row.timeout_started_at || 0)
  if (!started) return timeoutSec
  return Math.max(0, timeoutSec - Math.max(0, nowSec - started))
}

export function normalizeCollectionTimeoutInput(value: string): string | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  const compact = raw.replace(/\s+/g, '')
  if (['inf', 'infinite', 'infinity', 'perm', 'permanent', 'never'].includes(compact)) {
    throw new Error('Timeout must be finite')
  }

  const mk = raw.match(/^(?:(\d+)d\s+)?(\d{1,2}):([0-5]\d):([0-5]\d)$/)
  if (mk) {
    const days = Number(mk[1] || 0)
    const hours = Number(mk[2] || 0)
    const minutes = Number(mk[3] || 0)
    const seconds = Number(mk[4] || 0)
    if (hours > 23) throw new Error('Timeout hour must be 0..23 in "Xd HH:MM:SS" format')
    const totalSeconds = (days * 86400) + (hours * 3600) + (minutes * 60) + seconds
    if (totalSeconds <= 0) throw new Error('Timeout must be greater than zero')
    return `${totalSeconds}s`
  }

  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw)
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Timeout must be greater than zero')
    return `${Math.floor(seconds)}s`
  }

  const parts = Array.from(compact.matchAll(/([1-9]\d*)(ms|s|m|h|d|w)/g))
  if (!parts.length || parts.map((m) => `${m[1]}${m[2]}`).join('') !== compact) {
    throw new Error('Timeout is invalid; use "10m", "2h30m", or "1d 15:00:00"')
  }
  let totalMs = 0
  for (const [, numRaw, unit] of parts) {
    const num = Number(numRaw)
    if (!Number.isFinite(num) || num <= 0) throw new Error('Timeout parts must be positive numbers')
    if (unit === 'ms') totalMs += num
    else if (unit === 's') totalMs += num * 1000
    else if (unit === 'm') totalMs += num * 60 * 1000
    else if (unit === 'h') totalMs += num * 3600 * 1000
    else if (unit === 'd') totalMs += num * 86400 * 1000
    else if (unit === 'w') totalMs += num * 7 * 86400 * 1000
  }
  if (totalMs <= 0) throw new Error('Timeout must be greater than zero')
  if (totalMs % 1000 === 0) return `${Math.floor(totalMs / 1000)}s`
  return `${totalMs}ms`
}

export function buildPolicyV2BridgeExprSummary(rule: Partial<FirewallRule>) {
  const parts: string[] = []
  if (rule.fib_check) parts.push(`fib:${rule.fib_check}`)
  if (rule.socket_match) parts.push(`socket:${rule.socket_match}`)
  if (rule.rt_nexthop) parts.push(`rt:${rule.rt_nexthop}`)
  if (rule.ipv6_exthdrs) parts.push(`exthdr:${rule.ipv6_exthdrs}`)
  return parts.length ? parts.join(' | ') : '—'
}
