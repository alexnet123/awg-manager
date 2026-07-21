import { expect, test } from '@playwright/test'
import { login } from './helpers'

function utcDateTime(offsetMs = 0) {
  const iso = new Date(Date.now() + offsetMs).toISOString()
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 19),
  }
}

test('NTP client toggle applies only through main Apply and manual time recovers back to sync', async ({ page }) => {
  test.setTimeout(120_000)
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await login(page)
  await page.getByRole('button', { name: 'NTP' }).click()
  await expect(page.getByRole('heading', { name: 'NTP / Chrony' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeVisible()

  await page.getByLabel('Timezone value').fill('UTC')
  await page.getByLabel('Enable NTP client').check()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText('NTP configuration applied. Chrony is active.')).toBeVisible()
  await expect(page.getByText('synchronized', { exact: true })).toBeVisible({ timeout: 90_000 })

  await page.getByLabel('Enable NTP client').uncheck()
  await expect(page.getByText('pending apply', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Date', { exact: true })).toBeEnabled()
  await expect(page.getByLabel('Time', { exact: true })).toBeEnabled()

  const manual = utcDateTime(5_000)
  await page.getByLabel('Date', { exact: true }).fill(manual.date)
  await page.getByLabel('Time', { exact: true }).fill(manual.time)
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText('NTP configuration applied. Chrony is active.')).toBeVisible()
  await expect(page.getByText('disabled', { exact: true }).first()).toBeVisible()
  await expect(page.getByLabel('Enable NTP client')).not.toBeChecked()

  await page.getByLabel('Enable NTP client').check()
  await expect(page.getByText('pending apply', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByText('NTP configuration applied. Chrony is active.')).toBeVisible()
  await expect(page.getByLabel('Enable NTP client')).toBeChecked()
  await expect(page.getByText('synchronized', { exact: true })).toBeVisible({ timeout: 90_000 })

  await page.getByRole('tab', { name: 'Status' }).click()
  await page.getByRole('button', { name: 'Refresh status' }).click()
  await expect(page.getByText('Normal', { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText('current', { exact: true })).toBeVisible()
  expect(browserErrors).toEqual([])
})
