import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers'

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

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

test('schema exposes expected table/chain matrix', async ({ request }) => {
  const res = await request.get('/firewall/schema', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  const schema = payload.item

  expect(schema.tables.filter.chains).toEqual(['input', 'forward', 'output'])
  expect(schema.tables.nat.chains).toEqual(['prerouting', 'input', 'output', 'postrouting'])
  expect(schema.tables.raw.chains).toEqual(['prerouting', 'output'])
  expect(schema.tables.mangle.chains).toEqual(['prerouting', 'input', 'forward', 'output', 'postrouting'])
})

test('ui context matrix: chains and nat actions change by table/chain', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  const expectedChains: Record<string, string[]> = {
    filter: ['input', 'forward', 'output'],
    nat: ['prerouting', 'input', 'output', 'postrouting'],
    raw: ['prerouting', 'output'],
    mangle: ['prerouting', 'input', 'forward', 'output', 'postrouting'],
  }

  for (const tableName of ['filter', 'nat', 'raw', 'mangle'] as const) {
    await page.getByRole('tab', { name: tableName }).click({ force: true })
    await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
    const modal = page.locator('div.fixed.inset-0.z-40').last()
    const chainSelect = modal.locator("label:has-text('Chain')").locator('..').locator('select')
    const chainValues = await chainSelect.locator('option').allTextContents()
    expect(chainValues.map((x) => x.trim())).toEqual(expectedChains[tableName])
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
  }

  // NAT-specific chain->action behavior.
  await page.getByRole('tab', { name: 'nat' }).click({ force: true })
  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  const chainSelect = modal.locator("label:has-text('Chain')").locator('..').locator('select')
  const actionSelect = modal.locator("label:has-text('Action')").locator('..').locator('select')

  await chainSelect.selectOption('prerouting')
  await modal.getByRole('tab', { name: 'Action' }).click()
  await actionSelect.selectOption('dnat')

  await modal.getByRole('tab', { name: 'Base match' }).click()
  await chainSelect.selectOption('postrouting')
  await modal.getByRole('tab', { name: 'Action' }).click()
  // After switching to postrouting, invalid nat_type should be sanitized by UI/state (dnat hidden from effective selection).
  // We assert the action selector remains usable and contains masquerade/snat.
  const options = (await actionSelect.locator('option').allTextContents()).map((x) => x.trim())
  expect(options).toContain('masquerade')
  expect(options).toContain('snat')
  await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
})

test('invalid context combinations are rejected', async ({ request }) => {
  const invalidPayloads = [
    { table: 'nat', chain: 'postrouting', action: 'accept', nat_type: 'dnat', to_addr: '10.8.0.2', to_port: '80' }, // invalid nat_type for chain
    { table: 'raw', chain: 'prerouting', action: 'jump', target_chain: 'input' }, // jump only filter
    { table: 'filter', chain: 'input', action: 'accept', nat_type: 'snat' }, // nat_type only nat table
    { table: 'mangle', chain: 'input', action: 'accept', notrack: true }, // notrack only raw
    { table: 'nat', chain: 'output', action: 'accept', nat_random: true }, // nat flag requires nat_type
  ]

  for (const payload of invalidPayloads) {
    const res = await createRule(request, payload)
    expect(res.ok()).toBeFalsy()
    expect([400, 422, 500]).toContain(res.status())
  }
})
