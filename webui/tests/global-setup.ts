import type { FullConfig } from '@playwright/test'

function getOriginFromBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  return `${url.protocol}//${url.host}`
}

async function apiFetch(origin: string, apiKey: string, path: string, init?: RequestInit) {
  const res = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  return res
}

export default async function globalSetup(config: FullConfig) {
  const apiKey = process.env.PLAYWRIGHT_API_KEY
  if (!apiKey) {
    throw new Error('PLAYWRIGHT_API_KEY is required for e2e tests')
  }

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || config.projects[0]?.use?.baseURL || 'http://127.0.0.1:8787/ui/'
  const origin = getOriginFromBaseUrl(String(baseUrl))

  const clientsRes = await apiFetch(origin, apiKey, '/clients')
  if (!clientsRes.ok) {
    throw new Error(`globalSetup: failed to fetch /clients: HTTP ${clientsRes.status}`)
  }
  const clientsPayload = await clientsRes.json() as { items?: Array<{ id: number }> }
  for (const client of clientsPayload.items || []) {
    await apiFetch(origin, apiKey, `/clients/${client.id}`, { method: 'DELETE' })
  }

  const interfacesRes = await apiFetch(origin, apiKey, '/interfaces')
  if (!interfacesRes.ok) {
    throw new Error(`globalSetup: failed to fetch /interfaces: HTTP ${interfacesRes.status}`)
  }
  const interfacesPayload = await interfacesRes.json() as { items?: Array<{ id: number }> }
  for (const iface of interfacesPayload.items || []) {
    await apiFetch(origin, apiKey, `/interfaces/${iface.id}`, { method: 'DELETE' })
  }
}
