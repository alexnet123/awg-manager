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

test('block B4: meta iiftype/oiftype map to runtime', async ({ request }) => {
  const comment = `block-b4-${Date.now()}`
  const res = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    proto: 'tcp',
    dport: '45601',
    meta_iiftype: '1',
    meta_oiftype: '1',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('iiftype')
  expect(line).toContain('oiftype')

  await deleteRule(request, created.id)
})

test('block B4: invalid iiftype/oiftype are rejected', async ({ request }) => {
  const badIif = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    meta_iiftype: 'ether',
    comment: `block-b4-bad-iif-${Date.now()}`,
  })
  expect(badIif.ok()).toBeFalsy()
  expect([400, 422]).toContain(badIif.status())
  expect(await badIif.text()).toContain('meta_iiftype')

  const badOif = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    meta_oiftype: 'x-1',
    comment: `block-b4-bad-oif-${Date.now()}`,
  })
  expect(badOif.ok()).toBeFalsy()
  expect([400, 422]).toContain(badOif.status())
  expect(await badOif.text()).toContain('meta_oiftype')
})
