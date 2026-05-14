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

test('negative fuzz: invalid payloads are rejected with no rule growth', async ({ request }) => {
  const beforeCount = (await listRules(request)).length

  const invalidPayloads: Array<Record<string, unknown>> = [
    // IP/CIDR
    { table: 'filter', chain: 'input', action: 'accept', src: '300.1.1.1/24' },
    { table: 'filter', chain: 'input', action: 'accept', dst: '10.0.0.1/99' },
    // ports
    { table: 'filter', chain: 'input', action: 'accept', proto: 'tcp', dport: '70000' },
    { table: 'filter', chain: 'input', action: 'accept', proto: 'tcp', sport: '-1' },
    { table: 'filter', chain: 'input', action: 'accept', proto: 'tcp', dport: '22,,80' },
    // protocol/action combos
    { table: 'raw', chain: 'prerouting', action: 'jump', target_chain: 'x' },
    { table: 'mangle', chain: 'input', action: 'accept', notrack: true },
    { table: 'filter', chain: 'input', action: 'accept', nat_type: 'snat' },
    // nat chain mismatch
    { table: 'nat', chain: 'postrouting', action: 'accept', nat_type: 'dnat', to_addr: '10.8.0.2', to_port: '443' },
    { table: 'nat', chain: 'prerouting', action: 'accept', nat_type: 'masquerade' },
    // nat flags without nat statement
    { table: 'nat', chain: 'output', action: 'accept', nat_random: true },
    { table: 'nat', chain: 'output', action: 'accept', nat_fully_random: true },
    { table: 'nat', chain: 'output', action: 'accept', nat_persistent: true },
    // invalid mark/log
    { table: 'mangle', chain: 'forward', action: 'accept', mark_set: 'zzz' },
    { table: 'filter', chain: 'input', action: 'accept', log_level: 'verbose' },
    // invalid chain/table
    { table: 'filter', chain: 'postrouting', action: 'accept' },
    { table: 'nat', chain: 'foobar', action: 'accept' },
    // invalid target chain symbols
    { table: 'filter', chain: 'input', action: 'jump', target_chain: 'bad chain' },
    // invalid ct state
    { table: 'filter', chain: 'input', action: 'accept', ct_state: 'established,new' },
  ]

  for (const payload of invalidPayloads) {
    const res = await createRule(request, payload)
    expect(res.ok(), `unexpected success for payload: ${JSON.stringify(payload)}`).toBeFalsy()
    expect([400, 422, 500]).toContain(res.status())
  }

  const afterCount = (await listRules(request)).length
  expect(afterCount).toBe(beforeCount)
})
