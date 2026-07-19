import { expect, test, type APIRequestContext } from '@playwright/test'

const API_KEY = process.env.PLAYWRIGHT_API_KEY || ''

function authHeaders() {
  return {
    'X-API-Key': API_KEY,
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

test('block B7: ct label and ct event map to runtime', async ({ request }) => {
  const comment = `block-b7-${Date.now()}`
  const res = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    proto: 'tcp',
    dport: '45622',
    ct_label: '0x1',
    ct_event: 'new,related,destroy',
    comment,
    enabled: true,
  })
  if (!res.ok()) throw new Error(`create failed ${res.status()}: ${await res.text()}`)
  const created = (await res.json()).item

  const state = await getFirewallState(request)
  const line = getRuleLineByComment(state?.item?.ruleset || '', comment)
  expect(line).toContain('ct label')
  expect(line).toContain('ct event set')

  await deleteRule(request, created.id)
})

test('block B7: invalid ct_event is rejected', async ({ request }) => {
  const bad = await createRule(request, {
    table: 'filter',
    chain: 'input',
    action: 'accept',
    ct_event: 'new,update',
    comment: `block-b7-bad-${Date.now()}`,
  })
  expect(bad.ok()).toBeFalsy()
  expect([400, 422]).toContain(bad.status())
  expect(await bad.text()).toContain('ct_event')
})

test('block B7: ct label stays in match and ct event is configured from action statements', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox').fill(API_KEY)
  await page.getByRole('button', { name: 'Enter' }).click()
  await page.getByRole('button', { name: 'Firewall' }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('tab', { name: 'Advanced match' }).click()

  await page.getByRole('button', { name: /Conntrack match/ }).click()

  await page.getByText('label_name / 0x1').locator('..').getByRole('button', { name: '+' }).click()
  await expect(page.getByPlaceholder('0x1 or label_name')).toBeVisible()
  await expect(page.getByText(/Names depend on server connlabel config/)).toBeVisible()
  await expect(page.getByText('new / related / destroy')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Action' }).click()
  await page.getByText('new / related / destroy').locator('..').getByRole('button', { name: '+' }).click()
  await expect(page.getByText('Sets conntrack event mask, not a packet match.')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /^new / })).toBeChecked()
  await page.getByRole('checkbox', { name: /^destroy / }).check()
  await page.getByRole('checkbox', { name: /^mark / }).check()
  await expect(page.getByText('new,destroy,mark')).toBeVisible()
})
