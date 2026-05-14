import { expect, test, type Page } from '@playwright/test'
import { login } from './helpers'

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function openAddRuleModal(page: Page) {
  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()
  return modal
}

async function getRulesCountViaApi(page: Page) {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  const res = await page.request.get('/firewall', {
    headers: { 'X-API-Key': apiKey },
  })
  const payload = await res.json()
  return (payload?.item?.rules || []).length as number
}

async function expectCreateRejected(page: Page, modal: ReturnType<typeof page.locator>) {
  const before = await getRulesCountViaApi(page)
  await modal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(page.locator('div.border-destructive\\/20').first()).toBeVisible({ timeout: 20_000 })
  await expect(modal).toBeVisible()
  const after = await getRulesCountViaApi(page)
  expect(after).toBe(before)
}

test('add rule rejects invalid source IP/CIDR', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  const modal = await openAddRuleModal(page)

  await page.getByText('192.168.1.0/24 or @trusted_hosts').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('192.168.1.0/24 or @trusted_hosts').fill('300.1.1.1/24')
  await expectCreateRejected(page, modal)
})

test('add rule rejects invalid destination port', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  const modal = await openAddRuleModal(page)

  await page.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('22, 80,443 or @admin_ports').fill('70000')
  await expectCreateRejected(page, modal)
})

test('add rule rejects invalid source port', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  const modal = await openAddRuleModal(page)

  await page.getByText('1024-65535 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('1024-65535 or @admin_ports').fill('99999')
  await expectCreateRejected(page, modal)
})
