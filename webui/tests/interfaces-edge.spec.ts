import { expect, test } from '@playwright/test'
import { createInterfaceViaUi, login } from './helpers'

test('interface validation shows error for invalid name', async ({ page }) => {
  await login(page)

  await createInterfaceViaUi(page, {
    name: 'interface-name-too-long',
    ip: '10.91.1.1',
    port: 53111,
  })

  const errorBox = page.locator('div.border-destructive\\/20')
  await expect(errorBox).toBeVisible()
  await expect(errorBox).toContainText(/15 characters or fewer|unsupported characters|Invalid/i)
})

test('parallel create race: two unique interfaces can be created without duplicates', async ({ page }) => {
  await login(page)
  const suffix = Date.now()
  const nameA = `ra${String(suffix).slice(-6)}`
  const nameB = `rb${String(suffix).slice(-6)}`

  // Use backend directly in parallel to stress service-level race handling.
  const result = await page.evaluate(async ({ nameA, nameB, suffix }) => {
    const apiKey = JSON.parse(sessionStorage.getItem('awg_manager_auth_v1') || '{}')?.apiKey
    const mk = (name: string, ip: string, port: number) => fetch('/interfaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        wg_interface: name,
        awg_version: '2',
        port_number: port,
        wg_ip_addr: ip,
        wg_ip_cidr: 24,
        srv_ip: '132.243.237.120',
        srv_dns: '1.1.1.1',
      }),
    }).then(async (r) => ({ status: r.status, body: await r.text() }))

    const p1 = mk(nameA, `10.92.${suffix % 200}.1`, 54000 + (suffix % 500))
    const p2 = mk(nameB, `10.93.${suffix % 200}.1`, 54500 + (suffix % 500))
    return await Promise.all([p1, p2])
  }, { nameA, nameB, suffix })

  expect(result[0].status).toBe(201)
  expect(result[1].status).toBe(201)

  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.locator('tbody tr').filter({ hasText: nameA })).toHaveCount(1)
  await expect(page.locator('tbody tr').filter({ hasText: nameB })).toHaveCount(1)
})
