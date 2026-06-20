import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
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

function toggleLine(modal: Locator, label: string) {
  return modal.locator(`label:has-text('${label}')`).locator('xpath=ancestor::div[contains(@class,"space-y-1.5")]').first()
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

async function createIpFilterTable(request: APIRequestContext, tableName: string) {
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family: 'ip',
      table_name: tableName,
      chain_name: 'input',
      chain_type: 'filter',
      hook: 'input',
      priority: uniquePriority(2),
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create ip filter table failed: ${JSON.stringify(json)}`).toBeTruthy()
  return json.item
}

async function createIp6FilterTable(request: APIRequestContext, tableName: string) {
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family: 'ip6',
      table_name: tableName,
      chain_name: 'input',
      chain_type: 'filter',
      hook: 'input',
      priority: uniquePriority(3),
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create ip6 filter table failed: ${JSON.stringify(json)}`).toBeTruthy()
  return json.item
}

async function createL3FilterTable(request: APIRequestContext, family: 'ip' | 'ip6', tableName: string, chainName: string, hook: 'input' | 'output') {
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family,
      table_name: tableName,
      chain_name: chainName,
      chain_type: 'filter',
      hook,
      priority: uniquePriority(hook === 'output' ? 12 : 11),
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create ${family} filter table failed: ${JSON.stringify(json)}`).toBeTruthy()
  return json.item
}

async function createL3NatTable(request: APIRequestContext, family: 'ip' | 'ip6', tableName: string, chainName: string, hook: 'prerouting' | 'postrouting') {
  const natPriority = hook === 'postrouting' ? 101 : -101
  const res = await request.post('/firewall/tables', {
    headers: authHeaders(),
    data: {
      family,
      table_name: tableName,
      chain_name: chainName,
      chain_type: 'nat',
      hook,
      priority: natPriority,
      policy: 'accept',
    },
  })
  const json = await res.json().catch(() => ({}))
  expect(res.ok(), `create ${family} nat table failed: ${JSON.stringify(json)}`).toBeTruthy()
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

test('unified Policy bridge: UI creates rule and list endpoint returns it', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await expect(page.getByText('Bridge input')).toBeVisible()

    await page.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('forward')
    await page.getByRole('tab', { name: 'Action' }).click()
    await page.locator("label:has-text('Action')").locator('..').locator('select').selectOption('accept')
    await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Add' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listBridgeRules(request, tableName)
      return rows.length
    }, { timeout: 30_000 }).toBeGreaterThan(0)
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy bridge: Add Rule action choices and object bindings match bridge context', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    await page.getByRole('tab', { name: 'Action' }).click()
    const modal = page.locator('div.fixed.inset-0.z-40').last()
    const actionSelect = modal.locator("label:has-text('Action')").locator('..').locator('select')

    await expect(actionSelect.locator('option[value="accept"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="drop"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="reject"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="queue"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="fwd"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(0)
    await expect(modal.getByText('NAT actions are not available for bridge/netdev rules.')).toBeVisible()
    await expect(modal.getByText('Dynamic set update is available only for inet rules.')).toBeVisible()
    await expect(modal.getByText('Verdict map is available only for inet rules.')).toBeVisible()

    await expect(modal.getByText('Named objects', { exact: true })).toBeVisible()
    await expect(modal.getByText('ct helper object')).toBeVisible()
    await expect(modal.getByText('ct timeout object')).toBeVisible()
    await expect(modal.getByText('ct expectation object', { exact: true })).toHaveCount(0)
    await expect(modal.getByText('ct expectation object is available only for inet/ip/ip6 rules.')).toBeVisible()
    await expect(modal.getByText('No named objects in this table yet. Create them from the Objects section.')).toBeVisible()

    await actionSelect.selectOption('queue')
    await expect(modal.getByText('queue num')).toBeVisible()
    await expect(modal.getByText('queue flags')).toBeVisible()

    await modal.getByRole('tab', { name: 'Statistics' }).click()
    await expect(modal.getByText('anonymous counter')).toBeVisible()
    await expect(modal.getByText('Counter object', { exact: true })).toBeVisible()
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy bridge walkthrough: creates drop rule and explains NAT unavailable', async ({ page, request }) => {
  const tableName = unique('br_walk_tbl')
  const comment = unique('bridge-walk-drop')
  const table = await createBridgeTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await modal.getByPlaceholder('Rule comment (optional)').fill(comment)
    await modal.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('forward')
    await expect(modal.getByText('Bridge input')).toBeVisible()
    await expect(modal.getByText('Bridge output')).toBeVisible()
    await toggleLine(modal, 'Bridge input').getByRole('button', { name: '+' }).click()
    await toggleLine(modal, 'Bridge input').locator('input').fill('br0')

    await modal.getByRole('tab', { name: 'Action' }).click()
    const actionSelect = modal.locator("label:has-text('Action')").locator('..').locator('select')
    await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(0)
    await expect(modal.getByText('NAT actions are not available for bridge/netdev rules.')).toBeVisible()
    await actionSelect.selectOption('drop')
    await modal.getByRole('button', { name: 'Add' }).click({ force: true })

    await expect.poll(async () => {
      const rows = await listBridgeRules(request, tableName)
      return rows.find((rule: any) => rule.comment === comment) || null
    }, { timeout: 30_000 }).not.toBeNull()

    const rows = await listBridgeRules(request, tableName)
    const createdRule = rows.find((rule: any) => rule.comment === comment)
    expect((createdRule as any).family).toBe('bridge')
    expect((createdRule as any).table).toBe(tableName)
    expect((createdRule as any).chain).toBe('forward')
    expect((createdRule as any).action).toBe('drop')
    expect((createdRule as any).ibrname).toBe('br0')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy bridge: base fields use bridge interface controls only', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Bridge input')).toBeVisible()
    await expect(modal.getByText('Bridge output')).toBeVisible()
    await expect(modal.getByText('Input interface')).toHaveCount(0)
    await expect(modal.getByText('Output interface')).toHaveCount(0)
    await expect(modal.getByText('Connection state')).toBeVisible()
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy ip filter: UI hides NAT verdicts outside nat context', async ({ page, request }) => {
  const tableName = unique('ip_filter_tbl')
  const table = await createIpFilterTable(request, tableName)
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`ip / ${tableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    await page.getByRole('tab', { name: 'Action' }).click()
    const actionSelect = page.locator("label:has-text('Action')").locator('..').locator('select')
    await expect(actionSelect.locator('option[value=\"dnat\"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value=\"snat\"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value=\"masquerade\"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value=\"redirect\"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value=\"reject\"]')).toHaveCount(1)
    await expect(page.getByText('NAT actions are shown only when the selected family/table/chain supports NAT.')).toBeVisible()
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy ip/ip6 custom filter: base fields follow hook direction', async ({ page, request }) => {
  const ipInputName = unique('ip_filter_in_tbl')
  const ip6OutputName = unique('ip6_filter_out_tbl')
  const ipInputTable = await createL3FilterTable(request, 'ip', ipInputName, 'input', 'input')
  const ip6OutputTable = await createL3FilterTable(request, 'ip6', ip6OutputName, 'output', 'output')
  try {
    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`ip / ${ipInputName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    let modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Input interface')).toBeVisible()
    await expect(modal.getByText('Output interface')).toHaveCount(0)
    await expect(modal.getByText('Connection state')).toBeVisible()
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
    await expect(modal).toBeHidden()

    await page.getByText(`ip / ${ipInputName}`, { exact: true }).click()
    await page.getByText(`ip6 / ${ip6OutputName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Input interface')).toHaveCount(0)
    await expect(modal.getByText('Output interface')).toBeVisible()
    await expect(modal.getByText('Connection state')).toBeVisible()
  } finally {
    await deleteTable(request, String(ipInputTable.id))
    await deleteTable(request, String(ip6OutputTable.id))
  }
})

test('unified Policy ip/ip6: ct expectation object binding is available in Add Rule', async ({ page, request }) => {
  const ipTableName = unique('ip_filter_tbl')
  const ip6TableName = unique('ip6_filter_tbl')
  const ipTable = await createIpFilterTable(request, ipTableName)
  const ip6Table = await createIp6FilterTable(request, ip6TableName)
  const objectIds: string[] = []
  const ipExpectationName = unique('exp_ip')
  const ip6ExpectationName = unique('exp_ip6')
  try {
    const ipExpectation = await upsertNamedObject(request, {
      family: 'ip',
      table: ipTableName,
      kind: 'ct_expectation',
      name: ipExpectationName,
      enabled: true,
      l3proto: 'ip',
      l4proto: 'tcp',
      dport: 2121,
      timeout: '30s',
      size: 8,
    })
    expect(ipExpectation.res.ok(), `create ip expectation failed: ${JSON.stringify(ipExpectation.payload)}`).toBeTruthy()
    objectIds.push(String(ipExpectation.payload?.item?.id || ''))

    const ip6Expectation = await upsertNamedObject(request, {
      family: 'ip6',
      table: ip6TableName,
      kind: 'ct_expectation',
      name: ip6ExpectationName,
      enabled: true,
      l3proto: 'ip6',
      l4proto: 'tcp',
      dport: 2121,
      timeout: '30s',
      size: 8,
    })
    expect(ip6Expectation.res.ok(), `create ip6 expectation failed: ${JSON.stringify(ip6Expectation.payload)}`).toBeTruthy()
    objectIds.push(String(ip6Expectation.payload?.item?.id || ''))

    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`ip / ${ipTableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await page.getByRole('tab', { name: 'Action' }).click()

    let modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('ct expectation object')).toBeVisible()
    await toggleLine(modal, 'ct expectation object').getByRole('button', { name: '+' }).click()
    await expect(toggleLine(modal, 'ct expectation object').locator('select')).toContainText(ipExpectationName)
    await expect(modal.getByText('No named objects in this table yet. Create them from the Objects section.')).toHaveCount(0)
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
    await expect(modal).toBeHidden()

    await page.getByText(`ip / ${ipTableName}`, { exact: true }).click()
    await page.getByText(`ip6 / ${ip6TableName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await page.getByRole('tab', { name: 'Action' }).click()

    modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('ct expectation object')).toBeVisible()
    await toggleLine(modal, 'ct expectation object').getByRole('button', { name: '+' }).click()
    await expect(toggleLine(modal, 'ct expectation object').locator('select')).toContainText(ip6ExpectationName)
  } finally {
    for (const objectId of objectIds) {
      if (objectId) await deleteNamedObject(request, objectId)
    }
    await deleteTable(request, String(ipTable.id))
    await deleteTable(request, String(ip6Table.id))
  }
})

test('unified Policy ip/ip6 custom nat: action choices follow custom nat chain', async ({ page, request }) => {
  const ipPostroutingName = unique('ip_nat_post_tbl')
  const ip6PreroutingName = unique('ip6_nat_pre_tbl')
  let ipPostroutingTable: any = null
  let ip6PreroutingTable: any = null
  try {
    ipPostroutingTable = await createL3NatTable(request, 'ip', ipPostroutingName, 'postrouting', 'postrouting')
    ip6PreroutingTable = await createL3NatTable(request, 'ip6', ip6PreroutingName, 'prerouting', 'prerouting')

    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`ip / ${ipPostroutingName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await page.getByRole('tab', { name: 'Action' }).click()

    let modal = page.locator('div.fixed.inset-0.z-40').last()
    let actionSelect = modal.locator("label:has-text('Action')").locator('..').locator('select')
    await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(0)
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
    await expect(modal).toBeHidden()

    await page.getByText(`ip / ${ipPostroutingName}`, { exact: true }).click()
    await page.getByText(`ip6 / ${ip6PreroutingName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await page.getByRole('tab', { name: 'Action' }).click()

    modal = page.locator('div.fixed.inset-0.z-40').last()
    actionSelect = modal.locator("label:has-text('Action')").locator('..').locator('select')
    await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(1)
    await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(0)
    await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(0)
  } finally {
    if (ipPostroutingTable?.id) await deleteTable(request, String(ipPostroutingTable.id))
    if (ip6PreroutingTable?.id) await deleteTable(request, String(ip6PreroutingTable.id))
  }
})

test('unified Policy ip/ip6 custom nat: base fields follow hook direction', async ({ page, request }) => {
  const ipPreroutingName = unique('ip_nat_pre_tbl')
  const ip6PostroutingName = unique('ip6_nat_post_tbl')
  let ipPreroutingTable: any = null
  let ip6PostroutingTable: any = null
  try {
    ipPreroutingTable = await createL3NatTable(request, 'ip', ipPreroutingName, 'prerouting', 'prerouting')
    ip6PostroutingTable = await createL3NatTable(request, 'ip6', ip6PostroutingName, 'postrouting', 'postrouting')

    await login(page)
    await openFirewall(page)

    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`ip / ${ipPreroutingName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    let modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Input interface')).toBeVisible()
    await expect(modal.getByText('Output interface')).toHaveCount(0)
    await expect(modal.getByText('Connection state')).toHaveCount(0)
    await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
    await expect(modal).toBeHidden()

    await page.getByText(`ip / ${ipPreroutingName}`, { exact: true }).click()
    await page.getByText(`ip6 / ${ip6PostroutingName}`, { exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()

    modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Input interface')).toHaveCount(0)
    await expect(modal.getByText('Output interface')).toBeVisible()
    await expect(modal.getByText('Connection state')).toHaveCount(0)
  } finally {
    if (ipPreroutingTable?.id) await deleteTable(request, String(ipPreroutingTable.id))
    if (ip6PostroutingTable?.id) await deleteTable(request, String(ip6PostroutingTable.id))
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

test('bridge rule API validation: proto/sport/dport/ct_state and nflog params are accepted in bridge policy', async ({ request }) => {
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

test('bridge rule API validation: bridge meta and mark match fields are accepted with strict validation', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const good = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      meta_pkttype: 'multicast',
      meta_iifgroup: '10',
      meta_oifgroup: '20',
      mark_match: '0x10',
      ct_mark_match: '25',
    })
    expect(good.res.ok(), `create bridge meta/mark rule failed: ${JSON.stringify(good.payload)}`).toBeTruthy()
    expect(good.payload?.item?.meta_pkttype).toBe('multicast')
    expect(good.payload?.item?.meta_iifgroup).toBe('10')
    expect(good.payload?.item?.meta_oifgroup).toBe('20')
    expect(good.payload?.item?.mark_match).toBe('0x10')
    expect(good.payload?.item?.ct_mark_match).toBe('25')

    const badPkttype = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      meta_pkttype: 'weird',
    })
    expect(badPkttype.res.ok()).toBeFalsy()
    expect(String(badPkttype.payload?.error || '')).toContain('meta_pkttype')

    const badMark = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      mark_match: 'abc',
    })
    expect(badMark.res.ok()).toBeFalsy()
    expect(String(badMark.payload?.error || '')).toContain('mark_match')
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

test('bridge rule API validation: queue action is accepted for bridge', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const queued = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'queue',
      queue_num: '0-3',
      queue_flags: ['bypass', 'fanout'],
    })
    expect(queued.res.ok(), `create bridge queue rule failed: ${JSON.stringify(queued.payload)}`).toBeTruthy()
    expect(queued.payload?.item?.action).toBe('queue')
    expect(queued.payload?.item?.queue_num).toBe('0-3')
    expect(queued.payload?.item?.queue_flags || []).toEqual(expect.arrayContaining(['bypass', 'fanout']))
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: structured expert expressions are planned/disabled for bridge on current runtime', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const blocked = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      fib_check: 'daddr type local',
      socket_match: 'transparent 1',
      rt_nexthop: '192.0.2.1',
      ipv6_exthdrs: 'frag missing',
    })
    expect(blocked.res.ok()).toBeFalsy()
    expect(String(blocked.payload?.error || '')).toContain('fib_check/socket_match/rt_nexthop/ipv6_exthdrs are planned for family=bridge')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: fwd statement is rejected for bridge (netdev only)', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const bad = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      fwd_to: '198.51.100.10',
      fwd_dev: 'eth0',
      fwd_family: 'ip',
    })
    expect(bad.res.ok()).toBeFalsy()
    expect(String(bad.payload?.error || '')).toContain('fwd_to/fwd_dev/fwd_family are supported only for family=netdev')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: queue fanout requires queue range', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const bad = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'queue',
      queue_num: '0',
      queue_flags: ['fanout'],
    })
    expect(bad.res.ok()).toBeFalsy()
    expect(String(bad.payload?.error || '')).toContain('fanout')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge rule API validation: dup statement is currently planned for bridge runtime', async ({ request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  try {
    const bad = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      dup_to: '192.0.2.10',
      dup_dev: 'eth0',
    })
    expect(bad.res.ok()).toBeFalsy()
    expect(String(bad.payload?.error || '')).toContain('dup_to/dup_dev are planned for family=bridge')
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
    expect(String(ctExpectationSet.payload?.error || '')).toContain('ct_expectation_set is not supported for family=bridge')
  } finally {
    await deleteTable(request, String(table.id))
  }
})

test('bridge objects API: ct_expectation object is not supported', async ({ request }) => {
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
    expect(String(created.payload?.error || '')).toContain('ct_expectation is not supported for family=bridge')
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

test('unified Policy bridge objects UI: object usage filters rules from object panel', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  let objectId = ''
  let ruleId = ''
  const objectName = unique('cnt')
  try {
    const createdObject = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'counter',
      name: objectName,
      enabled: true,
      comment: 'drilldown object',
    })
    expect(createdObject.res.ok(), `create object failed: ${JSON.stringify(createdObject.payload)}`).toBeTruthy()
    objectId = String(createdObject.payload?.item?.id || '')

    const createdRule = await createBridgeRule(request, {
      family: 'bridge',
      table: tableName,
      chain: 'forward',
      action: 'accept',
      proto: 'tcp',
      dport: '443',
      counter_name: objectName,
      comment: 'drilldown-rule',
    })
    expect(createdRule.res.ok(), `create rule failed: ${JSON.stringify(createdRule.payload)}`).toBeTruthy()
    ruleId = String(createdRule.payload?.item?.id || '')

    await login(page)
    await openFirewall(page)
    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator('select').selectOption(`bridge:${tableName}`)
    const objectRow = page.locator('tbody tr').filter({ hasText: objectName }).first()
    await expect(objectRow).toBeVisible()
    await objectRow.getByRole('button').first().click()

    await expect(page.getByText(new RegExp(`rules filter:\\s*object:\\s*counter:${objectName.toLowerCase()}`))).toBeVisible()
    await expect(page.locator('tbody tr').filter({ hasText: 'drilldown-rule' }).first()).toBeVisible()
  } finally {
    if (ruleId) await request.delete(`/firewall/rules/${ruleId}`, { headers: authHeaders() })
    if (objectId) await deleteNamedObject(request, objectId)
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy bridge objects UI: object row can open Add Rule prefilled with selected object binding', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  let objectId = ''
  const objectName = unique('cnt')
  try {
    const createdObject = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'counter',
      name: objectName,
      enabled: true,
      comment: 'prefill object',
    })
    expect(createdObject.res.ok(), `create object failed: ${JSON.stringify(createdObject.payload)}`).toBeTruthy()
    objectId = String(createdObject.payload?.item?.id || '')

    await login(page)
    await openFirewall(page)
    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator('select').selectOption(`bridge:${tableName}`)

    const objectRow = page.locator('tbody tr').filter({ hasText: objectName }).first()
    await expect(objectRow).toBeVisible()
    await objectRow.getByRole('button', { name: 'use' }).click()

    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await expect(page.getByText(`counter:${objectName}`)).toBeVisible()
  } finally {
    if (objectId) await deleteNamedObject(request, objectId)
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy bridge objects UI: limit object row can open Add Rule prefilled with limit binding', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  let counterId = ''
  let limitId = ''
  const counterName = unique('cnt')
  const limitName = unique('lim')
  try {
    const counterObj = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'counter',
      name: counterName,
      enabled: true,
    })
    expect(counterObj.res.ok(), `create counter failed: ${JSON.stringify(counterObj.payload)}`).toBeTruthy()
    counterId = String(counterObj.payload?.item?.id || '')

    const limitObj = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'limit',
      name: limitName,
      enabled: true,
      rate: '15/second',
    })
    expect(limitObj.res.ok(), `create limit failed: ${JSON.stringify(limitObj.payload)}`).toBeTruthy()
    limitId = String(limitObj.payload?.item?.id || '')

    await login(page)
    await openFirewall(page)
    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator('select').selectOption(`bridge:${tableName}`)

    const limitRow = page.locator('tbody tr').filter({ hasText: limitName }).first()
    await expect(limitRow).toBeVisible()
    await limitRow.getByRole('button', { name: 'use' }).click()

    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await expect(page.getByText(`limit:${limitName}`)).toBeVisible({ timeout: 5000 })
  } finally {
    if (limitId) await deleteNamedObject(request, limitId)
    if (counterId) await deleteNamedObject(request, counterId)
    await deleteTable(request, String(table.id))
  }
})

test('unified Policy bridge objects UI: editor quick panel can unlink a prefilled object binding', async ({ page, request }) => {
  const tableName = unique('br_tbl')
  const table = await createBridgeTable(request, tableName)
  let objectId = ''
  const objectName = unique('cnt')
  try {
    const createdObject = await upsertNamedObject(request, {
      family: 'bridge',
      table: tableName,
      kind: 'counter',
      name: objectName,
      enabled: true,
    })
    expect(createdObject.res.ok(), `create object failed: ${JSON.stringify(createdObject.payload)}`).toBeTruthy()
    objectId = String(createdObject.payload?.item?.id || '')

    await login(page)
    await openFirewall(page)
    await page.getByText('System table only', { exact: true }).click()
    await page.getByText(`bridge / ${tableName}`, { exact: true }).click()
    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator('select').selectOption(`bridge:${tableName}`)

    const objectRow = page.locator('tbody tr').filter({ hasText: objectName }).first()
    await expect(objectRow).toBeVisible()
    await objectRow.getByRole('button', { name: 'use' }).click()
    await expect(page.getByText('Add Firewall Rule')).toBeVisible()
    await expect(page.getByText(`counter:${objectName}`)).toBeVisible()

    await page.getByRole('button', { name: 'unlink' }).first().click()
    await expect(page.getByText(`counter:${objectName}`)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'unlink' })).toHaveCount(0)
  } finally {
    if (objectId) await deleteNamedObject(request, objectId)
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

test('unified Policy bridge: API CRUD + enable/disable + inet isolation', async ({ request }) => {
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
