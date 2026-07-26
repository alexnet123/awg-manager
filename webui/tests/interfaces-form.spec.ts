import { expect, test } from '@playwright/test'
import { login, openAwgTab } from './helpers'

test('generate params keeps preset I1 in config preview', async ({ page }) => {
  await login(page)
  await openAwgTab(page, 'Interfaces')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await page.getByRole('combobox').first().selectOption('2')
  await page.getByRole('combobox').nth(1).selectOption('sip')
  await page.getByRole('button', { name: 'Generate params' }).click()

  await expect(page.getByRole('button', { name: 'Show JSON' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hide JSON' })).toHaveCount(0)
  await expect(page.locator('textarea')).toHaveCount(0)
  await expect(page.locator('pre')).toContainText('I1 = <b 0x4f5054494f4e53207369703a>')
})

test('create button is protected from multi-click', async ({ page }) => {
  await login(page)
  await openAwgTab(page, 'Interfaces')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  const interfaceName = `pw-${Date.now()}`
  await page.getByPlaceholder('awg0').fill(interfaceName)
  await page.getByPlaceholder('10.8.0.1').fill('10.77.77.1')
  await page.getByPlaceholder('203.0.113.10').fill('132.243.237.120')
  await page.getByPlaceholder('1.1.1.1').fill('1.1.1.1')

  const createBtn = page.getByRole('button', { name: 'Add Interface' })
  await createBtn.dblclick()
  await page.getByRole('button', { name: 'Refresh' }).click()

  const rowsForInterface = page.locator('tbody tr').filter({ hasText: interfaceName })
  const count = await rowsForInterface.count()
  expect(count).toBeLessThanOrEqual(1)
})

test('edit interface groups server port without injecting endpoint into interface preview', async ({ page }) => {
  await login(page)
  await openAwgTab(page, 'Interfaces')

  const row = page.locator('tbody tr').filter({ hasText: 'awg0' }).first()
  await expect(row).toBeVisible()
  await row.dblclick()

  const interfaceSection = page.locator('form .rounded-md.border').filter({ hasText: 'Interface' }).first()
  const serverSection = page.locator('form .rounded-md.border').filter({ hasText: 'Server' }).first()
  await expect(interfaceSection.getByText('Listen port', { exact: true })).toHaveCount(0)
  await expect(serverSection.getByText('Listen port', { exact: true })).toBeVisible()

  await expect(page.locator('pre')).toContainText('[Interface]')
  await expect(page.locator('pre')).toContainText(/\n\n\[Peer\]/)
  await expect(page.locator('pre')).not.toContainText('Endpoint =')
})
