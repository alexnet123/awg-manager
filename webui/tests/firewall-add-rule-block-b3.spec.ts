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

test('block B3: meta pkttype is a single-value selector', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (await modal.getByRole('button', { name: 'Meta match +' }).isVisible()) {
    await modal.getByRole('button', { name: 'Meta match +' }).click()
  }
  const pktTypeLine = modal.locator('div.space-y-1\\.5', { hasText: 'meta pkttype' }).first()
  await pktTypeLine.getByRole('button', { name: '+' }).click()
  const select = pktTypeLine.locator('select')
  await expect(select).toHaveValue('host')
  await expect(select.locator('option')).toHaveText(['host', 'broadcast', 'multicast', 'other'])
  await select.selectOption('multicast')
  await expect(select).toHaveValue('multicast')
})

test('block B3: meta cpu is marked as expert/debug CPU id input', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (await modal.getByRole('button', { name: 'Meta match +' }).isVisible()) {
    await modal.getByRole('button', { name: 'Meta match +' }).click()
  }
  const cpuLine = modal.locator('div.space-y-1\\.5', { hasText: 'meta cpu' }).first()
  await expect(cpuLine.getByText('CPU id, expert/debug')).toBeVisible()
  await cpuLine.getByRole('button', { name: '+' }).click()
  const input = cpuLine.getByPlaceholder('0 / 1 / 2')
  await expect(input).toHaveValue('0')
  await input.fill('2')
  await expect(input).toHaveValue('2')
})

test('block B3: meta interface type uses protocol-style comboboxes', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (await modal.getByRole('button', { name: 'Meta match +' }).isVisible()) {
    await modal.getByRole('button', { name: 'Meta match +' }).click()
  }

  const iifTypeLine = modal.locator('div.space-y-1\\.5', { hasText: 'meta iiftype' }).first()
  await expect(iifTypeLine.getByText('interface type, expert')).toBeVisible()
  await iifTypeLine.getByRole('button', { name: '+' }).click()
  const iifInput = iifTypeLine.getByRole('combobox')
  await expect(iifInput).toHaveValue('Ethernet')
  await iifTypeLine.getByLabel('Show interface hardware types').click()
  await expect(modal.getByRole('option', { name: /Ethernet\s+1/ })).toBeVisible()
  await expect(modal.getByRole('option', { name: /Loopback\s+772/ })).toBeVisible()
  await modal.getByRole('option', { name: /Loopback\s+772/ }).click()
  await expect(iifInput).toHaveValue('Loopback')

  const oifTypeLine = modal.locator('div.space-y-1\\.5', { hasText: 'meta oiftype' }).first()
  await expect(oifTypeLine.getByText('interface type, expert')).toBeVisible()
  await oifTypeLine.getByRole('button', { name: '+' }).click()
  const oifInput = oifTypeLine.getByRole('combobox')
  await expect(oifInput).toHaveValue('Ethernet')
  await oifInput.fill('65534')
  await expect(oifInput).toHaveValue('None')
})

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

test('block B3: interface group fields explain Linux dev group ids', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (await modal.getByRole('button', { name: 'Meta match +' }).isVisible()) {
    await modal.getByRole('button', { name: 'Meta match +' }).click()
  }

  const iifGroupLine = modal.locator('div.space-y-1\\.5', { hasText: 'input interface group' }).first()
  await expect(iifGroupLine.getByText('Linux dev group id')).toBeVisible()
  await iifGroupLine.getByRole('button', { name: '+' }).click()
  await expect(iifGroupLine.getByPlaceholder('Linux dev group id')).toHaveValue('10')
  await expect(iifGroupLine.getByText('Expert: Linux dev group id from ip link group. Usually leave empty.')).toBeVisible()

  const oifGroupLine = modal.locator('div.space-y-1\\.5', { hasText: 'output interface group' }).first()
  await expect(oifGroupLine.getByText('Linux dev group id')).toBeVisible()
  await oifGroupLine.getByRole('button', { name: '+' }).click()
  await expect(oifGroupLine.getByPlaceholder('Linux dev group id')).toHaveValue('10')
  await expect(oifGroupLine.getByText('Expert: Linux dev group id from ip link group. Usually leave empty.')).toBeVisible()
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
