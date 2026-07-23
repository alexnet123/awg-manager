import * as React from 'react'
import { Copy, Eye, EyeOff, KeyRound, Loader2, Plus, RotateCcw, Save, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type AuthState } from '@/frontend/domains/common/api'
import {
  applyNtpConfig,
  getNtpConfig,
  getNtpStatus,
  getNtpTimezones,
  type NtpConfig,
  type NtpKey,
  type NtpStatus,
  putNtpConfig,
  reloadNtp,
  restartNtp,
  setNtpManualTime,
  setNtpTimezone,
} from '@/frontend/domains/ntp/api'
import { useDraggableWindow } from './firewall/useDraggableWindow'

type NtpTab = 'time' | 'sources' | 'access' | 'clients' | 'status'
type EditorMode = 'add' | 'edit'
type SourceType = 'server' | 'pool'
type AccessAction = 'allow' | 'deny'
type KeyAlgorithm = NtpKey['algorithm']
type SortDirection = 'asc' | 'desc'
type SourceColumnKey = 'type' | 'address' | 'min_poll' | 'max_poll' | 'iburst' | 'auth_key' | 'options'
type AccessColumnKey = 'action' | 'network'
type ClientStatusColumnKey = 'address' | 'ntp_packets' | 'ntp_drops' | 'ntp_interval' | 'ntp_last' | 'command_packets' | 'command_drops' | 'command_last'
type SourceStatusColumnKey = 'state' | 'address' | 'stratum' | 'poll' | 'reach' | 'last_rx' | 'adjusted_offset' | 'estimated_error'
type SortState<K extends string> = { key: K | null; dir: SortDirection }

type SourceRow = {
  id: string
  enabled: boolean
  type: SourceType
  address: string
  min_poll: string
  max_poll: string
  iburst: boolean
  auth_key: string
  options: string
  comment: string
}

type AccessRow = {
  id: string
  enabled: boolean
  action: AccessAction
  network: string
  comment: string
}

type KeyRow = {
  rowId: string
  enabled: boolean
  id: string
  algorithm: KeyAlgorithm
  secret: string
  comment: string
}

type TimeConfig = {
  id: 'time'
  ntp_enabled: boolean
  rtcsync: boolean
  timezone: string
  current_date: string
  current_time: string
}

type ServerConfig = {
  id: 'server'
  enabled: boolean
  use_local_clock: boolean
  local_stratum: string
  bind_address: string
  bind_interface: string
  listen_port: string
  orphan_mode: boolean
  rate_limit_enabled: boolean
  rate_interval: string
  rate_burst: string
  collect_client_statistics: boolean
  client_log_limit: string
  auth_key: string
}

type EditorForm = {
  id?: string
  enabled?: boolean
  type?: SourceType
  action?: AccessAction
  address?: string
  min_poll?: string
  max_poll?: string
  iburst?: boolean
  auth_key?: string
  options?: string
  comment?: string
  network?: string
  ntp_enabled?: boolean
  rtcsync?: boolean
  timezone?: string
  current_date?: string
  current_time?: string
  use_local_clock?: boolean
  local_stratum?: string
  bind_address?: string
}

type KeyEditorForm = {
  rowId?: string
  enabled: boolean
  id: string
  algorithm: KeyAlgorithm
  secret: string
  comment: string
}

const initialTime: TimeConfig = {
  id: 'time',
  ntp_enabled: true,
  rtcsync: true,
  timezone: 'Europe/Moscow',
  current_date: '2026-06-25',
  current_time: '12:00:00',
}
const initialServer: ServerConfig = {
  id: 'server',
  enabled: false,
  use_local_clock: false,
  local_stratum: '10',
  bind_address: '',
  bind_interface: '',
  listen_port: '123',
  orphan_mode: false,
  rate_limit_enabled: true,
  rate_interval: '3',
  rate_burst: '8',
  collect_client_statistics: true,
  client_log_limit: '1048576',
  auth_key: 'none',
}

const initialSources: SourceRow[] = [
  { id: 'src-1', enabled: true, type: 'server', address: '89.109.251.21', min_poll: '6', max_poll: '10', iburst: true, auth_key: 'none', options: 'prefer', comment: 'primary upstream' },
  { id: 'src-2', enabled: true, type: 'server', address: '89.109.251.22', min_poll: '6', max_poll: '10', iburst: true, auth_key: 'none', options: '', comment: 'backup upstream' },
]

const initialAccess: AccessRow[] = [
  { id: 'access-1', enabled: true, action: 'allow', network: '10.0.0.0/24', comment: 'LAN clients' },
]

const initialKeys: KeyRow[] = []
const editorStartPosition = { x: 420, y: 96 }
const fallbackTimezoneOptions = ['UTC', 'Europe/Moscow', 'Europe/Berlin', 'Europe/London', 'Asia/Dubai', 'Asia/Almaty', 'America/New_York']
const configRefreshMs = 5_000
const statusRefreshMs = 15_000
const keyAlgorithms: KeyAlgorithm[] = ['SHA256', 'SHA384', 'SHA512', 'SHA1', 'MD5']
const keySecretLengths: Record<KeyAlgorithm, number> = {
  MD5: 32,
  SHA1: 40,
  SHA256: 64,
  SHA384: 96,
  SHA512: 128,
}

function generateChronySecret(algorithm: KeyAlgorithm) {
  const length = keySecretLengths[algorithm]
  const bytes = new Uint8Array(Math.ceil(length / 2))
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length)
}

function selectableRowClass(selected: boolean, disabled = false, hasComment = false) {
  const base = `${hasComment ? 'h-9' : 'h-8'} cursor-default select-none`
  if (disabled) return `${base} bg-amber-50 text-amber-950 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-900/40`
  return `${base} hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selected ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''}`
}

function CommentedCell(props: { comment: string; children: React.ReactNode; className?: string }) {
  return (
    <TableCell className={`${props.comment ? 'relative align-bottom pb-0.5 pt-2' : ''} ${props.className || ''}`}>
      {props.comment ? (
        <div className='pointer-events-none absolute left-2 top-0.5 z-10 whitespace-nowrap text-[10px] font-bold leading-none text-black'>
          # {props.comment}
        </div>
      ) : null}
      <span className={props.comment ? 'block pt-1' : ''}>{props.children}</span>
    </TableCell>
  )
}

function statusBadge(value?: string | boolean) {
  const text = typeof value === 'boolean' ? (value ? 'enabled' : 'disabled') : (value || '-')
  const normalized = text.toLowerCase()
  const successStatuses = new Set(['enabled', 'yes', 'online', 'active', 'synchronized', 'normal', 'current', 'client', 'server', 'selected', '+'])
  const warningStatuses = new Set(['checking', 'waiting', 'unknown', 'not managed', 'pending apply', '~'])
  const dangerStatuses = new Set(['disabled', 'no', 'offline', 'inactive', 'failed', 'error', 'unsynchronized', '-', '?', 'x'])
  const className = successStatuses.has(normalized)
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : dangerStatuses.has(normalized)
      ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
      : warningStatuses.has(normalized)
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300'
  return <Badge variant='outline' className={className}>{text}</Badge>
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
  if (typeof value === 'boolean') return value ? 1 : 0
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

const sourceColumnOrder: SourceColumnKey[] = ['type', 'address', 'min_poll', 'max_poll', 'iburst', 'auth_key', 'options']
const sourceColumnLabels: Record<SourceColumnKey, string> = {
  type: 'Type',
  address: 'Address',
  min_poll: 'Min Poll',
  max_poll: 'Max Poll',
  iburst: 'IBurst',
  auth_key: 'Auth. Key',
  options: 'Options',
}

const accessColumnOrder: AccessColumnKey[] = ['action', 'network']
const accessColumnLabels: Record<AccessColumnKey, string> = {
  action: 'Action',
  network: 'Network',
}
const clientStatusColumnOrder: ClientStatusColumnKey[] = ['address', 'ntp_packets', 'ntp_drops', 'ntp_interval', 'ntp_last', 'command_packets', 'command_drops', 'command_last']
const clientStatusColumnLabels: Record<ClientStatusColumnKey, string> = {
  address: 'Address',
  ntp_packets: 'NTP packets',
  ntp_drops: 'NTP dropped',
  ntp_interval: 'NTP interval',
  ntp_last: 'Last NTP',
  command_packets: 'Command packets',
  command_drops: 'Command dropped',
  command_last: 'Last command',
}
const sourceStatusColumnOrder: SourceStatusColumnKey[] = ['state', 'address', 'stratum', 'poll', 'reach', 'last_rx', 'adjusted_offset', 'estimated_error']
const sourceStatusColumnLabels: Record<SourceStatusColumnKey, string> = {
  state: 'State',
  address: 'Address',
  stratum: 'Stratum',
  poll: 'Poll',
  reach: 'Reach',
  last_rx: 'Last Rx',
  adjusted_offset: 'Offset',
  estimated_error: 'Error',
}

function getZonedTime(timezone: string, epochSeconds?: number) {
  try {
    const value = typeof epochSeconds === 'number' ? new Date(epochSeconds * 1000) : new Date()
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    if (!values.year || !values.month || !values.day || !values.hour || !values.minute || !values.second) return null
    return {
      current_date: `${values.year}-${values.month}-${values.day}`,
      current_time: `${values.hour}:${values.minute}:${values.second}`,
    }
  } catch {
    return null
  }
}

function getZonedNow(timezone: string) {
  return getZonedTime(timezone)
}

function getTimezoneOffsetMinutes(timezone: string, epochSeconds?: number) {
  try {
    const value = typeof epochSeconds === 'number' ? new Date(epochSeconds * 1000) : new Date()
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value)
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    if (!values.year || !values.month || !values.day || !values.hour || !values.minute || !values.second) return null
    const zonedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    return Math.round((zonedAsUtc - value.getTime()) / 60000)
  } catch {
    return null
  }
}

