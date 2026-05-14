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

async function listRules(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  return payload?.item?.rules || []
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

test('runtime fields: log + counter + reject_type persist correctly', async ({ request }) => {
  const payload = {
    table: 'filter',
    chain: 'input',
    action: 'reject',
    reject_type: 'tcp reset',
    proto: 'tcp',
    dport: '45501',
    log_prefix: 'FW_TEST:',
    log_level: 'info',
    counter: true,
    comment: `runtime-fields-${Date.now()}`,
    enabled: true,
  }

  const res = await createRule(request, payload)
  if (!res.ok()) {
    throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  }
  const created = (await res.json()).item
  const id = created.id as string
  expect(created.reject_type).toBe('tcp reset')
  expect(created.log_prefix).toBe('FW_TEST:')
  expect(created.log_level).toBe('info')
  expect(created.counter).toBeTruthy()

  const rules = await listRules(request)
  const fromApi = rules.find((r: any) => r.id === id)
  expect(fromApi).toBeTruthy()
  expect(fromApi.reject_type).toBe('tcp reset')
  expect(fromApi.log_prefix).toBe('FW_TEST:')
  expect(fromApi.log_level).toBe('info')
  expect(fromApi.counter).toBeTruthy()

  await deleteRule(request, id)
})

test('runtime fields: mangle mark_set + ct_mark_set persist', async ({ request }) => {
  const payload = {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    mark_set: '0x10',
    ct_mark_set: '0x20',
    proto: 'tcp',
    dport: '45502',
    comment: `runtime-marks-${Date.now()}`,
    enabled: true,
  }
  const res = await createRule(request, payload)
  if (!res.ok()) {
    throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  }
  const created = (await res.json()).item
  const id = created.id as string
  expect(created.mark_set).toBe('0x10')
  expect(created.ct_mark_set).toBe('0x20')

  const rules = await listRules(request)
  const fromApi = rules.find((r: any) => r.id === id)
  expect(fromApi).toBeTruthy()
  expect(fromApi.mark_set).toBe('0x10')
  expect(fromApi.ct_mark_set).toBe('0x20')

  await deleteRule(request, id)
})

test('runtime fields: ct helper/timeout/expectation set persist', async ({ request }) => {
  const before = (await listRules(request)).length
  const payload = {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: '45503',
    ct_helper_set: 'ftp-standard',
    ct_timeout_set: 'customtimeout',
    ct_expectation_set: 'expect',
    comment: `runtime-ct-${Date.now()}`,
    enabled: true,
  }
  const res = await createRule(request, payload)
  expect(res.ok()).toBeFalsy()
  expect([400, 422]).toContain(res.status())
  const txt = await res.text()
  expect(txt).toContain('not enabled yet')
  const after = (await listRules(request)).length
  expect(after).toBe(before)
})
