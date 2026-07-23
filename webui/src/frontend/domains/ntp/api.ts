import { type AuthState, headers, parseError } from '../common/api'

export type NtpSource = {
  enabled: boolean
  type: 'server' | 'pool'
  address: string
  min_poll: number
  max_poll: number
  iburst: boolean
  auth_key: string
  options: string
  comment: string
}

export type NtpAccessRule = {
  enabled: boolean
  action: 'allow' | 'deny'
  network: string
  comment: string
}

export type NtpKey = {
  enabled: boolean
  id: string
  algorithm: 'MD5' | 'SHA1' | 'SHA256' | 'SHA384' | 'SHA512'
  secret: string
  comment: string
}

export type NtpConfig = {
  schema_version: 1
  applied_current?: boolean
  time: { timezone: string; ntp_enabled: boolean; rtcsync: boolean }
  sources: NtpSource[]
  server: {
    enabled: boolean
    use_local_clock: boolean
    local_stratum: number
    bind_address: string
    bind_interface: string
    listen_port: number
    orphan_mode: boolean
    rate_limit_enabled: boolean
    rate_interval: number
    rate_burst: number
    collect_client_statistics: boolean
    client_log_limit: number
    auth_key: string
  }
  access: NtpAccessRule[]
  keys: NtpKey[]
}

export type NtpStatus = {
  service: { active: boolean; enabled: boolean; state: string }
  current_time: number | null
  system_clock: null | {
    timezone: string
    local_rtc: boolean | null
    ntp_synchronized: boolean | null
    ntp_service: boolean | null
  }
  tracking: null | {
    reference_id: string
    reference_address: string
    stratum: number
    reference_time: number
    system_time: number
    last_offset: number
    rms_offset: number
    frequency_ppm: number
    residual_frequency_ppm: number
    skew_ppm: number
    root_delay: number
    root_dispersion: number
    update_interval: number
    leap_status: string
  }
  activity: null | {
    sources_online: number
    sources_offline: number
    sources_burst_online: number
    sources_burst_offline: number
    sources_unresolved: number
  }
  sources: Array<{
    mode: string
    state: string
    address: string
    stratum: number
    poll: number
    reach: number
    last_rx: number
    adjusted_offset: number
    measured_offset: number
    estimated_error: number
  }>
  source_stats: Array<{
    address: string
    samples: number
    runs: number
    span: number
    frequency_ppm: number
    frequency_skew_ppm: number
    offset: number
    standard_deviation: number
  }>
  clients: Array<{
    address: string
    ntp_packets: number
    ntp_drops: number
    ntp_interval: number | null
    ntp_interval_last: number | null
    ntp_last: number | null
    command_packets: number
    command_drops: number
    command_interval: number | null
    command_last: number | null
  }>
  errors: Array<{ command: string; error: string }>
}

export type NtpApplyResult = {
  applied: boolean
  service: string
  config_path: string
  keys_path?: string
  backup_path: string
  disabled_services: string[]
}

async function getItem<T>(auth: AuthState, url: string): Promise<T> {
  const response = await fetch(url, { headers: headers(auth) })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = await response.json()
  return payload.item
}

export function getNtpConfig(auth: AuthState): Promise<NtpConfig> {
  return getItem(auth, '/ntp')
}

export async function putNtpConfig(auth: AuthState, config: NtpConfig): Promise<NtpConfig> {
  const response = await fetch('/ntp', {
    method: 'PUT',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(config),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = await response.json()
  return payload.item
}

export async function applyNtpConfig(auth: AuthState): Promise<NtpApplyResult> {
  const response = await fetch('/ntp/apply', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: '{}',
  })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = await response.json()
  return payload.item
}

export function getNtpStatus(auth: AuthState): Promise<NtpStatus> {
  return getItem(auth, '/ntp/status')
}

export async function getNtpTimezones(auth: AuthState): Promise<string[]> {
  const item = await getItem<{ items: string[] }>(auth, '/ntp/timezones')
  return item.items
}

async function postNtpAction<T>(auth: AuthState, action: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`/ntp/${action}`, {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = await response.json()
  return payload.item
}

export function setNtpTimezone(auth: AuthState, timezone: string): Promise<{ timezone: string }> {
  return postNtpAction(auth, 'timezone', { timezone })
}

export function setNtpManualTime(auth: AuthState, date: string, time: string): Promise<{ datetime: string }> {
  return postNtpAction(auth, 'manual-time', { date, time })
}

export function syncNtpNow(auth: AuthState): Promise<{ synchronized: boolean }> {
  return postNtpAction(auth, 'sync')
}

export function restartNtp(auth: AuthState): Promise<{ action: string; service: string }> {
  return postNtpAction(auth, 'restart')
}

export function reloadNtp(auth: AuthState): Promise<{ action: string; service: string }> {
  return postNtpAction(auth, 'reload')
}
