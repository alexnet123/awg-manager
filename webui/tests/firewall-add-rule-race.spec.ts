import { expect, test, type APIRequestContext } from '@playwright/test'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function listRules(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  return payload?.item?.rules || []
}

async function createRule(request: APIRequestContext, payload: Record<string, unknown>) {
  return await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: payload,
  })
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

test('parallel create same payload should not create many duplicates', async ({ request }) => {
  const markerPort = String(42000 + Math.floor(Math.random() * 1000))
  const payload = {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: markerPort,
    comment: `race-same-${Date.now()}`,
    enabled: true,
  }

  const beforeRules = await listRules(request)
  const beforeCount = beforeRules.filter((r: any) => r?.dport === markerPort).length

  const attempts = 5
  const results = await Promise.all(
    Array.from({ length: attempts }, () => createRule(request, payload)),
  )
  const okCount = results.filter((r) => r.ok()).length
  expect(okCount).toBeGreaterThanOrEqual(1)

  const afterRules = await listRules(request)
  const created = afterRules.filter((r: any) => r?.dport === markerPort)
  const delta = created.length - beforeCount

  // Current strict target: one logical rule for same payload.
  // If this fails, backend needs dedup/idempotency guard.
  expect(delta).toBeLessThanOrEqual(1)

  for (const r of created) {
    if (r?.id) await deleteRule(request, r.id)
  }
})

test('parallel create different payloads should create all valid rules', async ({ request }) => {
  const base = 43000 + Math.floor(Math.random() * 1000)
  const payloads = [0, 1, 2, 3].map((i) => ({
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: String(base + i),
    comment: `race-diff-${Date.now()}-${i}`,
    enabled: true,
  }))

  const results = await Promise.all(payloads.map((p) => createRule(request, p)))
  const ok = results.filter((r) => r.ok()).length
  expect(ok).toBe(payloads.length)

  const rules = await listRules(request)
  const created = rules.filter((r: any) => {
    const dp = Number(r?.dport || 0)
    return dp >= base && dp < base + payloads.length
  })
  expect(created.length).toBe(payloads.length)

  for (const r of created) {
    if (r?.id) await deleteRule(request, r.id)
  }
})
