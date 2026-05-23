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
  return -(25000 + (Date.now() % 100000) + offset)
}

async function openFirewall(page: Page) {
  const heading = page.getByRole('heading', { name: 'Firewall' })
  if (await heading.count()) {
    if (await heading.first().isVisible()) return
  }
  await page.getByRole('button', { name: 'Firewall' }).click({ force: true })
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function createBridgeTable(request: APIRequestContext, tableName: string) {
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family: 'bridge',
      table_name: tableName,
      chain_name: 'forward',
      chain_type: 'filter',
      hook: 'forward',
      priority: uniquePriority(1),
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create bridge table failed: ${JSON.stringify(json)}`).toBeTruthy()
  return json.item
}

async function deleteTable(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/tables/${id}`, { headers: authHeaders() })
}

async function listBridgeRules(request: APIRequestContext, tableName: string) {
  const res = await request.get(`/firewall/rules?family=bridge&table=${encodeURIComponent(tableName)}`, { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const payload = await res.json()
  return payload.items || []
}

async function createBridgeRule(request: APIRequestContext, body: Record<string, any>) {
  const res = await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: body,
  })
  const payload = await res.json().catch(() => ({}))
  return { res, payload }
}

async function updateBridgeRule(request: APIRequestContext, id: string, body: Record<string, any>) {
  const res = await request.put(`/firewall/rules/${id}`, {
    headers: authHeaders(),
    data: body,
  })
  const payload = await res.json().catch(() => ({}))
  return { res, payload }
}

