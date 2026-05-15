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

async function getFirewallState(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  return await res.json()
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

function getRuleLineByComment(ruleset: string, comment: string): string {
  const lines = String(ruleset || '').split('\n')
  return lines.find((line) => line.includes(`comment "${comment}"`)) || ''
}

test('block A: raw table accepts raw_expr + nftrace + notrack and maps to runtime', async ({ request }) => {
  const comment = `block-a-raw-${Date.now()}`
  const payload = {
    table: 'raw',
    chain: 'prerouting',
    action: 'accept',
    proto: 'tcp',
    dport: '45561',
    raw_expr: 'meta length > 80',
    nftrace: true,
    notrack: true,
    comment,
    enabled: true,
  }

  const createRes = await createRule(request, payload)
  if (!createRes.ok()) {
    throw new Error(`create failed ${createRes.status()}: ${await createRes.text()}`)
  }
  const created = (await createRes.json()).item
  expect(created.raw_expr).toBe('meta length > 80')
  expect(created.nftrace).toBeTruthy()
  expect(created.notrack).toBeTruthy()

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('tcp dport 45561')
  expect(line).toContain('meta length > 80')
  expect(line).toContain('notrack')
  expect(line).toContain('meta nftrace set 1')
  expect(line).not.toContain(' notrack accept')

  await deleteRule(request, created.id)
})

test('block A: nftrace and raw_expr are rejected outside raw table', async ({ request }) => {
  const badNftrace = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    nftrace: true,
    comment: `block-a-bad-nftrace-${Date.now()}`,
  })
  expect(badNftrace.ok()).toBeFalsy()
  expect([400, 422]).toContain(badNftrace.status())
  expect(await badNftrace.text()).toContain('nftrace is only valid for raw table')

  const badRawExpr = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    raw_expr: 'meta length > 80',
    comment: `block-a-bad-rawexpr-${Date.now()}`,
  })
  expect(badRawExpr.ok()).toBeFalsy()
  expect([400, 422]).toContain(badRawExpr.status())
  expect(await badRawExpr.text()).toContain('raw_expr is only valid for raw table')
})
