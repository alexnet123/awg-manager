import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('login and navigate to clients', async ({ page }) => {
  await login(page)

  await page.getByRole('button', { name: 'Clients' }).click()
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()
  await expect(page.getByText('Manage peers, configs, and QR codes.')).toBeVisible()
})
