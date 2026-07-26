import * as React from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AwgEditorWindow } from './awgEditorWindow'
import type { AuthState, InterfaceItem } from './api'
import { createInterface, deleteInterface, generateAwgParams, getInterfaceConfig, getInterfaces, setInterfaceEnabled, updateInterface } from './api'

const I1_PRESETS: Record<string, string> = {
  quic: '<b 0xc30000000108><rc 8><t><r 40>',
  dns: '<b 0x123401000001000000000000><rc 12><t><r 24>',
  sip: '<b 0x4f5054494f4e53207369703a><rc 10><b 0x205349502f322e300d0a><t><r 18>',
}

type Preset = 'none' | 'quic' | 'dns' | 'sip'
type InterfaceColumnKey = 'wg_interface' | 'awg_version' | 'address' | 'port_number' | 'srv_ip'
type SortDirection = 'asc' | 'desc'
type SortState<K extends string> = { key: K | null; dir: SortDirection }
type InterfaceForm = {
  wg_interface: string
  awg_version: '1' | '2'
  port_number: string
  wg_ip_addr: string
  wg_ip_cidr: string
  srv_ip: string
  srv_dns: string
  awg_params_json: string
}

const interfaceColumnLabels: Record<InterfaceColumnKey, string> = {
  wg_interface: 'Name',
  awg_version: 'Version',
  address: 'Address',
  port_number: 'Port',
  srv_ip: 'Server',
}

const interfaceColumnOrder: InterfaceColumnKey[] = ['wg_interface', 'awg_version', 'address', 'port_number', 'srv_ip']

function tryParseJson(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return JSON.parse(trimmed)
}

