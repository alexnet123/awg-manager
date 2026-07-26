import { expect, test } from '@playwright/test'
import { login, openAwgTab } from './helpers'

test('full lifecycle: create interface, create client, view config/qr, delete all', async ({ page }) => {
  await login(page)

  const suffix = Date.now()
  const ifaceName = `e2e${String(suffix).slice(-8)}`
  const clientName = `e2e-client-${suffix}`
  const octetA = 150 + (suffix % 50)
  const octetB = 10 + (suffix % 200)
  const ifaceIp = `10.${octetA}.${octetB}.1`
  const ifacePort = `${52000 + (suffix % 1000)}`

  // Create interface in Interfaces page.
  await openAwgTab(page, 'Interfaces')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByPlaceholder('awg0').fill(ifaceName)
  await page.locator('input[type="number"]').first().fill(ifacePort)
  await page.getByPlaceholder('10.8.0.1').fill(ifaceIp)
  await page.getByPlaceholder('203.0.113.10').fill('132.243.237.120')
  await page.getByPlaceholder('1.1.1.1').fill('1.1.1.1')
  const createInterfaceBtn = page.getByRole('button', { name: 'Add Interface' })
  await createInterfaceBtn.click()
  const errorBanner = page.locator('div.border-destructive\\/20')
  if (await errorBanner.count()) {
    const errText = (await errorBanner.first().textContent())?.trim() || 'unknown UI error'
    throw new Error(`Interface create failed: ${errText}`)
  }
  await page.getByRole('button', { name: 'Refresh' }).click()

  const ifaceRow = page.locator('tbody tr').filter({ hasText: ifaceName })
  await expect(ifaceRow).toHaveCount(1)

  await ifaceRow.first().dblclick()
  await expect(page.getByRole('heading', { name: 'Edit interface' })).toBeVisible()
  await expect(page.getByText('Public Key')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Edit interface' })).toHaveCount(0)

  // Go to clients and create client linked to new interface.
  await openAwgTab(page, 'Peers')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByPlaceholder('phone').fill(clientName)
  await page.locator('select').first().selectOption(ifaceName)
  await page.getByRole('button', { name: 'Add Peer' }).click()
  await page.getByRole('button', { name: 'Refresh' }).click()

  const clientRow = page.locator('tbody tr').filter({ hasText: clientName })
  await expect(clientRow).toHaveCount(1)
  await clientRow.first().dblclick()

  // Validate config and QR rendering.
  await expect(page.getByRole('heading', { name: 'Edit peer' })).toBeVisible()
  await expect(page.locator('pre')).toContainText('[Interface]')
  await expect(page.locator('pre')).toContainText('Address = ')
  await page.getByRole('tab', { name: 'QR' }).click()
  await expect(page.locator('div.rounded-xl.border.bg-background svg').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Edit peer' })).toHaveCount(0)

  // Delete client.
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Del' }).click()
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.locator('tbody tr').filter({ hasText: clientName })).toHaveCount(0)

  // Delete interface.
  await openAwgTab(page, 'Interfaces')
  const ifaceRowAfter = page.locator('tbody tr').filter({ hasText: ifaceName })
  await expect(ifaceRowAfter).toHaveCount(1)
  await ifaceRowAfter.first().click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Del' }).click()
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.locator('tbody tr').filter({ hasText: ifaceName })).toHaveCount(0)
})
