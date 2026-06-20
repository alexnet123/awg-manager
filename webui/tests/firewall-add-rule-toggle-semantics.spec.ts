import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function findRuleByComment(request: APIRequestContext, comment: string) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  const rules = payload?.item?.rules || []
  return rules.find((r: any) => (r.comment || '') === comment)
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

test('add-rule +/- toggles remove disabled fields from saved rule', async ({ page, request }) => {
  await login(page)
  await openFirewall(page)
  await page.getByRole('tab', { name: 'mangle' }).click()

  const comment = `toggle-semantics-${Date.now()}`
  const dport = String(47000 + Math.floor(Math.random() * 1000))

  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  // Base tab: enable+fill then disable src and limit_rate
  const srcLine = modal.locator('div.space-y-1\\.5', { hasText: 'Source address' }).first()
  await srcLine.getByRole('button', { name: '+' }).click()
  await modal.getByPlaceholder('192.168.1.0/24 or @trusted_hosts').fill('10.70.0.0/24')
  await srcLine.getByRole('button', { name: '-' }).click()

  const dportLine = modal.locator('div.space-y-1\\.5', { hasText: 'Destination port' }).first()
  await dportLine.getByRole('button', { name: '+' }).click()
  await modal.getByPlaceholder('22, 80,443 or @admin_ports').fill(dport)

  const rateLine = modal.locator('div.space-y-1\\.5', { hasText: 'Rate limit' }).first()
  await rateLine.getByRole('button', { name: '+' }).click()
  await modal.getByPlaceholder('10/second or 200/minute').fill('77/second')
  await rateLine.getByRole('button', { name: '-' }).click()

  // Advanced tab: enable+fill then disable fib expr
  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  const fibPanel = modal.getByRole('button', { name: /FIB \/ socket \/ routing \/ L2/ }).first()
  await fibPanel.click()
  const fibLine = modal.locator('div.space-y-1\\.5', { hasText: 'fib expression' }).first()
  await fibLine.getByRole('button', { name: '+' }).click()
  await modal.getByPlaceholder('fib daddr . iif oif exists').fill('meta length > 40')
  await fibLine.getByRole('button', { name: '-' }).click()

  // Action tab: enable+fill then disable mark and log fields
  await modal.getByRole('tab', { name: 'Action' }).click()
  const markLine = modal.locator('div.space-y-1\\.5', { hasText: 'meta mark set' }).first()
  await markLine.getByRole('button', { name: '+' }).click()
  await modal.getByPlaceholder('0x1 or 10').first().fill('0x44')
  await markLine.getByRole('button', { name: '-' }).click()

  // Set comment via API-visible field (no toggle in some revisions).
  const commentInput = modal.getByPlaceholder('Rule comment (optional)')
  if (await commentInput.count()) {
    await commentInput.fill(comment)
  }

  await modal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(modal).toBeHidden()

  const row = page.locator('tbody tr').filter({ hasText: dport }).first()
  await expect(row).toBeVisible()

  let rule = await findRuleByComment(request, comment)
  if (!rule) {
    const res = await request.get('/firewall', { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const payload = await res.json()
    const rules = payload?.item?.rules || []
    rule = rules.find((r: any) => r.dport === dport)
  }
  expect(rule).toBeTruthy()
  expect(rule.dport).toBe(dport)
  expect(rule.src).toBeFalsy()
  expect(rule.limit_rate).toBeFalsy()
  expect(rule.fib_expr).toBeFalsy()
  expect(rule.mark_set).toBeFalsy()

  await deleteRule(request, rule.id)
})
