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
  await expect(modal.getByText('User ID')).toHaveCount(0)
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
  const connMark = modal.locator("label:has-text('connection mark')").first()
  const pktMark = modal.locator("label:has-text('packet mark')").first()
  await expect(connMark).toBeVisible()
  await expect(pktMark).toBeVisible()
  await expect(connMark.locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').locator('button', { hasText: '+' }).first()).toBeVisible()
  await expect(pktMark.locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').locator('button', { hasText: '+' }).first()).toBeVisible()

  // Advanced routing and L2 blocks
  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  await modal.getByRole('button', { name: /FIB \/ socket \/ routing/ }).click()
  let activePanel = modal.locator('[role="tabpanel"][data-state="active"]').last()
  const fibLine = activePanel.locator("label:has-text('Route lookup checks (expert)')").first().locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]')
  await expect(fibLine.getByText('Usually leave empty. Checks Linux routing table.')).toBeVisible()
  await fibLine.getByRole('button', { name: '+' }).click()
  await expect(fibLine.getByText('Route lookup check', { exact: true })).toBeVisible()
  await expect(fibLine.getByText('This only checks the Linux routing table')).toBeVisible()
  await expect(fibLine.getByText('Block spoofed source')).toBeVisible()
  await expect(fibLine.getByText('Require source return route')).toBeVisible()
  await expect(fibLine.getByText('Require destination route')).toBeVisible()
  await expect(fibLine.getByText('Match local destination')).toBeVisible()
  await expect(fibLine.getByText('Match non-local destination')).toBeVisible()
  await expect(fibLine.getByText('Drop unroutable destination')).toBeVisible()
  await expect(fibLine.getByText('Custom expression')).toHaveCount(0)
  await expect(fibLine.getByText('What this selected check does')).toBeVisible()
  await expect(fibLine.getByText('Use this for anti-spoofing')).toBeVisible()
  await expect(fibLine.getByText('fib saddr . iif oif missing')).toHaveCount(0)
  await fibLine.getByRole('button', { name: 'Show nft expression' }).click()
  await expect(fibLine.getByText('fib saddr . iif oif missing')).toBeVisible()
  await fibLine.getByText('Drop unroutable destination').click()
  await expect(fibLine.getByText('Destination has no route')).toBeVisible()
  await expect(fibLine.getByText('fib daddr . iif oif missing')).toHaveCount(0)
  await fibLine.getByRole('button', { name: 'Show nft expression' }).click()
  await expect(fibLine.getByText('fib daddr . iif oif missing')).toBeVisible()

  const routeNextHopLine = activePanel.locator("label:has-text('Route next hop')").first().locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]')
  await expect(routeNextHopLine.getByText('192.0.2.1')).toBeVisible()
  await routeNextHopLine.getByRole('button', { name: '+' }).click()
  await expect(routeNextHopLine.locator('input[placeholder="192.0.2.1"]')).toBeVisible()
  await expect(routeNextHopLine.getByText('Matches packets whose selected Linux route uses this next-hop')).toBeVisible()
  await expect(activePanel.getByText('Route uses IPsec')).toHaveCount(0)
  await expect(activePanel.getByText('rt expression')).toHaveCount(0)

  await expect(activePanel.getByText('Transparent proxy socket')).toHaveCount(0)
  await expect(activePanel.getByText('socket expression')).toHaveCount(0)
  await expect(activePanel.getByText('socket match')).toHaveCount(0)

  const ipv6ExtensionLine = activePanel.locator("label:has-text('IPv6 extension header')").first().locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]')
  await expect(ipv6ExtensionLine.getByText('Usually leave empty. Checks whether an IPv6 extension header is present or missing.')).toBeVisible()
  await ipv6ExtensionLine.getByRole('button', { name: '+' }).click()
  await expect(ipv6ExtensionLine.getByText('Header', { exact: true })).toBeVisible()
  await expect(ipv6ExtensionLine.getByText('Condition', { exact: true })).toBeVisible()
  await expect(ipv6ExtensionLine.getByRole('option', { name: 'Fragment' })).toHaveCount(1)
  await expect(ipv6ExtensionLine.getByRole('option', { name: 'Hop-by-Hop' })).toHaveCount(1)
  await expect(ipv6ExtensionLine.getByRole('option', { name: 'Routing' })).toHaveCount(1)
  await expect(ipv6ExtensionLine.getByRole('option', { name: 'Destination Options' })).toHaveCount(1)
  await expect(ipv6ExtensionLine.getByRole('option', { name: 'Mobility' })).toHaveCount(1)
  await expect(ipv6ExtensionLine.getByRole('option', { name: 'is present' })).toHaveCount(1)
  await expect(ipv6ExtensionLine.getByRole('option', { name: 'is missing' })).toHaveCount(1)
  await expect(ipv6ExtensionLine.getByText('Matches non-fragmented IPv6 packets.')).toBeVisible()
  await expect(activePanel.getByText('exthdr expression')).toHaveCount(0)
  await expect(activePanel.getByText('ipv6 extension headers')).toHaveCount(0)

  const l2SectionButton = modal.getByRole('button', { name: 'Ethernet / VLAN (L2) +', exact: true })
  await expect(l2SectionButton).toBeVisible()
  await expect(activePanel.getByText('vlan id', { exact: true })).toHaveCount(0)
  await expect(activePanel.getByText('ether src', { exact: true })).toHaveCount(0)
  await expect(activePanel.getByText('ether dst', { exact: true })).toHaveCount(0)
  await expect(activePanel.getByText('ether type', { exact: true })).toHaveCount(0)
  await l2SectionButton.click()
  await expect(activePanel.getByText('vlan id', { exact: true })).toBeVisible()
  await expect(activePanel.getByText('ether src', { exact: true })).toBeVisible()
  await expect(activePanel.getByText('ether dst', { exact: true })).toBeVisible()
  await expect(activePanel.getByText('ether type', { exact: true })).toBeVisible()
  await expect(activePanel.getByText('Advanced fields are now grouped by purpose; backend enablement will be added block-by-block.')).toHaveCount(0)

  await expect(activePanel.getByText('Raw expression & debug')).toHaveCount(0)
  await expect(activePanel.getByText('raw expression')).toHaveCount(0)
  await expect(activePanel.getByText('raw fib tail')).toHaveCount(0)
  await expect(activePanel.getByText('nftrace (raw table only)')).toHaveCount(0)
  await modal.getByRole('tab', { name: 'Action' }).click()
  activePanel = modal.locator('[role="tabpanel"][data-state="active"]').last()
  await expect(activePanel.getByText('nftrace (raw table only)')).toBeVisible()
  await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
  await expect(modal).toBeHidden()

  await page.getByRole('tab', { name: 'raw' }).click({ force: true })
  const rawModal = await openAddRuleModal(page)
  await rawModal.getByRole('tab', { name: 'Advanced match' }).click()
  activePanel = rawModal.locator('[role="tabpanel"][data-state="active"]').last()
  await expect(activePanel.getByText('Raw expression & debug')).toHaveCount(0)
  await expect(activePanel.getByText('raw expression')).toHaveCount(0)
  await expect(activePanel.getByText('raw fib tail')).toHaveCount(0)
  await expect(activePanel.getByText('nftrace', { exact: true })).toHaveCount(0)
  await rawModal.getByRole('tab', { name: 'Action' }).click()
  activePanel = rawModal.locator('[role="tabpanel"][data-state="active"]').last()
  await expect(activePanel.getByText('nftrace', { exact: true })).toBeVisible()
})
