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
  table: string
  family: 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
  chain: string
  action: 'accept' | 'drop' | 'reject' | 'jump' | 'goto' | 'return' | 'queue' | 'fwd'
  proto?: 'tcp' | 'udp' | 'icmp' | 'icmpv6' | null
  src?: string | null
  dst?: string | null
  in_interface?: string | null
  out_interface?: string | null
  ibrname?: string | null
  obrname?: string | null
  sport?: string | null
  dport?: string | null
  comment?: string | null
  ct_state?: 'established,related' | 'new' | 'invalid' | 'related' | 'established' | 'untracked' | null
  user_id?: string | null
  hour?: string | null
  dscp?: string | null
  nat_type?: 'masquerade' | 'snat' | 'dnat' | 'redirect' | null
  target_chain?: string | null
  reject_type?: string | null
  to_addr?: string | null
  to_port?: string | null
  nat_random?: boolean
  nat_fully_random?: boolean
  nat_persistent?: boolean
  notrack?: boolean
  mark_set?: string | null
  ct_mark_set?: string | null
  log_prefix?: string | null
  log_level?: 'emerg' | 'alert' | 'crit' | 'err' | 'warn' | 'notice' | 'info' | 'debug' | null
  log_flags?: Array<'tcp sequence' | 'tcp options' | 'ip options' | 'skuid' | 'ether' | 'all'> | null
  log_group?: number | null
  log_snaplen?: number | null
  log_queue_threshold?: number | null
  fib_expr?: string | null
  socket_expr?: string | null
  rt_expr?: string | null
  exthdr_expr?: string | null
  raw_expr?: string | null
  nftrace?: boolean
  tcp_flags?: string | null
  icmp_type?: string | null
  icmp_code?: string | null
  icmpv6_type?: string | null
  icmpv6_code?: string | null
  meta_length?: string | null
  meta_priority?: string | null
  meta_cpu?: string | null
  meta_pkttype?: string | null
  meta_iiftype?: string | null
  meta_oiftype?: string | null
  meta_iifgroup?: string | null
  meta_oifgroup?: string | null
  mark_match?: string | null
  ct_mark_match?: string | null
  ct_status?: string | null
  ct_direction?: string | null
  ct_expiration?: string | null
  ct_helper_match?: string | null
  ct_label?: string | null
  ct_event?: string | null
  ct_original_saddr?: string | null
  ct_original_daddr?: string | null
  ct_reply_saddr?: string | null
  ct_reply_daddr?: string | null
  fib_check?: string | null
  socket_match?: string | null
  rt_nexthop?: string | null
  ipv6_exthdrs?: string | null
  vlan_id?: string | null
  ether_src?: string | null
  ether_dst?: string | null
  ether_type?: string | null
  ct_helper_set?: string | null
  ct_timeout_set?: string | null
  ct_expectation_set?: string | null
  counter_name?: string | null
  limit_name?: string | null
  quota_name?: string | null
  queue_num?: string | null
  queue_flags?: Array<'bypass' | 'fanout'> | null
  dup_to?: string | null
  dup_dev?: string | null
  fwd_to?: string | null
  fwd_dev?: string | null
  fwd_family?: 'ip' | 'ip6' | null
  limit_rate?: string | null
  counter?: boolean
  runtime_packets?: number
  runtime_bytes?: number
  runtime_pps?: number
  runtime_bps?: number
  runtime_history?: Array<{ t: number; packets: number; bytes: number; pps?: number; bps?: number }>
  enabled: boolean
}

export type FirewallSetItem = {
  id: string
  name: string
  elements: string[]
  enabled?: boolean
  comment?: string | null
  timeout?: string | null
  created_at?: number | null
  timeout_started_at?: number | null
  timeout_seconds?: number | null
  timeout_remaining_seconds?: number | null
}

export type FirewallSetsState = {
  addr: FirewallSetItem[]
  port: FirewallSetItem[]
  iface: FirewallSetItem[]
}

export type FirewallMapItem = {
  id: string
  kind: 'map' | 'vmap'
  name: string
  entries: string[]
  enabled?: boolean
  comment?: string | null
  timeout?: string | null
  created_at?: number | null
  timeout_started_at?: number | null
  timeout_seconds?: number | null
  timeout_remaining_seconds?: number | null
}

export type FirewallMapsState = {
  map: FirewallMapItem[]
  vmap: FirewallMapItem[]
}

export type FirewallTableItem = {
  id: string
  family: string
  table_name: string
  chain_name: string
  chain_type: 'filter' | 'nat' | 'route'
  hook: 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'
  device?: string | null
  priority: number
  policy: 'accept' | 'drop'
  builtin?: boolean
  enabled?: boolean
}

export type FirewallTablesState = {
  builtin: FirewallTableItem[]
  custom: FirewallTableItem[]
}

export type FirewallNamedObjects = {
  family: string
  table: string
  counter: string[]
  limit: string[]
  quota: string[]
  ct_helper: string[]
  ct_timeout: string[]
  ct_expectation: string[]
  items?: FirewallNamedObjectItem[]
}