function selectableAwgRowClass(selected: boolean, disabled = false) {
  return `h-8 cursor-default select-none hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selected ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${disabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`
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

function defaultForm(): InterfaceForm {
  return {
    wg_interface: '',
    awg_version: '2',
    port_number: '51820',
    wg_ip_addr: '',
    wg_ip_cidr: '24',
    srv_ip: '',
    srv_dns: '',
    awg_params_json: '',
  }
}

function formFromInterface(item: InterfaceItem): InterfaceForm {
  return {
    wg_interface: item.wg_interface,
    awg_version: item.awg_version,
    port_number: String(item.port_number),
    wg_ip_addr: item.wg_ip_addr,
    wg_ip_cidr: String(item.wg_ip_cidr),
    srv_ip: item.srv_ip,
    srv_dns: item.srv_dns,
    awg_params_json: JSON.stringify(item.awg_params || {}, null, 2),
  }
}

const STANDARD_INTERFACE_CONFIG_KEYS = new Set(['PrivateKey', 'Address', 'ListenPort', 'DNS'])

function parseAwgParamsJson(source: InterfaceForm): Record<string, string | number | null> | null {
  if (!source.awg_params_json.trim()) return null
  try {
    const parsed = tryParseJson(source.awg_params_json)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string | number | null> : null
  } catch {
    return null
  }
}

function formatAwgParamLines(params: Record<string, string | number | null> | null) {
  if (!params) return []
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key} = ${value}`)
}

function buildLocalInterfaceConfigPreview(source: InterfaceForm) {
  const paramLines = formatAwgParamLines(parseAwgParamsJson(source))
  if (!paramLines.length) return ''
  const lines = ['[Interface]']
  const address = source.wg_ip_addr.trim()
  const cidr = source.wg_ip_cidr.trim()
  const port = source.port_number.trim()
  const dns = source.srv_dns.trim()
  if (address) lines.push(`Address = ${address}${cidr ? `/${cidr}` : ''}`)
  if (port) lines.push(`ListenPort = ${port}`)
  if (dns) lines.push(`DNS = ${dns}`)
  lines.push(...paramLines)
  return lines.join('\n')
}

function ensureConfigSectionSpacing(config: string) {
  return config.replace(/\n{1,}(\[[^\]]+\])/g, '\n\n$1')
}

function mergeAwgParamsIntoConfigPreview(config: string, source: InterfaceForm) {
  const paramLines = formatAwgParamLines(parseAwgParamsJson(source))
  if (!paramLines.length) return ensureConfigSectionSpacing(config)
  if (!config || config === 'Loading...' || config.startsWith('Failed to load')) return buildLocalInterfaceConfigPreview(source)

  const lines = config.split('\n')
  const interfaceStart = lines.findIndex((line) => line.trim() === '[Interface]')
  if (interfaceStart < 0) return buildLocalInterfaceConfigPreview(source)
  const nextSection = lines.findIndex((line, index) => index > interfaceStart && /^\[[^\]]+\]/.test(line.trim()))
  const interfaceEnd = nextSection < 0 ? lines.length : nextSection
  const before = lines.slice(0, interfaceStart)
  const block = lines.slice(interfaceStart, interfaceEnd)
  const after = lines.slice(interfaceEnd)
  const filteredBlock = block.filter((line) => {
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*)\s*=/)
    return !match || STANDARD_INTERFACE_CONFIG_KEYS.has(match[1])
  })
  while (filteredBlock.length && !filteredBlock[filteredBlock.length - 1].trim()) filteredBlock.pop()
  return ensureConfigSectionSpacing([...before, ...filteredBlock, ...paramLines, ...(after.length ? ['', ...after] : [])].join('\n'))
}

export function InterfacesPage(props: {
  auth: AuthState
  refreshNonce: number
  embedded?: boolean
  createOpen?: boolean
  createTitle?: string
  onCreateOpenChange?: (open: boolean) => void
  onCreateDone?: () => void
}) {
  const [items, setItems] = React.useState<InterfaceItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [selected, setSelected] = React.useState<InterfaceItem | null>(null)
  const [editingInterface, setEditingInterface] = React.useState<InterfaceItem | null>(null)
  const [form, setForm] = React.useState<InterfaceForm>(defaultForm)
  const [editForm, setEditForm] = React.useState<InterfaceForm>(defaultForm)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isToggling, setIsToggling] = React.useState(false)
  const [isGeneratingParams, setIsGeneratingParams] = React.useState(false)
  const [isGeneratingEditParams, setIsGeneratingEditParams] = React.useState(false)
  const [preset, setPreset] = React.useState<Preset>('none')
  const [editPreset, setEditPreset] = React.useState<Preset>('none')
  const [interfaceConfigPreview, setInterfaceConfigPreview] = React.useState('')
  const [standaloneCreateOpen, setStandaloneCreateOpen] = React.useState(false)
  const [sort, setSort] = React.useState<SortState<InterfaceColumnKey>>(emptySort<InterfaceColumnKey>())

  const isDialogOpen = props.createOpen ?? standaloneCreateOpen
  const setDialogOpen = props.onCreateOpenChange ?? setStandaloneCreateOpen
  const currentForm = editingInterface ? editForm : form
  const currentPreset = editingInterface ? editPreset : preset
  const generatingCurrentParams = editingInterface ? isGeneratingEditParams : isGeneratingParams
  const sortedItems = React.useMemo(() => sortRows(items, sort, interfaceSortValue), [items, sort])
  const selectedEnabled = selected?.enabled ?? true
  const currentConfigPreview = editingInterface
    ? mergeAwgParamsIntoConfigPreview(interfaceConfigPreview, currentForm)
    : buildLocalInterfaceConfigPreview(currentForm)

  async function refresh() {
    setError(null)
    setIsLoading(true)
    try {
      const rows = await getInterfaces(props.auth)
      setItems(rows)
      setSelected((prev) => (prev ? rows.find((row) => row.id === prev.id) ?? null : null))
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

  function setCurrentForm(patch: Partial<InterfaceForm>) {
    if (editingInterface) {
      setEditForm((prev) => ({ ...prev, ...patch }))
    } else {
      setForm((prev) => ({ ...prev, ...patch }))
    }
  }

  function setCurrentPreset(nextPreset: Preset) {
    if (editingInterface) setEditPreset(nextPreset)
    else setPreset(nextPreset)
  }

  function openCreateDialog() {
    setEditingInterface(null)
    setForm(defaultForm())
    setPreset('none')
    setInterfaceConfigPreview('')
    setDialogOpen(true)
  }

  const closeEditor = React.useCallback(() => {
    setDialogOpen(false)
    setEditingInterface(null)
    setInterfaceConfigPreview('')
  }, [setDialogOpen])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const source = editingInterface ? editForm : form
      const payload: any = {
        wg_interface: source.wg_interface.trim(),
        awg_version: source.awg_version,
        port_number: Number(source.port_number),
        wg_ip_addr: source.wg_ip_addr.trim(),
        wg_ip_cidr: Number(source.wg_ip_cidr),
        srv_ip: source.srv_ip.trim(),
        srv_dns: source.srv_dns.trim(),
      }
      if (source.awg_params_json.trim()) {
        payload.awg_params = tryParseJson(source.awg_params_json)
      }
      if (editingInterface) {
        const updated = await updateInterface(props.auth, editingInterface.id, payload)
        setSelected(updated)
      } else {
        await createInterface(props.auth, payload)
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
    if (!confirm('Delete this interface?')) return
    setError(null)
    try {
      await deleteInterface(props.auth, id)
      setSelected(null)
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
      const updated = await setInterfaceEnabled(props.auth, selected.id, enabled)
      setSelected(updated)
      setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      if (editingInterface?.id === updated.id) setEditingInterface(updated)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsToggling(false)
    }
  }

  function selectInterface(item: InterfaceItem) {
    setSelected(item)
  }

  function openInterfaceEditor(item: InterfaceItem) {
    setSelected(item)
    setEditingInterface(item)
    setEditForm(formFromInterface(item))
    setEditPreset('none')
    setInterfaceConfigPreview('')
    void getInterfaceConfig(props.auth, item.id)
      .then((config) => setInterfaceConfigPreview(config))
      .catch(() => setInterfaceConfigPreview('Failed to load config preview'))
    setDialogOpen(true)
  }

  async function onGenerateParams() {
    setError(null)
    if (editingInterface) setIsGeneratingEditParams(true)
    else setIsGeneratingParams(true)
    try {
      const awgVersion = currentForm.awg_version === '1' ? '1' : '2'
      const generated = await generateAwgParams(props.auth, awgVersion)
      const current = currentForm.awg_params_json.trim() ? tryParseJson(currentForm.awg_params_json) || {} : {}
      const merged = {
        ...generated,
        I1: current.I1 ?? generated.I1,
        I2: current.I2 ?? generated.I2,
        I3: current.I3 ?? generated.I3,
        I4: current.I4 ?? generated.I4,
        I5: current.I5 ?? generated.I5,
      }
      setCurrentForm({ awg_params_json: JSON.stringify(merged, null, 2) })
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      if (editingInterface) setIsGeneratingEditParams(false)
      else setIsGeneratingParams(false)
    }
  }

  function onApplyPreset(nextPreset: Preset) {
    setCurrentPreset(nextPreset)
    if (nextPreset === 'none') return
    try {
      const current = currentForm.awg_params_json.trim() ? JSON.parse(currentForm.awg_params_json) : {}
      setCurrentForm({ awg_params_json: JSON.stringify({ ...current, I1: I1_PRESETS[nextPreset] }, null, 2) })
    } catch {
      setCurrentForm({ awg_params_json: JSON.stringify({ I1: I1_PRESETS[nextPreset] }, null, 2) })
    }
  }

  function interfaceSortValue(row: InterfaceItem, key: InterfaceColumnKey) {
    switch (key) {
      case 'address':
        return `${row.wg_ip_addr}/${row.wg_ip_cidr}`
      case 'port_number':
        return row.port_number
      default:
        return row[key]
    }
  }

  function renderInterfaceCell(row: InterfaceItem, key: InterfaceColumnKey) {
    switch (key) {
      case 'wg_interface':
        return <TableCell className='font-medium'>{row.wg_interface}</TableCell>
      case 'awg_version':
        return <TableCell><Badge variant='secondary'>v{row.awg_version}</Badge></TableCell>
      case 'address':
        return <TableCell>{row.wg_ip_addr}/{row.wg_ip_cidr}</TableCell>
      case 'port_number':
        return <TableCell>{row.port_number}</TableCell>
      case 'srv_ip':
        return <TableCell>{row.srv_ip}</TableCell>
    }
  }

  return (
    <div className='flex h-full min-h-0 flex-col space-y-3'>
      {!props.embedded ? (
        <div className='flex items-start justify-between gap-2'>
          <div>
            <h2 className='text-lg font-semibold tracking-tight'>Interfaces</h2>
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
        title={editingInterface ? 'Edit interface' : (props.createTitle ?? 'Add interface')}
        onClose={closeEditor}
        onSubmit={onSubmit}
        footer={(
          <>
            <Button type='button' variant='outline' onClick={closeEditor}>Cancel</Button>
            <Button type='submit' disabled={isSaving}>
              <Plus />
              {isSaving ? 'Saving...' : editingInterface ? 'Save' : 'Add Interface'}
            </Button>
          </>
        )}
      >
        <div className='space-y-2.5'>
          <div className='rounded-md border bg-muted/10 p-2.5'>
            <div className='mb-2 text-[11px] font-medium text-muted-foreground'>Interface</div>
            <div className='grid gap-x-2.5 gap-y-3 md:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>Interface name</Label>
                <Input className='h-7' value={currentForm.wg_interface} onChange={(e) => setCurrentForm({ wg_interface: e.target.value })} placeholder='awg0' required />
              </div>
              <div className='space-y-1.5'>
                <Label>Version</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={currentForm.awg_version}
                  onChange={(e) => setCurrentForm({ awg_version: e.target.value as '1' | '2' })}
                >
                  <option value='2'>2</option>
                  <option value='1'>1</option>
                </select>
              </div>
            </div>
            <div className='grid gap-x-2.5 gap-y-3 pt-2.5 md:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>Interface IP</Label>
                <Input className='h-7' value={currentForm.wg_ip_addr} onChange={(e) => setCurrentForm({ wg_ip_addr: e.target.value })} placeholder='10.8.0.1' required />
              </div>
              <div className='space-y-1.5'>
                <Label>CIDR</Label>
                <Input className='h-7' value={currentForm.wg_ip_cidr} onChange={(e) => setCurrentForm({ wg_ip_cidr: e.target.value })} type='number' min={1} max={32} />
              </div>
            </div>
          </div>

          <div className='rounded-md border bg-muted/10 p-2.5'>
            <div className='mb-2 text-[11px] font-medium text-muted-foreground'>Server</div>
            <div className='grid gap-x-2.5 gap-y-3 md:grid-cols-3'>
              <div className='space-y-1.5'>
                <Label>Server public IP</Label>
                <Input className='h-7' value={currentForm.srv_ip} onChange={(e) => setCurrentForm({ srv_ip: e.target.value })} placeholder='203.0.113.10' required />
              </div>
              <div className='space-y-1.5'>
                <Label>Listen port</Label>
                <Input className='h-7' value={currentForm.port_number} onChange={(e) => setCurrentForm({ port_number: e.target.value })} type='number' min={1} max={65535} />
              </div>
              <div className='space-y-1.5'>
                <Label>DNS</Label>
                <Input className='h-7' value={currentForm.srv_dns} onChange={(e) => setCurrentForm({ srv_dns: e.target.value })} placeholder='1.1.1.1' required />
              </div>
            </div>
          </div>

            {editingInterface ? (
              <div className='space-y-1.5 rounded-md border bg-muted/10 p-2.5'>
                <div className='text-muted-foreground'>Public Key</div>
                <div className='break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs'>{editingInterface.public_key}</div>
              </div>
            ) : null}

            <div className='space-y-1.5 rounded-md border bg-muted/10 p-2.5'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <Label>AWG params</Label>
                <div className='flex flex-wrap items-center gap-2'>
                  <select
                    className='h-7 rounded-md border bg-background px-2 text-xs'
                    value={currentPreset}
                    onChange={(e) => onApplyPreset(e.target.value as Preset)}
                    disabled={currentForm.awg_version !== '2'}
                  >
                    <option value='none'>Protocol preset</option>
                    <option value='quic'>QUIC-like</option>
                    <option value='dns'>DNS-like</option>
                    <option value='sip'>SIP-like</option>
                  </select>
                  <Button type='button' variant='outline' size='sm' onClick={() => void onGenerateParams()} disabled={generatingCurrentParams}>
                    <Sparkles className='size-4' />
                    {generatingCurrentParams ? 'Generating...' : 'Generate params'}
                  </Button>
                </div>
              </div>
              {currentConfigPreview ? (
                <pre className='max-h-[220px] overflow-auto rounded-xl border bg-muted p-3 text-xs'>
                  {currentConfigPreview}
                </pre>
              ) : (
                <p className='text-[11px] text-muted-foreground'>
                  Use presets and generator for normal setup. Raw JSON is optional and hidden by default.
                </p>
              )}
            </div>
        </div>
      </AwgEditorWindow>

      <div className='flex min-h-0 flex-1 flex-col gap-2 text-xs'>
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' onClick={openCreateDialog}><Plus />Add</Button>
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
                {interfaceColumnOrder.map((key) => (
                  <SortableHead key={key} sortKey={key} label={interfaceColumnLabels[key]} sort={sort} onSort={(next) => setSort((prev) => nextSortState(prev, next))} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((it) => (
                <TableRow
                  key={it.id}
                  className={selectableAwgRowClass(selected?.id === it.id, it.enabled === false)}
                  onClick={() => selectInterface(it)}
                  onDoubleClick={() => openInterfaceEditor(it)}
                >
                  {interfaceColumnOrder.map((key) => (
                    <React.Fragment key={key}>{renderInterfaceCell(it, key)}</React.Fragment>
                  ))}
                </TableRow>
              ))}
              {!items.length && !isLoading ? <EmptyRow colSpan={interfaceColumnOrder.length} text='No interfaces found.' /> : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
