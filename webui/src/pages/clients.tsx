import * as React from 'react'
import { Download, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AwgEditorWindow } from './awgEditorWindow'
import type { AuthState, ClientItem, InterfaceItem } from './api'
import {
  createClient,
  deleteClient,
  downloadWithAuth,
  getClientConfig,
  getClientQrSvg,
  getClients,
  getInterfaces,
  setClientEnabled,
  updateClient,
} from './api'

type ClientColumnKey = 'name' | 'ip' | 'wg_interface' | 'pubkey'
type SortDirection = 'asc' | 'desc'
type SortState<K extends string> = { key: K | null; dir: SortDirection }

const clientColumnLabels: Record<ClientColumnKey, string> = {
  name: 'Name',
  ip: 'IP',
  wg_interface: 'Interface',
  pubkey: 'Public Key',
}

const clientColumnOrder: ClientColumnKey[] = ['name', 'ip', 'wg_interface', 'pubkey']

function selectableAwgRowClass(selected: boolean, disabled = false) {
  return `h-8 cursor-default select-none hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selected ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${disabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`
}

function truncateMiddle(value?: string | null, max = 28) {
  const text = String(value || '')
  if (!text) return '-'
  if (text.length <= max) return text
  const half = Math.floor((max - 3) / 2)
  return `${text.slice(0, half)}...${text.slice(-half)}`
}

function emptySort<K extends string>(): SortState<K> {
  return { key: null, dir: 'asc' }
}

function nextSortState<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (prev.key !== key) return { key, dir: 'asc' }
  if (prev.dir === 'asc') return { key, dir: 'desc' }
  return emptySort()
}

function sortIndicator(active: boolean, dir: SortDirection): string {
  if (!active) return '↕'
  return dir === 'asc' ? '▲' : '▼'
}

function normalizeSortValue(value: unknown): string | number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return ''
  const text = String(value).trim()
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return text.toLowerCase()
}

function compareSortValues(a: unknown, b: unknown): number {
  const av = normalizeSortValue(a)
  const bv = normalizeSortValue(b)
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true })
}

function sortRows<T, K extends string>(rows: T[], sort: SortState<K>, getValue: (row: T, key: K) => unknown): T[] {
  if (!sort.key) return rows
  const dir = sort.dir === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const cmp = compareSortValues(getValue(a.row, sort.key as K), getValue(b.row, sort.key as K))
      return cmp === 0 ? a.index - b.index : dir * cmp
    })
    .map((item) => item.row)
}

function SortableHead<K extends string>(props: {
  sortKey: K
  label: string
  sort: SortState<K>
  onSort: (key: K) => void
}) {
  return (
    <TableHead>
      <button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.onSort(props.sortKey)}>
        {props.label}
        <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(props.sort.key === props.sortKey, props.sort.dir)}</span>
      </button>
    </TableHead>
  )
}

function EmptyRow(props: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={props.colSpan} className='py-8 text-center text-xs text-muted-foreground'>
        {props.text}
      </TableCell>
    </TableRow>
  )
}

