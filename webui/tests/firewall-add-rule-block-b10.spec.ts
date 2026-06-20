import { expect, test, type APIRequestContext } from '@playwright/test'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function createRule(request: APIRequestContext, payload: Record<string, unknown>) {
  return await request.post('/firewall/rules', { headers: authHeaders(), data: payload })
}

async function createTable(request: APIRequestContext, payload: Record<string, unknown>) {
  return await request.post('/firewall/tables', { headers: authHeaders(), data: payload })
}

async function getFirewallState(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  return await res.json()
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

async function deleteTable(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/tables/${id}`, { headers: authHeaders() })
}

function getRuleLineByComment(ruleset: string, comment: string): string {
  const lines = String(ruleset || '').split('\n')
  return lines.find((line) => line.includes(`comment "${comment}"`)) || ''
}

test('block B10: dscp maps to runtime', async ({ request }) => {
  const comment = `block-b10-${Date.now()}`
  const res = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    dscp: 'cs5',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('ip dscp cs5')

  await deleteRule(request, created.id)
})

test('block B10: dscp maps to ip6 runtime for ip6 tables', async ({ request }) => {
  const suffix = Date.now()
  const tableName = `ip6_dscp_b10_${suffix}`
  const tableRes = await createTable(request, {
    family: 'ip6',
    table_name: tableName,
    chain_name: 'input',
    chain_type: 'filter',
    hook: 'input',
    priority: 13,
    policy: 'accept',
  })
  if (!tableRes.ok()) throw new Error(`table create failed ${tableRes.status()}: ${await tableRes.text()}`)
  const table = (await tableRes.json()).item

  let created: any = null
  try {
    const comment = `block-b10-ip6-${suffix}`
    const res = await createRule(request, {
      family: 'ip6',
      table: tableName,
      chain: 'input',
      action: 'accept',
      dscp: 'cs5',
      comment,
      enabled: true,
    })
    if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
    created = (await res.json()).item

    const state = await getFirewallState(request)
    const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
    expect(line).toContain('ip6 dscp cs5')
  } finally {
    if (created?.id) await deleteRule(request, created.id)
    await deleteTable(request, table.id)
  }
})

test('block B10: invalid dscp is rejected', async ({ request }) => {
  const bad = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    dscp: 'cs99',
    comment: `block-b10-bad-${Date.now()}`,
  })
  expect(bad.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad.status())
  expect(await bad.text()).toContain('dscp')
})
