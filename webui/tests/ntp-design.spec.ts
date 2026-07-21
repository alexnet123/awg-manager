import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('NTP UI loads live configuration and Chrony status', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await login(page)

  await page.getByRole('button', { name: 'NTP' }).click()
  await expect(page.getByText('design preview')).toHaveCount(0)
  await expect(page.getByText('Loading NTP configuration…')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Sources' }).click()
  await expect(page.getByRole('columnheader', { name: 'Address' })).toBeVisible()
  await expect(page.locator('tbody tr')).not.toHaveCount(0)

  await page.getByRole('tab', { name: 'Status' }).click()
  await expect(page.getByText('Applied config', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Runtime service', { exact: true })).toBeVisible()
  await expect(page.getByText('Runtime sync', { exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Reach' })).toBeVisible()
  expect(browserErrors).toEqual([])
})

test('Time configuration cards have equal heights', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'NTP' }).click()

  const systemTimeValue = page.getByText('System time', { exact: true }).locator('..').locator(':scope > div').nth(1)
  await expect(systemTimeValue).toHaveCSS('font-size', '12px')
  await expect(systemTimeValue.locator('span')).toHaveCount(2)
  await expect(page.getByText('Last sync', { exact: true })).toBeVisible()

  const timeCards = page.locator('[role="tabpanel"][data-state="active"] .mt-3.grid > .rounded-xl.border')
  await expect(timeCards).toHaveCount(5)
  const boxes = await Promise.all([
    timeCards.nth(0).boundingBox(),
    timeCards.nth(1).boundingBox(),
    timeCards.nth(2).boundingBox(),
  ])
  const heights = boxes.map((box) => box?.height || 0)
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)
})

test('Time values tick every second', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: 'NTP' }).click()

  const systemTimeValue = page.getByText('System time', { exact: true }).locator('..').locator(':scope > div').nth(1)
  const manualTimeInput = page.getByRole('textbox', { name: 'Time', exact: true })
  const beforeSummary = (await systemTimeValue.textContent()) || ''
  const beforeManual = await manualTimeInput.inputValue()

  await page.waitForTimeout(1_300)

  await expect(systemTimeValue).not.toHaveText(beforeSummary)
  await expect(manualTimeInput).not.toHaveValue(beforeManual)
})

test('Timezone selector uses host timezone catalog and recalculates displayed time', async ({ page }) => {
  await login(page)
  await page.route('**/ntp/timezones', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, item: { items: ['UTC', 'Asia/Tokyo', 'Europe/Berlin'] } }),
    })
  })

  await page.getByRole('button', { name: 'NTP' }).click()
  await expect(page.getByText('Popular timezone')).toHaveCount(0)
  await expect(page.getByText('Host timezones loaded')).toHaveCount(0)
  await expect(page.getByText('UTC offset')).toBeVisible()

  const systemTimeValue = page.getByText('System time', { exact: true }).locator('..').locator(':scope > div').nth(1)
  const beforeSummary = (await systemTimeValue.textContent()) || ''
  await page.getByLabel('Timezone value').focus()
  const timezoneOptions = page.getByTestId('ntp-timezone-options')
  await expect(timezoneOptions).toBeVisible()
  expect(await timezoneOptions.getByRole('button').count()).toBeGreaterThan(1)
  await page.getByLabel('Timezone value').fill('Asia/To')
  await expect(timezoneOptions).toBeVisible()
  await expect(timezoneOptions).toHaveCSS('max-height', '224px')
  await timezoneOptions.getByRole('button', { name: 'Asia/Tokyo' }).click()

  await expect(page.getByLabel('Timezone value')).toHaveValue('Asia/Tokyo')
  await expect(page.getByText('UTC+09:00')).toBeVisible()
  await expect(systemTimeValue).not.toHaveText(beforeSummary)
})

