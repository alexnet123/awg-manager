import { expect, type Page } from '@playwright/test'

export async function login(page: Page) {
  const apiKey = process.env.PLAYWRIGHT_API_KEY
  if (!apiKey) {
    throw new Error('PLAYWRIGHT_API_KEY is required for e2e tests')
  }

  await page.goto('/')
  await expect(page.getByText('Sign in')).toBeVisible()
  await page.locator('input[type="password"]').first().fill(apiKey)
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByRole('heading', { name: 'Interfaces' })).toBeVisible()
}

export async function createInterfaceViaUi(page: Page, opts: {
  name: string
  ip: string
  port?: number
  cidr?: number
  serverIp?: string
  dns?: string
}) {
  await page.getByPlaceholder('awg0').fill(opts.name)
  if (opts.port) {
    await page.locator('input[type="number"]').first().fill(String(opts.port))
  }
  await page.getByPlaceholder('10.8.0.1').fill(opts.ip)
  if (opts.cidr) {
    await page.locator('input[type="number"]').nth(1).fill(String(opts.cidr))
  }
  await page.getByPlaceholder('203.0.113.10').fill(opts.serverIp ?? '132.243.237.120')
  await page.getByPlaceholder('1.1.1.1').fill(opts.dns ?? '1.1.1.1')
  await page.getByRole('button', { name: 'Create' }).click()
}
