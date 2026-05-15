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

test('add-rule modal exposes required field groups and tabs', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  const modal = await openAddRuleModal(page)

  await expect(modal.getByRole('tab', { name: 'Base match' })).toBeVisible()
  await expect(modal.getByRole('tab', { name: 'Advanced match' })).toBeVisible()
  await expect(modal.getByRole('tab', { name: 'Action' })).toBeVisible()
  await expect(modal.getByRole('tab', { name: 'Statistics' })).toBeVisible()

  await expect(modal.getByText('Base rule placement')).toBeVisible()
  await expect(modal.getByText('L3 address match')).toBeVisible()
  await expect(modal.getByText('L4 protocol and port match')).toBeVisible()
  await expect(modal.getByText('Interface match')).toBeVisible()
  await expect(modal.getByText('Connection tracking match')).toBeVisible()
})

test('add-rule modal supports all firewall table tabs without crash', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  for (const tableName of ['filter', 'nat', 'raw', 'mangle'] as const) {
    await page.getByRole('tab', { name: tableName }).click({ force: true })
    const modal = await openAddRuleModal(page)
    await expect(modal.locator('select').first()).toBeVisible() // chain selector
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
    await expect(modal).toBeHidden()
  }
})

test('add-rule key advanced toggles are present and context-aware', async ({ page }) => {
  await login(page)
  await openFirewall(page)
  const modal = await openAddRuleModal(page)

  // Base mark match fields are now editable
  const connMark = modal.locator("label:has-text('Connection mark')").first()
  const pktMark = modal.locator("label:has-text('Packet mark')").first()
  await expect(connMark).toBeVisible()
  await expect(pktMark).toBeVisible()
  await expect(connMark.locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').locator('button', { hasText: '+' }).first()).toBeVisible()
  await expect(pktMark.locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').locator('button', { hasText: '+' }).first()).toBeVisible()

  // Advanced raw expression block
  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  await expect(modal.getByText('Raw expression & debug')).toBeVisible()
  const rawExprLine = modal.locator("label:has-text('raw expression')").first()
  await expect(rawExprLine).toBeVisible()
  await expect(rawExprLine.locator('xpath=ancestor::div[2]').locator('button', { hasText: '+' }).first()).toBeVisible()
  await expect(modal.getByText('nftrace (raw table only)')).toBeVisible()
})