test('Access table follows IPsec-like list styling', async ({ page }) => {
  await login(page)

  await page.getByRole('button', { name: 'NTP' }).click()
  await page.getByRole('tab', { name: 'Access' }).click()

  await expect(page.getByRole('columnheader', { name: 'Enabled' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Network' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Comment' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Firewall' })).toHaveCount(0)
  await expect(page.getByText('not managed', { exact: true })).toHaveCount(0)
})

test('NTP source copy reuses settings with empty address', async ({ page }) => {
  await login(page)

  await page.getByRole('button', { name: 'NTP' }).click()
  await page.getByRole('tab', { name: 'Sources' }).click()
  await expect(page.locator('tbody tr')).not.toHaveCount(0)

  await page.locator('tbody tr').first().dblclick()
  const editDialog = page.getByRole('dialog', { name: 'Edit NTP sources' })
  await expect(editDialog.getByRole('button', { name: 'Copy' })).toBeVisible()
  const copiedComment = await editDialog.getByLabel('Comment').inputValue()

  await editDialog.getByRole('button', { name: 'Copy' }).click()
  const addDialog = page.getByRole('dialog', { name: 'Add NTP sources' })
  await expect(addDialog.getByLabel('Address')).toHaveValue('')
  await expect(addDialog.getByLabel('Comment')).toHaveValue(copiedComment)
  await expect(addDialog.getByRole('button', { name: 'Add' })).toBeVisible()
  await addDialog.getByRole('button', { name: 'Add' }).click()
  await expect(addDialog.getByText('Address is required.')).toBeVisible()
  await expect(addDialog).toBeVisible()
})

test('NTP access copy reuses settings with empty network', async ({ page }) => {
  await login(page)

  await page.getByRole('button', { name: 'NTP' }).click()
  await page.getByRole('tab', { name: 'Access' }).click()
  await expect(page.locator('tbody tr')).not.toHaveCount(0)

  await page.locator('tbody tr').first().dblclick()
  const editDialog = page.getByRole('dialog', { name: 'Edit NTP access' })
  await expect(editDialog.getByRole('button', { name: 'Copy' })).toBeVisible()
  const copiedComment = await editDialog.getByLabel('Comment').inputValue()

  await editDialog.getByRole('button', { name: 'Copy' }).click()
  const addDialog = page.getByRole('dialog', { name: 'Add NTP access' })
  await expect(addDialog.getByLabel('Network')).toHaveValue('')
  await expect(addDialog.getByLabel('Comment')).toHaveValue(copiedComment)
  await expect(addDialog.getByRole('button', { name: 'Add' })).toBeVisible()
  await addDialog.getByRole('button', { name: 'Add' }).click()
  await expect(addDialog.getByText('Network is required.')).toBeVisible()
  await expect(addDialog).toBeVisible()
})

test('NTP page renders configuration before slow Chrony status completes', async ({ page }) => {
  await login(page)

  await page.route('**/ntp/status', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        item: {
          service: { active: true, enabled: true, state: 'active' },
          system_clock: { timezone: 'UTC', local_rtc: false, ntp_synchronized: true, ntp_service: true },
          tracking: null,
          activity: null,
          sources: [],
          source_stats: [],
          errors: [],
        },
      }),
    })
  })

  await page.getByRole('button', { name: 'NTP' }).click()
  await expect(page.getByText('Loading NTP configuration…')).toHaveCount(0, { timeout: 1_500 })
  await expect(page.getByRole('tab', { name: 'Time' })).toBeVisible({ timeout: 1_500 })
  await expect(page.getByText('Manual time')).toBeVisible({ timeout: 1_500 })
  await expect(page.getByText('checking', { exact: true }).first()).toBeVisible()
})

test('NTP page shell renders before slow saved configuration completes', async ({ page }) => {
  await login(page)

  await page.route('**/ntp', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 4_000))
    await route.continue()
  })

  await page.getByRole('button', { name: 'NTP' }).click()
  await expect(page.getByText('Loading NTP configuration…')).toHaveCount(0, { timeout: 500 })
  await expect(page.getByRole('tab', { name: 'Time' })).toBeVisible({ timeout: 500 })
  await expect(page.getByText('Manual time')).toBeVisible({ timeout: 500 })
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled()
})

