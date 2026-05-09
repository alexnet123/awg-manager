import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.describe('api key rotation flow', () => {
  test.skip(!process.env.PW_ENABLE_ROTATE_TEST, 'Set PW_ENABLE_ROTATE_TEST=1 to run destructive key-rotation test')

  test('old key stops working, new key works, logout/login cycle', async ({ page }) => {
    const oldKey = process.env.PLAYWRIGHT_API_KEY || ''
    await login(page)

    page.once('dialog', (dialog) => {
      // confirm rotation
      if (dialog.type() === 'confirm') dialog.accept()
    })

    let rotatedMessage = ''
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'alert') {
        rotatedMessage = dialog.message()
        await dialog.accept()
      }
    })

    await page.getByRole('button', { name: 'Rotate API key' }).click()
    await expect(page.getByText('Sign in')).toBeVisible()

    const match = rotatedMessage.match(/[a-f0-9]{64}/)
    expect(match).toBeTruthy()
    const newKey = match![0]
    expect(newKey).not.toBe(oldKey)

    // old key should fail
    await page.locator('input[type="password"]').first().fill(oldKey)
    await page.getByRole('button', { name: 'Enter' }).click()
    await expect(page.locator('div.border-destructive\\/20')).toContainText(/invalid api key/i)

    // new key should pass
    await page.locator('input[type="password"]').first().fill(newKey)
    await page.getByRole('button', { name: 'Enter' }).click()
    await expect(page.getByRole('heading', { name: 'Interfaces' })).toBeVisible()

    // logout/login with new key
    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page.getByText('Sign in')).toBeVisible()
    await page.locator('input[type="password"]').first().fill(newKey)
    await page.getByRole('button', { name: 'Enter' }).click()
    await expect(page.getByRole('heading', { name: 'Interfaces' })).toBeVisible()
  })
})
