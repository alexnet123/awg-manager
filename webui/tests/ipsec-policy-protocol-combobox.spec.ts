import { expect, test } from '@playwright/test'

test('ipsec policy protocol can be typed or selected from dropdown', async ({ page }) => {
  const apiKey = process.env.PLAYWRIGHT_API_KEY
  if (!apiKey) throw new Error('PLAYWRIGHT_API_KEY is required for e2e tests')

  await page.goto('/ui/')
  await expect(page.getByText('Sign in')).toBeVisible()
  await page.locator('input[type="password"]').first().fill(apiKey)
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByRole('button', { name: 'Interfaces' })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'IPsec' }).click()
  await page.getByRole('tab', { name: 'Policies' }).click()
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  const protocol = page.getByRole('textbox', { name: 'Protocol' })
  await expect(protocol).toBeEditable()
  await expect(protocol).toHaveValue('any')

  await protocol.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'any' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Any all' })).toHaveCount(0)
  await expect(page.getByRole('option', { name: 'TCP (6)' })).toBeVisible()
  await page.getByRole('option', { name: /ICMP \(1\)/ }).click()
  await expect(protocol).toHaveValue('ICMP (1)')

  await protocol.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'TCP (6)' })).toBeVisible()

  await protocol.fill('132')
  await expect(protocol).toHaveValue('132')

  await protocol.press('ArrowDown')
  await page.getByRole('option', { name: 'TCP (6)' }).click()
  await expect(protocol).toHaveValue('TCP (6)')

  await protocol.fill('gre')
  await expect(protocol).toHaveValue('gre')

  await page.getByRole('tab', { name: 'Action' }).click()
  await page.getByRole('combobox').filter({ hasText: /^start$/ }).click()
  await expect(page.getByRole('option', { name: 'start', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'trap', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'none', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'trap|start', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByText('start = bring the CHILD_SA up immediately')).toBeVisible()
  await expect(page.getByText('trap = wait for matching traffic')).toBeVisible()
  await expect(page.getByText('none = load only')).toBeVisible()

  await expect(page.getByText('Close action after the remote peer closes this CHILD_SA')).toBeVisible()
  await expect(page.getByText('none = do nothing (VICI clear)')).toBeVisible()
  await expect(page.getByText('trap = install an on-demand trap (VICI hold)')).toHaveCount(2)
  await expect(page.getByText('start = recreate immediately (VICI restart)')).toBeVisible()

  await expect(page.getByText('Action when DPD declares the IKE peer dead for this CHILD_SA')).toBeVisible()
  await expect(page.getByText('clear = remove the CHILD_SA')).toBeVisible()
  await expect(page.getByText('restart = recreate it immediately')).toBeVisible()
})