test('NTP page auto-refreshes desired configuration changed elsewhere', async ({ page }) => {
  await login(page)

  let configReads = 0
  const configBody = (serverEnabled: boolean) => ({
    schema_version: 1,
    applied_current: true,
    time: { timezone: 'UTC', ntp_enabled: true, rtcsync: true },
    sources: [{ enabled: true, type: 'pool', address: '2.debian.pool.ntp.org', min_poll: 6, max_poll: 10, iburst: true, auth_key: 'none', options: '', comment: '' }],
    server: {
      enabled: serverEnabled,
      use_local_clock: false,
      local_stratum: 10,
      bind_address: '',
      bind_interface: '',
      listen_port: 123,
      orphan_mode: false,
      rate_limit_enabled: true,
      rate_interval: 3,
      rate_burst: 8,
      collect_client_statistics: true,
      client_log_limit: 1048576,
      auth_key: 'none',
    },
    access: [],
    keys: [],
  })
  const statusBody = {
    ok: true,
    item: {
      service: { active: true, enabled: true, state: 'active' },
      current_time: Math.floor(Date.now() / 1000),
      system_clock: { timezone: 'UTC', local_rtc: false, ntp_synchronized: true, ntp_service: true },
      tracking: null,
      activity: { sources_online: 1, sources_offline: 0, sources_burst_online: 0, sources_burst_offline: 0, sources_unresolved: 0 },
      sources: [],
      source_stats: [],
      errors: [],
    },
  }

  await page.route('**/ntp/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statusBody) })
  })
  await page.route('**/ntp', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    configReads += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, item: configBody(configReads > 1) }),
    })
  })

  await page.getByRole('button', { name: 'NTP' }).click()
  await page.getByRole('tab', { name: 'Time' }).click()
  await expect(page.getByLabel('Enable NTP server')).not.toBeChecked()
  await expect(page.getByLabel('Enable NTP server')).toBeChecked({ timeout: 7_000 })
})