export function ClientsPage(props: {
  auth: AuthState
  refreshNonce: number
  embedded?: boolean
  createOpen?: boolean
  createTitle?: string
  onCreateOpenChange?: (open: boolean) => void
  onCreateDone?: () => void
}) {
  const [clients, setClients] = React.useState<ClientItem[]>([])
  const [interfaces, setInterfaces] = React.useState<InterfaceItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [selected, setSelected] = React.useState<ClientItem | null>(null)
  const [editingClient, setEditingClient] = React.useState<ClientItem | null>(null)
  const [activeTab, setActiveTab] = React.useState<'config' | 'qr'>('config')
  const [configText, setConfigText] = React.useState<string>('')
  const [qrSvg, setQrSvg] = React.useState<string>('')
  const [form, setForm] = React.useState({
    name: '',
    wg_interface: '',
    ip: '',
    allowed_ips: '0.0.0.0/0',
  })
  const [isSaving, setIsSaving] = React.useState(false)
  const [isToggling, setIsToggling] = React.useState(false)
  const [standaloneCreateOpen, setStandaloneCreateOpen] = React.useState(false)
  const [sort, setSort] = React.useState<SortState<ClientColumnKey>>(emptySort<ClientColumnKey>())

  const isDialogOpen = props.createOpen ?? standaloneCreateOpen
  const setDialogOpen = props.onCreateOpenChange ?? setStandaloneCreateOpen
  const sortedClients = React.useMemo(() => sortRows(clients, sort, (row, key) => row[key]), [clients, sort])
  const selectedEnabled = selected?.enabled ?? true

  async function refresh() {
    setError(null)
    setIsLoading(true)
    try {
      const [ifs, cls] = await Promise.all([getInterfaces(props.auth), getClients(props.auth)])
      setInterfaces(ifs)
      setClients(cls)
      setSelected((prev) => (prev ? cls.find((row) => row.id === prev.id) ?? null : null))
      setForm((prev) => ({ ...prev, wg_interface: prev.wg_interface || (ifs[0]?.wg_interface ?? '') }))
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.refreshNonce])

  function resetForm(nextInterface = interfaces[0]?.wg_interface ?? '') {
    setForm({
      name: '',
      wg_interface: nextInterface,
      ip: '',
      allowed_ips: '0.0.0.0/0',
    })
    setActiveTab('config')
    setConfigText('')
    setQrSvg('')
  }

  function openCreateDialog() {
    setEditingClient(null)
    resetForm()
    setDialogOpen(true)
  }

  const closeEditor = React.useCallback(() => {
    setDialogOpen(false)
    setEditingClient(null)
    setConfigText('')
    setQrSvg('')
  }, [setDialogOpen])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const payload: any = { name: form.name.trim(), wg_interface: form.wg_interface.trim() }
      if (form.ip.trim()) payload.ip = form.ip.trim()
      payload.allowed_ips = form.allowed_ips.trim() || '0.0.0.0/0'
      if (editingClient) {
        const updated = await updateClient(props.auth, editingClient.id, payload)
        setSelected(updated)
      } else {
        await createClient(props.auth, payload)
        props.onCreateDone?.()
      }
      await refresh()
      closeEditor()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsSaving(false)
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Delete this client?')) return
    setError(null)
    try {
      await deleteClient(props.auth, id)
      setSelected(null)
      setEditingClient(null)
      closeEditor()
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  async function onSetSelectedEnabled(enabled: boolean) {
    if (!selected) return
    setError(null)
    setIsToggling(true)
    try {
      const updated = await setClientEnabled(props.auth, selected.id, enabled)
      setSelected(updated)
      setClients((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      if (editingClient?.id === updated.id) setEditingClient(updated)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsToggling(false)
    }
  }

  async function loadConfig(clientId: number) {
    setError(null)
    try {
      setConfigText(await getClientConfig(props.auth, clientId))
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  async function loadQr(clientId: number) {
    setError(null)
    try {
      setQrSvg(await getClientQrSvg(props.auth, clientId))
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  function selectClient(item: ClientItem) {
    setSelected(item)
  }

  function openClientEditor(item: ClientItem) {
    setSelected(item)
    setEditingClient(item)
    setForm({
      name: item.name,
      wg_interface: item.wg_interface,
      ip: item.ip,
      allowed_ips: item.allowed_ips || '0.0.0.0/0',
    })
    setActiveTab('config')
    setQrSvg('')
    void loadConfig(item.id)
    setDialogOpen(true)
  }

  function renderClientCell(row: ClientItem, key: ClientColumnKey) {
    switch (key) {
      case 'name':
        return <TableCell className='font-medium'>{row.name}</TableCell>
      case 'ip':
        return <TableCell>{row.ip}</TableCell>
      case 'wg_interface':
        return <TableCell>{row.wg_interface}</TableCell>
      case 'pubkey':
        return <TableCell className='font-mono text-[11px]' title={row.pubkey}>{truncateMiddle(row.pubkey, 34)}</TableCell>
    }
  }

  return (
    <div className='flex h-full min-h-0 flex-col space-y-3'>
      {!props.embedded ? (
        <div className='flex items-start justify-between gap-2'>
          <div>
            <h2 className='text-lg font-semibold tracking-tight'>Clients</h2>
          </div>
          <Button size='sm' onClick={openCreateDialog}>
            <Plus />
            Add
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className='rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      ) : null}

      <AwgEditorWindow
        open={isDialogOpen}
        title={editingClient ? 'Edit peer' : (props.createTitle ?? 'Add peer')}
        onClose={closeEditor}
        onSubmit={onSubmit}
        footer={(
          <>
            <Button type='button' variant='outline' onClick={closeEditor}>Cancel</Button>
            <Button type='submit' disabled={!interfaces.length || isSaving}>
              <Plus />
              {isSaving ? 'Saving...' : editingClient ? 'Save' : 'Add Peer'}
            </Button>
          </>
        )}
      >
        <div className='space-y-2.5'>
          <div className='rounded-md border bg-muted/10 p-2.5'>
            <div className='mb-2 text-[11px] font-medium text-muted-foreground'>Peer</div>
            <div className='grid gap-x-2.5 gap-y-3 md:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>Name</Label>
                <Input className='h-7' value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder='phone' required />
              </div>
              <div className='space-y-1.5'>
                <Label>Interface</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={form.wg_interface}
                  onChange={(e) => setForm((p) => ({ ...p, wg_interface: e.target.value }))}
                  disabled={!interfaces.length}
                  required
                >
                  {interfaces.map((it) => (
                    <option key={it.id} value={it.wg_interface}>
                      {it.wg_interface} (v{it.awg_version})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className='grid gap-x-2.5 gap-y-3 pt-2.5 md:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>Client IP</Label>
                <Input className='h-7' value={form.ip} onChange={(e) => setForm((p) => ({ ...p, ip: e.target.value }))} placeholder='10.8.0.2' />
              </div>
              <div className='space-y-1.5'>
                <Label>AllowedIPs</Label>
                <Input
                  className='h-7'
                  value={form.allowed_ips}
                  onChange={(e) => setForm((p) => ({ ...p, allowed_ips: e.target.value }))}
                  placeholder='0.0.0.0/0'
                />
              </div>
            </div>
          </div>

            {editingClient ? (
              <>
                <div className='space-y-1.5 rounded-md border bg-muted/10 p-2.5'>
                  <div className='text-muted-foreground'>Public Key</div>
                  <div className='break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs'>{editingClient.pubkey}</div>
                </div>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'config' | 'qr')}>
                  <TabsList className='h-8'>
                    <TabsTrigger className='px-3 text-xs' value='config' onClick={() => void loadConfig(editingClient.id)}>
                      Config
                    </TabsTrigger>
                    <TabsTrigger className='px-3 text-xs' value='qr' onClick={() => void loadQr(editingClient.id)}>
                      QR
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value='config' className='mt-2 space-y-2'>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => void downloadWithAuth(props.auth, `/clients/${editingClient.id}/config/download`, `client-${editingClient.id}.conf`)}
                      >
                        <Download />
                        Download .conf
                      </Button>
                    </div>
                    <pre className='max-h-[260px] overflow-auto rounded-xl border bg-muted p-3 text-xs'>{configText || '—'}</pre>
                  </TabsContent>

                  <TabsContent value='qr' className='mt-2 space-y-2'>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => void downloadWithAuth(props.auth, `/clients/${editingClient.id}/qr/download?format=svg`, `client-${editingClient.id}.svg`)}
                      >
                        <Download />
                        Download SVG
                      </Button>
                    </div>
                    <div className='rounded-xl border bg-background p-3'>
                      {qrSvg ? <div className='max-w-full overflow-auto' dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <div className='text-sm text-muted-foreground'>—</div>}
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            ) : null}
        </div>
      </AwgEditorWindow>

      <div className='flex min-h-0 flex-1 flex-col gap-2 text-xs'>
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' onClick={openCreateDialog} disabled={!interfaces.length}><Plus />Add</Button>
          <Button size='sm' variant='destructive' disabled={!selected} onClick={() => selected ? void onDelete(selected.id) : undefined}>
            Del
          </Button>
          <Button size='sm' variant='outline' disabled={!selected || !selectedEnabled || isToggling} onClick={() => void onSetSelectedEnabled(false)}>
            Disable
          </Button>
          <Button size='sm' disabled={!selected || selectedEnabled || isToggling} onClick={() => void onSetSelectedEnabled(true)}>
            Enable
          </Button>
        </div>

        <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
          <Table className='w-max min-w-full'>
            <TableHeader>
              <TableRow>
                {clientColumnOrder.map((key) => (
                  <SortableHead key={key} sortKey={key} label={clientColumnLabels[key]} sort={sort} onSort={(next) => setSort((prev) => nextSortState(prev, next))} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients.map((it) => (
                <TableRow
                  key={it.id}
                  className={selectableAwgRowClass(selected?.id === it.id, it.enabled === false)}
                  onClick={() => selectClient(it)}
                  onDoubleClick={() => openClientEditor(it)}
                >
                  {clientColumnOrder.map((key) => (
                    <React.Fragment key={key}>{renderClientCell(it, key)}</React.Fragment>
                  ))}
                </TableRow>
              ))}
              {!clients.length && !isLoading ? <EmptyRow colSpan={clientColumnOrder.length} text='No peers found.' /> : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
