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

test('block B8: l2 fields map to runtime', async ({ request }) => {
  const comment = `block-b8-${Date.now()}`
  const res = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: '45623',
    vlan_id: '10',
    ether_src: 'aa:bb:cc:dd:ee:ff',
    ether_dst: '11:22:33:44:55:66',
    ether_type: '0x0800',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('vlan id 10')
  expect(line).toContain('ether saddr aa:bb:cc:dd:ee:ff')
  expect(line).toContain('ether daddr 11:22:33:44:55:66')
  expect(line).toContain('ether type 0x0800')

  await deleteRule(request, created.id)
})

test('block B8: invalid l2 values are rejected', async ({ request }) => {
  const badVlan = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    vlan_id: '5000',
    comment: `block-b8-vlan-${Date.now()}`,
  })
  expect(badVlan.ok()).toBeFalsy()
  expect([400, 422]).toContain(badVlan.status())
  expect(await badVlan.text()).toContain('vlan_id')

  const badMac = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    ether_src: 'zz:bb:cc:dd:ee:ff',
    comment: `block-b8-mac-${Date.now()}`,
  })
  expect(badMac.ok()).toBeFalsy()
  expect([400, 422]).toContain(badMac.status())
  expect(await badMac.text()).toContain('ether_src')
})
