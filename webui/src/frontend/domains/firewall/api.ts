import { type AuthState, headers, parseError } from '../common/api'

export type FirewallRule = {
  id: string
  table: string
  family: 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
  chain: string
  action: '' | 'accept' | 'drop' | 'reject' | 'jump' | 'goto' | 'return' | 'queue' | 'fwd'
  proto?: string | null
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
  set_stmt_op?: 'add' | 'update' | null
  set_stmt_name?: string | null
  set_stmt_expr?: 'ip saddr' | 'ip daddr' | 'tcp dport' | 'udp dport' | null
  set_stmt_timeout?: string | null
  set_stmt_comment?: string | null
  vmap_stmt_expr?: 'meta l4proto' | null
  vmap_stmt_name?: string | null
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
  dynamic?: boolean
  size?: number | null
  gc_interval?: string | null
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
