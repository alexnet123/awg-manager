import { expect, test, type APIRequestContext } from '@playwright/test'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function createRule(request: APIRequestContext, payload: Record<string, unknown>) {
  return await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: payload,
  })
}

async function getFirewall(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  return await res.json()
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

test('enabled=false rule is persisted but not applied to runtime counters', async ({ request }) => {
  const payload = {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: '45511',
    enabled: false,
    comment: `disabled-${Date.now()}`,
  }
  const res = await createRule(request, payload)
  expect(res.ok()).toBeTruthy()
  const created = (await res.json()).item
  expect(created.enabled).toBeFalsy()

  const state = await getFirewall(request)
  const row = (state?.item?.rules || []).find((r: any) => r.id === created.id)
  expect(row).toBeTruthy()
  expect(row.enabled).toBeFalsy()
  expect(row.runtime_packets).toBe(0)
  expect(row.runtime_bytes).toBe(0)

  await deleteRule(request, created.id)
})

test('jump action requires user-defined target_chain and rejects base chains', async ({ request }) => {
  const bad = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'jump',
    comment: `jump-bad-${Date.now()}`,
  })
  expect(bad.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad.status())

  const baseChain = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'jump',
    target_chain: 'forward',
    comment: `jump-base-${Date.now()}`,
  })
  expect(baseChain.ok()).toBeFalsy()
  expect([400, 422]).toContain(baseChain.status())
  const txt = await baseChain.text()
  expect(txt).toContain('user-defined chain')
})

test('log fields and counter are returned with runtime history payload', async ({ request }) => {
  const payload = {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: '8787',
    log_prefix: 'API_LOG:',
    log_level: 'info',
    counter: true,
    comment: `stats-${Date.now()}`,
    enabled: true,
  }
  const res = await createRule(request, payload)
  expect(res.ok()).toBeTruthy()
  const created = (await res.json()).item

  const state = await getFirewall(request)
  const row = (state?.item?.rules || []).find((r: any) => r.id === created.id)
  expect(row).toBeTruthy()
  expect(row.log_prefix).toBe('API_LOG:')
  expect(row.log_level).toBe('info')
  expect(row.counter).toBeTruthy()
  expect(Array.isArray(row.runtime_history)).toBeTruthy()
  expect(typeof row.runtime_pps).toBe('number')
  expect(typeof row.runtime_bps).toBe('number')

  await deleteRule(request, created.id)
})
