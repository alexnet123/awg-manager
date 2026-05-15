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

test('block B: tcp_flags maps to runtime nft', async ({ request }) => {
  const comment = `block-b-tcp-${Date.now()}`
  const res = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: '45571',
    tcp_flags: 'syn',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('tcp dport 45571')
  expect(line).toContain('tcp flags syn')

  await deleteRule(request, created.id)
})

test('block B: icmp type/code maps to runtime nft', async ({ request }) => {
  const comment = `block-b-icmp-${Date.now()}`
  const res = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'icmp',
    icmp_type: 'echo-request',
    icmp_code: '0',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('icmp type echo-request')
  expect(line).toContain('icmp code')

  await deleteRule(request, created.id)
})

test('block B: meta_length and ct_status map to runtime nft', async ({ request }) => {
  const comment = `block-b-meta-${Date.now()}`
  const res = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    proto: 'tcp',
    dport: '45572',
    meta_length: '64-1500',
    ct_status: 'dnat,assured',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('meta length 64-1500')
  expect(line).toContain('ct status')
  expect(line).toContain('assured')
  expect(line).toContain('dnat')

  await deleteRule(request, created.id)
})

test('block B: incompatible proto combinations are rejected', async ({ request }) => {
  const badTcpFlags = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'udp',
    tcp_flags: 'syn',
    comment: `block-b-bad-tcp-${Date.now()}`,
  })
  expect(badTcpFlags.ok()).toBeFalsy()
  expect([400, 422]).toContain(badTcpFlags.status())
  expect(await badTcpFlags.text()).toContain('tcp_flags requires proto tcp')

  const badIcmp = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    icmp_type: 'echo-request',
    comment: `block-b-bad-icmp-${Date.now()}`,
  })
  expect(badIcmp.ok()).toBeFalsy()
  expect([400, 422]).toContain(badIcmp.status())
  expect(await badIcmp.text()).toContain('icmp_type/icmp_code require proto icmp')
})
