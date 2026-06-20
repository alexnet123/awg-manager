import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

function unique(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

function uniquePriority(offset = 0) {
  return -(45000 + (Date.now() % 100000) + offset)
}

async function openFirewall(page: Page) {
  const heading = page.getByRole('heading', { name: 'Firewall' })
  if (await heading.count()) {
    if (await heading.first().isVisible()) return
  }
  await page.getByRole('button', { name: 'Firewall' }).click({ force: true })
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function createBridgeTable(request: APIRequestContext, tableName: string) {
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family: 'bridge',
      table_name: tableName,
      chain_name: 'forward',
      chain_type: 'filter',
      hook: 'forward',
      priority: uniquePriority(1),
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create bridge table failed: ${JSON.stringify(json)}`).toBeTruthy()
  return json.item
}

async function createNetdevTable(request: APIRequestContext, tableName: string) {
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family: 'netdev',
      table_name: tableName,
      chain_name: 'ingress',
      chain_type: 'filter',
      hook: 'ingress',
      device: 'eth0',
      priority: uniquePriority(2),
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create netdev table failed: ${JSON.stringify(json)}`).toBeTruthy()
  return json.item
}

async function deleteTable(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/tables/${id}`, { headers: authHeaders() })
}

test('firewall why-disabled hints: bridge and netdev limitations are explained in the UI', async ({ page, request }) => {
  const bridgeTableName = unique('br_hint_tbl')
  const netdevTableName = unique('nd_hint_tbl')
  const bridgeTable = await createBridgeTable(request, bridgeTableName)
  const netdevTable = await createNetdevTable(request, netdevTableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${bridgeTableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    let modal = page.locator('div.fixed.inset-0.z-40').last()
    await modal.getByRole('tab', { name: 'Action' }).click()
    await expect(modal.getByText('NAT actions are not available for bridge/netdev rules.')).toBeVisible()
    await expect(modal.getByText('Dynamic set update is available only for inet rules.')).toBeVisible()
    await expect(modal.getByText('Verdict map is available only for inet rules.')).toBeVisible()
    await expect(modal.getByText('ct expectation object is available only for inet/ip/ip6 rules.')).toBeVisible()
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
    await expect(modal).toBeHidden()

    await page.getByText(`bridge / ${bridgeTableName}`, { exact: true }).click()
    await page.getByText(`netdev / ${netdevTableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    modal = page.locator('div.fixed.inset-0.z-40').last()
    await modal.getByRole('tab', { name: 'Action' }).click()
    await expect(modal.getByText('NAT actions are not available for bridge/netdev rules.')).toBeVisible()
    await expect(modal.getByText('Dynamic set update is available only for inet rules.')).toBeVisible()
    await expect(modal.getByText('Verdict map is available only for inet rules.')).toBeVisible()
    await expect(modal.getByText('Named object bindings are not available for netdev rules.')).toBeVisible()
    await expect(modal.getByText('Named objects')).toHaveCount(0)
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
    await expect(modal).toBeHidden()

    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator('select').selectOption(`netdev:${netdevTableName}`)
    await expect(page.getByText('netdev object bindings are not supported by backend validation')).toBeVisible()
    await page.getByRole('button', { name: 'Add object' }).click()
    modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Add Firewall Object')).toBeVisible()
    const kindSelect = modal.locator("label:has-text('Kind')").locator('..').locator('select')
    await expect(kindSelect.locator('option[value="ct_expectation"]')).toBeDisabled()
    await expect(modal.getByRole('button', { name: 'FTP expectation' })).toBeDisabled()
  } finally {
    await deleteTable(request, String(bridgeTable.id))
    await deleteTable(request, String(netdevTable.id))
  }
})