test('NTP server settings expose help, dependencies and submit full payload', async ({ page }) => {
  await login(page)

  const putPayloads: any[] = []
  const configBody = {
    schema_version: 1,
    applied_current: true,
    time: { timezone: 'UTC', ntp_enabled: true, rtcsync: true },
    sources: [{ enabled: true, type: 'pool', address: '2.debian.pool.ntp.org', min_poll: 6, max_poll: 10, iburst: true, auth_key: 'none', options: '', comment: 'test' }],
    server: {
      enabled: true,
      use_local_clock: true,
      local_stratum: 10,
      bind_address: '',
      bind_interface: '',
      listen_port: 123,
      orphan_mode: false,
      rate_limit_enabled: true,
      rate_interval: 3,
      rate_burst: 8,
      collect_client_statistics: true,
      client_log_limit: 1048576,
      auth_key: 'none',
    },
    access: [{ enabled: true, action: 'allow', network: '192.0.2.0/24', comment: 'test' }],
    keys: [{ enabled: true, id: '1', algorithm: 'SHA256', secret: 'server-secret', comment: 'server key' }],
  }
  const statusBody = {
    ok: true,
    item: {
      service: { active: true, enabled: true, state: 'active' },
      current_time: Math.floor(Date.now() / 1000),
      system_clock: { timezone: 'UTC', local_rtc: false, ntp_synchronized: true, ntp_service: true },
      tracking: null,
      activity: { sources_online: 0, sources_offline: 0, sources_burst_online: 0, sources_burst_offline: 0, sources_unresolved: 0 },
      sources: [],
      source_stats: [],
      errors: [],
    },
  }

  await page.route('**/ntp/status', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statusBody) })
  })
  await page.route('**/ntp/timezone', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, item: { timezone: 'UTC' } }) })
  })
  await page.route('**/ntp/apply', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, item: { applied: true, service: 'active', config_path: '/etc/chrony/chrony.conf', backup_path: '', disabled_services: [] } }),
    })
  })
  await page.route('**/ntp', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, item: configBody }) })
      return
    }
    if (route.request().method() !== 'PUT') {
      await route.continue()
      return
    }
    const payload = await route.request().postDataJSON()
    putPayloads.push(payload)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, item: payload }) })
  })

  await page.getByRole('button', { name: 'NTP' }).click()
  await page.getByRole('tab', { name: 'Time' }).click()
  await expect(page.getByText('NTP server', { exact: true })).toBeVisible()
  await expect(page.getByText('writes chrony.conf and restarts Chrony.')).toHaveCount(0)
  await expect(page.getByText('controls who may query this server.')).toHaveCount(0)
  await expect(page.getByText('is intentionally not managed here.')).toHaveCount(0)
  await expect(page.getByText('Fallback stratum 1–15; 10 is safe.')).toBeVisible()
  await expect(page.getByText('UDP NTP port; default is 123.')).toBeVisible()
  await expect(page.getByText('Needs local clock; elects isolated leader.')).toBeVisible()
  await expect(page.getByText('Client stats', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Log limit', { exact: true })).toHaveCount(0)

  await page.getByLabel('Enable NTP server').uncheck()
  await expect(page.getByLabel('Use local clock')).toBeDisabled()
  await expect(page.getByLabel('Local stratum')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add Bind address' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add Authentication key' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Manage NTP keys' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Listen port' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add Bind interface' })).toBeDisabled()
  await expect(page.getByLabel('Orphan mode')).toBeDisabled()
  await expect(page.getByLabel('Rate limit responses')).toBeDisabled()
  await expect(page.getByLabel('Rate interval')).toBeDisabled()
  await expect(page.getByLabel('Rate burst')).toBeDisabled()
  await expect(page.getByLabel('Collect client statistics')).toHaveCount(0)
  await expect(page.getByLabel('Client log limit')).toHaveCount(0)

  await page.getByLabel('Enable NTP server').check()
  await page.getByLabel('Use local clock').uncheck()
  await expect(page.getByLabel('Orphan mode')).toBeDisabled()
  await page.getByLabel('Use local clock').check()
  await expect(page.getByLabel('Orphan mode')).toBeEnabled()
  await page.getByLabel('Rate limit responses').uncheck()
  await expect(page.getByLabel('Rate interval')).toBeDisabled()
  await expect(page.getByLabel('Rate burst')).toBeDisabled()
  await page.getByLabel('Rate limit responses').check()

  await page.getByLabel('Local stratum').fill('12')
  await page.getByRole('button', { name: 'Add Listen port' }).click()
  await page.getByRole('spinbutton', { name: 'Listen port' }).fill('124')
  await page.getByRole('button', { name: 'Add Bind address' }).click()
  await expect(page.getByRole('textbox', { name: 'Bind address' })).toHaveValue('0.0.0.0')
  await page.getByRole('textbox', { name: 'Bind address' }).fill('127.0.0.1')
  await page.getByRole('button', { name: 'Add Bind interface' }).click()
  await page.getByRole('textbox', { name: 'Bind interface' }).fill('eth0')
  await page.getByLabel('Orphan mode').check()
  await page.getByLabel('Rate interval').fill('4')
  await page.getByLabel('Rate burst').fill('9')
  await page.getByRole('button', { name: 'Manage NTP keys' }).click()
  const serverKeysDialog = page.getByRole('dialog', { name: 'Manage NTP keys' })
  await expect(serverKeysDialog.getByText('server key')).toBeVisible()
  await serverKeysDialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Add Authentication key' }).click()
  await page.getByRole('combobox', { name: 'Authentication key' }).click()
  await page.getByRole('option', { name: '1' }).click()

  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect.poll(() => putPayloads.length).toBe(1)
  expect(putPayloads[0].server).toEqual({
    enabled: true,
    use_local_clock: true,
    local_stratum: 12,
    bind_address: '127.0.0.1',
    bind_interface: 'eth0',
    listen_port: 124,
    orphan_mode: true,
    rate_limit_enabled: true,
    rate_interval: 4,
    rate_burst: 9,
    collect_client_statistics: true,
    client_log_limit: 1048576,
    auth_key: '1',
  })
  expect(putPayloads[0].keys).toEqual([{ enabled: true, id: '1', algorithm: 'SHA256', secret: 'server-secret', comment: 'server key' }])
})

test('NTP design follows IPsec-like tabs and configuration flow', async ({ page }) => {
  await login(page)

  await page.getByRole('button', { name: 'NTP' }).click()
  await expect(page.getByRole('heading', { name: 'NTP / Chrony' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Time' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Sources' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Server' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Access' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Advanced' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Status' })).toBeVisible()

  await page.getByRole('tab', { name: 'Time' }).click()
  await expect(page.locator('[role="tabpanel"][data-state="active"]')).toHaveCSS('overflow-y', 'auto')
  await expect(page.getByText('System time', { exact: true })).toBeVisible()
  await expect(page.getByText('Manual time')).toBeVisible()
  await expect(page.getByText('NTP synchronization')).toBeVisible()
  await expect(page.getByText('NTP server', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Sync hardware clock (RTC)')).toBeChecked()
  await page.getByLabel('Enable NTP server').setChecked(false)
  await expect(page.getByLabel('Enable NTP server')).not.toBeChecked()
  await expect(page.getByLabel('Local stratum')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Bind address' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Listen port' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Bind interface' })).toBeVisible()
  await expect(page.getByLabel('Orphan mode')).toBeVisible()
  await expect(page.getByLabel('Rate limit responses')).toBeVisible()
  await expect(page.getByLabel('Rate interval')).toBeVisible()
  await expect(page.getByLabel('Rate burst')).toBeVisible()
  await expect(page.getByLabel('Collect client statistics')).toHaveCount(0)
  await expect(page.getByLabel('Client log limit')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add Authentication key' })).toBeVisible()
  await page.getByRole('button', { name: 'Manage NTP keys' }).click()
  const keysDialog = page.getByRole('dialog', { name: 'Manage NTP keys' })
  await expect(keysDialog).toBeVisible()
  await expect(keysDialog.getByText('Chrony authentication keys', { exact: true })).toBeVisible()
  await expect(keysDialog.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
  await expect(keysDialog.getByRole('button', { name: 'Del', exact: true })).toBeVisible()
  await expect(keysDialog.getByRole('button', { name: 'Disable', exact: true })).toBeVisible()
  await expect(keysDialog.getByRole('button', { name: 'Enable', exact: true })).toBeVisible()
  await expect(keysDialog.getByRole('columnheader', { name: 'ID ↕' })).toBeVisible()
  await expect(keysDialog.getByRole('columnheader', { name: 'Algorithm ↕' })).toBeVisible()
  await expect(keysDialog.getByRole('button', { name: 'Add', exact: true })).toBeEnabled()
  await keysDialog.getByRole('button', { name: 'Add', exact: true }).click()
  const addKeyDialog = page.getByRole('dialog', { name: 'Add NTP key' })
  await expect(addKeyDialog).toBeVisible()
  await addKeyDialog.getByLabel('ID').fill('99')
  const secretInput = addKeyDialog.getByLabel('Secret')
  await expect(secretInput).toHaveAttribute('type', 'password')
  await addKeyDialog.getByTitle('Generate secret').click()
  await expect(secretInput).toHaveValue(/[0-9a-f]{64}/)
  await expect(secretInput).toHaveAttribute('type', 'text')
  await addKeyDialog.getByTitle('Hide secret').click()
  await expect(secretInput).toHaveAttribute('type', 'password')
  await addKeyDialog.getByTitle('Show secret').click()
  await expect(secretInput).toHaveAttribute('type', 'text')
  await addKeyDialog.getByLabel('Comment').fill('test key')
  await addKeyDialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(keysDialog.getByText('test key')).toBeVisible()
  await expect(keysDialog.getByText('99', { exact: true })).toBeVisible()
  await expect(keysDialog.getByText('••••••••')).toBeVisible()
  await expect(keysDialog.locator('tbody tr').first()).toHaveClass(/bg-blue-/)
  await keysDialog.getByRole('button', { name: 'Close' }).click()
  await page.getByLabel('Enable NTP server').setChecked(true)
  await page.getByLabel('Use local clock').setChecked(true)
  await page.getByLabel('Orphan mode').setChecked(true)
  await page.getByRole('button', { name: 'Add Bind interface' }).click()
  await page.getByRole('textbox', { name: 'Bind interface' }).fill('eth0')
  await page.getByLabel('Rate interval').fill('4')
  await page.getByLabel('Rate burst').fill('4')
  await expect(page.getByRole('button', { name: 'Set manually' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Apply timezone' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sync now' })).toHaveCount(0)
  await expect(page.getByText('Service', { exact: true })).toBeVisible()
  await expect(page.getByText('RTC sync', { exact: true })).toBeVisible()
  const syncBadge = page.getByText(/^(synchronized|waiting|disabled)$/).first()
  await expect(syncBadge).toBeVisible()
  if (await syncBadge.textContent() === 'synchronized') {
    await expect(syncBadge).toHaveClass(/bg-emerald-/)
  } else if (await syncBadge.textContent() === 'waiting') {
    await expect(syncBadge).toHaveClass(/bg-amber-/)
  } else {
    await expect(syncBadge).toHaveClass(/bg-red-/)
  }
  await page.getByLabel('Enable NTP client').uncheck()
  await expect(page.getByText('pending apply', { exact: true })).toHaveCount(0)
  await page.getByLabel('Enable NTP client').check()
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Apply saved config' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Revert changes' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(1)
  await expect(page.getByText('Selected source', { exact: true })).toHaveCount(1)
  await expect(page.getByText('Mode', { exact: true })).toHaveCount(0)
  await expect(page.getByText('makestep', { exact: true })).toHaveCount(0)
  await expect(page.getByText('chrony.conf preview')).toHaveCount(0)
  await expect(page.getByLabel('Timezone value')).toBeVisible()
  await page.getByLabel('Timezone value').fill('UTC')

  await page.getByRole('tab', { name: 'Sources' }).click()
  await expect(page.getByRole('columnheader', { name: 'Address' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Enabled' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Comment' })).toHaveCount(0)
  await expect(page.getByText('chrony.conf preview')).toHaveCount(0)
  const firstSourceRow = page.locator('tbody tr').first()
  await firstSourceRow.click()
  const sourceDisableButton = page.getByRole('button', { name: 'Disable', exact: true })
  const sourceEnableButton = page.getByRole('button', { name: 'Enable', exact: true })
  if (!(await sourceDisableButton.isEnabled())) {
    await expect(sourceEnableButton).toBeEnabled()
    await sourceEnableButton.click()
    await expect(firstSourceRow).not.toHaveClass(/bg-amber-50/)
  }
  await expect(sourceDisableButton).toBeEnabled()
  await expect(sourceEnableButton).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Del', exact: true })).toBeEnabled()
  await sourceDisableButton.click()
  await expect(firstSourceRow).toHaveClass(/bg-amber-50/)
  await expect(sourceDisableButton).toBeDisabled()
  await expect(sourceEnableButton).toBeEnabled()
  await expect(page.getByText('NTP source changes applied. Chrony is active.')).toBeVisible()
  await expect(page.getByText('Desired NTP configuration has pending changes.')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Time' }).click()
  await expect(page.getByText('pending apply', { exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: 'Status' }).click()
  await expect(page.getByText('Applied config', { exact: true })).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'NTP' }).click()
  await expect(page.getByText('Desired NTP configuration has pending changes.')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Sources' }).click()
  const reloadedFirstSourceRow = page.locator('tbody tr').first()
  await expect(reloadedFirstSourceRow).toHaveClass(/bg-amber-50/)
  await reloadedFirstSourceRow.click()
  await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Enable', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Del', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Enable', exact: true }).click()
  await expect(reloadedFirstSourceRow).not.toHaveClass(/bg-amber-50/)
  await expect(page.getByRole('button', { name: 'Del', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Enable', exact: true })).toBeDisabled()
  await expect(page.getByText('NTP source changes applied. Chrony is active.')).toBeVisible()
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const sourceDialog = page.getByRole('dialog', { name: 'Add NTP sources' })
  const sourceAddress = `ntp-${Date.now()}.example.com`
  await sourceDialog.getByLabel('Address').fill(sourceAddress)
  await sourceDialog.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('cell', { name: sourceAddress })).toBeVisible()
  await expect(page.getByText('NTP source changes applied. Chrony is active.')).toBeVisible()
  await page.getByRole('cell', { name: sourceAddress }).click()
  await expect(page.getByRole('button', { name: 'Del', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Del' }).click()
  await expect(page.getByRole('cell', { name: sourceAddress })).toHaveCount(0)
  await expect(page.getByText('NTP source changes applied. Chrony is active.')).toBeVisible()

  await page.getByRole('tab', { name: 'Access' }).click()
  await expect(page.getByText('chrony.conf preview')).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Enabled' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const accessDialog = page.getByRole('dialog', { name: 'Add NTP access' })
  const accessNetwork = '192.0.2.123/32'
  await accessDialog.getByLabel('Network').fill(accessNetwork)
  await accessDialog.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByRole('cell', { name: accessNetwork })).toBeVisible()
  await expect(page.getByText('Desired NTP configuration saved.')).toBeVisible()
  await page.getByRole('cell', { name: accessNetwork }).click()
  const addedAccessRow = page.locator('tbody tr').filter({ hasText: accessNetwork })
  await expect(page.getByRole('button', { name: 'Del', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Enable', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Disable', exact: true }).click()
  await expect(addedAccessRow).toHaveClass(/bg-amber-50/)
  await expect(page.getByRole('button', { name: 'Del', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Enable', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Enable', exact: true }).click()
  await expect(addedAccessRow).not.toHaveClass(/bg-amber-50/)
  await expect(page.getByRole('button', { name: 'Del', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Enable', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Del' }).click()
  await expect(page.getByRole('cell', { name: accessNetwork })).toHaveCount(0)
  await expect(page.getByText('Desired NTP configuration saved.')).toBeVisible()
})
