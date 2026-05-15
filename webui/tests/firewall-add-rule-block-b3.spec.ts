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

test('block B3: meta pkttype + iifgroup + oifgroup map to runtime', async ({ request }) => {
  const comment = `block-b3-${Date.now()}`
  const res = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    proto: 'tcp',
    dport: '45591',
    meta_pkttype: 'host',
    meta_iifgroup: '10',
    meta_oifgroup: '20',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('meta pkttype host')
  expect(line).toContain('iifgroup 10')
  expect(line).toContain('oifgroup 20')

  await deleteRule(request, created.id)
})

test('block B3: invalid meta group and pkttype are rejected', async ({ request }) => {
  const badPktType = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    meta_pkttype: 'invalid_type',
    comment: `block-b3-bad-pkt-${Date.now()}`,
  })
  expect(badPktType.ok()).toBeFalsy()
  expect([400, 422]).toContain(badPktType.status())
  expect(await badPktType.text()).toContain('meta_pkttype')

  const badGroup = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    meta_iifgroup: 'abc',
    comment: `block-b3-bad-grp-${Date.now()}`,
  })
  expect(badGroup.ok()).toBeFalsy()
  expect([400, 422]).toContain(badGroup.status())
  expect(await badGroup.text()).toContain('meta_iifgroup')
})
