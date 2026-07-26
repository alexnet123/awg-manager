import { type AuthState, headers, parseError } from '../common/api'

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
  enabled: boolean
}

export type ClientItem = {
  id: number
  name: string
  pubkey: string
  ip: string
  wg_interface: string
  allowed_ips: string
  enabled: boolean
  privkey?: string
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

export async function setInterfaceEnabled(auth: AuthState, id: number, enabled: boolean): Promise<InterfaceItem> {
  const action = enabled ? 'enable' : 'disable'
  const res = await fetch(`/interfaces/${id}/${action}`, { method: 'POST', headers: headers(auth) })
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

export async function setClientEnabled(auth: AuthState, id: number, enabled: boolean): Promise<ClientItem> {
  const action = enabled ? 'enable' : 'disable'
  const res = await fetch(`/clients/${id}/${action}`, { method: 'POST', headers: headers(auth) })
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
