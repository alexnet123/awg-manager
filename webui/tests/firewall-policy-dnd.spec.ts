import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers'

type FirewallRuleRow = {
  id: string
  table: string
  chain: string
  comment?: string | null
  enabled?: boolean
}

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY
  if (!apiKey) {
    throw new Error('PLAYWRIGHT_API_KEY is required for e2e tests')
  }
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function createRule(
  request: APIRequestContext,
  payload: Record<string, unknown>
): Promise<FirewallRuleRow> {
  const res = await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: payload,
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json() as { item: FirewallRuleRow }
  return body.item
}

async function deleteRule(request: APIRequestContext, id: string) {
  await request.delete(`/firewall/rules/${id}`, { headers: authHeaders() })
}

async function fetchRules(request: APIRequestContext): Promise<FirewallRuleRow[]> {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  const body = await res.json() as { item: { rules: FirewallRuleRow[] } }
  return body.item.rules || []
}

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

async function ensurePolicyTab(page: Page, tabName: 'filter' | 'nat' | 'raw' | 'mangle') {
  await page.getByRole('tab', { name: 'policy' }).click()
  await page.getByRole('tab', { name: tabName }).click({ force: true })
}

async function assertRelativeOrder(
  request: APIRequestContext,
  table: string,
  firstComment: string,
  secondComment: string
) {
  const rules = await fetchRules(request)
  const tableRules = rules.filter((r) => (r.table || '').toLowerCase() === table)
  const idxFirst = tableRules.findIndex((r) => (r.comment || '') === firstComment)
  const idxSecond = tableRules.findIndex((r) => (r.comment || '') === secondComment)
  expect(idxFirst).toBeGreaterThanOrEqual(0)
  expect(idxSecond).toBeGreaterThanOrEqual(0)
  expect(idxFirst).toBeLessThan(idxSecond)
}

test('firewall policy dnd: reorder works the same in filter/nat/raw/mangle', async ({ page, request }) => {
  const tag = `pw-dnd-${Date.now()}`
  const createdIds: string[] = []

  try {
    const filterA = await createRule(request, {
      table: 'filter',
      chain: 'input',
      action: 'accept',
      proto: 'tcp',
      dport: '42021',
      comment: `${tag}-filter-a`,
      enabled: false,
    })
    const filterB = await createRule(request, {
      table: 'filter',
      chain: 'input',
      action: 'accept',
      proto: 'tcp',
      dport: '42022',
      comment: `${tag}-filter-b`,
      enabled: false,
    })
    const natA = await createRule(request, {
      table: 'nat',
      chain: 'output',
      action: 'accept',
      proto: 'tcp',
      dport: '42031',
      comment: `${tag}-nat-a`,
      enabled: false,
    })
    const natB = await createRule(request, {
      table: 'nat',
      chain: 'output',
      action: 'accept',
      proto: 'tcp',
      dport: '42032',
      comment: `${tag}-nat-b`,
      enabled: false,
    })
    const rawA = await createRule(request, {
      table: 'raw',
      chain: 'output',
      action: 'accept',
      proto: 'tcp',
      dport: '42041',
      comment: `${tag}-raw-a`,
      enabled: false,
    })
    const rawB = await createRule(request, {
      table: 'raw',
      chain: 'output',
      action: 'accept',
      proto: 'tcp',
      dport: '42042',
      comment: `${tag}-raw-b`,
      enabled: false,
    })
    const mangleA = await createRule(request, {
      table: 'mangle',
      chain: 'input',
      action: 'accept',
      proto: 'tcp',
      dport: '42051',
      comment: `${tag}-mangle-a`,
      enabled: false,
    })
    const mangleB = await createRule(request, {
      table: 'mangle',
      chain: 'input',
      action: 'accept',
      proto: 'tcp',
      dport: '42052',
      comment: `${tag}-mangle-b`,
      enabled: false,
    })
    createdIds.push(
      filterA.id, filterB.id,
      natA.id, natB.id,
      rawA.id, rawB.id,
      mangleA.id, mangleB.id
    )

    await login(page)
    await openFirewall(page)

    const checks: Array<{ table: 'filter' | 'nat' | 'raw' | 'mangle'; first: string; second: string }> = [
      { table: 'filter', first: `${tag}-filter-a`, second: `${tag}-filter-b` },
      { table: 'nat', first: `${tag}-nat-a`, second: `${tag}-nat-b` },
      { table: 'raw', first: `${tag}-raw-a`, second: `${tag}-raw-b` },
      { table: 'mangle', first: `${tag}-mangle-a`, second: `${tag}-mangle-b` },
    ]

    for (const item of checks) {
      await ensurePolicyTab(page, item.table)
      const rowA = page.locator('tbody tr').filter({ hasText: item.first }).first()
      const rowB = page.locator('tbody tr').filter({ hasText: item.second }).first()
      await expect(rowA).toBeVisible()
      await expect(rowB).toBeVisible()

      // move B above A
      await rowB.dragTo(rowA)

      await expect.poll(async () => {
        const rules = await fetchRules(request)
        const tableRules = rules.filter((r) => (r.table || '').toLowerCase() === item.table)
        const idxA = tableRules.findIndex((r) => (r.comment || '') === item.first)
        const idxB = tableRules.findIndex((r) => (r.comment || '') === item.second)
        return `${idxB}:${idxA}`
      }, { timeout: 20_000 }).not.toBe('-1:-1')

      const nowRules = await fetchRules(request)
      const tableRules = nowRules.filter((r) => (r.table || '').toLowerCase() === item.table)
      const idxA = tableRules.findIndex((r) => (r.comment || '') === item.first)
      const idxB = tableRules.findIndex((r) => (r.comment || '') === item.second)
      expect(idxB).toBeLessThan(idxA)

      // move back to stable order (A before B) for deterministic cleanup
      await rowA.dragTo(rowB)
      await expect.poll(async () => {
        const rules = await fetchRules(request)
        const t = rules.filter((r) => (r.table || '').toLowerCase() === item.table)
        const a = t.findIndex((r) => (r.comment || '') === item.first)
        const b = t.findIndex((r) => (r.comment || '') === item.second)
        return `${a}:${b}`
      }, { timeout: 20_000 }).not.toBe('-1:-1')
      await assertRelativeOrder(request, item.table, item.first, item.second)
    }
  } finally {
    for (const id of createdIds) {
      await deleteRule(request, id)
    }
  }
})

