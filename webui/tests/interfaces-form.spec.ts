import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('generate params keeps preset I1 and opens JSON', async ({ page }) => {
  await login(page)

  await page.getByRole('combobox').first().selectOption('2')
  await page.getByRole('combobox').nth(1).selectOption('sip')
  await page.getByRole('button', { name: 'Generate params' }).click()

  await expect(page.getByRole('button', { name: 'Hide JSON' })).toBeVisible()
  const jsonArea = page.locator('textarea').first()
  await expect(jsonArea).toBeVisible()
  await expect(jsonArea).toContainText('"I1": "<b 0x4f5054494f4e53207369703a>')
})

test('create button is protected from multi-click', async ({ page }) => {
  await login(page)

  const interfaceName = `pw-${Date.now()}`
  await page.getByPlaceholder('awg0').fill(interfaceName)
  await page.getByPlaceholder('10.8.0.1').fill('10.77.77.1')
  await page.getByPlaceholder('203.0.113.10').fill('132.243.237.120')
  await page.getByPlaceholder('1.1.1.1').fill('1.1.1.1')

  const createBtn = page.getByRole('button', { name: 'Create' })
  await createBtn.dblclick()
  await page.getByRole('button', { name: 'Refresh' }).click()

  const rowsForInterface = page.locator('tbody tr').filter({ hasText: interfaceName })
  const count = await rowsForInterface.count()
  expect(count).toBeLessThanOrEqual(1)
})
