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

async function upsertNamedObject(request: APIRequestContext, body: Record<string, any>) {
  const hasId = typeof body.id === 'string' && body.id.length > 0
  const res = await request.fetch(hasId ? `/firewall/objects/${body.id}` : '/firewall/objects', {
    method: hasId ? 'PUT' : 'POST',
    headers: authHeaders(),
    data: body,
  })
  const payload = await res.json().catch(() => ({}))
  return { res, payload }
}

async function deleteNamedObject(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/objects/${id}`, { headers: authHeaders() })
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

test('unified Policy netdev: API accepts ingress filter, queue and fwd rules', async ({ request }) => {
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

test('unified Policy netdev: API rejects non-ingress table and bridge-only fields', async ({ request }) => {
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

test('unified Policy netdev: UI creates and edits a rule', async ({ page, request }) => {
  const tableName = unique('nd_tbl')
  const table = await createNetdevTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`netdev / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    await page.getByRole('tab', { name: 'Action' }).click()
    await page.locator("label:has-text('Action')").locator('..').locator('select').selectOption('accept')
    await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listNetdevRules(request, tableName)
      return rows.length
    }, { timeout: 30_000 }).toBeGreaterThan(0)
    await expect(page.getByText('Add Firewall Rule')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add' }).first()).toBeEnabled()

    const row = page.locator('tbody tr').filter({ hasText: 'accept' }).first()
    await row.dblclick()
    await expect(page.getByText('Edit Firewall Rule')).toBeVisible()
    await page.getByPlaceholder('Rule comment (optional)').fill('unified policy netdev edited')
    await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Save' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listNetdevRules(request, tableName)
      return rows.some((r: any) => r.comment === 'unified policy netdev edited')
    }, { timeout: 30_000 }).toBeTruthy()
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy netdev: Add Rule action choices match netdev context', async ({ page, request }) => {
  const tableName = unique('nd_tbl')
  const table = await createNetdevTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`netdev / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    await page.getByRole('tab', { name: 'Action' }).click()
    const modal = page.locator('div.fixed.inset-0.z-40').last()
    const actionSelect = modal.locator("label:has-text('Action')").locator('..').locator('select')

    await expect(actionSelect.locator('option[value="accept"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="drop"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="queue"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="fwd"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="reject"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(0)
    await expect(modal.getByText('NAT actions are not available for bridge/netdev rules.')).toBeVisible()
    await expect(modal.getByText('Dynamic set update is available only for inet rules.')).toBeVisible()
    await expect(modal.getByText('Verdict map is available only for inet rules.')).toBeVisible()
    await expect(modal.getByText('Named object bindings are not available for netdev rules.')).toBeVisible()
    await expect(modal.getByText('Named objects')).toHaveCount(0)

    await actionSelect.selectOption('fwd')
    await expect(modal.getByText('fwd family')).toBeVisible()
    await expect(modal.getByText('fwd to')).toBeVisible()
    await expect(modal.getByText('fwd dev')).toBeVisible()

    await modal.getByRole('tab', { name: 'Statistics' }).click()
    await expect(modal.getByText(/Enable nft `counter` for this rule/)).toBeVisible()
    await expect(modal.getByText('counter object')).toHaveCount(0)
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy netdev walkthrough: creates tcp dport 23 drop rule and exposes fwd only here', async ({ page, request }) => {
  const tableName = unique('nd_walk_tbl')
  const comment = unique('netdev-walk-drop')
  const table = await createNetdevTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`netdev / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await modal.getByPlaceholder('Rule comment (optional)').fill(comment)
    await modal.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('ingress')
    await expect(modal.getByText('Input interface')).toBeVisible()
    await expect(modal.getByText('Output interface')).toHaveCount(0)
    await modal.locator("label:has-text('Protocol')").locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').first().locator('input').fill('tcp')
    await modal.locator("label:has-text('Destination port')").locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').first().getByRole('button', { name: '+' }).click()
    await modal.locator("label:has-text('Destination port')").locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').first().locator('input').fill('23')

    await modal.getByRole('tab', { name: 'Action' }).click()
    const actionSelect = modal.locator("label:has-text('Action')").locator('..').locator('select')
    await expect(actionSelect.locator('option[value="drop"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="fwd"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="reject"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(0)
    await expect(modal.getByText('Named object bindings are not available for netdev rules.')).toBeVisible()
    await actionSelect.selectOption('fwd')
    await expect(modal.getByText('fwd dev')).toBeVisible()
    await actionSelect.selectOption('drop')
    await modal.getByRole('button', { name: 'Add' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listNetdevRules(request, tableName)
      return rows.find((rule: any) => rule.comment === comment) || null
    }, { timeout: 30_000 }).not.toBeNull()

    const rows = await listNetdevRules(request, tableName)
    const createdRule = rows.find((rule: any) => rule.comment === comment)
    expect(createdRule.family).toBe('netdev')
    expect(createdRule.table).toBe(tableName)
    expect(createdRule.chain).toBe('ingress')
    expect(createdRule.action).toBe('drop')
    expect(createdRule.proto).toBe('tcp')
    expect(createdRule.dport).toBe('23')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy netdev: base fields follow ingress device context', async ({ page, request }) => {
  const tableName = unique('nd_tbl')
  const table = await createNetdevTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`netdev / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Input interface')).toBeVisible()
    await expect(modal.getByText('Output interface')).toHaveCount(0)
    await expect(modal.getByText('Bridge input')).toHaveCount(0)
    await expect(modal.getByText('Bridge output')).toHaveCount(0)
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy netdev objects: Use in rule and ct object kinds are disabled', async ({ page, request }) => {
  const tableName = unique('nd_tbl')
  const table = await createNetdevTable(request, tableName)
  let objectId = ''
  const objectName = unique('nd_counter')
  try {
    const created = await upsertNamedObject(request, {
      family: 'netdev',
      table: tableName,
      kind: 'counter',
      name: objectName,
      enabled: true,
    })
    expect(created.res.ok(), `create netdev object failed: ${JSON.stringify(created.payload)}`).toBeTruthy()
    objectId = String(created.payload?.item?.id || '')

    await login(page)
    await openFirewall(page)
    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator('select').selectOption(`netdev:${tableName}`)

    await expect(page.getByText('netdev object bindings are not supported by backend validation')).toBeVisible()
    const useInRule = page.getByRole('button', { name: 'Use in rule' })
    await expect(useInRule).toBeDisabled()

    const objectRow = page.locator('tbody tr').filter({ hasText: objectName }).first()
    await expect(objectRow).toBeVisible()
    await objectRow.click()
    await expect(useInRule).toBeDisabled()
    await expect(objectRow.getByRole('button', { name: 'use' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Add object' }).click()
    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Add Firewall Object')).toBeVisible()
    const kindSelect = modal.locator("label:has-text('Kind')").locator('..').locator('select')
    await expect(kindSelect.locator('option[value="ct_helper"]')).toBeDisabled()
    await expect(kindSelect.locator('option[value="ct_timeout"]')).toBeDisabled()
    await expect(kindSelect.locator('option[value="ct_expectation"]')).toBeDisabled()
    await expect(modal.getByRole('button', { name: 'FTP expectation' })).toBeDisabled()
  } finally {
    if (objectId) await deleteNamedObject(request, objectId)
    await deleteTable(request, String(table.id))
  }
})
