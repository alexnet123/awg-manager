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

test('runtime nft equivalence: filter fields map to nft rule expression', async ({ request }) => {
  const comment = `nft-eq-filter-${Date.now()}`
  const payload = {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    src: '10.8.0.0/24',
    dport: '45521',
    in_interface: 'awg1',
    ct_state: 'established,related',
    limit_rate: '25/second',
    log_prefix: 'EQ:',
    log_level: 'info',
    counter: true,
    comment,
    enabled: true,
  }

  const createRes = await createRule(request, payload)
  expect(createRes.ok()).toBeTruthy()
  const created = (await createRes.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('iifname "awg1"')
  expect(line).toContain('ip saddr 10.8.0.0/24')
  expect(line).toContain('ct state established,related')
  expect(line).toContain('tcp dport 45521')
  expect(line).toContain('limit rate 25/second')
  expect(line).toContain('log prefix "EQ:" level info')
  expect(line).toContain('counter')
  expect(line).toContain('accept')

  await deleteRule(request, created.id)
})

test('runtime nft equivalence: mangle marks map to nft expression', async ({ request }) => {
  const comment = `nft-eq-mangle-${Date.now()}`
  const payload = {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    proto: 'udp',
    dport: '45522',
    mark_set: '0x10',
    ct_mark_set: '0x20',
    comment,
    enabled: true,
  }

  const createRes = await createRule(request, payload)
  expect(createRes.ok()).toBeTruthy()
  const created = (await createRes.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('udp dport 45522')
  expect(line).toContain('meta mark set 0x00000010')
  expect(line).toContain('ct mark set 0x00000020')
  expect(line).toContain('accept')

  await deleteRule(request, created.id)
})

test('runtime nft equivalence: nat dnat maps to nft expression with flags', async ({ request }) => {
  const comment = `nft-eq-nat-${Date.now()}`
  const payload = {
    table: 'nat',
    chain: 'prerouting',
    action: 'accept',
    proto: 'tcp',
    dport: '45523',
    nat_type: 'dnat',
    to_addr: '10.8.0.2',
    to_port: '8443',
    nat_random: true,
    nat_persistent: true,
    comment,
    enabled: true,
  }

  const createRes = await createRule(request, payload)
  expect(createRes.ok()).toBeTruthy()
  const created = (await createRes.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('tcp dport 45523')
  expect(line).toContain('dnat ip to 10.8.0.2:8443')
  expect(line).toContain('random,persistent')

  await deleteRule(request, created.id)
})

test('runtime nft equivalence: disabled rule is not applied to ruleset', async ({ request }) => {
  const comment = `nft-eq-disabled-${Date.now()}`
  const payload = {
    table: 'filter',
    chain: 'input',
    action: 'drop',
    proto: 'tcp',
    dport: '45524',
    comment,
    enabled: false,
  }

  const createRes = await createRule(request, payload)
  expect(createRes.ok()).toBeTruthy()
  const created = (await createRes.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toBe('')

  await deleteRule(request, created.id)
})
