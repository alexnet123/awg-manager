import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

function unique(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function listTablesViaApi(page: Page) {
  return await page.evaluate(async () => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const res = await fetch('/firewall/tables', { headers: { 'X-API-Key': apiKey } })
    const payload = await res.json()
    return payload?.item || { builtin: [], custom: [] }
  })
}

async function listRulesViaApi(page: Page) {
  return await page.evaluate(async () => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const res = await fetch('/firewall', { headers: { 'X-API-Key': apiKey } })
    const payload = await res.json()
    return payload?.item?.rules || []
  })
}

test('firewall tables: add and delete custom table chain', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  await page.getByRole('tab', { name: 'table builder' }).click()

  const tableName = unique('pw_tbl')
  const tablePanel = page.locator('div.rounded-xl.border').first()

  await tablePanel.locator('button').filter({ hasText: 'Add' }).first().click()
  await expect(page.getByText('Add Table Chain')).toBeVisible()
  await page.getByPlaceholder('custom_table').fill(tableName)
  await page.getByPlaceholder('input_custom').fill('input')
  await page.locator("label:has-text('Priority')").locator('..').locator('input').fill('-11')
  await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

  await expect(page.locator('tbody tr').filter({ hasText: tableName }).first()).toBeVisible()
  const afterCreate = await listTablesViaApi(page)
  expect((afterCreate.custom || []).some((t: any) => t.table_name === tableName && t.chain_name === 'input')).toBeTruthy()

  const row = page.locator('tbody tr').filter({ hasText: tableName }).first()
  await row.click()
  await expect(tablePanel.locator('button').filter({ hasText: 'Del' })).toBeEnabled()
  page.once('dialog', (d) => d.accept())
  await tablePanel.locator('button').filter({ hasText: 'Del' }).first().click()

  await page.getByRole('tab', { name: 'policy' }).click()
  await page.getByRole('tab', { name: 'filter' }).click()
  await page.getByRole('tab', { name: 'table builder' }).click()
  await expect(page.locator('tbody tr').filter({ hasText: tableName })).toHaveCount(0)

  const afterDelete = await listTablesViaApi(page)
  expect((afterDelete.custom || []).some((t: any) => t.table_name === tableName)).toBeFalsy()
})

test('firewall policy: click custom table and create rule in it', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  await page.getByRole('tab', { name: 'table builder' }).click()

  const tableName = unique('pw_tblp')
  const tablePanel = page.locator('div.rounded-xl.border').first()

  await tablePanel.locator('button').filter({ hasText: 'Add' }).first().click()
  await expect(page.getByText('Add Table Chain')).toBeVisible()
  await page.getByPlaceholder('custom_table').fill(tableName)
  await page.getByPlaceholder('input_custom').fill('input')
  await page.locator("label:has-text('Priority')").locator('..').locator('input').fill('-21')
  await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(page.locator('tbody tr').filter({ hasText: tableName }).first()).toBeVisible()

  await page.getByRole('tab', { name: 'policy' }).click()
  await page.getByRole('button', { name: tableName }).click()
  await expect(page.getByText(new RegExp(`table:\\s*${tableName}`))).toBeVisible()

  const beforeRules = await listRulesViaApi(page)
  const beforeCount = beforeRules.filter((r: any) => r.table === tableName && r.chain === 'input').length

  const rulesPanel = page.locator('div.rounded-xl.border').first()
  await rulesPanel.locator('button').filter({ hasText: 'Add' }).first().click()
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

  const rules = await listRulesViaApi(page)
  const afterCount = rules.filter((r: any) => r.table === tableName && r.chain === 'input').length
  expect(afterCount).toBeGreaterThan(beforeCount)
})