test('policy v2 bridge: UI creates rule and list endpoint returns it', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)
    await page.getByRole('tab', { name: 'policy v2' }).click()

    await page.locator("label:has-text('Table')").locator('..').locator('select').selectOption(tableName)
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Bridge Rule (Policy v2)')).toBeVisible()

    await page.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('forward')
    await page.locator("label:has-text('Action')").locator('..').locator('select').selectOption('accept')
    await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listBridgeRules(request, tableName)
      return rows.length
    }, { timeout: 15_000 }).toBeGreaterThan(0)
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: invalid MAC is rejected', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const res = await request.post('/firewall/rules', {
      headers: authHeaders(),
      data: {
        family: 'bridge',
        table: tableName,
        chain: 'forward',
        action: 'accept',
        ether_src: 'aa:bb:cc:dd:ee',
      },
    })
    expect(res.ok()).toBeFalsy()
    const payload = await res.json().catch(() => ({}))
    expect(String(payload?.error || '')).toContain('ether_src')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: proto/sport/dport/ct_state and nflog params are accepted in bridge policy v2', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const res = await request.post('/firewall/rules', {
      headers: authHeaders(),
      data: {
        family: 'bridge',
        table: tableName,
        chain: 'forward',
        action: 'accept',
        proto: 'tcp',
        sport: '1024',
        dport: '443',
        ct_state: 'established,related',
        log_group: 10,
        log_snaplen: 256,
        log_queue_threshold: 2,
      },
    })
    const payload = await res.json().catch(() => ({}))
    expect(res.ok(), `create bridge proto rule failed: ${JSON.stringify(payload)}`).toBeTruthy()
    expect(payload?.item?.proto).toBe('tcp')
    expect(payload?.item?.sport).toBe('1024')
    expect(payload?.item?.dport).toBe('443')
    expect(payload?.item?.ct_state).toBe('established,related')
    expect(payload?.item?.log_group).toBe(10)
    expect(payload?.item?.log_snaplen).toBe(256)
    expect(payload?.item?.log_queue_threshold).toBe(2)
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: log_group and log_flags are mutually exclusive', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const { res, payload } = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      log_group: 10,
      log_flags: ['tcp sequence'],
    })
    expect(res.ok()).toBeFalsy()
    expect(String(payload?.error || '')).toContain('mutually exclusive')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: vlan and ether_type ranges are enforced', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const badVlanLow = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      vlan_id: '0',
    })
    expect(badVlanLow.res.ok()).toBeFalsy()
    expect(String(badVlanLow.payload?.error || '')).toContain('vlan_id')

    const badVlanHigh = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      vlan_id: '4096',
    })
    expect(badVlanHigh.res.ok()).toBeFalsy()
    expect(String(badVlanHigh.payload?.error || '')).toContain('vlan_id')

    const badEtherType = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      ether_type: '99999',
    })
    expect(badEtherType.res.ok()).toBeFalsy()
    expect(String(badEtherType.payload?.error || '')).toContain('ether_type')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: inet-only fields are rejected for family=bridge', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const badField = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      src: '10.8.0.0/24',
    })
    expect(badField.res.ok()).toBeFalsy()
    expect(String(badField.payload?.error || '')).toContain('src is not supported for family=bridge')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: reject requires input/prerouting hook chain', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const badRes = await request.post('/firewall/rules', {
      headers: authHeaders(),
      data: {
        family: 'bridge',
        table: tableName,
        chain: 'forward',
        action: 'reject',
      },
    })
    const badPayload = await badRes.json().catch(() => ({}))
    expect(badRes.ok()).toBeFalsy()
    expect(String(badPayload?.error || '')).toContain('input or prerouting')

    const inputRes = await request.post('/firewall/tables', {
      headers: authHeaders(),
      data: {
        family: 'bridge',
        table_name: tableName,
        chain_name: 'input',
        chain_type: 'filter',
        hook: 'input',
        priority: uniquePriority(2),
        policy: 'accept',
      },
    })
    const inputTablePayload = await inputRes.json().catch(() => ({}))
    expect(inputRes.ok(), `create bridge input chain failed: ${JSON.stringify(inputTablePayload)}`).toBeTruthy()

    const okRes = await request.post('/firewall/rules', {
      headers: authHeaders(),
      data: {
        family: 'bridge',
        table: tableName,
        chain: 'input',
        action: 'reject',
      },
    })
    const okPayload = await okRes.json().catch(() => ({}))
    expect(okRes.ok(), `reject in input hook should work: ${JSON.stringify(okPayload)}`).toBeTruthy()
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('policy v2 bridge: API CRUD + enable/disable + inet isolation', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const created = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      proto: 'tcp',
      dport: '443',
      comment: 'bridge-crud',
      enabled: true,
    })
    expect(created.res.ok(), `create bridge rule failed: ${JSON.stringify(created.payload)}`).toBeTruthy()
    const ruleId = String(created.payload?.item?.id || '')
    expect(ruleId).not.toEqual('')

    await expect.poll(async () => {
      const rows = await listBridgeRules(request, tableName)
      return rows.some((r: any) => r.id === ruleId)
    }, { timeout: 15_000 }).toBeTruthy()

    const disabled = await updateBridgeRule(request, ruleId, { enabled: false })
    expect(disabled.res.ok(), `disable bridge rule failed: ${JSON.stringify(disabled.payload)}`).toBeTruthy()
    expect(disabled.payload?.item?.enabled).toBeFalsy()

    const enabled = await updateBridgeRule(request, ruleId, { enabled: true, comment: 'bridge-crud-updated', dport: '8443' })
    expect(enabled.res.ok(), `enable/update bridge rule failed: ${JSON.stringify(enabled.payload)}`).toBeTruthy()
    expect(enabled.payload?.item?.enabled).toBeTruthy()
    expect(enabled.payload?.item?.comment).toBe('bridge-crud-updated')
    expect(enabled.payload?.item?.dport).toBe('8443')

    const inetRes = await request.get('/firewall/rules?family=inet&table=filter', { headers: authHeaders() })
    expect(inetRes.ok()).toBeTruthy()
    const inetPayload = await inetRes.json().catch(() => ({}))
    const inetItems = Array.isArray(inetPayload?.items) ? inetPayload.items : []
    expect(inetItems.some((r: any) => r.id === ruleId)).toBeFalsy()

    const delRes = await request.delete(`/firewall/rules/${ruleId}`, { headers: authHeaders() })
    expect(delRes.ok()).toBeTruthy()
    await expect.poll(async () => {
      const rows = await listBridgeRules(request, tableName)
      return rows.some((r: any) => r.id === ruleId)
    }, { timeout: 15_000 }).toBeFalsy()
  } finally {
    await deleteTable(request, String(table.id))
  }
})
