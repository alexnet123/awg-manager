import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

function unique(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

function uniquePriority(offset = 0) {
  return -(35000 + (Date.now() % 100000) + offset)
}

async function openFirewall(page: Page) {
  const heading = page.getByRole('heading', { name: 'Firewall' })
  if (await heading.count()) {
    if (await heading.first().isVisible()) return
  }
  await page.getByRole('button', { name: 'Firewall' }).click({ force: true })
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function createNetdevTable(request: APIRequestContext, tableName: string, chainName = 'ingress') {
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family: 'netdev',
      table_name: tableName,
      chain_name: chainName,
      chain_type: 'filter',
      hook: 'ingress',
      device: 'eth0',
      priority: uniquePriority(1),
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create netdev table failed: ${JSON.stringify(json)}`).toBeTruthy()
  return json.item
}

async function deleteTable(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/tables/${id}`, { headers: authHeaders() })
}

async function createRule(request: APIRequestContext, body: Record<string, any>) {
  const res = await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: body,
  })
  const payload = await res.json().catch(() => ({}))
  return { res, payload }
}

async function listNetdevRules(request: APIRequestContext, tableName: string) {
  const res = await request.get(`/firewall/rules?family=netdev&table=${encodeURIComponent(tableName)}`, { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  return payload.items || []
}

test('policy3 netdev: API accepts ingress filter, queue and fwd rules', async ({ request }) => {
  const tableName = unique('nd_tbl')
  const table = await createNetdevTable(request, tableName)
  try {
    const accept = await createRule(request, {
      family: 'netdev',
      table: tableName,
      chain: 'ingress',
      action: 'accept',
      proto: 'tcp',
      dport: '443',
      ether_src: 'aa:bb:cc:dd:ee:ff',
      counter: true,
      limit_rate: '10/second',
      log_prefix: 'NETDEV:',
    })
    expect(accept.res.ok(), `create netdev accept failed: ${JSON.stringify(accept.payload)}`).toBeTruthy()
    expect(accept.payload?.item?.family).toBe('netdev')
    expect(accept.payload?.item?.counter).toBeTruthy()

    const queue = await createRule(request, {
      family: 'netdev',
      table: tableName,
      chain: 'ingress',
      action: 'queue',
      ether_src: 'aa:bb:cc:dd:ee:ff',
      queue_num: '0-3',
      queue_flags: ['bypass', 'fanout'],
    })
    expect(queue.res.ok(), `create netdev queue failed: ${JSON.stringify(queue.payload)}`).toBeTruthy()

    const fwd = await createRule(request, {
      family: 'netdev',
      table: tableName,
      chain: 'ingress',
      action: 'fwd',
      ether_src: 'aa:bb:cc:dd:ee:ff',
      fwd_to: '127.0.0.1',
      fwd_dev: 'eth0',
      fwd_family: 'ip',
    })
    expect(fwd.res.ok(), `create netdev fwd failed: ${JSON.stringify(fwd.payload)}`).toBeTruthy()
    expect(fwd.payload?.item?.action).toBe('fwd')
    expect(fwd.payload?.item?.fwd_to).toBe('127.0.0.1')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('policy3 netdev: API rejects non-ingress table and bridge-only fields', async ({ request }) => {
  const badTable = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family: 'netdev',
      table_name: unique('bad_nd'),
      chain_name: 'input',
      chain_type: 'filter',
      hook: 'input',
      priority: uniquePriority(20),
      policy: 'accept',
    },
  })
  expect(badTable.ok()).toBeFalsy()
  expect(String((await badTable.json().catch(() => ({})))?.error || '')).toContain('netdev')

  const tableName = unique('nd_tbl')
  const table = await createNetdevTable(request, tableName)
  try {
    const bridgeOnly = await createRule(request, {
      family: 'netdev',
      table: tableName,
      chain: 'ingress',
      action: 'accept',
      ibrname: 'br0',
    })
    expect(bridgeOnly.res.ok()).toBeFalsy()
    expect(String(bridgeOnly.payload?.error || '')).toContain('ibrname')

    const fwdMissingDevice = await createRule(request, {
      family: 'netdev',
      table: tableName,
      chain: 'ingress',
      action: 'fwd',
      fwd_to: '127.0.0.1',
    })
    expect(fwdMissingDevice.res.ok()).toBeFalsy()
    expect(String(fwdMissingDevice.payload?.error || '')).toContain('fwd_dev')

    const fwdOnAccept = await createRule(request, {
      family: 'netdev',
      table: tableName,
      chain: 'ingress',
      action: 'accept',
      fwd_to: '127.0.0.1',
      fwd_dev: 'lo',
    })
    expect(fwdOnAccept.res.ok()).toBeFalsy()
    expect(String(fwdOnAccept.payload?.error || '')).toContain('action=fwd')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('policy3 netdev: UI creates and edits a rule', async ({ page, request }) => {
  const tableName = unique('nd_tbl')
  const table = await createNetdevTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)
    await page.getByRole('tab', { name: 'policy3' }).click()

    await page.locator("label:has-text('Table')").locator('..').locator('select').selectOption(tableName)
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Netdev Rule (Policy3)')).toBeVisible()

    await page.locator("label:has-text('Action')").locator('..').locator('select').selectOption('accept')
    await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listNetdevRules(request, tableName)
      return rows.length
    }, { timeout: 30_000 }).toBeGreaterThan(0)
    await expect(page.getByText('Add Netdev Rule (Policy3)')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add' }).first()).toBeEnabled()

    const row = page.locator('tbody tr').filter({ hasText: 'accept' }).first()
    await row.dblclick()
    await expect(page.getByText('Edit Netdev Rule (Policy3)')).toBeVisible()
    await page.getByPlaceholder('Optional comment').fill('policy3 edited')
    await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Save' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listNetdevRules(request, tableName)
      return rows.some((r: any) => r.comment === 'policy3 edited')
    }, { timeout: 30_000 }).toBeTruthy()
  } finally {
    await deleteTable(request, String(table.id))
  }
})
