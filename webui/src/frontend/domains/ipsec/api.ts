import { type AuthState, headers, parseError } from '../common/api'

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
