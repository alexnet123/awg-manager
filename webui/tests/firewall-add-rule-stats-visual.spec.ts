import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers'

async function openFirewall(page: Page) {
  await page.getByRole('button', { name: 'Firewall' }).click()
  await expect(page.getByRole('heading', { name: 'Firewall' })).toBeVisible()
}

test('statistics tab shows chart and series toggle works', async ({ page, request }) => {
  const apiKey = process.env.PLAYWRIGHT_API_KEY || ''
  const authHeaders = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
  const cleanupByComment = async (apiRequest: APIRequestContext, comment: string) => {
    const stateRes = await apiRequest.get('/firewall', { headers: authHeaders })
    if (!stateRes.ok()) return
    const payload = await stateRes.json()
    const rules = payload?.item?.rules || []
    for (const row of rules) {
      if ((row?.comment || '') === comment) {
        await apiRequest.delete(`/firewall/rules/${row.id}`, { headers: authHeaders })
      }
    }
  }

  await login(page)
  await openFirewall(page)

  await page.getByRole('button', { name: 'Add' }).first().click({ force: true })
  const addModal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(addModal.getByText('Add Firewall Rule')).toBeVisible()

  const comment = `stats-visual-${Date.now()}`
  const dport = String(45000 + Math.floor(Math.random() * 1000))
  await page.getByText('22,80,443 or @admin_ports').locator('..').getByRole('button', { name: '+' }).click()
  await page.getByPlaceholder('22, 80,443 or @admin_ports').fill(dport)
  if (await page.getByPlaceholder('Allow office VPN users').count()) {
    await page.getByPlaceholder('Allow office VPN users').fill(comment)
  }
  await page.getByRole('tab', { name: 'Statistics' }).click()
  await page.getByLabel('Enable nft `counter` for this rule').check()
  await addModal.getByRole('button', { name: 'Add' }).click({ force: true })
  await expect(addModal).toBeHidden()

  const row = page.locator('tbody tr').filter({ hasText: dport }).first()
  await expect(row).toBeVisible()
  await row.dblclick()

  const editModal = page.locator('div.fixed.inset-0.z-40').last()
  await expect(editModal.getByText('Edit Firewall Rule')).toBeVisible()
  await editModal.getByRole('tab', { name: 'Statistics' }).click()

  await expect(editModal.getByText('Current rule traffic')).toBeVisible()
  await expect(editModal.locator('svg.recharts-surface')).toBeVisible()

  const bytesBtn = editModal.getByRole('button', { name: 'Bytes/sec' })
  await bytesBtn.click()
  await expect(editModal.locator('path[stroke=\"#60a5fa\"]')).toHaveCount(1)

  const packetsBtn = editModal.getByRole('button', { name: 'Packets/sec' })
  await packetsBtn.click()
  await expect(editModal.locator('path[stroke=\"#2563eb\"]')).toHaveCount(1)

  const counterCb = editModal.getByLabel('Enable nft `counter` for this rule')
  await counterCb.uncheck()
  await expect(editModal.getByText('Counter disabled: enable `nft counter` to collect live chart data.')).toBeVisible()
  await counterCb.check()
  await expect(editModal.getByText('Counter disabled: enable `nft counter` to collect live chart data.')).toBeHidden()

  await editModal.getByRole('button', { name: 'Save' }).click({ force: true })
  await expect(editModal).toBeHidden()

  await cleanupByComment(request, comment)
})