function formatTimezoneOffset(timezone: string, epochSeconds?: number) {
  const offsetMinutes = getTimezoneOffsetMinutes(timezone, epochSeconds)
  if (offsetMinutes === null) return '-'
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absoluteMinutes = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')
  const minutes = String(absoluteMinutes % 60).padStart(2, '0')
  return `UTC${sign}${hours}:${minutes}`
}

function localStateFromConfig(config: NtpConfig) {
  const zonedNow = getZonedNow(config.time.timezone) || { current_date: '', current_time: '' }
  return {
    time: {
      id: 'time' as const,
      ntp_enabled: config.time.ntp_enabled,
      rtcsync: config.time.rtcsync,
      timezone: config.time.timezone,
      ...zonedNow,
    },
    server: {
      id: 'server' as const,
      ...config.server,
      local_stratum: String(config.server.local_stratum),
      listen_port: String(config.server.listen_port),
      rate_interval: String(config.server.rate_interval),
      rate_burst: String(config.server.rate_burst),
      client_log_limit: String(config.server.client_log_limit),
    },
    sources: config.sources.map((source, index) => ({
      id: `src-${index + 1}`,
      ...source,
      min_poll: String(source.min_poll),
      max_poll: String(source.max_poll),
    })),
    accessRules: config.access.map((rule, index) => ({ id: `access-${index + 1}`, ...rule })),
    keys: (config.keys || []).map((key, index) => ({
      rowId: `key-${index + 1}`,
      ...key,
    })),
  }
}

function backendConfigFromState(time: TimeConfig, server: ServerConfig, sources: SourceRow[], accessRules: AccessRow[], keys: KeyRow[]): NtpConfig {
  return {
    schema_version: 1,
    time: { timezone: time.timezone.trim(), ntp_enabled: time.ntp_enabled, rtcsync: time.rtcsync },
    sources: sources.map(({ id: _id, ...source }) => ({
      ...source,
      min_poll: Number(source.min_poll),
      max_poll: Number(source.max_poll),
    })),
    server: {
      enabled: server.enabled,
      use_local_clock: server.use_local_clock,
      local_stratum: Number(server.local_stratum),
      bind_address: server.bind_address,
      bind_interface: server.bind_interface,
      listen_port: Number(server.listen_port || initialServer.listen_port),
      orphan_mode: server.orphan_mode,
      rate_limit_enabled: server.rate_limit_enabled,
      rate_interval: Number(server.rate_interval),
      rate_burst: Number(server.rate_burst),
      collect_client_statistics: true,
      client_log_limit: Number(server.client_log_limit || initialServer.client_log_limit),
      auth_key: server.auth_key,
    },
    access: accessRules.map(({ id: _id, ...rule }) => rule),
    keys: keys.map(({ rowId: _rowId, ...key }) => key),
  }
}

function configSignature(config: NtpConfig | null) {
  if (!config) return ''
  return JSON.stringify({
    time: config.time,
    sources: config.sources,
    server: config.server,
    access: config.access,
    keys: config.keys || [],
  })
}

