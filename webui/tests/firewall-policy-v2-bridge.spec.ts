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
  const res = await request.delete(`/firewall/objects/${id}`, { headers: authHeaders() })
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

test('bridge rule API validation: anonymous limit_rate is accepted for bridge', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const { res, payload } = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      proto: 'tcp',
      dport: '443',
      limit_rate: '10/second',
    })
    expect(res.ok(), `create bridge limit_rate rule failed: ${JSON.stringify(payload)}`).toBeTruthy()
    expect(payload?.item?.limit_rate).toBe('10/second')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: missing named stateful objects are rejected with clear message', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const namedCounter = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      counter_name: 'cnt_missing_test',
    })
    expect(namedCounter.res.ok()).toBeFalsy()
    expect(String(namedCounter.payload?.error || '')).toContain('counter_name references missing counter object')

    const namedLimit = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      limit_name: 'lim_missing_test',
    })
    expect(namedLimit.res.ok()).toBeFalsy()
    expect(String(namedLimit.payload?.error || '')).toContain('limit_name references missing limit object')

    const namedQuota = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      quota_name: 'q_missing_test',
    })
    expect(namedQuota.res.ok()).toBeFalsy()
    expect(String(namedQuota.payload?.error || '')).toContain('quota_name references missing quota object')

    const ctHelperSet = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      ct_helper_set: 'ftp-standard',
    })
    expect(ctHelperSet.res.ok()).toBeFalsy()
    expect(String(ctHelperSet.payload?.error || '')).toContain('ct_helper_set references missing ct helper object')

    const ctExpectationSet = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      ct_expectation_set: 'expect-test',
    })
    expect(ctExpectationSet.res.ok()).toBeFalsy()
    expect(String(ctExpectationSet.payload?.error || '')).toContain('ct_expectation_set is planned for family=bridge')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge objects API: ct_expectation object is disabled as planned', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const created = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'ct_expectation',
      name: unique('exp'),
      enabled: true,
      l4proto: 'tcp',
      dport: 2121,
      timeout: '30s',
      size: 8,
    })
    expect(created.res.ok()).toBeFalsy()
    expect(String(created.payload?.error || '')).toContain('ct_expectation is planned for family=bridge')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge named objects CRUD: create object and use it in bridge rule', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  let objectId = ''
  try {
    const created = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'counter',
      name: unique('cnt'),
      enabled: true,
      comment: 'bridge counter',
    })
    expect(created.res.ok(), `create object failed: ${JSON.stringify(created.payload)}`).toBeTruthy()
    objectId = String(created.payload?.item?.id || '')
    const objectName = String(created.payload?.item?.name || '')
    expect(objectId.length).toBeGreaterThan(0)
    expect(objectName.length).toBeGreaterThan(0)

    const withReference = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      counter_name: objectName,
    })
    expect(withReference.res.ok(), `create bridge rule with counter_name failed: ${JSON.stringify(withReference.payload)}`).toBeTruthy()
    expect(withReference.payload?.item?.counter_name).toBe(objectName)
  } finally {
    if (objectId) await deleteNamedObject(request, objectId)
    await deleteTable(request, String(table.id))
  }
})

test('bridge named objects CRUD: object deletion is blocked while referenced', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  let objectId = ''
  let ruleId = ''
  try {
    const created = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'counter',
      name: unique('cnt'),
      enabled: true,
    })
    expect(created.res.ok(), `create object failed: ${JSON.stringify(created.payload)}`).toBeTruthy()
    objectId = String(created.payload?.item?.id || '')
    const objectName = String(created.payload?.item?.name || '')

    const createdRule = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      counter_name: objectName,
    })
    expect(createdRule.res.ok(), `create bridge rule failed: ${JSON.stringify(createdRule.payload)}`).toBeTruthy()
    ruleId = String(createdRule.payload?.item?.id || '')

    const delWhileReferenced = await deleteNamedObject(request, objectId)
    expect(delWhileReferenced.res.ok()).toBeFalsy()
    expect(String(delWhileReferenced.payload?.error || '')).toContain('object is in use')

    await request.delete(`/firewall/rules/${ruleId}`, { headers: authHeaders() })

    const delAfterRule = await deleteNamedObject(request, objectId)
    expect(delAfterRule.res.ok(), `delete object failed after rule remove: ${JSON.stringify(delAfterRule.payload)}`).toBeTruthy()
    objectId = ''
  } finally {
    if (ruleId) await request.delete(`/firewall/rules/${ruleId}`, { headers: authHeaders() })
    if (objectId) await deleteNamedObject(request, objectId)
    await deleteTable(request, String(table.id))
  }
})

test('bridge named objects: one rule can reference multiple object bindings', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  const createdObjectIds: string[] = []
  let ruleId = ''
  try {
    const suffix = unique('obj')
    const objectsToCreate = [
      { kind: 'counter', name: `cnt_${suffix}` },
      { kind: 'limit', name: `lim_${suffix}`, rate: '20/second', burst: '50 packets', over: false },
      { kind: 'quota', name: `quo_${suffix}`, mode: 'over', bytes: '50 mbytes' },
      { kind: 'ct_helper', name: `hlp_${suffix}`, helper_type: 'ftp', l4proto: 'tcp', l3proto: 'ip' },
      { kind: 'ct_timeout', name: `tmo_${suffix}`, l4proto: 'tcp', timeout_policy: 'established:120, close:20', l3proto: 'ip' },
    ] as const

    for (const objectPayload of objectsToCreate) {
      const created = await upsertNamedObject(request, {
        family: 'bridge',
        table: tableName,
        enabled: true,
        ...objectPayload,
      })
      expect(created.res.ok(), `create object failed: ${JSON.stringify(created.payload)}`).toBeTruthy()
      createdObjectIds.push(String(created.payload?.item?.id || ''))
    }

    const rule = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      proto: 'tcp',
      dport: '443',
      counter_name: `cnt_${suffix}`,
      limit_name: `lim_${suffix}`,
      quota_name: `quo_${suffix}`,
      ct_helper_set: `hlp_${suffix}`,
      ct_timeout_set: `tmo_${suffix}`,
      comment: 'multi-object-binding',
    })
    expect(rule.res.ok(), `create bridge rule with multiple object refs failed: ${JSON.stringify(rule.payload)}`).toBeTruthy()
    ruleId = String(rule.payload?.item?.id || '')
    expect(rule.payload?.item?.counter_name).toBe(`cnt_${suffix}`)
    expect(rule.payload?.item?.limit_name).toBe(`lim_${suffix}`)
    expect(rule.payload?.item?.quota_name).toBe(`quo_${suffix}`)
    expect(rule.payload?.item?.ct_helper_set).toBe(`hlp_${suffix}`)
    expect(rule.payload?.item?.ct_timeout_set).toBe(`tmo_${suffix}`)

    await expect.poll(async () => {
      const rows = await listBridgeRules(request, tableName)
      const row = rows.find((x: any) => x.id === ruleId)
      return !!row
        && row.counter_name === `cnt_${suffix}`
        && row.limit_name === `lim_${suffix}`
        && row.quota_name === `quo_${suffix}`
        && row.ct_helper_set === `hlp_${suffix}`
        && row.ct_timeout_set === `tmo_${suffix}`
    }, { timeout: 15_000 }).toBeTruthy()
  } finally {
    if (ruleId) await request.delete(`/firewall/rules/${ruleId}`, { headers: authHeaders() })
    for (const objectId of createdObjectIds) {
      if (objectId) await deleteNamedObject(request, objectId)
    }
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
