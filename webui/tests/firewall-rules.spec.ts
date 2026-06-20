import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function upsertSet(request: APIRequestContext, kind: 'addr' | 'port', body: Record<string, unknown>) {
  const res = await request.post(`/firewall/sets/${kind}`, {
    headers: authHeaders(),
    data: body,
  })
  if (!res.ok()) throw new Error(`set create failed ${res.status()}: ${await res.text()}`)
  return (await res.json()).item
}

async function upsertMap(request: APIRequestContext, kind: 'map' | 'vmap', body: Record<string, unknown>) {
  const res = await request.post(`/firewall/maps/${kind}`, {
    headers: authHeaders(),
    data: body,
  })
  if (!res.ok()) throw new Error(`map create failed ${res.status()}: ${await res.text()}`)
  return (await res.json()).item
}

async function deleteSet(request: APIRequestContext, kind: 'addr' | 'port', id: string) {
  await request.delete(`/firewall/sets/${kind}/${id}`, { headers: authHeaders() })
}

async function deleteMap(request: APIRequestContext, kind: 'map' | 'vmap', id: string) {
  await request.delete(`/firewall/maps/${kind}/${id}`, { headers: authHeaders() })
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

async function deleteObject(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/objects/${id}`, { headers: authHeaders() })
}

async function createObject(request: APIRequestContext, payload: Record<string, unknown>) {
  const res = await request.post('/firewall/objects', {
    headers: authHeaders(),
    data: payload,
  })
  if (!res.ok()) throw new Error(`object create failed ${res.status()}: ${await res.text()}`)
  return (await res.json()).item
}

async function createRule(request: APIRequestContext, payload: Record<string, unknown>) {
  const res = await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: payload,
  })
  if (!res.ok()) throw new Error(`rule create failed ${res.status()}: ${await res.text()}`)
  return (await res.json()).item
}

async function listObjects(request: APIRequestContext, family: string, table: string) {
  const res = await request.get(`/firewall/objects?family=${family}&table=${table}`, { headers: authHeaders() })
  if (!res.ok()) throw new Error(`objects list failed ${res.status()}: ${await res.text()}`)
  return (await res.json()).item
}

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function clickToolbarButton(page: Page, name: 'Add' | 'Del' | 'Disable' | 'Enable') {
  const button = page.getByRole('button', { name }).first()
  await expect(button).toBeVisible()
  await button.click({ force: true, timeout: 30_000 })
}

test('firewall smoke: rules basic flow', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  // filter rule
  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
  await page.getByText('192.168.1.0/24 or @trusted_hosts').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('192.168.1.0/24 or @trusted_hosts').fill('10.66.1.0/24')
  await page.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('22, 80,443 or @admin_ports').fill('443')
  await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(ruleModal).toBeHidden()
  const ruleRow = page.locator('tbody tr').filter({ hasText: '10.66.1.0/24' }).first()
  await expect(ruleRow).toBeVisible()
  await ruleRow.click()
  await clickToolbarButton(page, 'Disable')
  await clickToolbarButton(page, 'Enable')

})

test('firewall add rule: source and destination port hints create working tcp rule', async ({ page, request }) => {
  const comment = `ui-port-fields-${Date.now()}`
  let ruleId = ''

  try {
    await login(page)
    await openFirewall(page)

    await clickToolbarButton(page, 'Add')
    const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(ruleModal.getByText('Add Firewall Rule')).toBeVisible()

    await ruleModal.getByPlaceholder('Rule comment (optional)').fill(comment)

    await ruleModal.getByText('1024-65535 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
    await ruleModal.getByPlaceholder('1024-65535 or @admin_ports').fill('1024-65535')

    await ruleModal.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
    await ruleModal.getByPlaceholder('22, 80,443 or @admin_ports').fill('22,80,443')

    await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(ruleModal).toBeHidden({ timeout: 30_000 })

    const rules = await request.get('/firewall', { headers: authHeaders() })
    expect(rules.ok()).toBeTruthy()
    const state = await rules.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === comment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.proto).toBe('tcp')
    expect(createdRule.sport).toBe('1024:65535')
    expect(createdRule.dport).toBe('22,80,443')
    ruleId = String(createdRule.id)

    await expect(page.locator('tbody tr').filter({ hasText: comment }).first()).toBeVisible()
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
  }
})

test('firewall add rule: input and output interface fields create forward rule', async ({ page, request }) => {
  const comment = `ui-iface-fields-${Date.now()}`
  let ruleId = ''

  try {
    await login(page)
    await openFirewall(page)

    await clickToolbarButton(page, 'Add')
    const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(ruleModal.getByText('Add Firewall Rule')).toBeVisible()

    await ruleModal.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('forward')
    await ruleModal.getByPlaceholder('Rule comment (optional)').fill(comment)

    await ruleModal.getByText('eth0 / lo / @lan_ifaces').locator('..').getByRole('button', { name: '+' }).click()
    await ruleModal.getByPlaceholder('eth0 / lo / @lan_ifaces').fill('lo')

    await ruleModal.getByText('eth0 / awg1 / @wan_ifaces').locator('..').getByRole('button', { name: '+' }).click()
    await ruleModal.getByPlaceholder('eth0 / awg1 / @wan_ifaces').fill('eth0')

    await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(ruleModal).toBeHidden({ timeout: 30_000 })

    const rules = await request.get('/firewall', { headers: authHeaders() })
    expect(rules.ok()).toBeTruthy()
    const state = await rules.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === comment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.chain).toBe('forward')
    expect(createdRule.in_interface).toBe('lo')
    expect(createdRule.out_interface).toBe('eth0')
    ruleId = String(createdRule.id)

    await expect(page.locator('tbody tr').filter({ hasText: comment }).first()).toBeVisible()
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
  }
})

test('firewall add rule: connection state checkboxes create established related rule', async ({ page, request }) => {
  const comment = `ui-ct-state-${Date.now()}`
  let ruleId = ''

  try {
    await login(page)
    await openFirewall(page)

    await clickToolbarButton(page, 'Add')
    const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(ruleModal.getByText('Add Firewall Rule')).toBeVisible()

    await ruleModal.getByPlaceholder('Rule comment (optional)').fill(comment)

    await ruleModal.getByText('established,related / new / invalid').locator('..').getByRole('button', { name: '+' }).click()
    await ruleModal.locator('label', { hasText: 'established' }).locator('input').check()
    await ruleModal.locator('label', { hasText: 'related' }).locator('input').check()

    await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(ruleModal).toBeHidden({ timeout: 30_000 })

    const rules = await request.get('/firewall', { headers: authHeaders() })
    expect(rules.ok()).toBeTruthy()
    const state = await rules.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === comment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.ct_state).toBe('established,related')
    ruleId = String(createdRule.id)

    await expect(page.locator('tbody tr').filter({ hasText: comment }).first()).toBeVisible()
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
  }
})

test('firewall add rule: connection and packet mark match fields create rule', async ({ page, request }) => {
  const comment = `ui-mark-match-${Date.now()}`
  let ruleId = ''

  try {
    await login(page)
    await openFirewall(page)

    await clickToolbarButton(page, 'Add')
    const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(ruleModal.getByText('Add Firewall Rule')).toBeVisible()

    await ruleModal.getByPlaceholder('Rule comment (optional)').fill(comment)

    const ctMarkLine = ruleModal.locator('div.space-y-1\\.5', { hasText: 'Connection mark' }).first()
    await ctMarkLine.getByRole('button', { name: '+' }).click()
    await ctMarkLine.getByPlaceholder('0x1 / 10').fill('0x20')

    const pktMarkLine = ruleModal.locator('div.space-y-1\\.5', { hasText: 'Packet mark' }).first()
    await pktMarkLine.getByRole('button', { name: '+' }).click()
    await pktMarkLine.getByPlaceholder('0x1 / 10').fill('0x10')

    await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(ruleModal).toBeHidden({ timeout: 30_000 })

    const rules = await request.get('/firewall', { headers: authHeaders() })
    expect(rules.ok()).toBeTruthy()
    const state = await rules.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === comment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.ct_mark_match).toBe('0x20')
    expect(createdRule.mark_match).toBe('0x10')
    ruleId = String(createdRule.id)

    await expect(page.locator('tbody tr').filter({ hasText: comment }).first()).toBeVisible()
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
  }
})

test('firewall policy toolbar does not show built-in table scope hint', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  await expect(page.getByText('Built-in filter/nat/raw/mangle stay inet-scoped')).toHaveCount(0)
  const tableSelector = page.getByRole('combobox').filter({ hasText: 'System table only' }).first()
  const box = await tableSelector.boundingBox()
  expect(box?.width).toBeGreaterThan(180)
  expect(box?.width).toBeLessThan(280)
})

test('firewall policy nat: action choices follow selected nat chain', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  await page.getByRole('tab', { name: 'nat' }).click()
  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  await page.getByRole('tab', { name: 'Action' }).click()

  const actionSelect = page.locator("label:has-text('Action')").locator('..').locator('select')
  await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Base match' }).click()
  await page.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('postrouting')
  await page.getByRole('tab', { name: 'Action' }).click()
  await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Base match' }).click()
  await page.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('output')
  await page.getByRole('tab', { name: 'Action' }).click()
  await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(1)
  await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Base match' }).click()
  await page.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('input')
  await page.getByRole('tab', { name: 'Action' }).click()
  await expect(actionSelect.locator('option[value="dnat"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="redirect"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="snat"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="masquerade"]')).toHaveCount(0)
  await expect(actionSelect.locator('option[value="reject"]')).toHaveCount(1)
  await expect(page.getByText('NAT actions are shown only when the selected family/table/chain supports NAT.')).toBeVisible()
})

test('firewall policy nat: action tab explains which chains expose nat actions', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  await page.getByRole('tab', { name: 'nat' }).click()
  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  await page.getByRole('tab', { name: 'Action' }).click()

  await expect(page.getByText('prerouting/output use dnat or redirect')).toBeVisible()

  await page.getByRole('tab', { name: 'Base match' }).click()
  await page.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('postrouting')
  await page.getByRole('tab', { name: 'Action' }).click()

  await expect(page.getByText('postrouting uses snat or masquerade')).toBeVisible()
})

test('firewall policy nat: table shows nat action instead of internal accept verdict', async ({ page, request }) => {
  const comment = `ui-nat-masq-${Date.now()}`
  const created = await createRule(request, {
    table: 'nat',
    chain: 'postrouting',
    action: 'accept',
    proto: null,
    src: '10.66.1.0/24',
    nat_type: 'masquerade',
    comment,
    enabled: true,
  })
  const id = created.id as string

  try {
    await login(page)
    await openFirewall(page)
    await page.getByRole('tab', { name: 'nat' }).click()

    const ruleRow = page.locator('tbody tr').filter({ hasText: comment }).first()
    await expect(ruleRow).toBeVisible()
    await expect(ruleRow).toContainText('masquerade')
  } finally {
    await deleteRule(request, id)
  }
})

test('firewall objects: named counter can be created for inet filter and selected in rule stats', async ({ page, request }) => {
  const counterName = `cnt_https_${Date.now()}`
  const ruleComment = `ui-counter-rule-${Date.now()}`
  let objectId = ''
  let ruleId = ''

  try {
    await login(page)
    await openFirewall(page)
    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator("label:has-text('Object table')").locator('..').locator('select').selectOption('inet:filter')
    await expect(page.getByText('Objects are scoped to the selected nftables table.')).toBeVisible()

    await page.getByRole('button', { name: 'Add object' }).click()
    const objectModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(objectModal.getByText('Add Firewall Object')).toBeVisible()
    await objectModal.locator("label:has-text('Kind')").locator('..').locator('select').selectOption('counter')
    await objectModal.getByPlaceholder('object_name').fill(counterName)
    await objectModal.getByRole('button', { name: 'Add' }).click()
    await expect(objectModal).toBeHidden({ timeout: 30_000 })
    await expect(page.locator('tbody tr').filter({ hasText: counterName }).first()).toBeVisible()

    const objectsAfterCreate = await listObjects(request, 'inet', 'filter')
    const createdObject = (objectsAfterCreate.items || []).find((item: any) => item.name === counterName)
    expect(createdObject).toBeTruthy()
    objectId = String(createdObject.id)

    await page.getByRole('tab', { name: 'policy' }).click()
    await page.getByRole('tab', { name: 'filter' }).click()
    await clickToolbarButton(page, 'Add')
    const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(ruleModal.getByText('Add Firewall Rule')).toBeVisible()
    await ruleModal.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
    await ruleModal.getByPlaceholder('22, 80,443 or @admin_ports').fill('443')
    await ruleModal.getByPlaceholder('Rule comment (optional)').fill(ruleComment)
    await ruleModal.getByRole('tab', { name: 'Statistics' }).click()
    await ruleModal.locator("label:has-text('counter object')").locator('..').locator('select').selectOption(counterName)
    await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(ruleModal).toBeHidden({ timeout: 30_000 })

    const rules = await request.get('/firewall', { headers: authHeaders() })
    expect(rules.ok()).toBeTruthy()
    const state = await rules.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === ruleComment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.counter_name).toBe(counterName)
    ruleId = String(createdRule.id)

    await page.locator('tbody tr').filter({ hasText: ruleComment }).first().click()
    await page.getByRole('button', { name: 'Reset counters' }).click()
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
    if (objectId) await deleteObject(request, objectId)
  }
})

test('firewall walkthrough K: named limit and quota objects can be bound to a filter rule', async ({ page, request }) => {
  const suffix = Date.now()
  const limitName = `lim_walk_${suffix}`
  const quotaName = `quo_walk_${suffix}`
  const ruleComment = `walkthrough-k-objects-${suffix}`
  let limitId = ''
  let quotaId = ''
  let ruleId = ''

  try {
    await login(page)
    await openFirewall(page)
    await page.getByRole('tab', { name: 'objects' }).click()
    await page.locator("label:has-text('Object table')").locator('..').locator('select').selectOption('inet:filter')
    await expect(page.getByText('Objects are scoped to the selected nftables table.')).toBeVisible()

    await page.getByRole('button', { name: 'Add object' }).click()
    let objectModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(objectModal.getByText('Add Firewall Object')).toBeVisible()
    await objectModal.locator("label:has-text('Kind')").locator('..').locator('select').selectOption('limit')
    await objectModal.getByPlaceholder('object_name').fill(limitName)
    await objectModal.getByPlaceholder('10/second or 1024 bytes/second').fill('10/second')
    await objectModal.getByRole('button', { name: 'Add' }).click()
    await expect(objectModal).toBeHidden({ timeout: 30_000 })
    await expect(page.locator('tbody tr').filter({ hasText: limitName }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Add object' }).click()
    objectModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(objectModal.getByText('Add Firewall Object')).toBeVisible()
    await objectModal.locator("label:has-text('Kind')").locator('..').locator('select').selectOption('quota')
    await objectModal.getByPlaceholder('object_name').fill(quotaName)
    await objectModal.getByPlaceholder('20 mbytes').fill('100 mbytes')
    await objectModal.getByRole('button', { name: 'Add' }).click()
    await expect(objectModal).toBeHidden({ timeout: 30_000 })
    await expect(page.locator('tbody tr').filter({ hasText: quotaName }).first()).toBeVisible()

    const objectsAfterCreate = await listObjects(request, 'inet', 'filter')
    const createdLimit = (objectsAfterCreate.items || []).find((item: any) => item.name === limitName && item.kind === 'limit')
    const createdQuota = (objectsAfterCreate.items || []).find((item: any) => item.name === quotaName && item.kind === 'quota')
    expect(createdLimit).toBeTruthy()
    expect(createdQuota).toBeTruthy()
    limitId = String(createdLimit.id)
    quotaId = String(createdQuota.id)

    await page.getByRole('tab', { name: 'policy' }).click()
    await page.getByRole('tab', { name: 'filter' }).click()
    await clickToolbarButton(page, 'Add')
    const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(ruleModal.getByText('Add Firewall Rule')).toBeVisible()
    await ruleModal.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
    await ruleModal.getByPlaceholder('22, 80,443 or @admin_ports').fill('45564')
    await ruleModal.getByPlaceholder('Rule comment (optional)').fill(ruleComment)
    await ruleModal.getByRole('tab', { name: 'Action' }).click()

    const limitLine = ruleModal.locator('div.space-y-1\\.5', { hasText: 'limit object' }).first()
    await expect(limitLine.getByRole('button', { name: '+' })).toBeEnabled()
    await limitLine.getByRole('button', { name: '+' }).click()
    await limitLine.locator('select').selectOption(limitName)

    const quotaLine = ruleModal.locator('div.space-y-1\\.5', { hasText: 'quota object' }).first()
    await expect(quotaLine.getByRole('button', { name: '+' })).toBeEnabled()
    await quotaLine.getByRole('button', { name: '+' }).click()
    await quotaLine.locator('select').selectOption(quotaName)

    await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(ruleModal).toBeHidden({ timeout: 30_000 })

    const rules = await request.get('/firewall', { headers: authHeaders() })
    expect(rules.ok()).toBeTruthy()
    const state = await rules.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === ruleComment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.limit_name).toBe(limitName)
    expect(createdRule.quota_name).toBe(quotaName)
    ruleId = String(createdRule.id)
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
    if (limitId) await deleteObject(request, limitId)
    if (quotaId) await deleteObject(request, quotaId)
  }
})

test('firewall walkthrough L: ct helper timeout and expectation objects can be bound to a filter rule', async ({ page, request }) => {
  test.setTimeout(180_000)
  const suffix = Date.now()
  const helperName = `hlp_walk_${suffix}`
  const timeoutName = `tmo_walk_${suffix}`
  const expectationName = `exp_walk_${suffix}`
  const ruleComment = `walkthrough-l-ct-${suffix}`
  let helperId = ''
  let timeoutId = ''
  let expectationId = ''
  let ruleId = ''

  try {
    const helper = await createObject(request, {
      family: 'inet',
      table: 'filter',
      kind: 'ct_helper',
      name: helperName,
      enabled: true,
      helper_type: 'ftp',
      l4proto: 'tcp',
      l3proto: 'ip',
    })
    helperId = String(helper.id)
    const timeout = await createObject(request, {
      family: 'inet',
      table: 'filter',
      kind: 'ct_timeout',
      name: timeoutName,
      enabled: true,
      l4proto: 'tcp',
      l3proto: 'ip',
      timeout_policy: 'established:120, close:20',
    })
    timeoutId = String(timeout.id)
    const expectation = await createObject(request, {
      family: 'inet',
      table: 'filter',
      kind: 'ct_expectation',
      name: expectationName,
      enabled: true,
      l4proto: 'tcp',
      l3proto: 'ip',
      dport: '21',
      timeout: '2m',
      size: '8',
    })
    expectationId = String(expectation.id)

    await login(page)
    await openFirewall(page)
    await page.getByRole('tab', { name: 'filter' }).click()
    await clickToolbarButton(page, 'Add')
    const ruleModal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(ruleModal.getByText('Add Firewall Rule')).toBeVisible()
    await ruleModal.getByPlaceholder('any').fill('tcp')
    await ruleModal.getByPlaceholder('Rule comment (optional)').fill(ruleComment)
    await ruleModal.getByRole('tab', { name: 'Action' }).click()

    const helperLine = ruleModal.locator('div.space-y-1\\.5', { hasText: 'ct helper object' }).first()
    await expect(helperLine.getByRole('button', { name: '+' })).toBeEnabled()
    await helperLine.getByRole('button', { name: '+' }).click()
    await helperLine.locator('select').selectOption(helperName)

    const timeoutLine = ruleModal.locator('div.space-y-1\\.5', { hasText: 'ct timeout object' }).first()
    await expect(timeoutLine.getByRole('button', { name: '+' })).toBeEnabled()
    await timeoutLine.getByRole('button', { name: '+' }).click()
    await timeoutLine.locator('select').selectOption(timeoutName)

    const expectationLine = ruleModal.locator('div.space-y-1\\.5', { hasText: 'ct expectation object' }).first()
    await expect(expectationLine.getByRole('button', { name: '+' })).toBeEnabled()
    await expectationLine.getByRole('button', { name: '+' }).click()
    await expectationLine.locator('select').selectOption(expectationName)

    await ruleModal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(ruleModal).toBeHidden({ timeout: 30_000 })

    const rules = await request.get('/firewall', { headers: authHeaders() })
    expect(rules.ok()).toBeTruthy()
    const state = await rules.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === ruleComment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.ct_helper_set).toBe(helperName)
    expect(createdRule.ct_timeout_set).toBe(timeoutName)
    expect(createdRule.ct_expectation_set).toBe(expectationName)
    ruleId = String(createdRule.id)
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
    if (helperId) await deleteObject(request, helperId)
    if (timeoutId) await deleteObject(request, timeoutId)
    if (expectationId) await deleteObject(request, expectationId)
  }
})

test('firewall policy raw/mangle: context-specific controls are gated', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  await page.getByRole('tab', { name: 'raw' }).click()
  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  await page.getByRole('tab', { name: 'Advanced match' }).click()
  await page.getByRole('button', { name: /Raw expression & debug/ }).click()
  await expect(page.getByText('meta length > 80 / ip protocol tcp')).toBeVisible()
  await expect(page.getByText('nftrace', { exact: true })).toBeVisible()
  await expect(page.getByText('notrack (advanced mode)', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Action' }).click()
  await expect(page.getByText('meta mark set')).toHaveCount(0)
  await expect(page.getByText('NAT actions are shown only when the selected family/table/chain supports NAT.')).toBeVisible()
  await expect(page.getByText('ct mark set')).toHaveCount(0)
  await page.locator('div.fixed.inset-0.z-40').last().getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('tab', { name: 'mangle' }).click()
  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  await page.getByRole('tab', { name: 'Action' }).click()
  await expect(page.getByText('meta mark set')).toBeVisible()
  await expect(page.getByText('ct mark set')).toBeVisible()
  await page.getByRole('tab', { name: 'Advanced match' }).click()
  await page.getByRole('button', { name: /Raw expression & debug/ }).click()
  await expect(page.getByText('available in raw table only')).toBeVisible()
  await expect(page.getByText('nftrace (raw table only)', { exact: true })).toBeVisible()
  await expect(page.getByText('notrack (raw table only)', { exact: true })).toBeVisible()
})

test('firewall walkthrough I: raw notrack and nftrace can be saved from UI', async ({ page, request }) => {
  const comment = `walkthrough-i-raw-${Date.now()}`
  let ruleId = ''

  await login(page)
  await openFirewall(page)

  try {
    await clickToolbarButton(page, 'Add')
    let modal = page.locator('div.fixed.inset-0.z-40').last()
    await modal.getByRole('tab', { name: 'Advanced match' }).click()
    await modal.getByRole('button', { name: /Raw expression & debug/ }).click()
    await expect(modal.getByText('nftrace (raw table only)', { exact: true })).toBeVisible()
    await expect(modal.getByText('notrack (raw table only)', { exact: true })).toBeVisible()
    await modal.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('tab', { name: 'raw' }).click()
    await clickToolbarButton(page, 'Add')
    modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

    await modal.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
    await modal.getByPlaceholder('22, 80,443 or @admin_ports').fill('45562')
    await modal.getByPlaceholder('Rule comment (optional)').fill(comment)
    await modal.getByRole('tab', { name: 'Advanced match' }).click()
    await modal.getByRole('button', { name: /Raw expression & debug/ }).click()
    await modal.getByLabel('nftrace').check()
    await modal.getByLabel('notrack (advanced mode)').check()
    await modal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(modal).toBeHidden({ timeout: 30_000 })

    const stateRes = await request.get('/firewall', { headers: authHeaders() })
    expect(stateRes.ok()).toBeTruthy()
    const state = await stateRes.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === comment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.table).toBe('raw')
    expect(createdRule.notrack).toBeTruthy()
    expect(createdRule.nftrace).toBeTruthy()
    ruleId = String(createdRule.id)
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
  }
})

test('firewall walkthrough J: mangle mark and ct mark can be saved from UI', async ({ page, request }) => {
  const comment = `walkthrough-j-mangle-${Date.now()}`
  let ruleId = ''

  await login(page)
  await openFirewall(page)

  try {
    await page.getByRole('tab', { name: 'mangle' }).click()
    await clickToolbarButton(page, 'Add')
    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Add Firewall Rule')).toBeVisible()

    await modal.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('forward')
    await modal.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
    await modal.getByPlaceholder('22, 80,443 or @admin_ports').fill('45563')
    await modal.getByPlaceholder('Rule comment (optional)').fill(comment)
    await modal.getByRole('tab', { name: 'Action' }).click()

    const markLine = modal.locator('div.space-y-1\\.5', { hasText: 'meta mark set' }).first()
    await markLine.getByRole('button', { name: '+' }).click()
    await markLine.getByPlaceholder('0x1 or 10').fill('0x10')

    const ctMarkLine = modal.locator('div.space-y-1\\.5', { hasText: 'ct mark set' }).first()
    await ctMarkLine.getByRole('button', { name: '+' }).click()
    await ctMarkLine.getByPlaceholder('0x1 or 10').fill('0x20')

    await modal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(modal).toBeHidden({ timeout: 30_000 })

    const stateRes = await request.get('/firewall', { headers: authHeaders() })
    expect(stateRes.ok()).toBeTruthy()
    const state = await stateRes.json()
    const createdRule = (state.item?.rules || []).find((rule: any) => rule.comment === comment)
    expect(createdRule).toBeTruthy()
    expect(createdRule.table).toBe('mangle')
    expect(createdRule.chain).toBe('forward')
    expect(createdRule.mark_set).toBe('0x10')
    expect(createdRule.ct_mark_set).toBe('0x20')
    ruleId = String(createdRule.id)
  } finally {
    if (ruleId) await deleteRule(request, ruleId)
  }
})

test('firewall policy base fields follow selected hook direction', async ({ page }) => {
  await login(page)
  await openFirewall(page)

  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  let modal = page.locator('div.fixed.inset-0.z-40').last()

  await expect(modal.getByText('Input interface')).toBeVisible()
  await expect(modal.getByText('Output interface')).toHaveCount(0)
  await expect(modal.getByText('Connection state')).toBeVisible()

  await modal.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('output')
  await expect(modal.getByText('Input interface')).toHaveCount(0)
  await expect(modal.getByText('Output interface')).toBeVisible()
  await expect(modal.getByText('Connection state')).toBeVisible()
  await modal.getByRole('button', { name: 'Cancel' }).click({ force: true })
  await expect(modal).toBeHidden()

  await page.getByRole('tab', { name: 'nat' }).click()
  await clickToolbarButton(page, 'Add')
  await expect(page.getByText('Add Firewall Rule')).toBeVisible()
  modal = page.locator('div.fixed.inset-0.z-40').last()

  await expect(modal.getByText('Input interface')).toBeVisible()
  await expect(modal.getByText('Output interface')).toHaveCount(0)
  await expect(modal.getByText('Connection state')).toHaveCount(0)

  await modal.locator("label:has-text('Chain')").locator('..').locator('select').selectOption('postrouting')
  await expect(modal.getByText('Input interface')).toHaveCount(0)
  await expect(modal.getByText('Output interface')).toBeVisible()
  await expect(modal.getByText('Connection state')).toHaveCount(0)
})

test('firewall policy dynamic set statement controls save inet addr set rule', async ({ page, request }) => {
  const setName = `dyn_addr_${Date.now()}`
  const createdSet = await upsertSet(request, 'addr', {
    name: setName,
    elements: [],
    timeout: '1h',
    dynamic: true,
    size: 65536,
    gc_interval: '30s',
  })
  let createdRuleId: string | null = null

  try {
    await login(page)
    await openFirewall(page)

    await clickToolbarButton(page, 'Add')
    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Add Firewall Rule')).toBeVisible()
    await modal.getByRole('tab', { name: 'Action' }).click()

    await expect(modal.getByText('Dynamic set update')).toBeVisible()
    await modal.getByRole('button', { name: 'Enable dynamic set update' }).click()
    await modal.locator("label:has-text('target set')").locator('..').locator('select').selectOption(setName)
    await modal.locator("label:has-text('set op')").locator('..').locator('select').selectOption('add')
    await modal.locator("label:has-text('set expression')").locator('..').locator('select').selectOption('ip saddr')
    await modal.getByPlaceholder('10s').fill('10s')

    await modal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(modal).toBeHidden()

    const rulesRes = await request.get('/firewall/rules?family=inet&table=filter', { headers: authHeaders() })
    expect(rulesRes.ok()).toBeTruthy()
    const rulesPayload = await rulesRes.json()
    const createdRule = (rulesPayload.items || []).find((row: any) => row.set_stmt_name === setName)
    expect(createdRule).toBeTruthy()
    createdRuleId = createdRule.id
    expect(createdRule.set_stmt_op).toBe('add')
    expect(createdRule.set_stmt_expr).toBe('ip saddr')
    expect(createdRule.set_stmt_timeout).toBe('10s')
    expect(createdRule.set_stmt_comment).toBeFalsy()
  } finally {
    if (createdRuleId) await deleteRule(request, createdRuleId)
    await deleteSet(request, 'addr', createdSet.id)
  }
})

test('firewall policy verdict map controls save inet l4proto vmap rule', async ({ page, request }) => {
  const vmapName = `proto_vmap_${Date.now()}`
  const createdMap = await upsertMap(request, 'vmap', {
    name: vmapName,
    entries: ['tcp:accept', 'udp:drop', 'icmp:return'],
  })
  let createdRuleId: string | null = null

  try {
    await login(page)
    await openFirewall(page)

    await clickToolbarButton(page, 'Add')
    const modal = page.locator('div.fixed.inset-0.z-40').last()
    await expect(modal.getByText('Add Firewall Rule')).toBeVisible()
    await modal.getByRole('tab', { name: 'Action' }).click()

    await expect(modal.getByText('Verdict map')).toBeVisible()
    await modal.getByRole('button', { name: 'Enable verdict map' }).click()
    await modal.locator("label:has-text('target vmap')").locator('..').locator('select').selectOption(vmapName)
    await modal.locator("label:has-text('vmap expression')").locator('..').locator('select').selectOption('meta l4proto')

    await modal.getByRole('button', { name: 'Add' }).click({ force: true })
    await expect(modal).toBeHidden()

    const rulesRes = await request.get('/firewall/rules?family=inet&table=filter', { headers: authHeaders() })
    expect(rulesRes.ok()).toBeTruthy()
    const rulesPayload = await rulesRes.json()
    const createdRule = (rulesPayload.items || []).find((row: any) => row.vmap_stmt_name === vmapName)
    expect(createdRule).toBeTruthy()
    createdRuleId = createdRule.id
    expect(createdRule.action).toBeFalsy()
    expect(createdRule.vmap_stmt_expr).toBe('meta l4proto')
    expect(createdRule.vmap_stmt_name).toBe(vmapName)
  } finally {
    if (createdRuleId) await deleteRule(request, createdRuleId)
    await deleteMap(request, 'vmap', createdMap.id)
  }
})
