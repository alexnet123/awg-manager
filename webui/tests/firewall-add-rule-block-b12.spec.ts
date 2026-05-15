import { expect, test, type APIRequestContext } from '@playwright/test'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
}

async function createRule(request: APIRequestContext, payload: Record<string, unknown>) {
  return request.post('/firewall/rules', { headers: authHeaders(), data: payload })
}

async function getFirewallState(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

function getRuleLineByComment(ruleset: string, comment: string): string {
  const lines = String(ruleset || '').split('\n')
  return lines.find((line) => line.includes(`comment "${comment}"`)) || ''
}

test('block B12: fib/socket/rt/exthdr fields map to runtime', async ({ request }) => {
  const comment = `block-b12-${Date.now()}`
  const res = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    fib_check: 'daddr type local',
    socket_match: 'transparent 1',
    rt_nexthop: '192.0.2.1',
    ipv6_exthdrs: 'frag missing',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('fib daddr type local')
  expect(line).toContain('socket transparent 1')
  expect(line).toContain('rt nexthop 192.0.2.1')
  expect(line).toContain('exthdr frag missing')

  await deleteRule(request, created.id)
})

test('block B12: invalid fib_check chars are rejected', async ({ request }) => {
  const bad = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    fib_check: 'daddr type local; rm -rf /',
    comment: `block-b12-bad-${Date.now()}`,
  })
  expect(bad.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad.status())
  expect(await bad.text()).toContain('fib_check')
})
