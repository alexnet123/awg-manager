import { expect, test } from '@playwright/test'
import { createInterfaceViaUi, login, openAwgTab } from './helpers'

test('client auto IP + refuse deleting interface with attached clients', async ({ page }) => {
  await login(page)
  const suffix = Date.now()
  const ifaceName = `ca${String(suffix).slice(-6)}`

  await createInterfaceViaUi(page, {
    name: ifaceName,
    ip: `10.94.${suffix % 200}.1`,
    port: 55000 + (suffix % 500),
  })
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.locator('tbody tr').filter({ hasText: ifaceName })).toHaveCount(1)

  await openAwgTab(page, 'Peers')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByPlaceholder('phone').fill(`client-${suffix}`)
  await page.locator('select').first().selectOption(ifaceName)
  await page.getByRole('button', { name: 'Add Peer' }).click()
  await page.getByRole('button', { name: 'Refresh' }).click()
  const createdClient = page.locator('tbody tr').filter({ hasText: `client-${suffix}` })
  await expect(createdClient).toHaveCount(1)
  await expect(createdClient).toContainText('10.')

  await openAwgTab(page, 'Interfaces')
  const row = page.locator('tbody tr').filter({ hasText: ifaceName })
  await row.first().click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Del' }).click()
  const errorBox = page.locator('div.border-destructive\\/20')
  await expect(errorBox).toBeVisible()
  await expect(errorBox).toContainText(/clients attached|attached/i)
})

test('large client list: table, edit dialog, config and qr are usable', async ({ page }) => {
  await login(page)
  const suffix = Date.now()
  const ifaceName = `cb${String(suffix).slice(-6)}`
  const targetCount = Number(process.env.PW_BULK_CLIENTS || '50')

  await createInterfaceViaUi(page, {
    name: ifaceName,
    ip: `10.95.${suffix % 200}.1`,
    port: 56000 + (suffix % 500),
  })
  await page.getByRole('button', { name: 'Refresh' }).click()

  // Seed many clients quickly via API.
  const createResults = await page.evaluate(async ({ ifaceName, targetCount, suffix }) => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const tasks = []
    for (let i = 0; i < targetCount; i++) {
      tasks.push(fetch('/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          name: `bulk-${suffix}-${i}`,
          wg_interface: ifaceName,
        }),
      }).then((r) => r.status))
    }
    return Promise.all(tasks)
  }, { ifaceName, targetCount, suffix })

  expect(createResults.every((s) => s === 201)).toBeTruthy()

  await openAwgTab(page, 'Peers')
  await page.getByRole('button', { name: 'Refresh' }).click()
  const seededRows = page.locator('tbody tr').filter({ hasText: `bulk-${suffix}-` })
  await expect(seededRows).toHaveCount(targetCount)

  const probeName = `bulk-${suffix}-${Math.floor(targetCount / 2)}`
  const row = page.locator('tbody tr').filter({ hasText: probeName })
  await expect(row).toHaveCount(1)
  await row.first().dblclick()

  await expect(page.getByRole('heading', { name: 'Edit peer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0)
  await expect(page.locator('pre')).toContainText('[Interface]')
  await page.getByRole('tab', { name: 'QR' }).click()
  await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0)
  await expect(page.locator('div.rounded-xl.border.bg-background svg').first()).toBeVisible()
})
