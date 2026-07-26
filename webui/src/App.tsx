import * as React from 'react'
import { Clock3, Cpu, KeyRound, LockKeyhole, LogOut, MemoryStick, Moon, Network, Shield, Sun, TimerReset } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { AwgPage } from '@/pages/awg'
import { FirewallPage } from '@/pages/firewall'
import { IpsecPage } from '@/pages/ipsec'
import { NtpPage } from '@/pages/ntp'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type AuthState = {
  apiKey: string
}

type RouteKey = 'awg' | 'firewall' | 'ipsec' | 'ntp'

type SystemMetric = {
  percent: number | null
}

type SystemHealth = {
  cpu?: SystemMetric & {
    load_average_1m?: number | null
    cores?: number
  }
  uptime_seconds?: number | null
  memory?: SystemMetric & {
    used_bytes?: number
    available_bytes?: number
    total_bytes?: number
  } | null
}

type HealthPayload = {
  ok: boolean
  system?: SystemHealth
}

const AUTH_STORAGE_KEY = 'awg_manager_auth_v1'

function loadAuth(): AuthState {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return { apiKey: '' }
    const parsed = JSON.parse(raw)
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    }
  } catch {
    return { apiKey: '' }
  }
}

function saveAuth(next: AuthState) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
}

async function fetchHealth(auth: AuthState): Promise<HealthPayload> {
  const res = await fetch('/health', {
    headers: {
      'X-API-Key': auth.apiKey,
    },
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const payload = await res.json()
      message = payload?.error || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return await res.json()
}

async function healthCheck(auth: AuthState) {
  await fetchHealth(auth)
}

function formatPercent(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—'
}

function formatMemory(memory: SystemHealth['memory']) {
  const total = memory?.total_bytes
  const used = memory?.used_bytes
  if (!total || !used) return null
  const usedGb = used / 1024 / 1024 / 1024
  const totalGb = total / 1024 / 1024 / 1024
  return `${usedGb.toFixed(1)} / ${totalGb.toFixed(1)} GB`
}

function formatUptime(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function metricTone(value: number | null | undefined) {
  if (typeof value !== 'number') return 'bg-slate-300 dark:bg-slate-700'
  if (value >= 85) return 'bg-red-500'
  if (value >= 70) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function SystemInfoPill(props: {
  label: string
  value: string
  hint?: string | null
  icon: React.ReactNode
}) {
  return (
    <div className='flex h-9 min-w-[112px] items-center gap-2 rounded-md border bg-card/80 px-2.5 shadow-sm'>
      <div className='text-muted-foreground'>{props.icon}</div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2 text-[11px] leading-3'>
          <span className='font-medium text-muted-foreground'>{props.label}</span>
          <span className='font-semibold tabular-nums'>{props.value}</span>
        </div>
        {props.hint ? <div className='mt-1 truncate text-[10px] leading-3 text-muted-foreground'>{props.hint}</div> : null}
      </div>
    </div>
  )
}

function SystemMetricPill(props: {
  label: string
  value: number | null | undefined
  hint?: string | null
  icon: React.ReactNode
}) {
  const percent = typeof props.value === 'number' && Number.isFinite(props.value) ? Math.max(0, Math.min(100, props.value)) : 0
  return (
    <div className='flex h-9 min-w-[112px] items-center gap-2 rounded-md border bg-card/80 px-2.5 shadow-sm'>
      <div className='text-muted-foreground'>{props.icon}</div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2 text-[11px] leading-3'>
          <span className='font-medium text-muted-foreground'>{props.label}</span>
          <span className='font-semibold tabular-nums'>{formatPercent(props.value)}</span>
        </div>
        <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-muted'>
          <div className={`h-full rounded-full ${metricTone(props.value)}`} style={{ width: `${percent}%` }} />
        </div>
        {props.hint ? <div className='mt-0.5 truncate text-[10px] leading-3 text-muted-foreground'>{props.hint}</div> : null}
      </div>
    </div>
  )
}

function SystemLoadWidget(props: { system?: SystemHealth | null }) {
  const cpuHint = props.system?.cpu?.load_average_1m != null
    ? `load ${props.system.cpu.load_average_1m}${props.system.cpu.cores ? ` / ${props.system.cpu.cores}c` : ''}`
    : null
  return (
    <div className='hidden items-center gap-2 lg:flex'>
      <SystemMetricPill label='CPU' value={props.system?.cpu?.percent} hint={cpuHint} icon={<Cpu className='size-4' />} />
      <SystemMetricPill label='RAM' value={props.system?.memory?.percent} hint={formatMemory(props.system?.memory)} icon={<MemoryStick className='size-4' />} />
      <SystemInfoPill label='Uptime' value={formatUptime(props.system?.uptime_seconds)} hint='since boot' icon={<TimerReset className='size-4' />} />
    </div>
  )
}

function LoginView(props: { onAuthed: (auth: AuthState) => void }) {
  const [apiKey, setApiKey] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const next = { apiKey: apiKey.trim() }
    if (!next.apiKey) {
      setError('API token is required.')
      return
    }
    setIsLoading(true)
    try {
      await healthCheck(next)
      saveAuth(next)
      props.onAuthed(next)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='min-h-svh bg-background'>
      <div className='mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center px-6 py-10'>
        <div className='rounded-2xl border bg-card p-8 shadow-sm'>
          <div className='space-y-2'>
            <p className='text-sm font-medium text-muted-foreground'>Net manager</p>
            <h1 className='text-2xl font-semibold tracking-tight'>Sign in</h1>
            <p className='text-sm text-muted-foreground'>
              Enter the API token. Value is stored only in sessionStorage.
            </p>
          </div>
          <form className='mt-6 space-y-4' onSubmit={onSubmit}>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>API token</label>
              <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type='password' autoComplete='off' />
            </div>
            {error ? (
              <div className='rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive'>
                {error}
              </div>
            ) : null}
            <Button className='w-full' disabled={isLoading} type='submit'>
              {isLoading ? 'Checking...' : 'Enter'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

function DashboardView(props: { auth: AuthState; onLogout: () => void }) {
  const [route, setRoute] = React.useState<RouteKey>('awg')
  const [isRotating, setIsRotating] = React.useState(false)
  const refreshNonce = 0
  const [systemHealth, setSystemHealth] = React.useState<SystemHealth | null>(null)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('awg_manager_theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('awg_manager_theme', theme)
  }, [theme])

  const refreshSystemHealth = React.useCallback(async () => {
    try {
      const payload = await fetchHealth(props.auth)
      setSystemHealth(payload.system ?? null)
    } catch {
      setSystemHealth(null)
    }
  }, [props.auth])

  React.useEffect(() => {
    void refreshSystemHealth()
    const intervalId = window.setInterval(() => { void refreshSystemHealth() }, 5_000)
    return () => window.clearInterval(intervalId)
  }, [refreshSystemHealth])

  async function rotateApiKey() {
    if (!confirm('Rotate API key? The old key will stop working immediately.')) return
    setIsRotating(true)
    try {
      const res = await fetch('/api-key/rotate', {
        method: 'POST',
        headers: {
          'X-API-Key': props.auth.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || `HTTP ${res.status}`)
      }
      const payload = await res.json()
      const newKey = payload?.api_key
      if (typeof newKey !== 'string' || !newKey) throw new Error('Invalid response')
      const next = { apiKey: newKey }
      saveAuth(next)
      alert(`New API key:\n\n${newKey}\n\nSaved to sessionStorage for this tab.`)
      window.location.reload()
    } catch (exc) {
      alert(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsRotating(false)
    }
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible='icon' variant='sidebar'>
        <SidebarHeader>
          <div className='flex items-center justify-between px-2 py-1'>
            <div className='min-w-0 text-sm font-semibold leading-tight group-data-[collapsible=icon]:hidden'>
              Net manager
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route === 'awg'}
                onClick={() => setRoute('awg')}
                className='group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
              >
                <Network className='size-4 shrink-0 group-data-[collapsible=icon]:mx-auto' />
                <span>AmneziaWG</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route === 'firewall'}
                onClick={() => setRoute('firewall')}
                className='group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
              >
                <Shield className='size-4 shrink-0 group-data-[collapsible=icon]:mx-auto' />
                <span>Firewall</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route === 'ipsec'}
                onClick={() => setRoute('ipsec')}
                className='group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
              >
                <LockKeyhole className='size-4 shrink-0 group-data-[collapsible=icon]:mx-auto' />
                <span>IPsec</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route === 'ntp'}
                onClick={() => setRoute('ntp')}
                className='group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
              >
                <Clock3 className='size-4 shrink-0 group-data-[collapsible=icon]:mx-auto' />
                <span>NTP</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className='p-2 space-y-2 group-data-[collapsible=icon]:space-y-1 group-data-[collapsible=icon]:px-1.5'>
            {/* Full-width buttons when expanded */}
            <div className='space-y-2 group-data-[collapsible=icon]:hidden'>
              <Button
                variant='outline'
                className='w-full'
                onClick={() => void rotateApiKey()}
                disabled={isRotating}
              >
                {isRotating ? 'Rotating...' : 'Rotate API key'}
              </Button>
              <Button variant='secondary' className='w-full' onClick={props.onLogout}>
                Logout
              </Button>
            </div>

            {/* Compact icon buttons when collapsed */}
            <div className='hidden flex-col items-center gap-1 group-data-[collapsible=icon]:flex'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='outline'
                    size='icon'
                    className='h-9 w-9'
                    onClick={() => void rotateApiKey()}
                    disabled={isRotating}
                    aria-label='Rotate API key'
                  >
                    <KeyRound className='size-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='right'>Rotate API key</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='secondary'
                    size='icon'
                    className='h-9 w-9'
                    onClick={props.onLogout}
                    aria-label='Logout'
                  >
                    <LogOut className='size-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='right'>Logout</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <div className='flex h-svh min-h-0 flex-col overflow-hidden'>
          <header className='flex items-center gap-2 border-b bg-background/60 px-3 py-2 backdrop-blur'>
            <SidebarTrigger />
            <Separator orientation='vertical' className='h-6' />
            <div className='ml-auto flex flex-wrap items-center gap-2'>
              <SystemLoadWidget system={systemHealth} />
              <Button
                variant='outline'
                size='sm'
                className='h-9 min-w-[112px] justify-start gap-2 rounded-md bg-card/80 px-2.5 shadow-sm'
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              >
                {theme === 'dark' ? <Sun /> : <Moon />}
                {theme === 'dark' ? 'Day' : 'Night'}
              </Button>
            </div>
          </header>
          <main className='flex min-h-0 flex-1 overflow-hidden p-3 md:p-4'>
            {route === 'awg' ? <AwgPage auth={props.auth} refreshNonce={refreshNonce} /> : null}
            {route === 'firewall' ? <FirewallPage auth={props.auth} refreshNonce={refreshNonce} /> : null}
            {route === 'ipsec' ? <IpsecPage auth={props.auth} refreshNonce={refreshNonce} /> : null}
            {route === 'ntp' ? <NtpPage auth={props.auth} refreshNonce={refreshNonce} /> : null}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function App() {
  const [auth, setAuth] = React.useState<AuthState>(() => loadAuth())
  const [isAuthed, setIsAuthed] = React.useState<boolean>(() => !!auth.apiKey)

  React.useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!auth.apiKey) return
      try {
        await healthCheck(auth)
        if (!cancelled) setIsAuthed(true)
      } catch {
        if (!cancelled) setIsAuthed(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [auth])

  if (!isAuthed) {
    return (
      <LoginView
        onAuthed={(next) => {
          setAuth(next)
          setIsAuthed(true)
        }}
      />
    )
  }

  return (
    <DashboardView
      auth={auth}
      onLogout={() => {
        sessionStorage.removeItem(AUTH_STORAGE_KEY)
        setAuth({ apiKey: '' })
        setIsAuthed(false)
      }}
    />
  )
}
