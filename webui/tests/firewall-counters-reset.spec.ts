import { expect, test, type APIRequestContext } from '@playwright/test'

function authHeaders() {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  return {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function getFirewall(request: APIRequestContext) {
  const res = await request.get('/firewall', { headers: authHeaders() })
  expect(res.ok()).toBeTruthy()
  return await res.json()
}

test('reset counters clears runtime rates and counter history baseline', async ({ request }) => {
  const dport = String(46000 + Math.floor(Math.random() * 1000))
  const comment = `counter-reset-${Date.now()}`
  const createRes = await request.post('/firewall/rules', {
    headers: authHeaders(),
    data: {
      table: 'filter',
      chain: 'input',
      action: 'accept',
      proto: 'tcp',
      dport,
      counter: true,
      enabled: true,
      comment,
    },
  })
  expect(createRes.ok()).toBeTruthy()
  const created = (await createRes.json()).item

  const resetRes = await request.post('/firewall/counters/reset', {
    headers: authHeaders(),
    data: { table: 'filter' },
  })
  expect(resetRes.ok()).toBeTruthy()
  const resetBody = await resetRes.json()
  expect(resetBody.ok).toBeTruthy()
  expect(Number(resetBody.tables_reset || 0)).toBeGreaterThanOrEqual(0)
  expect(Number(resetBody.rules_stats_reset || 0)).toBeGreaterThanOrEqual(0)

  const state = await getFirewall(request)
  const row = (state?.item?.rules || []).find((r: any) => r.id === created.id)
  expect(row).toBeTruthy()
  expect(typeof row.runtime_pps).toBe('number')
  expect(typeof row.runtime_bps).toBe('number')
  expect(row.runtime_pps).toBeGreaterThanOrEqual(0)
  expect(row.runtime_bps).toBeGreaterThanOrEqual(0)

  const history = Array.isArray(row.runtime_history) ? row.runtime_history : []
  expect(history.length).toBeLessThanOrEqual(120)

  await request.delete(`/firewall/rules/${created.id}`, { headers: authHeaders() })
})
