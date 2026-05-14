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

test('base wired fields: dst + in/out iface + ct_state + limit_rate persist', async ({ request }) => {
  const payload = {
    table: 'filter',
    chain: 'forward',
    action: 'accept',
    proto: 'tcp',
    src: '10.8.0.0/24',
    dst: '10.9.0.0/24',
    sport: '12000:12100',
    dport: '443',
    in_interface: 'awg1',
    out_interface: 'eth0',
    ct_state: 'established,related',
    limit_rate: '100/second',
    comment: `wired-base-${Date.now()}`,
    enabled: true,
  }

  const res = await createRule(request, payload)
  if (!res.ok()) {
    throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  }
  const created = (await res.json()).item
  const id = created.id as string

  expect(created.dst).toBe(payload.dst)
  expect(created.in_interface).toBe(payload.in_interface)
  expect(created.out_interface).toBe(payload.out_interface)
  expect(created.ct_state).toBe(payload.ct_state)
  expect(created.limit_rate).toBe(payload.limit_rate)

  const rules = await listRules(request)
  const fromApi = rules.find((r: any) => r.id === id)
  expect(fromApi).toBeTruthy()
  expect(fromApi.dst).toBe(payload.dst)
  expect(fromApi.in_interface).toBe(payload.in_interface)
  expect(fromApi.out_interface).toBe(payload.out_interface)
  expect(fromApi.ct_state).toBe(payload.ct_state)
  expect(fromApi.limit_rate).toBe(payload.limit_rate)

  await deleteRule(request, id)
})

test('advanced expressions: API stores safe values without quote chars', async ({ request }) => {
  const payload = {
    table: 'raw',
    chain: 'output',
    action: 'accept',
    proto: 'udp',
    dport: '53',
    fib_expr: 'meta length > 40',
    socket_expr: 'meta priority set 1',
    rt_expr: 'meta mark set 0x11',
    exthdr_expr: 'meta nftrace set 1',
    comment: `wired-adv-${Date.now()}`,
    enabled: true,
  }

  const res = await createRule(request, payload)
  if (!res.ok()) {
    throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  }
  const created = (await res.json()).item
  const id = created.id as string

  expect(created.fib_expr).toBe(payload.fib_expr)
  expect(created.socket_expr).toBe(payload.socket_expr)
  expect(created.rt_expr).toBe(payload.rt_expr)
  expect(created.exthdr_expr).toBe(payload.exthdr_expr)

  const rules = await listRules(request)
  const fromApi = rules.find((r: any) => r.id === id)
  expect(fromApi).toBeTruthy()
  expect(fromApi.fib_expr).toBe(payload.fib_expr)
  expect(fromApi.socket_expr).toBe(payload.socket_expr)
  expect(fromApi.rt_expr).toBe(payload.rt_expr)
  expect(fromApi.exthdr_expr).toBe(payload.exthdr_expr)

  await deleteRule(request, id)
})

test('nat wired fields: nat_type + to + nat flags persist', async ({ request }) => {
  const payload = {
    table: 'nat',
    chain: 'prerouting',
    action: 'accept',
    proto: 'tcp',
    dport: '8080',
    nat_type: 'dnat',
    to_addr: '10.8.0.2',
    to_port: '80',
    nat_random: true,
    nat_fully_random: false,
    nat_persistent: true,
    comment: `wired-nat-${Date.now()}`,
    enabled: true,
  }

  const res = await createRule(request, payload)
  if (!res.ok()) {
    throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  }
  const created = (await res.json()).item
  const id = created.id as string

  expect(created.nat_type).toBe(payload.nat_type)
  expect(created.to_addr).toBe(payload.to_addr)
  expect(created.to_port).toBe(payload.to_port)
  expect(created.nat_random).toBeTruthy()
  expect(created.nat_persistent).toBeTruthy()

  const rules = await listRules(request)
  const fromApi = rules.find((r: any) => r.id === id)
  expect(fromApi).toBeTruthy()
  expect(fromApi.nat_type).toBe(payload.nat_type)
  expect(fromApi.to_addr).toBe(payload.to_addr)
  expect(fromApi.to_port).toBe(payload.to_port)
  expect(fromApi.nat_random).toBeTruthy()
  expect(fromApi.nat_persistent).toBeTruthy()

  await deleteRule(request, id)
})
