import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

function unique(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

function uniquePriority(offset = 0) {
  return -(10000 + (Date.now() % 100000) + offset)
}

async function openFirewall(page: Page) {
  const heading = page.getByRole('heading', { name: 'Firewall' })
  if (await heading.count()) {
    if (await heading.first().isVisible()) return
  }
  await page.getByRole('button', { name: 'Firewall' }).click({ force: true })
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

async function createTableViaApi(page: Page, payload: Record<string, any>) {
  return await page.evaluate(async (body) => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const res = await fetch('/firewall/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, json }
  }, payload)
}

async function deleteTableViaApi(page: Page, id: string) {
  return await page.evaluate(async (tableId) => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const res = await fetch(`/firewall/tables/${tableId}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': apiKey },
    })
    return res.ok
  }, id)
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
  await page.locator("label:has-text('Priority')").locator('..').locator('input').fill(String(uniquePriority(0)))
  await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

  await expect(page.locator('tbody tr').filter({ hasText: tableName }).first()).toBeVisible()
  const afterCreate = await listTablesViaApi(page)
  expect((afterCreate.custom || []).some((t: any) => t.table_name === tableName && t.chain_name === 'input')).toBeTruthy()

  const row = page.locator('tbody tr').filter({ hasText: tableName }).first()
  await row.click()
  await expect(tablePanel.locator('button').filter({ hasText: 'Del' })).toBeEnabled()
  page.once('dialog', (d) => d.accept())
  await tablePanel.locator('button').filter({ hasText: 'Del' }).first().click()

  await expect.poll(async () => {
    const afterDelete = await listTablesViaApi(page)
    return (afterDelete.custom || []).some((t: any) => t.table_name === tableName)
  }, { timeout: 15_000 }).toBeFalsy()
})

test('firewall policy: click custom table and create rule in it', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  const tableName = unique('pw_tblp')
  const created = await createTableViaApi(page, {
    family: 'inet',
    table_name: tableName,
    chain_name: 'input',
    chain_type: 'filter',
    hook: 'input',
    priority: uniquePriority(1),
    policy: 'accept',
  })
  expect(created.ok).toBeTruthy()
  const createdId = created.json?.item?.id as string

  await page.getByRole('tab', { name: 'policy', exact: true }).click()
  const picker = page.getByRole('combobox').first()
  await picker.click()
  await page.getByRole('option', { name: tableName }).click()

  const beforeRules = await listRulesViaApi(page)
  const beforeCount = beforeRules.filter((r: any) => r.table === tableName && r.chain === 'input').length

  const rulesPanel = page.locator('div.rounded-xl.border').first()
  await rulesPanel.locator('button').filter({ hasText: 'Add' }).first().click()
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

  const rules = await listRulesViaApi(page)
  const afterCount = rules.filter((r: any) => r.table === tableName && r.chain === 'input').length
  expect(afterCount).toBeGreaterThan(beforeCount)
  await deleteTableViaApi(page, createdId)
})

test('firewall policy: custom table picker shows many tables and allows switching', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  await page.getByRole('tab', { name: 'policy', exact: true }).click()

  const prefix = unique('pg')
  const createdIds: string[] = []
  for (let i = 0; i < 9; i += 1) {
    const tableName = `${prefix}_${i}`
    const res = await createTableViaApi(page, {
      family: 'inet',
      table_name: tableName,
      chain_name: 'input',
      chain_type: 'filter',
      hook: 'input',
      priority: uniquePriority(100 + i),
      policy: 'accept',
    })
    expect(res.ok).toBeTruthy()
    createdIds.push(res.json?.item?.id)
  }

  await page.getByRole('button', { name: 'Refresh' }).first().click().catch(() => {})
  await page.reload()
  await openFirewall(page)
  await page.getByRole('tab', { name: 'policy', exact: true }).click()

  const picker = page.getByRole('combobox').first()
  await picker.click()
  await expect(page.getByRole('option', { name: `${prefix}_0` })).toBeVisible()
  await expect(page.getByRole('option', { name: `${prefix}_8` })).toBeVisible()
  await page.getByRole('option', { name: `${prefix}_8` }).click()

  for (const id of createdIds.filter(Boolean)) {
    await deleteTableViaApi(page, id)
  }
})

test('firewall tables: same table name supports multiple chains + disable hides yellow tab', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  const tableName = unique('multi')
  const c1 = await createTableViaApi(page, {
    family: 'inet',
    table_name: tableName,
    chain_name: 'input',
    chain_type: 'filter',
    hook: 'input',
    priority: uniquePriority(200),
    policy: 'accept',
  })
  expect(c1.ok).toBeTruthy()
  const r1 = c1.json?.item
  const c2 = await createTableViaApi(page, {
    family: 'inet',
    table_name: tableName,
    chain_name: 'forward',
    chain_type: 'filter',
    hook: 'forward',
    priority: uniquePriority(201),
    policy: 'accept',
  })
  expect(c2.ok).toBeTruthy()
  const r2 = c2.json?.item

  await expect.poll(async () => {
    const data = await listTablesViaApi(page)
    return (data.custom || []).filter((t: any) => t.table_name === tableName).length
  }, { timeout: 15_000 }).toBe(2)

  const d1 = await createTableViaApi(page, {
    id: r1?.id,
    family: 'inet',
    table_name: tableName,
    chain_name: 'input',
    chain_type: 'filter',
    hook: 'input',
    priority: Number(r1?.priority ?? uniquePriority(202)),
    policy: 'accept',
    enabled: false,
  })
  expect(d1.ok).toBeTruthy()
  const d2 = await createTableViaApi(page, {
    id: r2?.id,
    family: 'inet',
    table_name: tableName,
    chain_name: 'forward',
    chain_type: 'filter',
    hook: 'forward',
    priority: Number(r2?.priority ?? uniquePriority(203)),
    policy: 'accept',
    enabled: false,
  })
  expect(d2.ok).toBeTruthy()

  await page.reload()
  await openFirewall(page)
  await page.getByRole('tab', { name: 'policy', exact: true }).click()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await expect(page.getByText(tableName, { exact: true })).toHaveCount(0)

  await deleteTableViaApi(page, c1.json?.item?.id)
  await deleteTableViaApi(page, c2.json?.item?.id)
})

test('firewall tables: invalid chain_type/hook/device combos are rejected by API', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  const badRoute = await createTableViaApi(page, {
    family: 'inet',
    table_name: unique('bad_route'),
    chain_name: 'bad1',
    chain_type: 'route',
    hook: 'input',
    priority: uniquePriority(500),
    policy: 'accept',
  })
  expect(badRoute.ok).toBeFalsy()

  const badIngressNoDevice = await createTableViaApi(page, {
    family: 'inet',
    table_name: unique('bad_ingress'),
    chain_name: 'bad2',
    chain_type: 'filter',
    hook: 'ingress',
    priority: uniquePriority(501),
    policy: 'accept',
  })
  expect(badIngressNoDevice.ok).toBeFalsy()

  const badNonIngressWithDevice = await createTableViaApi(page, {
    family: 'inet',
    table_name: unique('bad_device'),
    chain_name: 'bad3',
    chain_type: 'filter',
    hook: 'input',
    device: 'eth0',
    priority: uniquePriority(502),
    policy: 'accept',
  })
  expect(badNonIngressWithDevice.ok).toBeFalsy()
})

test('firewall tables: non-inet families are accepted in table builder API', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  const tableName = unique('fam_ip')
  const created = await createTableViaApi(page, {
    family: 'ip',
    table_name: tableName,
    chain_name: 'input',
    chain_type: 'filter',
    hook: 'input',
    priority: uniquePriority(700),
    policy: 'accept',
  })
  expect(created.ok).toBeTruthy()
  const createdId = created.json?.item?.id as string
  expect(created.json?.item?.family).toBe('ip')
  await deleteTableViaApi(page, createdId)
})
