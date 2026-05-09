export type AuthState = {
  apiKey: string
}

export type InterfaceItem = {
  id: number
  wg_interface: string
  awg_version: '1' | '2'
  port_number: number
  wg_ip_addr: string
  wg_ip_cidr: number
  public_key: string
  srv_ip: string
  srv_dns: string
  awg_params: Record<string, string | number | null>
}

export type ClientItem = {
  id: number
  name: string
  pubkey: string
  ip: string
  wg_interface: string
  allowed_ips: string
  privkey?: string
}

export type FirewallRule = {
  id: string
  table: 'filter' | 'nat' | 'raw' | 'mangle'
  family: 'inet' | 'ip' | 'ip6'
  chain: 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting'
  action: 'accept' | 'drop' | 'reject'
  proto?: 'tcp' | 'udp' | 'icmp' | 'icmpv6' | null
  src?: string | null
  dst?: string | null
  in_interface?: string | null
  out_interface?: string | null
  sport?: string | null
  dport?: string | null
  comment?: string | null
  ct_state?: 'established,related' | 'new' | 'invalid' | null
  enabled: boolean
}

export type FirewallState = {
  active: boolean
  rules: FirewallRule[]
  ruleset: string
  family: string
  tables: string[]
}

export async function generateAwgParams(auth: AuthState, awgVersion: '1' | '2'): Promise<Record<string, string | number | null>> {
  const res = await fetch('/awg/params/generate', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ awg_version: awgVersion }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.awg_params || {}
}

function headers(auth: AuthState, extra?: Record<string, string>) {
  return {
    'X-API-Key': auth.apiKey,
    ...(extra || {}),
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const payload = await res.json()
    return payload?.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export async function getInterfaces(auth: AuthState): Promise<InterfaceItem[]> {
  const res = await fetch('/interfaces', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function getInterfaceConfig(auth: AuthState, id: number): Promise<string> {
  const res = await fetch(`/interfaces/${id}/config`, { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.config || ''
}

export async function getClients(auth: AuthState): Promise<ClientItem[]> {
  const res = await fetch('/clients', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function createInterface(auth: AuthState, body: any): Promise<InterfaceItem> {
  const res = await fetch('/interfaces', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteInterface(auth: AuthState, id: number): Promise<void> {
  const res = await fetch(`/interfaces/${id}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function updateInterface(auth: AuthState, id: number, body: any): Promise<InterfaceItem> {
  const res = await fetch(`/interfaces/${id}`, {
    method: 'PUT',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function createClient(auth: AuthState, body: any): Promise<ClientItem> {
  const res = await fetch('/clients', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteClient(auth: AuthState, id: number): Promise<void> {
  const res = await fetch(`/clients/${id}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function updateClient(auth: AuthState, id: number, body: any): Promise<ClientItem> {
  const res = await fetch(`/clients/${id}`, {
    method: 'PUT',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function getClientConfig(auth: AuthState, id: number): Promise<string> {
  const res = await fetch(`/clients/${id}/config`, { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.config || ''
}

export async function getClientQrSvg(auth: AuthState, id: number): Promise<string> {
  const res = await fetch(`/clients/${id}/qr?format=svg`, { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  return await res.text()
}

export async function downloadWithAuth(auth: AuthState, url: string, filename: string) {
  const res = await fetch(url, { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadBackup(auth: AuthState): Promise<void> {
  await downloadWithAuth(auth, '/backup/download', 'clients.db')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function restoreBackup(auth: AuthState, file: File): Promise<void> {
  const buffer = await file.arrayBuffer()
  const base64Payload = bytesToBase64(new Uint8Array(buffer))
  const res = await fetch('/backup/restore', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ db_base64: base64Payload }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getFirewallState(auth: AuthState): Promise<FirewallState> {
  const res = await fetch('/firewall', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function createFirewallRule(auth: AuthState, body: Partial<FirewallRule>): Promise<FirewallRule> {
  const res = await fetch('/firewall/rules', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function updateFirewallRule(auth: AuthState, id: string, body: Partial<FirewallRule>): Promise<FirewallRule> {
  const res = await fetch(`/firewall/rules/${id}`, {
    method: 'PUT',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteFirewallRule(auth: AuthState, id: string): Promise<void> {
  const res = await fetch(`/firewall/rules/${id}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function applyFirewallRules(auth: AuthState): Promise<void> {
  const res = await fetch('/firewall/apply', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(await parseError(res))
}
