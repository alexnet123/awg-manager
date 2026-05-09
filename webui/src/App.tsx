import * as React from 'react'
import { Download, KeyRound, LogOut, Moon, Network, RefreshCcw, Shield, Sun, Upload, Users } from 'lucide-react'
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
import { InterfacesPage } from '@/pages/interfaces'
import { ClientsPage } from '@/pages/clients'
import { FirewallPage } from '@/pages/firewall'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { downloadBackup, restoreBackup } from '@/pages/api'

type AuthState = {
  apiKey: string
}

type RouteKey = 'interfaces' | 'clients' | 'firewall'

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

async function healthCheck(auth: AuthState) {
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
            <p className='text-sm font-medium text-muted-foreground'>AWG Manager</p>
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
  const [route, setRoute] = React.useState<RouteKey>('interfaces')
  const [isRotating, setIsRotating] = React.useState(false)
  const [refreshNonce, setRefreshNonce] = React.useState(0)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [isRestoringBackup, setIsRestoringBackup] = React.useState(false)
  const backupInputRef = React.useRef<HTMLInputElement | null>(null)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('awg_manager_theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('awg_manager_theme', theme)
  }, [theme])

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
              AWG Manager
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route === 'interfaces'}
                onClick={() => setRoute('interfaces')}
                className='group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
              >
                <Network className='size-4 shrink-0 group-data-[collapsible=icon]:mx-auto' />
                <span>Interfaces</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={route === 'clients'}
                onClick={() => setRoute('clients')}
                className='group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0'
              >
                <Users className='size-4 shrink-0 group-data-[collapsible=icon]:mx-auto' />
                <span>Clients</span>
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
        <div className='flex min-h-svh flex-col'>
          <header className='flex items-center gap-2 border-b bg-background/60 px-3 py-2 backdrop-blur'>
            <SidebarTrigger />
            <Separator orientation='vertical' className='h-6' />
            <div className='ml-auto flex flex-wrap items-center gap-2'>
              <Button variant='outline' size='sm' onClick={() => void downloadBackup(props.auth)}>
                <Download />
                Download backup
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={isRestoringBackup}
                onClick={() => backupInputRef.current?.click()}
              >
                <Upload />
                {isRestoringBackup ? 'Restoring...' : 'Restore backup'}
              </Button>
              <input
                ref={backupInputRef}
                type='file'
                accept='.db,application/octet-stream'
                className='hidden'
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.currentTarget.value = ''
                  if (!file) return
                  if (!confirm('Restore backup now? Current DB data will be replaced.')) return
                  setIsRestoringBackup(true)
                  try {
                    await restoreBackup(props.auth, file)
                    setRefreshNonce((v) => v + 1)
                  } catch (exc) {
                    alert(exc instanceof Error ? exc.message : String(exc))
                  } finally {
                    setIsRestoringBackup(false)
                  }
                }}
              />
              <Button
                variant='default'
                size='sm'
                className={`relative z-10 text-white ${isRefreshing ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'}`}
                onClick={() => {
                  setIsRefreshing(true)
                  setRefreshNonce((v) => v + 1)
                  setTimeout(() => setIsRefreshing(false), 700)
                }}
              >
                <RefreshCcw />
                Refresh
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              >
                {theme === 'dark' ? <Sun /> : <Moon />}
                {theme === 'dark' ? 'Day' : 'Night'}
              </Button>
            </div>
          </header>
          <main className='flex-1 p-3 md:p-4'>
            {route === 'interfaces' ? <InterfacesPage auth={props.auth} refreshNonce={refreshNonce} /> : null}
            {route === 'clients' ? <ClientsPage auth={props.auth} refreshNonce={refreshNonce} /> : null}
            {route === 'firewall' ? <FirewallPage auth={props.auth} refreshNonce={refreshNonce} /> : null}
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
