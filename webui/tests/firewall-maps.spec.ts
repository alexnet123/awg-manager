import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

function unique(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function listMapsViaApi(page: Page) {
  return await page.evaluate(async () => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const res = await fetch('/firewall/maps', { headers: { 'X-API-Key': apiKey } })
    const payload = await res.json()
    return payload?.item || { map: [], vmap: [] }
  })
}

async function listSetsViaApi(page: Page) {
  return await page.evaluate(async () => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const res = await fetch('/firewall/sets', { headers: { 'X-API-Key': apiKey } })
    const payload = await res.json()
    return payload?.item || { addr: [], port: [], iface: [] }
  })
}

test('firewall maps: add map, disable/enable, delete', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  await page.getByRole('tab', { name: 'collections' }).click()

  const mapName = unique('pw_map')
  const mapsPanel = page.locator('div.rounded-xl.border').first()

  await mapsPanel.locator('button').filter({ hasText: 'Add' }).first().click()
  await expect(page.getByText('Add collection')).toBeVisible()
  const mapModal = page.locator('div.fixed.inset-0.z-40').last()
  await page.locator("label:has-text('Type')").locator('..').locator('select').selectOption('map')
  await page.getByPlaceholder('map_name').fill(mapName)
  await page.getByPlaceholder('tcp:accept, udp:drop').fill('22:0x10')
  await mapModal.getByRole('button', { name: 'Add' }).click({ force: true })

  const err = page.locator('div.border-destructive\\/20')
  if (await err.count()) {
    const msg = (await err.first().innerText()).trim()
    throw new Error(`Map create returned UI error: ${msg}`)
  }

  await expect(mapModal).toBeHidden({ timeout: 30_000 })
  const row = page.locator('tbody tr').filter({ hasText: mapName }).first()
  await expect(row).toBeVisible()
  const afterCreate = await listMapsViaApi(page)
  expect((afterCreate.map || []).some((m: any) => m.name === mapName)).toBeTruthy()
  await row.click()
  await mapsPanel.locator('button').filter({ hasText: 'Disable' }).first().click({ force: true })
  await mapsPanel.locator('button').filter({ hasText: 'Enable' }).first().click({ force: true })
  await row.click()
  await expect(mapsPanel.locator('button').filter({ hasText: 'Del' }).first()).toBeEnabled()
  page.once('dialog', (d) => d.accept())
  await mapsPanel.locator('button').filter({ hasText: 'Del' }).first().click({ force: true })
  const afterDelete = await listMapsViaApi(page)
  expect((afterDelete.map || []).some((m: any) => m.name === mapName)).toBeFalsy()
})

test('collections timeout: read-only edit, disabled enable/disable, auto-expire cleanup', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  await page.getByRole('tab', { name: 'collections' }).click()

  const setName = unique('pw_timeout_set')
  const panel = page.locator('div.rounded-xl.border').first()

  await panel.locator('button').filter({ hasText: 'Add' }).first().click()
  await expect(page.getByText('Add collection')).toBeVisible()
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await page.locator("label:has-text('Type')").locator('..').locator('select').selectOption('port')
  await page.getByPlaceholder('set_name').fill(setName)
  await page.getByPlaceholder('22, 443, 51820').fill('232,33,333,44545')
  await page.getByText('Finite only; e.g. 10m or 1d 15:00:00').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('10m, 2h30m, 1d 15:00:00').fill('8s')
  await modal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(modal).toBeHidden({ timeout: 30_000 })

  const row = page.locator('tbody tr').filter({ hasText: setName }).first()
  await expect(row).toBeVisible()
  await row.click()
  await expect(panel.locator('button').filter({ hasText: 'Disable' }).first()).toBeDisabled()
  await expect(panel.locator('button').filter({ hasText: 'Enable' }).first()).toBeDisabled()

  await row.dblclick()
  const editModal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(editModal.getByText('read-only')).toBeVisible()
  await expect(page.getByPlaceholder('set_name')).toBeDisabled()
  await expect(page.getByPlaceholder('22, 443, 51820')).toBeDisabled()
  await expect(page.getByPlaceholder('10m, 2h30m, 1d 15:00:00')).toBeDisabled()
  await expect(editModal.getByRole('button', { name: 'Save' })).toBeDisabled()
  await editModal.getByRole('button', { name: 'Cancel' }).click()
  await expect(editModal).toBeHidden()

  await expect.poll(async () => {
    const sets = await listSetsViaApi(page)
    return (sets.port || []).some((s: any) => s.name === setName)
  }, { timeout: 20_000 }).toBeFalsy()
})
