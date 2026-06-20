import { expect, test, type APIRequestContext } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function createRule(request: APIRequestContext, payload: Record<string, unknown>) {
  return await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: payload,
  })
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

test('block B2: packet priority editor explains QoS priority', async ({ page }) => {
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
  if (await modal.getByRole('button', { name: 'Meta match +' }).isVisible()) {
    await modal.getByRole('button', { name: 'Meta match +' }).click()
  }
  const priorityLine = modal.locator('div.space-y-1\\.5', { hasText: 'set packet priority (QoS)' }).first()
  await priorityLine.getByRole('button', { name: '+' }).click()
  await expect(priorityLine.getByText('Common values')).toBeVisible()
  await expect(priorityLine.getByText('Expert QoS action')).toBeVisible()
  await expect(priorityLine.getByText('not firewall rule order')).toBeVisible()
  await priorityLine.getByRole('button', { name: '1:10 tc classid major:minor' }).click()
  await expect(priorityLine.getByPlaceholder('1:10 / 0x10 / 10')).toHaveValue('1:10')
})

test('block B2: meta priority/cpu + ct direction/expiration map to runtime', async ({ request }) => {
  const comment = `block-b2-${Date.now()}`
  const res = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    proto: 'tcp',
    dport: '45581',
    meta_priority: '1:10',
    meta_cpu: '1',
    ct_direction: 'original',
    ct_expiration: '30s',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('meta priority set 1:10')
  expect(line).toContain('meta cpu 1')
  expect(line).toContain('ct direction original')
  expect(line).toContain('ct expiration 30s')

  await deleteRule(request, created.id)
})

test('block B2: invalid meta/ct values are rejected', async ({ request }) => {
  const badPriority = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    meta_priority: 'bad:value:1',
    comment: `block-b2-bad-prio-${Date.now()}`,
  })
  expect(badPriority.ok()).toBeFalsy()
  expect([400, 422]).toContain(badPriority.status())
  expect(await badPriority.text()).toContain('meta_priority')

  const badDirection = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    ct_direction: 'both',
    comment: `block-b2-bad-dir-${Date.now()}`,
  })
  expect(badDirection.ok()).toBeFalsy()
  expect([400, 422]).toContain(badDirection.status())
  expect(await badDirection.text()).toContain('ct_direction must be original or reply')
})
