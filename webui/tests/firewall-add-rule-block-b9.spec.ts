import { expect, test, type APIRequestContext } from '@playwright/test'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function createRule(request: APIRequestContext, payload: Record<string, unknown>) {
  return await request.post('/firewall/rules', { headers: authHeaders(), data: payload })
}

async function getFirewallState(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  return await res.json()
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

function getRuleLineByComment(ruleset: string, comment: string): string {
  const lines = String(ruleset || '').split('\n')
  return lines.find((line) => line.includes(`comment "${comment}"`)) || ''
}

test('block B9: ct tuple address fields explain original and reply directions', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((apiKey) => {
    sessionStorage.setItem('awg_manager_auth_v1', JSON.stringify({ apiKey }))
  }, process.env.PLAYWRIGHT_API_KEY || '')
  await page.reload()

  await page.getByRole('button', { name: 'Firewall' }).click()
  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const modal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

  await modal.getByRole('tab', { name: 'Advanced match' }).click()
  if (await modal.getByRole('button', { name: 'Conntrack match +' }).isVisible()) {
    await modal.getByRole('button', { name: 'Conntrack match +' }).click()
  }

  const originalSource = modal.locator('div.space-y-1\\.5', { hasText: 'original source address' }).first()
  await expect(originalSource.getByText('initiator address')).toBeVisible()
  await originalSource.getByRole('button', { name: '+' }).click()
  await expect(originalSource.getByText('Conntrack original direction: source that started the flow.')).toBeVisible()

  const originalDestination = modal.locator('div.space-y-1\\.5', { hasText: 'original destination address' }).first()
  await expect(originalDestination.getByText('target address')).toBeVisible()
  await originalDestination.getByRole('button', { name: '+' }).click()
  await expect(originalDestination.getByText('Conntrack original direction: destination the flow was started to.')).toBeVisible()

  const replySource = modal.locator('div.space-y-1\\.5', { hasText: 'reply source address' }).first()
  await expect(replySource.getByText('return source')).toBeVisible()
  await replySource.getByRole('button', { name: '+' }).click()
  await expect(replySource.getByText('Conntrack reply direction: source of return traffic.')).toBeVisible()

  const replyDestination = modal.locator('div.space-y-1\\.5', { hasText: 'reply destination address' }).first()
  await expect(replyDestination.getByText('return destination')).toBeVisible()
  await replyDestination.getByRole('button', { name: '+' }).click()
  await expect(replyDestination.getByText('Conntrack reply direction: destination of return traffic.')).toBeVisible()
})

test('block B9: ct original/reply addr fields map to runtime', async ({ request }) => {
  const comment = `block-b9-${Date.now()}`
  const res = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: '45624',
    ct_original_saddr: '192.168.10.10',
    ct_original_daddr: '203.0.113.10',
    ct_reply_saddr: '203.0.113.10',
    ct_reply_daddr: '192.168.10.10',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('ct original ip saddr 192.168.10.10')
  expect(line).toContain('ct original ip daddr 203.0.113.10')
  expect(line).toContain('ct reply ip saddr 203.0.113.10')
  expect(line).toContain('ct reply ip daddr 192.168.10.10')

  await deleteRule(request, created.id)
})

test('block B9: invalid ct original/reply addr values are rejected', async ({ request }) => {
  const bad = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    ct_original_saddr: 'bad-ip',
    comment: `block-b9-bad-${Date.now()}`,
  })
  expect(bad.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad.status())
  expect(await bad.text()).toContain('ct_original_saddr')
})
