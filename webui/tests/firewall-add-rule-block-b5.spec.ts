import { expect, test, type APIRequestContext } from '@playwright/test'

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

test('block B5: ct helper match is a combobox with presets and custom input', async ({ page }) => {
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

  const helperLine = modal.locator('div.space-y-1\\.5', { hasText: 'ct helper' }).first()
  await expect(helperLine.getByText('ftp / sip')).toBeVisible()
  await helperLine.getByRole('button', { name: '+' }).click()

  const input = helperLine.getByRole('combobox')
  await expect(input).toHaveValue('ftp')
  await expect(helperLine.getByText('Matches an already assigned conntrack helper.')).toBeVisible()
  await helperLine.getByRole('button', { name: 'Show ct helper presets' }).click()
  await expect(helperLine.getByRole('option', { name: 'sip SIP signaling helper' })).toBeVisible()
  await helperLine.getByRole('option', { name: 'sip SIP signaling helper' }).click()
  await expect(input).toHaveValue('sip')

  await input.fill('ftp-custom')
  await expect(input).toHaveValue('ftp-custom')
})

test('block B5: ct helper match maps to runtime', async ({ request }) => {
  const comment = `block-b5-${Date.now()}`
  const res = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    proto: 'tcp',
    dport: '45611',
    ct_helper_match: 'ftp',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('ct helper')
  expect(line).toContain('"ftp"')

  await deleteRule(request, created.id)
})

test('block B5: invalid ct helper match value is rejected', async ({ request }) => {
  const bad = await createRule(request, {
    table: 'mangle',
    chain: 'forward',
    action: 'accept',
    ct_helper_match: 'ftp helper!',
    comment: `block-b5-bad-${Date.now()}`,
  })
  expect(bad.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad.status())
  expect(await bad.text()).toContain('ct_helper_match')
})
