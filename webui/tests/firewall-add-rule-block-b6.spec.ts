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

test('block B6: packet/ct mark match map to runtime', async ({ request }) => {
  const comment = `block-b6-${Date.now()}`
  const res = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    proto: 'tcp',
    dport: '45621',
    mark_match: '0x10',
    ct_mark_match: '0x20',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('meta mark')
  expect(line).toContain('ct mark')

  await deleteRule(request, created.id)
})

test('block B6: invalid mark match values are rejected', async ({ request }) => {
  const bad1 = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    mark_match: '0xZZ',
    comment: `block-b6-bad1-${Date.now()}`,
  })
  expect(bad1.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad1.status())
  expect(await bad1.text()).toContain('mark_match')

  const bad2 = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    ct_mark_match: 'abc',
    comment: `block-b6-bad2-${Date.now()}`,
  })
  expect(bad2.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad2.status())
  expect(await bad2.text()).toContain('ct_mark_match')
})
