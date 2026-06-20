import { expect, test, type APIRequestContext } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

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

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
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

  expect(created.proto).toBe('tcp')
  expect(created.dport).toBe('45571')
  expect(created.tcp_flags).toBe('syn')

  await deleteRule(request, created.id)
})

test('block B: tcp flags picker saves combined flags', async ({ page, request }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  const comment = `block-b-tcp-ui-${Date.now()}`

  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByPlaceholder('Rule comment (optional)').fill(comment)
  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (!(await modal.getByText('tcp flags').isVisible())) {
    await modal.getByRole('button', { name: 'Network & L4 extras +' }).click()
  }
  const tcpFlagsLine = modal.locator('div.space-y-1\\.5', { hasText: 'tcp flags' }).first()
  await tcpFlagsLine.getByRole('button', { name: '+' }).click()
  await tcpFlagsLine.getByLabel('SYN + ACK').check()
  await modal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(modal).toBeHidden({ timeout: 15_000 })

  const res = await request.get('/firewall/rules?family=inet&table=filter', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  const created = (payload.items || []).find((row: any) => row.comment === comment)
  expect(created).toBeTruthy()
  expect(created.proto).toBe('tcp')
  expect(created.tcp_flags).toBe('syn,ack')

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

  expect(created.proto).toBe('icmp')
  expect(created.icmp_type).toBe('echo-request')
  expect(created.icmp_code).toBe('0')

  await deleteRule(request, created.id)
})

test('block B: ICMP IPv4 grouped editor saves type and code', async ({ page, request }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  const comment = `block-b-icmp-ui-${Date.now()}`

  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByPlaceholder('Rule comment (optional)').fill(comment)
  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (!(await modal.getByText('ICMP IPv4').isVisible())) {
    await modal.getByRole('button', { name: 'Network & L4 extras +' }).click()
  }
  const icmpLine = modal.locator('div.space-y-1\\.5', { hasText: 'ICMP IPv4' }).first()
  await icmpLine.getByRole('button', { name: '+' }).click()
  await expect(icmpLine.getByText('Common type options')).toBeVisible()
  await icmpLine.getByRole('button', { name: 'destination-unreachable network/host/port error' }).click()
  await expect(icmpLine.getByText('Code options for destination-unreachable')).toBeVisible()
  await icmpLine.getByRole('button', { name: '3 port unreachable' }).click()
  await modal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(modal).toBeHidden({ timeout: 15_000 })

  const res = await request.get('/firewall/rules?family=inet&table=filter', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  const created = (payload.items || []).find((row: any) => row.comment === comment)
  expect(created).toBeTruthy()
  expect(created.proto).toBe('icmp')
  expect(created.icmp_type).toBe('destination-unreachable')
  expect(created.icmp_code).toBe('3')

  await deleteRule(request, created.id)
})

test('block B: ICMP IPv6 grouped editor saves type and code', async ({ page, request }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  const comment = `block-b-icmpv6-ui-${Date.now()}`

  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByPlaceholder('Rule comment (optional)').fill(comment)
  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (!(await modal.getByText('ICMP IPv6').isVisible())) {
    await modal.getByRole('button', { name: 'Network & L4 extras +' }).click()
  }
  const icmpv6Line = modal.locator('div.space-y-1\\.5', { hasText: 'ICMP IPv6' }).first()
  await icmpv6Line.getByRole('button', { name: '+' }).click()
  await expect(icmpv6Line.getByText('Common type options')).toBeVisible()
  await icmpv6Line.getByRole('button', { name: 'packet-too-big PMTU discovery' }).click()
  await expect(icmpv6Line.getByText('Code options for packet-too-big')).toBeVisible()
  await icmpv6Line.getByRole('button', { name: '0 only valid code' }).click()
  await modal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(modal).toBeHidden({ timeout: 15_000 })

  const res = await request.get('/firewall/rules?family=inet&table=filter', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  const created = (payload.items || []).find((row: any) => row.comment === comment)
  expect(created).toBeTruthy()
  expect(created.proto).toBe('icmpv6')
  expect(created.icmpv6_type).toBe('packet-too-big')
  expect(created.icmpv6_code).toBe('0')

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

  expect(created.meta_length).toBe('64-1500')
  expect(created.ct_status).toBe('dnat,assured')

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