export type FirewallNamedObjectKind = 'counter' | 'limit' | 'quota' | 'ct_helper' | 'ct_timeout' | 'ct_expectation'

export type FirewallNamedObjectItem = {
  id: string
  kind: FirewallNamedObjectKind
  family: 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
  table: string
  name: string
  enabled: boolean
  comment?: string | null
  config?: Record<string, string | number | boolean | null>
}

export type FirewallState = {
  active: boolean
  rules: FirewallRule[]
  ruleset: string
  family: string
  tables: string[]
}

export type FirewallSchema = {
  family: 'inet'
  tables: Record<'filter' | 'nat' | 'raw' | 'mangle', {
    chains: FirewallRule['chain'][]
    nat_types?: FirewallRule['nat_type'][]
    nat_types_by_chain?: Record<string, FirewallRule['nat_type'][]>
    supports: string[]
  }>
  actions: FirewallRule['action'][]
  protos: NonNullable<FirewallRule['proto']>[]
  ct_states: NonNullable<FirewallRule['ct_state']>[]
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

export async function getFirewallRules(auth: AuthState, filters?: { family?: string; table?: string }): Promise<FirewallRule[]> {
  const params = new URLSearchParams()
  if (filters?.family) params.set('family', filters.family)
  if (filters?.table) params.set('table', filters.table)
  const query = params.toString()
  const res = await fetch(`/firewall/rules${query ? `?${query}` : ''}`, { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function getFirewallObjects(auth: AuthState, filters: { family: string; table: string }): Promise<FirewallNamedObjects> {
  const params = new URLSearchParams()
  params.set('family', filters.family)
  params.set('table', filters.table)
  const res = await fetch(`/firewall/objects?${params.toString()}`, { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function upsertFirewallObject(auth: AuthState, body: Partial<FirewallNamedObjectItem> & Record<string, any>): Promise<FirewallNamedObjectItem> {
  const objectId = body.id
  const method = objectId ? 'PUT' : 'POST'
  const url = objectId ? `/firewall/objects/${objectId}` : '/firewall/objects'
  const res = await fetch(url, {
    method,
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteFirewallObject(auth: AuthState, id: string): Promise<void> {
  const res = await fetch(`/firewall/objects/${id}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getFirewallSchema(auth: AuthState): Promise<FirewallSchema> {
  const res = await fetch('/firewall/schema', { headers: headers(auth) })
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

export async function reorderFirewallRules(auth: AuthState, table: string, orderedIds: string[]): Promise<FirewallRule[]> {
  const res = await fetch('/firewall/rules/reorder', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ table, ordered_ids: orderedIds }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function resetFirewallCounters(auth: AuthState, table?: string): Promise<void> {
  const res = await fetch('/firewall/counters/reset', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(table ? { table } : {}),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getFirewallSets(auth: AuthState): Promise<FirewallSetsState> {
  const res = await fetch('/firewall/sets', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item || { addr: [], port: [], iface: [] }
}

export async function upsertFirewallSet(auth: AuthState, kind: 'addr' | 'port' | 'iface', body: Partial<FirewallSetItem>): Promise<FirewallSetItem> {
  const res = await fetch(`/firewall/sets/${kind}`, {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteFirewallSet(auth: AuthState, kind: 'addr' | 'port' | 'iface', id: string): Promise<void> {
  const res = await fetch(`/firewall/sets/${kind}/${id}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getFirewallMaps(auth: AuthState): Promise<FirewallMapsState> {
  const res = await fetch('/firewall/maps', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item || { map: [], vmap: [] }
}

export async function upsertFirewallMap(auth: AuthState, kind: 'map' | 'vmap', body: Partial<FirewallMapItem>): Promise<FirewallMapItem> {
  const res = await fetch(`/firewall/maps/${kind}`, {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteFirewallMap(auth: AuthState, kind: 'map' | 'vmap', id: string): Promise<void> {
  const res = await fetch(`/firewall/maps/${kind}/${id}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getFirewallTables(auth: AuthState): Promise<FirewallTablesState> {
  const res = await fetch('/firewall/tables', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item || { builtin: [], custom: [] }
}

export async function upsertFirewallTable(auth: AuthState, body: Partial<FirewallTableItem>): Promise<FirewallTableItem> {
  const res = await fetch('/firewall/tables', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteFirewallTable(auth: AuthState, id: string): Promise<void> {
  const res = await fetch(`/firewall/tables/${id}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export type IpsecPeer = {
  name: string
  remote_addrs: string[]
  local_addrs: string[]
  ike_version: 2
  phase1_profile: string
  enabled: boolean
  dpd: boolean
  nat_t: boolean
  send_initial_contact: boolean
}

export type IpsecIdentity = {
  peer: string
  auth_method: 'psk'
  local_id: string
  remote_id: string
  psk?: string
  has_psk?: boolean
}

export type IpsecPolicy = {
  name: string
  peer: string
  local_ts: string[]
  remote_ts: string[]
  proposal: string
  action: 'encrypt'
  level: 'require' | 'use'
  mode: 'tunnel'
  start_action: 'start' | 'trap' | 'none'
  enabled: boolean
}

export type IpsecPhase1Profile = {
  name: string
  encryption: string
  hash: string
  dh_group: string
  lifetime: string
  proposal_check: string
  proposal_string?: string
}

export type IpsecPhase2Proposal = {
  name: string
  encryption: string
  auth: string
  pfs_group?: string | null
  lifetime: string
  proposal_string?: string
}

export type IpsecActivePeer = {
  status: string
  peer: string
  remote_address: string
  ike_version: string
  profile: string
  uptime: string
  rekey: string
  state: string
}

export type IpsecInstalledSa = {
  state: string
  child_sa: string
  spi_in: string
  spi_out: string
  local_ts: string[]
  remote_ts: string[]
  esp_proposal: string
  bytes_in: number
  bytes_out: number
}

export type IpsecApplyResult = {
  loaded_peers: string[]
  initiated_policies: string[]
  active_peers: IpsecActivePeer[]
  installed_sas: { items: IpsecInstalledSa[]; xfrm?: { state?: string; policy?: string } }
  warnings: string[]
}

export async function getIpsecPeers(auth: AuthState): Promise<IpsecPeer[]> {
  const res = await fetch('/api/ipsec/peers', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function upsertIpsecPeer(auth: AuthState, body: Partial<IpsecPeer>): Promise<IpsecPeer> {
  const hasName = typeof body.name === 'string' && body.name.trim()
  const url = hasName ? `/api/ipsec/peers/${encodeURIComponent(String(body.name))}` : '/api/ipsec/peers'
  const method = hasName ? 'PUT' : 'POST'
  const res = await fetch(url, {
    method,
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteIpsecPeer(auth: AuthState, name: string): Promise<void> {
  const res = await fetch(`/api/ipsec/peers/${encodeURIComponent(name)}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getIpsecIdentities(auth: AuthState): Promise<IpsecIdentity[]> {
  const res = await fetch('/api/ipsec/identities', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function upsertIpsecIdentity(auth: AuthState, body: Partial<IpsecIdentity>): Promise<IpsecIdentity> {
  const res = await fetch('/api/ipsec/identities', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function getIpsecPolicies(auth: AuthState): Promise<IpsecPolicy[]> {
  const res = await fetch('/api/ipsec/policies', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function upsertIpsecPolicy(auth: AuthState, body: Partial<IpsecPolicy>): Promise<IpsecPolicy> {
  const hasName = typeof body.name === 'string' && body.name.trim()
  const url = hasName ? `/api/ipsec/policies/${encodeURIComponent(String(body.name))}` : '/api/ipsec/policies'
  const method = hasName ? 'PUT' : 'POST'
  const res = await fetch(url, {
    method,
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function deleteIpsecPolicy(auth: AuthState, name: string): Promise<void> {
  const res = await fetch(`/api/ipsec/policies/${encodeURIComponent(name)}`, { method: 'DELETE', headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getIpsecPhase1Profiles(auth: AuthState): Promise<IpsecPhase1Profile[]> {
  const res = await fetch('/api/ipsec/phase1-profiles', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function upsertIpsecPhase1Profile(auth: AuthState, body: Partial<IpsecPhase1Profile>): Promise<IpsecPhase1Profile> {
  const res = await fetch('/api/ipsec/phase1-profiles', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function getIpsecPhase2Proposals(auth: AuthState): Promise<IpsecPhase2Proposal[]> {
  const res = await fetch('/api/ipsec/phase2-proposals', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function upsertIpsecPhase2Proposal(auth: AuthState, body: Partial<IpsecPhase2Proposal>): Promise<IpsecPhase2Proposal> {
  const res = await fetch('/api/ipsec/phase2-proposals', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function applyIpsec(auth: AuthState): Promise<IpsecApplyResult> {
  const res = await fetch('/api/ipsec/apply', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.item
}

export async function getIpsecActivePeers(auth: AuthState): Promise<IpsecActivePeer[]> {
  const res = await fetch('/api/ipsec/active-peers', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || []
}

export async function getIpsecInstalledSas(auth: AuthState): Promise<{ items: IpsecInstalledSa[]; xfrm?: { state?: string; policy?: string } }> {
  const res = await fetch('/api/ipsec/installed-sas', { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const payload = await res.json()
  return payload.items || { items: [] }
}

export async function initiateIpsecPolicy(auth: AuthState, policyName: string): Promise<void> {
  const res = await fetch(`/api/ipsec/initiate/${encodeURIComponent(policyName)}`, {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function terminateIpsecPeer(auth: AuthState, peerName: string): Promise<void> {
  const res = await fetch(`/api/ipsec/terminate/${encodeURIComponent(peerName)}`, {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(await parseError(res))
}