function formatSeconds(value?: number) {
  if (typeof value !== 'number') return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(6)}s`
}

function formatOptionalSeconds(value?: number | null) {
  if (typeof value !== 'number') return '-'
  return `${value}s`
}

function formatReferenceTime(value: number | undefined, timezone: string) {
  if (!value) return null
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(value * 1000))
    const [date, time = '-'] = formatted.split(', ')
    return { date, time }
  } catch {
    const iso = new Date(value * 1000).toISOString()
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) }
  }
}

function EmptyRow(props: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={props.colSpan} className='h-24 text-center text-muted-foreground'>{props.text}</TableCell>
    </TableRow>
  )
}

function TableShell(props: { children: React.ReactNode }) {
  return <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>{props.children}</div>
}

function StatusTile(props: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className='rounded-xl border bg-background px-3 py-2'>
      <div className='text-[11px] font-medium text-muted-foreground'>{props.label}</div>
      <div className={`mt-1 truncate text-xs ${props.mono ? 'font-mono' : 'font-medium'}`}>{props.value}</div>
    </div>
  )
}

function EditorField(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid gap-1.5'>
      <Label>{props.label}</Label>
      {props.children}
    </div>
  )
}

function CompactRow(props: { label: string; children: React.ReactNode; align?: 'start' | 'center' }) {
  return (
    <div className={`grid gap-2 md:grid-cols-[150px_minmax(0,1fr)] ${props.align === 'start' ? 'items-start' : 'items-center'}`}>
      <Label className='pt-0.5 text-right text-xs font-medium text-foreground md:pt-1'>{props.label}</Label>
      <div className='min-w-0'>{props.children}</div>
    </div>
  )
}

function CompactSection(props: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className='rounded-xl bg-transparent p-0'>
      <div className='mb-2 px-2.5'>
        <div className='text-[12px] font-semibold'>{props.title}</div>
        {props.description ? <div className='mt-0.5 text-[11px] text-muted-foreground'>{props.description}</div> : null}
      </div>
      <div className='space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
        {props.children}
      </div>
    </section>
  )
}

function CompactCheckbox(props: { checked: boolean; onChange: (checked: boolean) => void; label: string; ariaLabel: string; disabled?: boolean }) {
  return (
    <label className={`flex h-7 w-full max-w-xl items-center gap-2 rounded-md border bg-background px-2.5 text-xs ${props.disabled ? 'text-muted-foreground opacity-70' : ''}`}>
      <input
        type='checkbox'
        disabled={props.disabled}
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        aria-label={props.ariaLabel}
      />
      {props.label}
    </label>
  )
}

function OptionalInputLine(props: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  inputLabel: string
  inactiveHint: string
  defaultValue: string
  placeholder?: string
}) {
  if (props.value) {
    return (
      <div className='relative'>
        <Input
          aria-label={props.inputLabel}
          disabled={props.disabled}
          className='h-8 pr-8 font-mono text-xs'
          placeholder={props.placeholder}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <button
          type='button'
          aria-label={`Clear ${props.inputLabel}`}
          className='absolute right-1 top-1 h-6 min-w-6 rounded border px-1 text-[11px] leading-5 text-foreground disabled:pointer-events-none disabled:opacity-50'
          onClick={() => props.onChange('')}
          disabled={props.disabled}
        >
          -
        </button>
      </div>
    )
  }
  return (
    <div className={`flex h-8 items-center justify-between rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground ${props.disabled ? 'opacity-70' : ''}`}>
      <span className='truncate pr-2'>{props.inactiveHint}</span>
      <button
        type='button'
        aria-label={`Add ${props.inputLabel}`}
        className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50'
        onClick={() => props.onChange(props.defaultValue)}
        disabled={props.disabled}
      >
        +
      </button>
    </div>
  )
}

function OptionalDefaultInputLine(props: {
  value: string
  onChange: (value: string) => void
  active: boolean
  onActiveChange: (active: boolean) => void
  disabled?: boolean
  inputLabel: string
  inactiveHint: string
  defaultValue: string
  placeholder?: string
  type?: React.HTMLInputTypeAttribute
  min?: string
  max?: string
}) {
  if (props.active || props.value !== props.defaultValue) {
    return (
      <div className='relative'>
        <Input
          aria-label={props.inputLabel}
          type={props.type}
          min={props.min}
          max={props.max}
          disabled={props.disabled}
          className='h-8 pr-8 font-mono text-xs'
          placeholder={props.placeholder}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <button
          type='button'
          aria-label={`Clear ${props.inputLabel}`}
          className='absolute right-1 top-1 h-6 min-w-6 rounded border px-1 text-[11px] leading-5 text-foreground disabled:pointer-events-none disabled:opacity-50'
          onClick={() => {
            props.onChange(props.defaultValue)
            props.onActiveChange(false)
          }}
          disabled={props.disabled}
        >
          -
        </button>
      </div>
    )
  }
  return (
    <div className={`flex h-8 items-center justify-between rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground ${props.disabled ? 'opacity-70' : ''}`}>
      <span className='truncate pr-2'>{props.inactiveHint}</span>
      <button
        type='button'
        aria-label={`Add ${props.inputLabel}`}
        className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50'
        onClick={() => props.onActiveChange(true)}
        disabled={props.disabled}
      >
        +
      </button>
    </div>
  )
}

function ServerField(props: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div className='min-w-0 rounded-md border bg-muted/10 p-2'>
      <div className='mb-1.5'>
        <Label className='text-xs font-semibold'>{props.label}</Label>
        <div className='mt-0.5 text-[10px] leading-3 text-muted-foreground'>{props.help}</div>
      </div>
      {props.children}
    </div>
  )
}

export function NtpPage(props: { auth: AuthState; refreshNonce: number }) {
  const [activeTab, setActiveTab] = React.useState<NtpTab>('time')
  const [time, setTime] = React.useState<TimeConfig>(initialTime)
  const [server, setServer] = React.useState<ServerConfig>(initialServer)
  const [sources, setSources] = React.useState<SourceRow[]>(initialSources)
  const [accessRules, setAccessRules] = React.useState<AccessRow[]>(initialAccess)
  const [keys, setKeys] = React.useState<KeyRow[]>(initialKeys)
  const [selectedIds, setSelectedIds] = React.useState<string[]>(['src-1'])
  const [sourceSort, setSourceSort] = React.useState<SortState<SourceColumnKey>>(emptySort<SourceColumnKey>())
  const [accessSort, setAccessSort] = React.useState<SortState<AccessColumnKey>>(emptySort<AccessColumnKey>())
  const [clientStatusSort, setClientStatusSort] = React.useState<SortState<ClientStatusColumnKey>>(emptySort<ClientStatusColumnKey>())
  const [sourceStatusSort, setSourceStatusSort] = React.useState<SortState<SourceStatusColumnKey>>(emptySort<SourceStatusColumnKey>())
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorTab, setEditorTab] = React.useState<NtpTab>('sources')
  const [editorMode, setEditorMode] = React.useState<EditorMode>('edit')
  const [editorForm, setEditorForm] = React.useState<EditorForm>({})
  const [editorError, setEditorError] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [messageKind, setMessageKind] = React.useState<'info' | 'error'>('info')
  const [savedConfig, setSavedConfig] = React.useState<NtpConfig | null>(null)
  const [appliedCurrent, setAppliedCurrent] = React.useState(true)
  const [runtimeStatus, setRuntimeStatus] = React.useState<NtpStatus | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [statusLoading, setStatusLoading] = React.useState(false)
  const [applying, setApplying] = React.useState(false)
  const [savingDesired, setSavingDesired] = React.useState(false)
  const [systemAction, setSystemAction] = React.useState<string | null>(null)
  const [manualTimeDirty, setManualTimeDirty] = React.useState(false)
  const [clockAnchor, setClockAnchor] = React.useState<{ epochSeconds: number; capturedAt: number } | null>(null)
  const [timezoneOptions, setTimezoneOptions] = React.useState<string[]>(fallbackTimezoneOptions)
  const [listenPortExpanded, setListenPortExpanded] = React.useState(false)
  const [authKeyExpanded, setAuthKeyExpanded] = React.useState(false)
  const [keyManagerOpen, setKeyManagerOpen] = React.useState(false)
  const [keyEditorOpen, setKeyEditorOpen] = React.useState(false)
  const [keyEditorMode, setKeyEditorMode] = React.useState<EditorMode>('add')
  const [keyEditorForm, setKeyEditorForm] = React.useState<KeyEditorForm>({ enabled: true, id: '', algorithm: 'SHA256', secret: '', comment: '' })
  const [keyEditorError, setKeyEditorError] = React.useState<string | null>(null)
  const [showKeySecret, setShowKeySecret] = React.useState(false)
  const [selectedKeyId, setSelectedKeyId] = React.useState('')
  const [timezoneSearchOpen, setTimezoneSearchOpen] = React.useState(false)
  const [timezoneSearchFiltering, setTimezoneSearchFiltering] = React.useState(false)
  const statusLoadingRef = React.useRef(false)
  const configLoadingRef = React.useRef(false)
  const { winPos, setWinPos, onDragStart } = useDraggableWindow(editorStartPosition)

  const configTab = activeTab !== 'status'
  const listTab = activeTab === 'sources' || activeTab === 'access'
  const desiredConfig = React.useMemo(() => backendConfigFromState(time, server, sources, accessRules, keys), [time, server, sources, accessRules, keys])
  const hasLocalConfigChanges = Boolean(savedConfig) && configSignature(desiredConfig) !== configSignature(savedConfig)
  const hasPendingApply = !appliedCurrent
  const authKeyOptions = React.useMemo(() => {
    const values = new Set<string>()
    keys.filter((key) => key.enabled).forEach((key) => values.add(key.id))
    if (server.auth_key && server.auth_key !== 'none') values.add(server.auth_key)
    sources.forEach((source) => {
      if (source.auth_key && source.auth_key !== 'none') values.add(source.auth_key)
    })
    return Array.from(values).sort((left, right) => Number(left) - Number(right) || left.localeCompare(right))
  }, [keys, server.auth_key, sources])
  const timezoneCatalog = React.useMemo(() => {
    const values = new Set([...timezoneOptions, time.timezone].map((item) => item.trim()).filter(Boolean))
    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [time.timezone, timezoneOptions])
  const timezoneMatches = React.useMemo(() => {
    const needle = time.timezone.trim().toLowerCase()
    if (timezoneSearchFiltering) {
      if (!needle) return timezoneCatalog
      return timezoneCatalog.filter((option) => option.toLowerCase().includes(needle))
    }
    const currentIndex = timezoneCatalog.findIndex((option) => option === time.timezone)
    if (currentIndex < 0) return timezoneCatalog.slice(0, 48)
    const nextOptions = timezoneCatalog.slice(currentIndex + 1, currentIndex + 41)
    const previousOptions = timezoneCatalog.slice(Math.max(0, currentIndex - 8), currentIndex)
    return [timezoneCatalog[currentIndex], ...nextOptions, ...previousOptions]
  }, [time.timezone, timezoneCatalog, timezoneSearchFiltering])
  const selectedTimezoneOffset = React.useMemo(
    () => formatTimezoneOffset(time.timezone, clockAnchor?.epochSeconds),
    [clockAnchor, time.timezone],
  )

  function showMessage(text: string | null, kind: 'info' | 'error' = 'info') {
    setMessageKind(kind)
    setMessage(text)
  }

  function showError(error: unknown) {
    showMessage(error instanceof Error ? error.message : String(error), 'error')
  }

  React.useEffect(() => {
    if (!message || messageKind === 'error') return
    const timeoutId = window.setTimeout(() => setMessage(null), 5000)
    return () => window.clearTimeout(timeoutId)
  }, [message, messageKind])

  React.useEffect(() => {
    let cancelled = false
    getNtpTimezones(props.auth)
      .then((items) => {
        if (cancelled || !items.length) return
        setTimezoneOptions(items)
      })
      .catch(() => {
        if (!cancelled) setTimezoneOptions(fallbackTimezoneOptions)
      })
    return () => { cancelled = true }
  }, [props.auth, props.refreshNonce])

  const hydrateConfig = React.useCallback((config: NtpConfig) => {
    const local = localStateFromConfig(config)
    setTime(local.time)
    setServer(local.server)
    setListenPortExpanded(local.server.listen_port !== initialServer.listen_port)
    setAuthKeyExpanded(local.server.auth_key !== initialServer.auth_key)
    setSources(local.sources)
    setAccessRules(local.accessRules)
    setKeys(local.keys)
    setSelectedKeyId(local.keys[0]?.id || '')
    setSavedConfig(config)
    setAppliedCurrent(config.applied_current !== false)
    setManualTimeDirty(false)
    setSelectedIds(local.sources[0] ? [local.sources[0].id] : [])
  }, [])

  const refreshStatus = React.useCallback(async () => {
    if (statusLoadingRef.current) return
    statusLoadingRef.current = true
    setStatusLoading(true)
    try {
      const nextStatus = await getNtpStatus(props.auth)
      setRuntimeStatus(nextStatus)
      if (typeof nextStatus.current_time === 'number') {
        setClockAnchor({ epochSeconds: nextStatus.current_time, capturedAt: Date.now() })
      }
    } catch (error) {
      showError(error)
    } finally {
      statusLoadingRef.current = false
      setStatusLoading(false)
    }
  }, [props.auth])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    showMessage(null)
    getNtpConfig(props.auth)
      .then((config) => {
        if (cancelled) return
        hydrateConfig(config)
        showMessage(null)
      })
      .catch((error) => {
        if (!cancelled) showError(error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    void refreshStatus()
    return () => { cancelled = true }
  }, [hydrateConfig, props.auth, props.refreshNonce, refreshStatus])

  React.useEffect(() => {
    if ((activeTab !== 'time' && activeTab !== 'status') || loading) return
    void refreshStatus()
    const intervalId = window.setInterval(() => { void refreshStatus() }, statusRefreshMs)
    return () => window.clearInterval(intervalId)
  }, [activeTab, loading, refreshStatus])

  React.useEffect(() => {
    if (loading || savingDesired || applying || systemAction || editorOpen || keyManagerOpen || manualTimeDirty || hasLocalConfigChanges) return
    let cancelled = false
    const refreshConfig = async () => {
      if (document.visibilityState === 'hidden' || configLoadingRef.current) return
      configLoadingRef.current = true
      try {
        const config = await getNtpConfig(props.auth)
        if (cancelled) return
        const remoteSignature = configSignature(config)
        const savedSignature = configSignature(savedConfig)
        if (remoteSignature !== savedSignature || config.applied_current !== savedConfig?.applied_current) {
          hydrateConfig(config)
        }
      } catch {
        // Background sync is best-effort; explicit Refresh still reports errors.
      } finally {
        configLoadingRef.current = false
      }
    }
    const intervalId = window.setInterval(() => { void refreshConfig() }, configRefreshMs)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [applying, editorOpen, hasLocalConfigChanges, hydrateConfig, keyManagerOpen, loading, manualTimeDirty, props.auth, savedConfig, savingDesired, systemAction])

  React.useEffect(() => {
    if (loading || manualTimeDirty || !clockAnchor) return
    const updateDisplayedTime = () => {
      const elapsedSeconds = (Date.now() - clockAnchor.capturedAt) / 1000
      const zonedNow = getZonedTime(time.timezone, clockAnchor.epochSeconds + elapsedSeconds)
      if (!zonedNow) return
      setTime((prev) => ({ ...prev, ...zonedNow }))
    }
    updateDisplayedTime()
    const intervalId = window.setInterval(updateDisplayedTime, 1000)
    return () => window.clearInterval(intervalId)
  }, [clockAnchor, loading, manualTimeDirty, time.timezone])

  function selectRow(id: string, event: React.MouseEvent) {
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
      return
    }
    setSelectedIds([id])
  }

  function nextId(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}`
  }

  function openCreate() {
    setEditorError(null)
    if (activeTab === 'sources') {
      setEditorTab('sources')
      setEditorMode('add')
      setEditorForm({ id: nextId('src'), enabled: true, type: 'server', address: '', min_poll: '6', max_poll: '10', iburst: true, auth_key: 'none', options: '', comment: '' })
      setWinPos(editorStartPosition)
      setEditorOpen(true)
    }
    if (activeTab === 'access') {
      setEditorTab('access')
      setEditorMode('add')
      setEditorForm({ id: nextId('access'), enabled: true, action: 'allow', network: '', comment: '' })
      setWinPos(editorStartPosition)
      setEditorOpen(true)
    }
  }

  function openEdit(tab: NtpTab, row?: SourceRow | AccessRow | TimeConfig) {
    setEditorError(null)
    setEditorTab(tab)
    setEditorMode('edit')
    if (tab === 'time') setEditorForm({ ...time })
    if (tab === 'sources') setEditorForm({ ...(row as SourceRow) })
    if (tab === 'access') setEditorForm({ ...(row as AccessRow) })
    setWinPos(editorStartPosition)
    setEditorOpen(true)
  }

  function copyEditorItem() {
    if (editorTab !== 'sources' && editorTab !== 'access') return
    setEditorError(null)
    setEditorMode('add')
    setEditorForm((prev) => ({
      ...prev,
      id: nextId(editorTab === 'sources' ? 'src' : 'access'),
      ...(editorTab === 'sources' ? { address: '' } : { network: '' }),
    }))
  }

  async function saveDesiredConfig(nextTime: TimeConfig, nextServer: ServerConfig, nextSources: SourceRow[], nextAccessRules: AccessRow[], nextKeys = keys) {
    setSavingDesired(true)
    showMessage(null)
    try {
      const normalized = await putNtpConfig(props.auth, backendConfigFromState(nextTime, nextServer, nextSources, nextAccessRules, nextKeys))
      setSavedConfig(normalized)
      setAppliedCurrent(false)
      showMessage('Desired NTP configuration saved. Use Apply on Time to activate Chrony.')
      return normalized
    } catch (error) {
      showError(error)
      throw error
    } finally {
      setSavingDesired(false)
    }
  }

  async function saveAndApplySources(nextSources: SourceRow[], preservedSelectedIds = selectedIds) {
    setSavingDesired(true)
    showMessage(null)
    try {
      const preservedSourceKeys = new Set(
        nextSources
          .filter((item) => preservedSelectedIds.includes(item.id))
          .map((item) => `${item.type}:${item.address}`)
      )
      const base = savedConfig ? localStateFromConfig(savedConfig) : { time, server, sources, accessRules, keys }
      const normalized = await putNtpConfig(props.auth, backendConfigFromState(base.time, base.server, nextSources, base.accessRules, base.keys))
      const result = await applyNtpConfig(props.auth)
      hydrateConfig(normalized)
      const normalizedState = localStateFromConfig(normalized)
      setSelectedIds(normalizedState.sources.filter((item) => preservedSourceKeys.has(`${item.type}:${item.address}`)).map((item) => item.id))
      setAppliedCurrent(true)
      await refreshStatus()
      showMessage(result.applied ? 'NTP source changes applied. Chrony is active.' : 'NTP source changes were saved but not activated.')
      return normalized
    } catch (error) {
      showError(error)
      throw error
    } finally {
      setSavingDesired(false)
    }
  }

  async function deleteSelected() {
    if (activeTab === 'sources') {
      const nextSources = sources.filter((item) => !selectedIds.includes(item.id))
      setSources(nextSources)
      setSelectedIds([])
      await saveAndApplySources(nextSources, [])
      return
    }
    if (activeTab === 'access') {
      const nextAccessRules = accessRules.filter((item) => !selectedIds.includes(item.id))
      setAccessRules(nextAccessRules)
      setSelectedIds([])
      await saveDesiredConfig(time, server, sources, nextAccessRules)
      return
    }
    setSelectedIds([])
  }

  async function setSelectedEnabled(enabled: boolean) {
    if (activeTab === 'time') setTime((prev) => ({ ...prev, ntp_enabled: enabled }))
    if (activeTab === 'sources') {
      const nextSources = sources.map((item) => selectedIds.includes(item.id) ? { ...item, enabled } : item)
      setSources(nextSources)
      await saveAndApplySources(nextSources)
    }
    if (activeTab === 'access') {
      const nextAccessRules = accessRules.map((item) => selectedIds.includes(item.id) ? { ...item, enabled } : item)
      setAccessRules(nextAccessRules)
      await saveDesiredConfig(time, server, sources, nextAccessRules)
    }
  }

  async function saveEditor(event: React.FormEvent) {
    event.preventDefault()
    setEditorError(null)
    if (editorTab === 'time') {
      setTime({
        id: 'time',
        ntp_enabled: editorForm.ntp_enabled ?? editorForm.enabled ?? true,
        rtcsync: editorForm.rtcsync ?? true,
        timezone: editorForm.timezone || 'UTC',
        current_date: editorForm.current_date || '',
        current_time: editorForm.current_time || '',
      })
    }
    if (editorTab === 'sources') {
      const address = String(editorForm.address || '').trim()
      if (!address) {
        setEditorError('Address is required.')
        return
      }
      const row: SourceRow = {
        id: editorForm.id || nextId('src'),
        enabled: editorForm.enabled !== false,
        type: editorForm.type || 'server',
        address,
        min_poll: editorForm.min_poll || '6',
        max_poll: editorForm.max_poll || '10',
        iburst: Boolean(editorForm.iburst),
        auth_key: editorForm.auth_key || 'none',
        options: editorForm.options || '',
        comment: editorForm.comment || '',
      }
      const nextSources = editorMode === 'add' ? [...sources, row] : sources.map((item) => item.id === row.id ? row : item)
      await saveAndApplySources(nextSources)
      setSources(nextSources)
      setSelectedIds([row.id])
      setEditorOpen(false)
      return
    }
    if (editorTab === 'access') {
      const network = String(editorForm.network || '').trim()
      if (!network) {
        setEditorError('Network is required.')
        return
      }
      const row: AccessRow = {
        id: editorForm.id || nextId('access'),
        enabled: editorForm.enabled !== false,
        action: editorForm.action || 'allow',
        network,
        comment: editorForm.comment || '',
      }
      const nextAccessRules = editorMode === 'add' ? [...accessRules, row] : accessRules.map((item) => item.id === row.id ? row : item)
      await saveDesiredConfig(time, server, sources, nextAccessRules)
      setAccessRules(nextAccessRules)
      setSelectedIds([row.id])
      setEditorOpen(false)
      return
    }
    setEditorOpen(false)
  }

  function updateTimezone(nextTimezone: string) {
    const normalizedTimezone = nextTimezone.trim()
    const zonedNow = getZonedNow(normalizedTimezone)
    setTime((prev) => ({
      ...prev,
      timezone: normalizedTimezone,
      ...(zonedNow || {}),
    }))
  }

  async function controlService(action: 'restart' | 'reload') {
    setSystemAction(action)
    showMessage(null)
    try {
      const result = action === 'restart' ? await restartNtp(props.auth) : await reloadNtp(props.auth)
      await refreshStatus()
      showMessage(`Chrony ${result.action} completed; service is ${result.service}.`)
    } catch (error) {
      showError(error)
    } finally {
      setSystemAction(null)
    }
  }

  async function applyChanges() {
    setApplying(true)
    showMessage(null)
    try {
      const normalized = await putNtpConfig(props.auth, desiredConfig)
      const result = await applyNtpConfig(props.auth)
      await setNtpTimezone(props.auth, normalized.time.timezone)
      if (!normalized.time.ntp_enabled && manualTimeDirty) {
        await setNtpManualTime(props.auth, time.current_date, time.current_time)
      }
      hydrateConfig(normalized)
      setAppliedCurrent(true)
      await refreshStatus()
      showMessage(result.applied ? 'NTP configuration applied. Chrony is active.' : 'NTP configuration was saved but not activated.')
    } catch (error) {
      showError(error)
    } finally {
      setApplying(false)
    }
  }

  function nextKeyId() {
    const existing = new Set(keys.map((key) => key.id))
    for (let value = 1; value < 10000; value += 1) {
      const candidate = String(value)
      if (!existing.has(candidate)) return candidate
    }
    return String(Date.now())
  }

  function keyReferences(keyId: string) {
    const references: string[] = []
    if (server.auth_key === keyId) references.push('server')
    sources.forEach((source) => {
      if (source.auth_key === keyId) references.push(source.comment || source.address || 'source')
    })
    return references
  }

  function openCreateKey() {
    setKeyEditorError(null)
    setShowKeySecret(false)
    setKeyEditorMode('add')
    setKeyEditorForm({ enabled: true, id: nextKeyId(), algorithm: 'SHA256', secret: '', comment: '' })
    setKeyEditorOpen(true)
  }

  function openEditKey(key: KeyRow) {
    setKeyEditorError(null)
    setShowKeySecret(false)
    setKeyEditorMode('edit')
    setKeyEditorForm({ rowId: key.rowId, enabled: key.enabled, id: key.id, algorithm: key.algorithm, secret: '', comment: key.comment })
    setKeyEditorOpen(true)
  }

  function generateKeyEditorSecret() {
    setKeyEditorForm((prev) => ({ ...prev, secret: generateChronySecret(prev.algorithm) }))
    setShowKeySecret(true)
  }

  function deleteSelectedKey() {
    const selected = keys.find((key) => key.id === selectedKeyId)
    if (!selected) return
    const references = keyReferences(selected.id)
    if (references.length) {
      setKeyEditorError(`Key ${selected.id} is used by ${references.join(', ')}. Clear references before deleting.`)
      return
    }
    const nextKeys = keys.filter((key) => key.id !== selected.id)
    setKeys(nextKeys)
    setSelectedKeyId(nextKeys[0]?.id || '')
    setKeyEditorError(null)
    showMessage('NTP key removed from desired configuration. Press Apply to write Chrony keys.')
  }

  function setSelectedKeyEnabled(enabled: boolean) {
    const selected = keys.find((key) => key.id === selectedKeyId)
    if (!selected) return
    const references = keyReferences(selected.id)
    if (!enabled && references.length) {
      setKeyEditorError(`Key ${selected.id} is used by ${references.join(', ')}. Clear references before disabling.`)
      return
    }
    setKeys((prev) => prev.map((key) => key.id === selected.id ? { ...key, enabled } : key))
    setKeyEditorError(null)
    showMessage(`NTP key ${selected.id} ${enabled ? 'enabled' : 'disabled'} in desired configuration. Press Apply to write Chrony keys.`)
  }

  function saveKeyEditor(event: React.FormEvent) {
    event.preventDefault()
    setKeyEditorError(null)
    const keyId = keyEditorForm.id.trim()
    if (!/^[1-9][0-9]*$/.test(keyId)) {
      setKeyEditorError('Key ID must be a positive number.')
      return
    }
    const duplicate = keys.some((key) => key.id === keyId && key.rowId !== keyEditorForm.rowId)
    if (duplicate) {
      setKeyEditorError(`Key ${keyId} already exists.`)
      return
    }
    const existing = keys.find((key) => key.rowId === keyEditorForm.rowId)
    const secret = keyEditorForm.secret || existing?.secret || ''
    if (!secret.trim()) {
      setKeyEditorError('Secret is required.')
      return
    }
    const row: KeyRow = {
      rowId: keyEditorForm.rowId || nextId('key'),
      enabled: keyEditorForm.enabled,
      id: keyId,
      algorithm: keyEditorForm.algorithm,
      secret: secret.trim(),
      comment: keyEditorForm.comment.trim(),
    }
    setKeys((prev) => keyEditorMode === 'add' ? [...prev, row] : prev.map((key) => key.rowId === row.rowId ? row : key))
    setSelectedKeyId(row.id)
    setKeyEditorOpen(false)
    showMessage(`NTP key ${row.id} saved in desired configuration. Press Apply to write Chrony keys.`)
  }

  function renderToolbar() {
    if (activeTab === 'time') return null
    if (activeTab === 'clients') {
      return (
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' variant='outline' disabled={statusLoading} onClick={refreshStatus}>{statusLoading ? <Loader2 className='animate-spin' /> : <RotateCcw />}Refresh client status</Button>
        </div>
      )
    }
    if (activeTab === 'status') {
      return (
        <div className='flex flex-wrap gap-2'>
          <Button size='sm' variant='outline' disabled={statusLoading} onClick={refreshStatus}>{statusLoading ? <Loader2 className='animate-spin' /> : <RotateCcw />}Refresh source status</Button>
          <Button size='sm' variant='outline' disabled={systemAction !== null} onClick={() => controlService('restart')}>{systemAction === 'restart' ? <Loader2 className='animate-spin' /> : null}Restart</Button>
          <Button size='sm' variant='outline' disabled={systemAction !== null} onClick={() => controlService('reload')}>{systemAction === 'reload' ? <Loader2 className='animate-spin' /> : null}Reload</Button>
        </div>
      )
    }
    const rows = activeTab === 'sources' ? sources : accessRules
    const selectedRows = rows.filter((item) => selectedIds.includes(item.id))
    const hasSelection = selectedRows.length > 0
    const canDisableSelection = selectedRows.some((item) => item.enabled)
    const canEnableSelection = selectedRows.some((item) => !item.enabled)
    return (
      <div className='flex flex-wrap gap-2'>
        {listTab ? (
          <>
            <Button size='sm' disabled={loading || savingDesired} onClick={openCreate}><Plus />Add</Button>
            <Button size='sm' variant='destructive' disabled={loading || savingDesired || !hasSelection} onClick={deleteSelected}>Del</Button>
          </>
        ) : (
          <Button size='sm' onClick={() => openEdit(activeTab)}>Edit</Button>
        )}
        <Button size='sm' variant='outline' disabled={loading || savingDesired || !canDisableSelection} onClick={() => setSelectedEnabled(false)}>{savingDesired ? <Loader2 className='animate-spin' /> : null}Disable</Button>
        <Button size='sm' disabled={loading || savingDesired || !canEnableSelection} onClick={() => setSelectedEnabled(true)}>Enable</Button>
      </div>
    )
  }

  function renderTimePanel() {
    const statusReady = runtimeStatus !== null
    const appliedTime = savedConfig?.time || time
    const appliedNtpEnabled = appliedTime.ntp_enabled
    const selectedSource = statusReady ? (runtimeStatus.sources.find((item) => item.state === '*')?.address || sources.find((item) => item.enabled)?.address || '-') : 'checking...'
    const synchronized = runtimeStatus?.tracking?.leap_status === 'Normal'
    const lastSync = appliedNtpEnabled ? formatReferenceTime(runtimeStatus?.tracking?.reference_time, time.timezone) : null
    const ntpSyncStatus = hasPendingApply
      ? 'pending apply'
      : !statusReady && appliedNtpEnabled
        ? 'checking'
        : appliedNtpEnabled
          ? (synchronized ? 'synchronized' : 'waiting')
          : 'disabled'
    const systemOffset = statusReady ? formatSeconds(runtimeStatus.tracking?.system_time) : 'checking...'
    const serviceStatus = !statusReady ? 'checking' : runtimeStatus.service.active ? 'active' : runtimeStatus.service.state
    const lastSyncValue = !appliedNtpEnabled
      ? 'disabled'
      : !statusReady
        ? 'checking...'
        : lastSync
          ? <><span className='block'>{lastSync.date}</span><span className='block'>{lastSync.time}</span></>
          : '-'

    return (
      <div className='min-w-0 rounded-xl border bg-muted/5 p-3'>
        <div className='grid gap-2 md:grid-cols-4 xl:grid-cols-8'>
          <StatusTile
            label='System time'
            value={<><span className='block'>{time.current_date || '-'}</span><span className='block'>{time.current_time || '-'}</span></>}
            mono
          />
          <StatusTile label='Timezone' value={time.timezone || '-'} mono />
          <StatusTile label='NTP sync' value={statusBadge(ntpSyncStatus)} />
          <StatusTile label='System offset' value={systemOffset} mono />
          <StatusTile label='Last sync' value={lastSyncValue} mono />
          <StatusTile label='Selected source' value={selectedSource} mono />
          <StatusTile label='Service' value={statusBadge(serviceStatus)} />
          <StatusTile label='RTC sync' value={statusBadge(appliedTime.rtcsync)} />
        </div>

        <div className='mt-3 grid items-stretch gap-3 lg:grid-cols-3'>
          <div className='flex h-full flex-col rounded-xl border bg-background p-3'>
            <div className='mb-3'>
              <div className='text-xs font-medium'>Manual time</div>
              <p className='text-[11px] text-muted-foreground'>Set date and time with the main Apply when NTP sync is disabled.</p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
              <EditorField label='Date'>
                <Input aria-label='Date' type='date' disabled={time.ntp_enabled} className='h-8 font-mono text-xs' value={time.current_date} onChange={(event) => { setManualTimeDirty(true); setTime((prev) => ({ ...prev, current_date: event.target.value })) }} />
              </EditorField>
              <EditorField label='Time'>
                <Input aria-label='Time' type='time' step='1' disabled={time.ntp_enabled} className='h-8 font-mono text-xs' value={time.current_time} onChange={(event) => { setManualTimeDirty(true); setTime((prev) => ({ ...prev, current_time: event.target.value })) }} />
              </EditorField>
            </div>
          </div>

          <div className='flex h-full flex-col rounded-xl border bg-background p-3'>
            <div className='mb-3'>
              <div className='text-xs font-medium'>Timezone</div>
              <p className='text-[11px] text-muted-foreground'>Changing timezone recalculates display; the main Apply saves desired configuration.</p>
            </div>
            <div className='grid gap-3'>
              <EditorField label='Timezone'>
                <div className='relative'>
                  <Input
                    aria-label='Timezone value'
                    className='h-8 font-mono text-xs'
                    value={time.timezone}
                    onBlur={() => window.setTimeout(() => setTimezoneSearchOpen(false), 120)}
                    onChange={(event) => {
                      setTimezoneSearchOpen(true)
                      setTimezoneSearchFiltering(true)
                      updateTimezone(event.target.value)
                    }}
                    onFocus={() => {
                      setTimezoneSearchFiltering(false)
                      setTimezoneSearchOpen(true)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setTimezoneSearchOpen(false)
                    }}
                  />
                  {timezoneSearchOpen ? (
                    <div
                      data-testid='ntp-timezone-options'
                      className='absolute left-0 right-0 top-full z-[90] mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-xs shadow-lg'
                    >
                      {timezoneMatches.length ? timezoneMatches.map((option) => (
                        <button
                          key={option}
                          type='button'
                          className={`block w-full rounded-sm px-2 py-1.5 text-left font-mono hover:bg-accent hover:text-accent-foreground ${option === time.timezone ? 'bg-blue-100 text-blue-950 dark:bg-blue-900/40 dark:text-blue-100' : ''}`}
                          onMouseDown={(event) => {
                            event.preventDefault()
                            updateTimezone(option)
                            setTimezoneSearchFiltering(false)
                            setTimezoneSearchOpen(false)
                          }}
                        >
                          {option}
                        </button>
                      )) : (
                        <div className='px-2 py-2 text-muted-foreground'>No matching timezone</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </EditorField>
              <div className='rounded-md border bg-muted/20 px-2 py-1.5 text-[11px]'>
                <div className='text-muted-foreground'>UTC offset</div>
                <div className='font-mono text-xs'>{selectedTimezoneOffset}</div>
              </div>
            </div>
          </div>

          <div className='flex h-full flex-col rounded-xl border bg-background p-3'>
            <div className='mb-3'>
              <div className='text-xs font-medium'>NTP synchronization</div>
              <p className='text-[11px] text-muted-foreground'>Client sync uses sources from the Sources tab.</p>
            </div>
            <div className='grid gap-3'>
              <label className='flex h-8 items-center gap-2 rounded-md border px-3 text-xs'><input type='checkbox' checked={time.ntp_enabled} onChange={(event) => setTime((prev) => ({ ...prev, ntp_enabled: event.target.checked }))} />Enable NTP client</label>
              <label className='flex h-8 items-center gap-2 rounded-md border px-3 text-xs'><input aria-label='Sync hardware clock (RTC)' type='checkbox' checked={time.rtcsync} onChange={(event) => setTime((prev) => ({ ...prev, rtcsync: event.target.checked }))} />Sync hardware clock (RTC)</label>
              <div className='text-[11px]'>
                <div className='rounded-md border bg-muted/20 px-2 py-1.5'>
                  <div className='text-muted-foreground'>Sources configured</div>
                  <div className='font-mono text-xs'>{sources.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className='rounded-xl border bg-background p-3 lg:col-span-3'>
            <div className='mb-3'>
              <div className='text-xs font-medium'>NTP server</div>
              <p className='text-[11px] text-muted-foreground'>Serve time to networks configured on the Access tab. Firewall rules are not managed here.</p>
            </div>
            <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-4'>
              <ServerField label='Enabled' help='Answer NTP clients from Access rules.'>
                <CompactCheckbox checked={server.enabled} onChange={(checked) => setServer((prev) => ({ ...prev, enabled: checked }))} label='Enable NTP server' ariaLabel='Enable NTP server' />
              </ServerField>
              <ServerField label='Use local clock' help='Fallback source when upstream time is lost.'>
                <CompactCheckbox disabled={!server.enabled} checked={server.use_local_clock} onChange={(checked) => setServer((prev) => ({ ...prev, use_local_clock: checked }))} label='Use local clock' ariaLabel='Use local clock' />
              </ServerField>
              <ServerField label='Local stratum' help='Fallback stratum 1–15; 10 is safe.'>
                <Input aria-label='Local stratum' disabled={!server.enabled} className='h-8 font-mono text-xs' value={server.local_stratum} onChange={(event) => setServer((prev) => ({ ...prev, local_stratum: event.target.value }))} />
              </ServerField>
              <ServerField label='Listen port' help='UDP NTP port; default is 123.'>
                <OptionalDefaultInputLine
                  inputLabel='Listen port'
                  type='number'
                  min='1'
                  max='65535'
                  disabled={!server.enabled}
                  value={server.listen_port}
                  active={listenPortExpanded}
                  defaultValue={initialServer.listen_port}
                  inactiveHint='123 / default'
                  placeholder='123'
                  onActiveChange={setListenPortExpanded}
                  onChange={(value) => setServer((prev) => ({ ...prev, listen_port: value }))}
                />
              </ServerField>
              <ServerField label='Bind address' help='Optional local IP; empty means all.'>
                <OptionalInputLine
                  inputLabel='Bind address'
                  disabled={!server.enabled}
                  value={server.bind_address}
                  defaultValue='0.0.0.0'
                  inactiveHint='0.0.0.0 / all interfaces'
                  placeholder='0.0.0.0'
                  onChange={(value) => setServer((prev) => ({ ...prev, bind_address: value }))}
                />
              </ServerField>
              <ServerField label='Bind interface' help='Optional device, for example eth0.'>
                <OptionalInputLine
                  inputLabel='Bind interface'
                  disabled={!server.enabled}
                  value={server.bind_interface}
                  defaultValue='eth0'
                  inactiveHint='all interfaces'
                  placeholder='eth0'
                  onChange={(value) => setServer((prev) => ({ ...prev, bind_interface: value }))}
                />
              </ServerField>
              <ServerField label='Auth key' help='Client auth key id; none disables auth.'>
                {!authKeyExpanded && server.auth_key === 'none' ? (
                  <div className='flex h-8 items-center justify-between gap-1 rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground'>
                    <span className='truncate pr-1'>none / no authentication</span>
                    <div className='flex items-center gap-1'>
                      <button
                        type='button'
                        aria-label='Manage NTP keys'
                        className='h-5 rounded border px-1.5 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50'
                        onClick={() => setKeyManagerOpen(true)}
                      >
                        Keys
                      </button>
                      <button
                        type='button'
                        aria-label='Add Authentication key'
                        className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50'
                        onClick={() => setAuthKeyExpanded(true)}
                        disabled={!server.enabled}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className='grid gap-1'>
                    <div className='flex items-center gap-1'>
                      <Select disabled={!server.enabled} value={server.auth_key} onValueChange={(value) => setServer((prev) => ({ ...prev, auth_key: value }))}>
                        <SelectTrigger aria-label='Authentication key' className='h-8 flex-1'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value='none'>none</SelectItem>
                          {authKeyOptions.map((keyId) => <SelectItem key={keyId} value={keyId}>{keyId}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <button
                        type='button'
                        aria-label='Clear Authentication key'
                        className='h-8 min-w-8 rounded border px-2 text-[11px] text-foreground disabled:pointer-events-none disabled:opacity-50'
                        onClick={() => {
                          setServer((prev) => ({ ...prev, auth_key: 'none' }))
                          setAuthKeyExpanded(false)
                        }}
                        disabled={!server.enabled}
                      >
                        -
                      </button>
                    </div>
                    <button
                      type='button'
                      aria-label='Manage NTP keys'
                      className='h-6 w-fit rounded border px-2 text-[11px] text-foreground hover:bg-accent hover:text-accent-foreground'
                      onClick={() => setKeyManagerOpen(true)}
                    >
                      Keys
                    </button>
                  </div>
                )}
              </ServerField>
              <ServerField label='Orphan mode' help='Needs local clock; elects isolated leader.'>
                <CompactCheckbox disabled={!server.enabled || !server.use_local_clock} checked={server.orphan_mode} onChange={(checked) => setServer((prev) => ({ ...prev, orphan_mode: checked }))} label='Orphan mode' ariaLabel='Orphan mode' />
              </ServerField>
              <ServerField label='Rate limit' help='Protects against noisy clients.'>
                <CompactCheckbox disabled={!server.enabled} checked={server.rate_limit_enabled} onChange={(checked) => setServer((prev) => ({ ...prev, rate_limit_enabled: checked }))} label='Rate limit responses' ariaLabel='Rate limit responses' />
              </ServerField>
              <ServerField label='Rate interval' help='Chrony interval exponent: -19…12.'>
                <Input aria-label='Rate interval' type='number' disabled={!server.enabled || !server.rate_limit_enabled} className='h-8 font-mono text-xs' value={server.rate_interval} onChange={(event) => setServer((prev) => ({ ...prev, rate_interval: event.target.value }))} />
              </ServerField>
              <ServerField label='Rate burst' help='Allowed burst before limiting: 1…255.'>
                <Input aria-label='Rate burst' type='number' min='1' max='255' disabled={!server.enabled || !server.rate_limit_enabled} className='h-8 font-mono text-xs' value={server.rate_burst} onChange={(event) => setServer((prev) => ({ ...prev, rate_burst: event.target.value }))} />
              </ServerField>
            </div>
          </div>

          <div className='flex justify-end rounded-xl border bg-background p-3 lg:col-span-3'>
            <Button size='sm' disabled={loading || applying} onClick={applyChanges}>{applying ? <Loader2 className='animate-spin' /> : null}Apply</Button>
          </div>
        </div>
      </div>
    )
  }

  function renderSourcesTable() {
    const sortedSources = sortRows(sources, sourceSort, (row, key) => row[key])

    return (
      <TableShell>
        <Table className='w-max min-w-full'>
          <TableHeader>
            <TableRow>
              {sourceColumnOrder.map((key) => (
                <SortableHead key={key} sortKey={key} label={sourceColumnLabels[key]} sort={sourceSort} onSort={(next) => setSourceSort((prev) => nextSortState(prev, next))} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSources.map((row) => (
              <TableRow key={row.id} className={selectableRowClass(selectedIds.includes(row.id), !row.enabled, Boolean(row.comment))} onClick={(event) => selectRow(row.id, event)} onDoubleClick={() => openEdit('sources', row)}>
                <CommentedCell comment={row.comment}>{row.type}</CommentedCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={`font-mono text-[11px] ${row.comment ? 'block pt-1' : ''}`}>{row.address || '-'}</span></TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.min_poll || '-'}</span></TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.max_poll || '-'}</span></TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{statusBadge(row.iburst ? 'yes' : 'no')}</span></TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.auth_key || 'none'}</span></TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={`font-mono text-[11px] ${row.comment ? 'block pt-1' : ''}`}>{row.options || '-'}</span></TableCell>
              </TableRow>
            ))}
            {!sources.length ? <EmptyRow colSpan={sourceColumnOrder.length} text='No NTP sources.' /> : null}
          </TableBody>
        </Table>
      </TableShell>
    )
  }

  function renderAccessTable() {
    const sortedAccessRules = sortRows(accessRules, accessSort, (row, key) => row[key])

    return (
      <TableShell>
        <Table className='w-max min-w-full'>
          <TableHeader>
            <TableRow>
              {accessColumnOrder.map((key) => (
                <SortableHead key={key} sortKey={key} label={accessColumnLabels[key]} sort={accessSort} onSort={(next) => setAccessSort((prev) => nextSortState(prev, next))} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAccessRules.map((row) => (
              <TableRow key={row.id} className={selectableRowClass(selectedIds.includes(row.id), !row.enabled, Boolean(row.comment))} onClick={(event) => selectRow(row.id, event)} onDoubleClick={() => openEdit('access', row)}>
                <CommentedCell comment={row.comment}>{row.action}</CommentedCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={`font-mono text-[11px] ${row.comment ? 'block pt-1' : ''}`}>{row.network || '-'}</span></TableCell>
              </TableRow>
            ))}
            {!accessRules.length ? <EmptyRow colSpan={accessColumnOrder.length} text='No Chrony access rules.' /> : null}
          </TableBody>
        </Table>
      </TableShell>
    )
  }

  function renderClientsTable() {
    const clients = runtimeStatus?.clients || []
    const sortedClients = sortRows(clients, clientStatusSort, (row, key) => row[key])

    return (
      <TableShell>
        <Table className='w-max min-w-full'>
          <TableHeader>
            <TableRow>
              {clientStatusColumnOrder.map((key) => (
                <SortableHead key={key} sortKey={key} label={clientStatusColumnLabels[key]} sort={clientStatusSort} onSort={(next) => setClientStatusSort((prev) => nextSortState(prev, next))} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedClients.map((client) => (
              <TableRow key={`${client.address}:${client.ntp_packets}:${client.command_packets}`} className='h-8 cursor-default select-none hover:bg-blue-100/80 dark:hover:bg-blue-900/35'>
                <TableCell className='font-mono text-[11px]'>{client.address}</TableCell>
                <TableCell>{client.ntp_packets}</TableCell>
                <TableCell>{client.ntp_drops}</TableCell>
                <TableCell>{formatOptionalSeconds(client.ntp_interval)}</TableCell>
                <TableCell>{formatOptionalSeconds(client.ntp_last)}</TableCell>
                <TableCell>{client.command_packets}</TableCell>
                <TableCell>{client.command_drops}</TableCell>
                <TableCell>{formatOptionalSeconds(client.command_last)}</TableCell>
              </TableRow>
            ))}
            {!clients.length ? <EmptyRow colSpan={8} text={statusLoading ? 'Loading Chrony clients…' : 'No Chrony clients seen yet.'} /> : null}
          </TableBody>
        </Table>
      </TableShell>
    )
  }

  function renderStatusTable() {
    const tracking = runtimeStatus?.tracking
    const sortedSources = sortRows(runtimeStatus?.sources || [], sourceStatusSort, (row, key) => row[key])
    return (
      <div className='flex min-h-0 flex-1 flex-col gap-2'>
        {hasPendingApply ? (
          <div className='rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300'>
            Status below is the currently applied Chrony runtime. Time form changes are not active until Apply runs on Time.
          </div>
        ) : null}
        <div className='grid gap-2 md:grid-cols-3 xl:grid-cols-5'>
          <StatusTile label='Source sync' value={statusBadge(tracking?.leap_status || 'unknown')} />
          <StatusTile label='Stratum' value={tracking ? `Stratum ${tracking.stratum}` : '-'} mono />
          <StatusTile label='Reference' value={tracking?.reference_address || '-'} mono />
          <StatusTile label='System offset' value={formatSeconds(tracking?.system_time)} mono />
          <StatusTile label='Sources online' value={runtimeStatus?.activity?.sources_online ?? '-'} mono />
        </div>
        {runtimeStatus?.errors.length ? (
          <div className='rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
            {runtimeStatus.errors.map((error) => `${error.command}: ${error.error}`).join(' · ')}
          </div>
        ) : null}
        <TableShell>
          <Table className='w-max min-w-full'>
            <TableHeader>
              <TableRow>
                {sourceStatusColumnOrder.map((key) => (
                  <SortableHead key={key} sortKey={key} label={sourceStatusColumnLabels[key]} sort={sourceStatusSort} onSort={(next) => setSourceStatusSort((prev) => nextSortState(prev, next))} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSources.map((source) => (
                <TableRow key={`${source.mode}:${source.address}`} className='h-8 cursor-default select-none hover:bg-blue-100/80 dark:hover:bg-blue-900/35'>
                  <TableCell>{statusBadge(source.state === '*' ? 'selected' : source.state)}</TableCell>
                  <TableCell className='font-mono text-[11px]'>{source.address}</TableCell>
                  <TableCell>{source.stratum}</TableCell>
                  <TableCell>{source.poll}</TableCell>
                  <TableCell>{source.reach}</TableCell>
                  <TableCell>{source.last_rx >= 4294967295 ? '-' : `${source.last_rx}s`}</TableCell>
                  <TableCell className='font-mono text-[11px]'>{formatSeconds(source.adjusted_offset)}</TableCell>
                  <TableCell className='font-mono text-[11px]'>{formatSeconds(source.estimated_error)}</TableCell>
                </TableRow>
              ))}
              {!runtimeStatus?.sources.length ? <EmptyRow colSpan={8} text={statusLoading ? 'Loading Chrony status…' : 'No Chrony runtime sources.'} /> : null}
            </TableBody>
          </Table>
        </TableShell>
      </div>
    )
  }

  function renderEditorFields() {
    if (editorTab === 'time') {
      return (
        <div className='grid gap-3 md:grid-cols-2'>
          <label className='flex h-8 items-center gap-2 rounded-md border px-3 text-xs'><input type='checkbox' checked={Boolean(editorForm.ntp_enabled)} onChange={(event) => setEditorForm((prev) => ({ ...prev, ntp_enabled: event.target.checked }))} />Use NTP synchronization</label>
          <label className='flex h-8 items-center gap-2 rounded-md border px-3 text-xs'><input type='checkbox' checked={Boolean(editorForm.rtcsync)} onChange={(event) => setEditorForm((prev) => ({ ...prev, rtcsync: event.target.checked }))} />Sync hardware clock (RTC)</label>
          <EditorField label='Date'><Input aria-label='Date' className='h-8 font-mono text-xs' value={String(editorForm.current_date || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, current_date: event.target.value }))} /></EditorField>
          <EditorField label='Time'><Input aria-label='Time' className='h-8 font-mono text-xs' value={String(editorForm.current_time || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, current_time: event.target.value }))} /></EditorField>
          <EditorField label='Timezone'><Input aria-label='Timezone' className='h-8 font-mono text-xs' value={String(editorForm.timezone || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, timezone: event.target.value }))} /></EditorField>
          <p className='md:col-span-2 text-[11px] text-muted-foreground'>Chrony configuration is live. Manual system time changes require a separate privileged backend action.</p>
        </div>
      )
    }
    if (editorTab === 'sources') {
      return (
        <div className='space-y-3' data-testid='ntp-source-editor'>
          <CompactSection title='Chrony source' description='Source entry that will be written to chrony.conf after Apply.'>
            <CompactRow label='Enabled'>
              <CompactCheckbox
                checked={Boolean(editorForm.enabled)}
                onChange={(enabled) => setEditorForm((prev) => ({ ...prev, enabled }))}
                label='Use this source'
                ariaLabel='Toggle NTP source enabled state'
              />
            </CompactRow>
            <CompactRow label='Type'>
              <Select value={String(editorForm.type || 'server')} onValueChange={(value) => setEditorForm((prev) => ({ ...prev, type: value as SourceType }))}>
                <SelectTrigger className='h-7 max-w-xl text-xs'><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value='server'>server</SelectItem><SelectItem value='pool'>pool</SelectItem></SelectContent>
              </Select>
            </CompactRow>
            <CompactRow label='Address' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>NTP server hostname, IP address, or pool name.</div>
              <Input aria-label='Address' className='h-7 max-w-xl text-xs' value={String(editorForm.address || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, address: event.target.value }))} placeholder='2.debian.pool.ntp.org' />
            </CompactRow>
            <CompactRow label='Comment'>
              <Input aria-label='Comment' className='h-7 max-w-xl text-xs' value={String(editorForm.comment || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder='optional label' />
            </CompactRow>
          </CompactSection>

          <CompactSection title='Polling and auth' description='Chrony polling interval and optional authentication parameters.'>
            <CompactRow label='Min Poll' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Minimum poll exponent. Chrony default is usually 6, which means 64 seconds.</div>
              <Input aria-label='Min Poll' className='h-7 max-w-xl font-mono text-xs' value={String(editorForm.min_poll || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, min_poll: event.target.value }))} />
            </CompactRow>
            <CompactRow label='Max Poll' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Maximum poll exponent. Value 10 means up to 1024 seconds between polls.</div>
              <Input aria-label='Max Poll' className='h-7 max-w-xl font-mono text-xs' value={String(editorForm.max_poll || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, max_poll: event.target.value }))} />
            </CompactRow>
            <CompactRow label='IBurst' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Send a short packet burst on start to synchronize faster.</div>
              <CompactCheckbox
                checked={Boolean(editorForm.iburst)}
                onChange={(iburst) => setEditorForm((prev) => ({ ...prev, iburst }))}
                label='Fast initial synchronization'
                ariaLabel='Toggle NTP source iburst option'
              />
            </CompactRow>
            <CompactRow label='Auth. Key' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Chrony authentication key id. Use none when source authentication is not configured.</div>
              <Select value={String(editorForm.auth_key || 'none')} onValueChange={(value) => setEditorForm((prev) => ({ ...prev, auth_key: value }))}>
                <SelectTrigger aria-label='Auth. Key' className='h-7 max-w-xl text-xs'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>none</SelectItem>
                  {authKeyOptions.map((keyId) => <SelectItem key={keyId} value={keyId}>{keyId}</SelectItem>)}
                </SelectContent>
              </Select>
            </CompactRow>
          </CompactSection>
        </div>
      )
    }
    if (editorTab === 'access') {
      return (
        <div className='space-y-3' data-testid='ntp-access-editor'>
          <CompactSection title='Chrony access' description='Access rule written to chrony.conf. Firewall rules are not created or modified.'>
            <CompactRow label='Enabled'>
              <CompactCheckbox
                checked={Boolean(editorForm.enabled)}
                onChange={(enabled) => setEditorForm((prev) => ({ ...prev, enabled }))}
                label='Use this access rule'
                ariaLabel='Toggle NTP access rule enabled state'
              />
            </CompactRow>
            <CompactRow label='Action' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Allow or deny NTP clients matched by the network below.</div>
              <Select value={String(editorForm.action || 'allow')} onValueChange={(value) => setEditorForm((prev) => ({ ...prev, action: value as AccessAction }))}>
                <SelectTrigger className='h-7 max-w-xl text-xs'><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value='allow'>allow</SelectItem><SelectItem value='deny'>deny</SelectItem></SelectContent>
              </Select>
            </CompactRow>
            <CompactRow label='Network' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Client subnet in CIDR notation, for example 192.0.2.0/24.</div>
              <Input aria-label='Network' className='h-7 max-w-xl font-mono text-xs' value={String(editorForm.network || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, network: event.target.value }))} placeholder='192.0.2.0/24' />
            </CompactRow>
            <CompactRow label='Comment'>
              <Input aria-label='Comment' className='h-7 max-w-xl text-xs' value={String(editorForm.comment || '')} onChange={(event) => setEditorForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder='optional label' />
            </CompactRow>
          </CompactSection>
        </div>
      )
    }
    return null
  }

  const selectedKey = keys.find((key) => key.id === selectedKeyId)

  return (
    <div
      className='flex h-full min-h-0 min-w-0 w-full flex-col gap-2 overflow-x-hidden'
      style={{ maxWidth: 'calc(100vw - var(--sidebar-width, 16rem) - 2rem)' }}
    >
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-lg font-semibold tracking-tight'>NTP / Chrony</h2>
      </div>

      {message ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${messageKind === 'error' ? 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300' : 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300'}`}>
          {message}
        </div>
      ) : null}

      {!loading && hasPendingApply ? (
        <div className='rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300'>
          Desired NTP configuration has pending changes. Source status still shows the currently applied Chrony config until you press Apply on Time.
        </div>
      ) : null}

      <Card className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden text-xs'>
        <CardContent className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2 overflow-hidden px-4 pt-0'>
          <div className='flex min-w-0 flex-wrap items-center gap-2 pt-4'>
            <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as NtpTab); setSelectedIds([]) }}>
              <TabsList className='h-9 flex-wrap'>
                <TabsTrigger className='px-4 text-sm' value='time'>Time</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='sources'>Sources</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='access'>Access</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='clients'>Client status</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='status'>Source status</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {renderToolbar()}

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as NtpTab)} className='min-h-0 flex-1 overflow-hidden'>
            <div className='flex min-h-0 flex-1 flex-col'>
              <TabsContent value='time' className='mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto'>{renderTimePanel()}</TabsContent>
              <TabsContent value='sources' className='mt-0 flex min-h-0 flex-1 flex-col'>{renderSourcesTable()}</TabsContent>
              <TabsContent value='access' className='mt-0 flex min-h-0 flex-1 flex-col'>{renderAccessTable()}</TabsContent>
              <TabsContent value='clients' className='mt-0 flex min-h-0 flex-1 flex-col'>{renderClientsTable()}</TabsContent>
              <TabsContent value='status' className='mt-0 flex min-h-0 flex-1 flex-col'>{renderStatusTable()}</TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {editorOpen && configTab ? (
        <div className='pointer-events-none fixed inset-0 z-40'>
          <div
            className='pointer-events-auto absolute z-50 w-[680px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl'
            style={{ left: winPos.x, top: winPos.y }}
            role='dialog'
            aria-modal='true'
            aria-label={`${editorMode === 'edit' ? 'Edit' : 'Add'} NTP ${editorTab}`}
          >
            <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={onDragStart}>
              <div className='flex items-center justify-between gap-3'>
                <span className='truncate'>{editorMode === 'edit' ? 'Edit' : 'Add'} NTP {editorTab}</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => setEditorOpen(false)}><X className='size-3.5' /></button>
              </div>
            </div>
            <form className='flex max-h-[78vh] min-h-0 flex-col overflow-hidden rounded-b-xl bg-background text-xs' onSubmit={saveEditor}>
              <div className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
                {editorError ? (
                  <div className='mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
                    {editorError}
                  </div>
                ) : null}
                {renderEditorFields()}
              </div>
              <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
                {editorMode === 'edit' && (editorTab === 'sources' || editorTab === 'access') ? (
                  <Button type='button' variant='outline' onClick={copyEditorItem}>
                    <Copy />Copy
                  </Button>
                ) : null}
                <Button type='button' variant='outline' onClick={() => setEditorOpen(false)}>Cancel</Button>
                <Button type='submit'><Save />{editorMode === 'edit' ? 'Save' : 'Add'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {keyManagerOpen && configTab ? (
        <div className='pointer-events-none fixed inset-0 z-40'>
          <div
            className='pointer-events-auto absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl'
            style={{ left: 460, top: 120 }}
            role='dialog'
            aria-modal='true'
            aria-label='Manage NTP keys'
          >
            <div className='rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium'>
              <div className='flex items-center justify-between gap-3'>
                <span className='truncate'>Manage NTP keys</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => setKeyManagerOpen(false)}><X className='size-3.5' /></button>
              </div>
            </div>
            <div className='px-3 py-3 text-xs'>
              <div className='mb-2'>
                <div className='text-[12px] font-semibold'>Chrony authentication keys</div>
                <div className='mt-0.5 text-[11px] text-muted-foreground'>Keys are referenced by id from server and source settings; secret values are not shown in the UI.</div>
              </div>
              {keyEditorError ? (
                <div className='mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
                  {keyEditorError}
                </div>
              ) : null}
              <div className='mb-2 flex flex-wrap gap-2'>
                <Button type='button' size='sm' onClick={openCreateKey}><Plus />Add</Button>
                <Button type='button' size='sm' variant='destructive' disabled={!selectedKey} onClick={deleteSelectedKey}>Del</Button>
                <Button type='button' size='sm' variant='outline' disabled={!selectedKey?.enabled} onClick={() => setSelectedKeyEnabled(false)}>Disable</Button>
                <Button type='button' size='sm' disabled={!selectedKey || selectedKey.enabled} onClick={() => setSelectedKeyEnabled(true)}>Enable</Button>
              </div>
              <div className='min-h-28 min-w-0 overflow-x-auto overflow-y-auto rounded-xl border'>
                <Table className='w-max min-w-full leading-5'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID ↕</TableHead>
                      <TableHead>Algorithm ↕</TableHead>
                      <TableHead>Secret ↕</TableHead>
                      <TableHead>State ↕</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((key) => (
                      <TableRow
                        key={key.rowId}
                        className={selectableRowClass(selectedKeyId === key.id, !key.enabled, Boolean(key.comment))}
                        onClick={() => setSelectedKeyId(key.id)}
                        onDoubleClick={() => openEditKey(key)}
                      >
                        <CommentedCell comment={key.comment}>{key.id}</CommentedCell>
                        <TableCell className={key.comment ? 'align-bottom pb-0.5 pt-2' : ''}><span className={key.comment ? 'block pt-1' : ''}>{key.algorithm}</span></TableCell>
                        <TableCell className={`${key.comment ? 'align-bottom pb-0.5 pt-2' : ''} font-mono text-[11px]`}><span className={key.comment ? 'block pt-1' : ''}>••••••••</span></TableCell>
                        <TableCell className={key.comment ? 'align-bottom pb-0.5 pt-2' : ''}><span className={key.comment ? 'block pt-1' : ''}>{key.enabled ? statusBadge('enabled') : statusBadge('disabled')}</span></TableCell>
                      </TableRow>
                    ))}
                    {!keys.length ? <EmptyRow colSpan={4} text='No Chrony authentication keys.' /> : null}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
              <Button type='button' variant='outline' onClick={() => setKeyManagerOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}

      {keyEditorOpen && keyManagerOpen ? (
        <div className='pointer-events-none fixed inset-0 z-50'>
          <div
            className='pointer-events-auto absolute z-[60] w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl'
            style={{ left: 500, top: 170 }}
            role='dialog'
            aria-modal='true'
            aria-label={keyEditorMode === 'add' ? 'Add NTP key' : 'Edit NTP key'}
          >
            <div className='rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium'>
              <div className='flex items-center justify-between gap-3'>
                <span className='truncate'>{keyEditorMode === 'add' ? 'Add NTP key' : 'Edit NTP key'}</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => setKeyEditorOpen(false)}><X className='size-3.5' /></button>
              </div>
            </div>
            <form className='flex flex-col rounded-b-xl bg-background text-xs' onSubmit={saveKeyEditor}>
              <div className='space-y-3 px-3 py-3'>
                {keyEditorError ? (
                  <div className='rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
                    {keyEditorError}
                  </div>
                ) : null}
                <CompactSection title='Chrony authentication key' description='Key material is written to chrony.keys after Apply; secrets are masked in tables.'>
                  <CompactRow label='Enabled'>
                    <CompactCheckbox
                      checked={keyEditorForm.enabled}
                      onChange={(enabled) => setKeyEditorForm((prev) => ({ ...prev, enabled }))}
                      label='Use this key'
                      ariaLabel='Toggle NTP key enabled state'
                    />
                  </CompactRow>
                  <CompactRow label='ID' align='start'>
                    <div className='mb-1 text-[11px] text-muted-foreground'>Numeric Chrony key id, for example 1.</div>
                    <Input aria-label='ID' className='h-7 max-w-xl font-mono text-xs' value={keyEditorForm.id} onChange={(event) => setKeyEditorForm((prev) => ({ ...prev, id: event.target.value }))} />
                  </CompactRow>
                  <CompactRow label='Algorithm'>
                    <Select value={keyEditorForm.algorithm} onValueChange={(value) => setKeyEditorForm((prev) => ({ ...prev, algorithm: value as KeyAlgorithm }))}>
                      <SelectTrigger aria-label='Algorithm' className='h-7 max-w-xl text-xs'><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {keyAlgorithms.map((algorithm) => <SelectItem key={algorithm} value={algorithm}>{algorithm}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CompactRow>
                  <CompactRow label='Secret' align='start'>
                    <div className='mb-1 text-[11px] text-muted-foreground'>{keyEditorMode === 'edit' ? 'Leave blank to keep the current secret.' : 'Shared secret used by Chrony keyfile.'}</div>
                    <div className='flex max-w-xl items-center gap-1'>
                      <Input
                        aria-label='Secret'
                        type={showKeySecret ? 'text' : 'password'}
                        className='h-7 flex-1 font-mono text-xs'
                        placeholder={keyEditorMode === 'edit' ? 'current secret hidden' : 'enter or generate secret'}
                        value={keyEditorForm.secret}
                        onChange={(event) => setKeyEditorForm((prev) => ({ ...prev, secret: event.target.value }))}
                      />
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='h-7 w-7 shrink-0'
                        title={showKeySecret ? 'Hide secret' : 'Show secret'}
                        onClick={() => setShowKeySecret((value) => !value)}
                      >
                        {showKeySecret ? <EyeOff className='size-3.5' /> : <Eye className='size-3.5' />}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        className='h-7 w-7 shrink-0'
                        title='Generate secret'
                        onClick={generateKeyEditorSecret}
                      >
                        <KeyRound className='size-3.5' />
                      </Button>
                    </div>
                  </CompactRow>
                  <CompactRow label='Comment'>
                    <Input aria-label='Comment' className='h-7 max-w-xl text-xs' value={keyEditorForm.comment} onChange={(event) => setKeyEditorForm((prev) => ({ ...prev, comment: event.target.value }))} placeholder='optional label' />
                  </CompactRow>
                </CompactSection>
              </div>
              <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
                <Button type='button' variant='outline' onClick={() => setKeyEditorOpen(false)}>Cancel</Button>
                <Button type='submit'><Save />{keyEditorMode === 'add' ? 'Add' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
