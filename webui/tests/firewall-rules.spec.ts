import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function clickToolbarButton(page: Page, name: 'Add' | 'Del' | 'Disable' | 'Enable') {
  const button = page.getByRole('button', { name }).first()
  await expect(button).toBeVisible()
  await button.click({ force: true, timeout: 30_000 })
}

test('firewall smoke: rules basic flow', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  // filter rule
  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
  await page.getByText('192.168.1.0/24 or @trusted_hosts').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('192.168.1.0/24 or @trusted_hosts').fill('10.66.1.0/24')
  await page.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('22, 80,443 or @admin_ports').fill('443')
  await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(ruleModal).toBeHidden()
  const ruleRow = page.locator('tbody tr').filter({ hasText: '10.66.1.0/24' }).first()
  await expect(ruleRow).toBeVisible()
  await ruleRow.click()
  await clickToolbarButton(page, 'Disable')
  await clickToolbarButton(page, 'Enable')

})
