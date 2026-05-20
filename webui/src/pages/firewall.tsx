import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AuthState, FirewallMapItem, FirewallMapsState, FirewallRule, FirewallSchema, FirewallSetItem, FirewallSetsState, FirewallState, FirewallTableItem, FirewallTablesState } from './api'
import { createFirewallRule, deleteFirewallMap, deleteFirewallRule, deleteFirewallSet, deleteFirewallTable, getFirewallMaps, getFirewallSchema, getFirewallSets, getFirewallState, getFirewallTables, reorderFirewallRules, resetFirewallCounters, updateFirewallRule, upsertFirewallMap, upsertFirewallSet, upsertFirewallTable } from './api'

const defaultRule: Partial<FirewallRule> = {
  table: 'filter',
  family: 'inet',
  chain: 'input',
  action: 'accept',
  proto: null,
  enabled: true,
  comment: '',
  ct_state: null,
  user_id: null,
  hour: null,
  dscp: null,
  nat_type: null,
  target_chain: null,
  reject_type: null,
  to_addr: null,
  to_port: null,
  nat_random: false,
  nat_fully_random: false,
  nat_persistent: false,
  notrack: false,
  mark_set: null,
  ct_mark_set: null,
  log_prefix: null,
  log_level: null,
  fib_expr: null,
  socket_expr: null,
  rt_expr: null,
  exthdr_expr: null,
  raw_expr: null,
  nftrace: false,
  tcp_flags: null,
  icmp_type: null,
  icmp_code: null,
  icmpv6_type: null,
  icmpv6_code: null,
  meta_length: null,
  meta_priority: null,
  meta_cpu: null,
  meta_pkttype: null,
  meta_iiftype: null,
  meta_oiftype: null,
  meta_iifgroup: null,
  meta_oifgroup: null,
  mark_match: null,
  ct_mark_match: null,
  ct_status: null,
  ct_direction: null,
  ct_expiration: null,
  ct_helper_match: null,
  ct_label: null,
  ct_event: null,
  ct_original_saddr: null,
  ct_original_daddr: null,
  ct_reply_saddr: null,
  ct_reply_daddr: null,
  fib_check: null,
  socket_match: null,
  rt_nexthop: null,
  ipv6_exthdrs: null,
  vlan_id: null,
  ether_src: null,
  ether_dst: null,
  ether_type: null,
  ct_helper_set: null,
  ct_timeout_set: null,
  ct_expectation_set: null,
  limit_rate: null,
  counter: false,
}

type EditorTab = 'base' | 'advanced' | 'action' | 'stats'
type FieldState = 'V' | 'H' | 'D' | 'W'

function parseCtState(value?: FirewallRule['ct_state'] | null) {
  return {
    established: value === 'established' || value === 'established,related',
    related: value === 'related' || value === 'established,related',
    newState: value === 'new',
    invalid: value === 'invalid',
    untracked: value === 'untracked',
  }
}

function buildCtState(flags: { established: boolean; related: boolean; newState: boolean; invalid: boolean; untracked: boolean }): FirewallRule['ct_state'] | null {
  if (flags.established && flags.related) return 'established,related'
  if (flags.established) return 'established'
  if (flags.related) return 'related'
  if (flags.newState) return 'new'
  if (flags.invalid) return 'invalid'
  if (flags.untracked) return 'untracked'
  return null
}

function ToggleLine(props: { label: string; enabled: boolean; onToggle: () => void; children: React.ReactNode; inactiveHint?: string }) {
  return (
    <div className='space-y-1.5'>
      <div className='flex items-center justify-between gap-2'>
        <Label>{props.label}</Label>
      </div>
      {props.enabled
        ? (
          <div className='relative'>
            <div className='pr-8'>
              {props.children}
            </div>
            <button
              type='button'
              className='absolute right-1 top-1 h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground'
              onClick={props.onToggle}
            >
              -
            </button>
          </div>
        )
        : (
          <div className='flex h-7 items-center justify-between rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground'>
            <span className='truncate pr-2'>{props.inactiveHint || ''}</span>
            <button type='button' className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground' onClick={props.onToggle}>+</button>
          </div>
        )}
    </div>
  )
}

function PlannedField(props: { label: string; placeholder: string }) {
  return (
    <ToggleLine label={props.label} enabled={false} onToggle={() => {}} inactiveHint={props.placeholder}>
      <Input className='h-7' disabled placeholder={`${props.placeholder} (planned)`} />
    </ToggleLine>
  )
}

type FirewallPolicyTab = 'filter' | 'nat' | 'raw' | 'mangle'
type FirewallSectionTab = 'policy' | 'collections' | 'table_builder'
type CollectionKind = 'addr' | 'port' | 'iface' | 'map' | 'vmap'
type SortDirection = 'asc' | 'desc'
type CollectionSortKey = 'kind' | 'name' | 'values' | 'status'
type TableSortKey = 'family' | 'table_name' | 'chain_name' | 'chain_type' | 'hook' | 'device' | 'priority' | 'policy' | 'origin' | 'status'
type PolicySortKey = 'chain' | 'action' | 'proto' | 'src' | 'dst' | 'sport' | 'dport' | 'in_interface' | 'out_interface' | 'ct_state' | 'packets' | 'bytes'

const POLICY_COLUMN_LABELS: Record<PolicySortKey, string> = {
  chain: 'Chain',
  action: 'Action',
  proto: 'Protocol',
  src: 'Source address',
  dst: 'Destination address',
  sport: 'Source port',
  dport: 'Destination port',
  in_interface: 'Input interface',
  out_interface: 'Output interface',
  ct_state: 'Connection state',
  packets: 'Packets',
  bytes: 'Bytes',
}

const POLICY_COLUMN_ORDER: PolicySortKey[] = [
  'chain',
  'action',
  'proto',
  'src',
  'dst',
  'sport',
  'dport',
  'in_interface',
  'out_interface',
  'ct_state',
  'packets',
  'bytes',
]

const LIVE_CHART_WINDOW = 90

type LiveChartPoint = {
  slot: number
  pps: number
  bps: number
  ts: number
}

const ADVANCED_SECTIONS_CLOSED = {
  l4: false,
  meta: false,
  ct: false,
  fib: false,
  raw: false,
}

function buildEmptyLiveChart(): LiveChartPoint[] {
  const now = Date.now()
  return Array.from({ length: LIVE_CHART_WINDOW }, (_, idx) => ({
    slot: idx,
    pps: 0,
    bps: 0,
    ts: now - (LIVE_CHART_WINDOW - idx) * 1000,
  }))
}

export function FirewallPage(props: { auth: AuthState; refreshNonce: number }) {
  const [state, setState] = React.useState<FirewallState | null>(null)
  const [schema, setSchema] = React.useState<FirewallSchema | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Partial<FirewallRule>>(defaultRule)
  const [isBusy, setIsBusy] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<FirewallSectionTab>('policy')
  const [activePolicyTab, setActivePolicyTab] = React.useState<FirewallPolicyTab>('filter')
  const [activeRuleTableName, setActiveRuleTableName] = React.useState<string>('filter')
  const [selectedRuleIds, setSelectedRuleIds] = React.useState<string[]>([])
  const [ruleAnchorId, setRuleAnchorId] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null)
  const [ruleEditorTab, setRuleEditorTab] = React.useState<EditorTab>('base')
  const [dragRuleId, setDragRuleId] = React.useState<string | null>(null)
  const [dragOverRuleId, setDragOverRuleId] = React.useState<string | null>(null)
  const [dragRuleTableName, setDragRuleTableName] = React.useState<string | null>(null)
  const [winPos, setWinPos] = React.useState({ x: 120, y: 120 })
  const [columnsOpen, setColumnsOpen] = React.useState(false)
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>({
    chain: true,
    action: true,
    proto: true,
    src: true,
    dst: false,
    sport: false,
    dport: true,
    in_interface: false,
    out_interface: false,
    ct_state: true,
    packets: true,
    bytes: true,
  })
  const [policySort, setPolicySort] = React.useState<{ key: PolicySortKey | null; dir: SortDirection }>({ key: null, dir: 'asc' })
  const dragRef = React.useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const [actionMode, setActionMode] = React.useState<string>('verdict')
  const [statsSeries, setStatsSeries] = React.useState<'packets' | 'bytes'>('packets')
  const [liveChartPoints, setLiveChartPoints] = React.useState<LiveChartPoint[]>(buildEmptyLiveChart)
  const [setsState, setSetsState] = React.useState<FirewallSetsState>({ addr: [], port: [], iface: [] })
  const [mapsState, setMapsState] = React.useState<FirewallMapsState>({ map: [], vmap: [] })
  const [tablesState, setTablesState] = React.useState<FirewallTablesState>({ builtin: [], custom: [] })
  const [collectionKind, setCollectionKind] = React.useState<CollectionKind>('addr')
  const [selectedCollectionIds, setSelectedCollectionIds] = React.useState<string[]>([])
  const [collectionAnchorId, setCollectionAnchorId] = React.useState<string | null>(null)
  const [collectionSort, setCollectionSort] = React.useState<{ key: CollectionSortKey | null; dir: SortDirection }>({ key: null, dir: 'asc' })
  const [newSetName, setNewSetName] = React.useState('')
  const [newSetElements, setNewSetElements] = React.useState('')
  const [newSetComment, setNewSetComment] = React.useState('')
  const [setOpen, setSetOpen] = React.useState(false)
  const [editingSetId, setEditingSetId] = React.useState<string | null>(null)
  const [selectedTableIds, setSelectedTableIds] = React.useState<string[]>([])
  const [tableAnchorId, setTableAnchorId] = React.useState<string | null>(null)
  const [tableSort, setTableSort] = React.useState<{ key: TableSortKey | null; dir: SortDirection }>({ key: null, dir: 'asc' })
  const [tableOpen, setTableOpen] = React.useState(false)
  const [editingTableId, setEditingTableId] = React.useState<string | null>(null)
  const [newTableFamily, setNewTableFamily] = React.useState('inet')
  const [newTableName, setNewTableName] = React.useState('')
  const [newChainName, setNewChainName] = React.useState('')
  const [newChainType, setNewChainType] = React.useState<'filter' | 'nat' | 'route'>('filter')
  const [newHook, setNewHook] = React.useState<'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'>('input')
  const [newDevice, setNewDevice] = React.useState('')
  const [newPriority, setNewPriority] = React.useState('-10')
  const [newPolicy, setNewPolicy] = React.useState<'accept' | 'drop'>('accept')
  const liveRateRef = React.useRef<{ pps: number; bps: number }>({ pps: 0, bps: 0 })
  const [advOpen, setAdvOpen] = React.useState<Record<string, boolean>>({ ...ADVANCED_SECTIONS_CLOSED })

  function formatCounter(value?: number) {
    const n = Number(value || 0)
    if (n < 1000) return String(n)
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    return `${(n / 1_000_000_000).toFixed(1)}G`
  }

  function formatBytesIEC(bytes?: number) {
    const n = Math.max(0, Number(bytes || 0))
    if (n < 1024) return `${n.toFixed(0)} B`
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KiB`
    if (n < 1024 ** 3) return `${(n / (1024 ** 2)).toFixed(1)} MiB`
    return `${(n / (1024 ** 3)).toFixed(2)} GiB`
  }

  function formatBitrate(bitsPerSec?: number) {
    const n = Math.max(0, Number(bitsPerSec || 0))
    if (n < 1000) return `${n.toFixed(0)} bps`
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)} kbps`
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)} Mbps`
    return `${(n / 1_000_000_000).toFixed(2)} Gbps`
  }

  function formatPacketRate(packetsPerSec?: number) {
    const n = Math.max(0, Number(packetsPerSec || 0))
    if (n < 10) return `${n.toFixed(1)} p/s`
    if (n < 1000) return `${Math.round(n)} p/s`
    return `${(n / 1000).toFixed(1)} Kp/s`
  }

  function computeSelection(
    orderedIds: string[],
    prevSelected: string[],
    anchorId: string | null,
    clickedId: string,
    event: React.MouseEvent
  ): { selected: string[]; anchor: string } {
    const prev = Array.from(new Set(prevSelected))
    const isToggle = event.metaKey || event.ctrlKey
    const isRange = event.shiftKey
    const fallbackAnchor = prev.length ? prev[prev.length - 1] : clickedId
    const nextAnchor = clickedId

    if (isRange) {
      const startId = anchorId || fallbackAnchor
      const a = orderedIds.indexOf(startId)
      const b = orderedIds.indexOf(clickedId)
      if (a >= 0 && b >= 0) {
        const [start, end] = a < b ? [a, b] : [b, a]
        const range = orderedIds.slice(start, end + 1)
        if (isToggle) return { selected: Array.from(new Set([...prev, ...range])), anchor: nextAnchor }
        return { selected: range, anchor: nextAnchor }
      }
    }

    if (isToggle) {
      const selected = prev.includes(clickedId) ? prev.filter((id) => id !== clickedId) : [...prev, clickedId]
      return { selected, anchor: nextAnchor }
    }

    return { selected: [clickedId], anchor: nextAnchor }
  }

  function sortIndicator(active: boolean, dir: SortDirection): string {
    if (!active) return '↕'
    return dir === 'asc' ? '▲' : '▼'
  }

  function compareStr(a: string, b: string): number {
    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  }

  const chainOptionsByTable: Record<string, string[]> = {
    filter: schema?.tables?.filter?.chains || ['input', 'forward', 'output'],
    nat: schema?.tables?.nat?.chains || ['prerouting', 'input', 'output', 'postrouting'],
    raw: schema?.tables?.raw?.chains || ['prerouting', 'output'],
    mangle: schema?.tables?.mangle?.chains || ['prerouting', 'input', 'forward', 'output', 'postrouting'],
  }
  const builtinRuleTables = new Set(['filter', 'nat', 'raw', 'mangle'])
  const customChainRowsByTable = React.useMemo(() => {
    const out: Record<string, FirewallTableItem[]> = {}
    for (const row of tablesState.custom) {
      const t = String(row.table_name || '').toLowerCase()
      if (!t) continue
      if (!out[t]) out[t] = []
      out[t].push(row)
    }
    return out
  }, [tablesState.custom])
  const activeFormTable = String(form.table || activeRuleTableName || activePolicyTab).toLowerCase()
  const defaultChainMode = builtinRuleTables.has(activeFormTable)
    ? activeFormTable
    : ((customChainRowsByTable[activeFormTable]?.find((row) => row.chain_name === form.chain)?.chain_type || customChainRowsByTable[activeFormTable]?.[0]?.chain_type || 'filter') === 'nat' ? 'nat' : 'filter')
  const tableSupports = new Set(schema?.tables?.[(defaultChainMode as 'filter' | 'nat' | 'raw' | 'mangle')]?.supports || [])
  const hasSupport = (key: string) => tableSupports.has(key)
  const activeChainOptions = builtinRuleTables.has(activeFormTable)
    ? (chainOptionsByTable[activeFormTable] || ['input'])
    : ((customChainRowsByTable[activeFormTable] || []).map((row) => row.chain_name).filter(Boolean))
  const effectiveChain = (form.chain || activeChainOptions[0] || 'input') as string
  const contextMode: 'filter' | 'nat' | 'raw' | 'mangle' = builtinRuleTables.has(activeFormTable)
    ? (activeFormTable as 'filter' | 'nat' | 'raw' | 'mangle')
    : (defaultChainMode as 'filter' | 'nat' | 'raw' | 'mangle')
  const contextKey = `${contextMode}:${effectiveChain}`
  const isFilterCtx = contextMode === 'filter'
  const isNatCtx = contextMode === 'nat'
  const isRawCtx = contextMode === 'raw'
  const isMangleCtx = contextMode === 'mangle'

  function generalFieldState(field: 'in_interface' | 'out_interface' | 'ct_state'): FieldState {
    const states: Record<string, Record<typeof field, FieldState>> = {
      'filter:input': { in_interface: 'V', out_interface: 'H', ct_state: 'V' },
      'filter:forward': { in_interface: 'V', out_interface: 'V', ct_state: 'V' },
      'filter:output': { in_interface: 'H', out_interface: 'V', ct_state: 'V' },
      'nat:prerouting': { in_interface: 'V', out_interface: 'H', ct_state: 'H' },
      'nat:input': { in_interface: 'V', out_interface: 'H', ct_state: 'H' },
      'nat:output': { in_interface: 'H', out_interface: 'V', ct_state: 'H' },
      'nat:postrouting': { in_interface: 'H', out_interface: 'V', ct_state: 'H' },
      'raw:prerouting': { in_interface: 'V', out_interface: 'H', ct_state: 'H' },
      'raw:output': { in_interface: 'H', out_interface: 'V', ct_state: 'H' },
      'mangle:prerouting': { in_interface: 'V', out_interface: 'H', ct_state: 'V' },
      'mangle:input': { in_interface: 'V', out_interface: 'H', ct_state: 'V' },
      'mangle:forward': { in_interface: 'V', out_interface: 'V', ct_state: 'V' },
      'mangle:output': { in_interface: 'H', out_interface: 'V', ct_state: 'V' },
      'mangle:postrouting': { in_interface: 'H', out_interface: 'V', ct_state: 'V' },
    }
    return states[contextKey]?.[field] || 'V'
  }

  const toPortState: FieldState = contextKey === 'nat:postrouting' ? 'W' : 'V'

  React.useEffect(() => {
    if (isNatCtx) setActionMode('nat')
    else if (isRawCtx) setActionMode('notrack')
    else if (isMangleCtx) setActionMode('mark')
    else setActionMode('verdict')
  }, [isNatCtx, isRawCtx, isMangleCtx])

  React.useEffect(() => {
    setActiveRuleTableName(activePolicyTab)
  }, [activePolicyTab])

  const selectedAction = form.nat_type || form.action || 'accept'
  const isNatActionSelected = ['dnat', 'snat', 'masquerade', 'redirect'].includes(String(selectedAction))

  async function refresh() {
    setError(null)
    try {
      const [fwState, fwSets, fwMaps, fwTables] = await Promise.all([getFirewallState(props.auth), getFirewallSets(props.auth), getFirewallMaps(props.auth), getFirewallTables(props.auth)])
      setState(fwState)
      setSetsState(fwSets)
      setMapsState(fwMaps)
      setTablesState(fwTables)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  React.useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.refreshNonce])

  React.useEffect(() => {
    void (async () => {
      try {
        setSchema(await getFirewallSchema(props.auth))
      } catch {
        // keep defaults if schema endpoint is unavailable
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.refreshNonce])

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh()
    }, 3000)
    return () => window.clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (addOpen && !editingRuleId) {
      const ruleTable = activeRuleTableName
      setForm((p) => ({ ...p, table: ruleTable, chain: activeChainOptions[0] || 'input' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuleTableName, addOpen, editingRuleId])

  React.useEffect(() => {
    if (!editingRuleId) return
    const live = (state?.rules || []).find((r) => r.id === editingRuleId)
    if (!live) return
    setForm((prev) => ({
      ...prev,
      runtime_packets: live.runtime_packets || 0,
      runtime_bytes: live.runtime_bytes || 0,
      runtime_pps: live.runtime_pps || 0,
      runtime_bps: live.runtime_bps || 0,
      runtime_history: live.runtime_history || [],
    }))
  }, [state, editingRuleId])

  React.useEffect(() => {
    if (!addOpen) return
    if (contextMode !== 'nat' && form.nat_type) {
      setForm((p) => ({ ...p, nat_type: null, to_addr: null, to_port: null }))
      return
    }
    if (contextMode === 'nat' && form.nat_type) {
      const chain = form.chain || 'prerouting'
      const allowedNat = schema?.tables?.nat?.nat_types_by_chain?.[chain] || ['dnat', 'redirect']
      if (!allowedNat.includes(form.nat_type)) {
        setForm((p) => ({ ...p, nat_type: null, to_addr: null, to_port: null }))
      }
    }
  }, [addOpen, form.chain, form.nat_type, contextMode, schema])

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)
    try {
      if (editingRuleId) await updateFirewallRule(props.auth, editingRuleId, form)
      else await createFirewallRule(props.auth, form)
      setForm(defaultRule)
      setEditingRuleId(null)
      setAddOpen(false)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onDelete(rule: FirewallRule) {
    if (!confirm('Delete this firewall rule?')) return
    setError(null)
    setIsBusy(true)
    try {
      await deleteFirewallRule(props.auth, rule.id)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabled(rule: FirewallRule, enabled: boolean) {
    setError(null)
    setIsBusy(true)
    try {
      await updateFirewallRule(props.auth, rule.id, { enabled })
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  function onDragStart(event: React.MouseEvent<HTMLDivElement>) {
    dragRef.current = { sx: event.clientX, sy: event.clientY, ox: winPos.x, oy: winPos.y }
    const onMove = (ev: MouseEvent) => {
      const s = dragRef.current
      if (!s) return
      setWinPos({ x: Math.max(8, s.ox + ev.clientX - s.sx), y: Math.max(8, s.oy + ev.clientY - s.sy) })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function openCreateWindow() {
    setEditingRuleId(null)
    setRuleEditorTab('base')
    setAdvOpen({ ...ADVANCED_SECTIONS_CLOSED })
    const ruleTable = activeRuleTableName
    setForm({ ...defaultRule, table: ruleTable, chain: activeChainOptions[0] || 'input' })
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 760) / 2) - 60) })
    setAddOpen(true)
  }

  function openEditWindow(rule: FirewallRule) {
    setEditingRuleId(rule.id)
    setRuleEditorTab('base')
    setAdvOpen({ ...ADVANCED_SECTIONS_CLOSED })
    setForm({
      table: rule.table,
      family: rule.family,
      chain: rule.chain,
      action: rule.action,
      proto: rule.proto || null,
      src: rule.src || null,
      dst: rule.dst || null,
      in_interface: rule.in_interface || null,
      out_interface: rule.out_interface || null,
      sport: rule.sport || null,
      dport: rule.dport || null,
      comment: rule.comment || null,
      runtime_packets: rule.runtime_packets || 0,
      runtime_bytes: rule.runtime_bytes || 0,
      runtime_pps: rule.runtime_pps || 0,
      runtime_bps: rule.runtime_bps || 0,
      runtime_history: rule.runtime_history || [],
      ct_state: rule.ct_state || null,
      user_id: rule.user_id || null,
      hour: rule.hour || null,
      dscp: rule.dscp || null,
      nat_type: rule.nat_type || null,
      target_chain: rule.target_chain || null,
      reject_type: rule.reject_type || null,
      to_addr: rule.to_addr || null,
      to_port: rule.to_port || null,
      nat_random: !!rule.nat_random,
      nat_fully_random: !!rule.nat_fully_random,
      nat_persistent: !!rule.nat_persistent,
      notrack: !!rule.notrack,
      mark_set: rule.mark_set || null,
      ct_mark_set: rule.ct_mark_set || null,
      log_prefix: rule.log_prefix || null,
      log_level: rule.log_level || null,
      fib_expr: rule.fib_expr || null,
      socket_expr: rule.socket_expr || null,
      rt_expr: rule.rt_expr || null,
      exthdr_expr: rule.exthdr_expr || null,
      raw_expr: rule.raw_expr || null,
      nftrace: !!rule.nftrace,
      tcp_flags: rule.tcp_flags || null,
      icmp_type: rule.icmp_type || null,
      icmp_code: rule.icmp_code || null,
      icmpv6_type: rule.icmpv6_type || null,
      icmpv6_code: rule.icmpv6_code || null,
      meta_length: rule.meta_length || null,
      meta_priority: rule.meta_priority || null,
      meta_cpu: rule.meta_cpu || null,
      meta_pkttype: rule.meta_pkttype || null,
      meta_iiftype: rule.meta_iiftype || null,
      meta_oiftype: rule.meta_oiftype || null,
      meta_iifgroup: rule.meta_iifgroup || null,
      meta_oifgroup: rule.meta_oifgroup || null,
      mark_match: rule.mark_match || null,
      ct_mark_match: rule.ct_mark_match || null,
      ct_status: rule.ct_status || null,
      ct_direction: rule.ct_direction || null,
      ct_expiration: rule.ct_expiration || null,
      ct_helper_match: rule.ct_helper_match || null,
      ct_label: rule.ct_label || null,
      ct_event: rule.ct_event || null,
      ct_original_saddr: rule.ct_original_saddr || null,
      ct_original_daddr: rule.ct_original_daddr || null,
      ct_reply_saddr: rule.ct_reply_saddr || null,
      ct_reply_daddr: rule.ct_reply_daddr || null,
      fib_check: rule.fib_check || null,
      socket_match: rule.socket_match || null,
      rt_nexthop: rule.rt_nexthop || null,
      ipv6_exthdrs: rule.ipv6_exthdrs || null,
      vlan_id: rule.vlan_id || null,
      ether_src: rule.ether_src || null,
      ether_dst: rule.ether_dst || null,
      ether_type: rule.ether_type || null,
      ct_helper_set: rule.ct_helper_set || null,
      ct_timeout_set: rule.ct_timeout_set || null,
      ct_expectation_set: rule.ct_expectation_set || null,
      limit_rate: rule.limit_rate || null,
      counter: !!rule.counter,
      enabled: rule.enabled,
    })
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 760) / 2) - 60) })
    setLiveChartPoints(buildEmptyLiveChart())
    setAddOpen(true)
  }

  const activeRuleTable = activeRuleTableName
  const visibleRules = (state?.rules || []).filter((r) => r.table === activeRuleTable)
  const sortedVisibleRules = React.useMemo(() => {
    const key = policySort.key
    if (!key) return visibleRules
    const rows = [...visibleRules]
    const dir = policySort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (key === 'packets') return dir * (Number(a.runtime_packets || 0) - Number(b.runtime_packets || 0))
      if (key === 'bytes') return dir * (Number(a.runtime_bytes || 0) - Number(b.runtime_bytes || 0))
      const value = (row: FirewallRule): string => {
        if (key === 'proto') return String(row.proto || 'any')
        if (key === 'src') return String(row.src || '')
        if (key === 'dst') return String(row.dst || '')
        if (key === 'sport') return String(row.sport || '')
        if (key === 'dport') return String(row.dport || '')
        if (key === 'in_interface') return String(row.in_interface || '')
        if (key === 'out_interface') return String(row.out_interface || '')
        if (key === 'ct_state') return String(row.ct_state || '')
        if (key === 'action') return String(row.action || '')
        if (key === 'chain') return String(row.chain || '')
        return ''
      }
      return dir * compareStr(value(a), value(b))
    })
    return rows
  }, [visibleRules, policySort])
  const visiblePolicyColSpan = React.useMemo(
    () => Math.max(1, POLICY_COLUMN_ORDER.reduce((acc, key) => acc + (visibleColumns[key] ? 1 : 0), 0)),
    [visibleColumns],
  )
  const firstVisiblePolicyColumn = React.useMemo<PolicySortKey>(
    () => POLICY_COLUMN_ORDER.find((key) => !!visibleColumns[key]) || 'chain',
    [visibleColumns],
  )
  const currentRulePackets = Number(form.runtime_packets || 0)
  const currentRuleBytes = Number(form.runtime_bytes || 0)
  const currentRulePps = Math.max(0, Number(form.runtime_pps || 0))
  const currentRuleBytesPerSec = Math.max(0, Number(form.runtime_bps || 0))
  const currentRuleBitrate = currentRuleBytesPerSec * 8

  React.useEffect(() => {
    liveRateRef.current = {
      pps: currentRulePps,
      bps: currentRuleBytesPerSec,
    }
  }, [currentRulePps, currentRuleBytesPerSec])

  React.useEffect(() => {
    if (!addOpen || !editingRuleId) {
      setLiveChartPoints(buildEmptyLiveChart())
      return
    }
    const history = Array.isArray(form.runtime_history) ? form.runtime_history : []
    const normalized = history
      .slice(-LIVE_CHART_WINDOW)
      .map((item) => ({
        pps: Math.max(0, Number(item?.pps || 0)),
        bps: Math.max(0, Number(item?.bps || 0)),
        ts: Number(item?.t || 0) * 1000,
      }))
    const padded = [
      ...Array.from({ length: Math.max(0, LIVE_CHART_WINDOW - normalized.length) }, () => ({ pps: 0, bps: 0, ts: Date.now() })),
      ...normalized,
    ].slice(-LIVE_CHART_WINDOW)
    setLiveChartPoints(padded.map((point, idx) => ({ slot: idx, ...point })))
  }, [addOpen, editingRuleId])

  React.useEffect(() => {
    if (!addOpen || !editingRuleId || ruleEditorTab !== 'stats') return
    const timer = window.setInterval(() => {
      const samplePps = Math.max(0, Number(liveRateRef.current.pps || 0))
      const sampleBps = Math.max(0, Number(liveRateRef.current.bps || 0))
      setLiveChartPoints((prev) => {
        const base = prev.length ? prev : buildEmptyLiveChart()
        const shifted = base.slice(1).map((point, idx) => ({ ...point, slot: idx }))
        shifted.push({ slot: LIVE_CHART_WINDOW - 1, pps: samplePps, bps: sampleBps, ts: Date.now() })
        return shifted
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [addOpen, editingRuleId, ruleEditorTab])

  const statsChart = React.useMemo(() => {
    const points = liveChartPoints.length ? liveChartPoints : buildEmptyLiveChart()
    const maxPps = Math.max(1, ...points.map((p) => p.pps))
    const maxBitsPerSec = Math.max(1, ...points.map((p) => p.bps * 8))
    return { points, maxPps, maxBitsPerSec }
  }, [liveChartPoints])

  async function onReorderDrop(targetRuleId: string, targetTableName: string, droppedRuleId?: string, droppedRuleTableName?: string) {
    const fromRuleId = droppedRuleId || dragRuleId
    const fromTableName = (droppedRuleTableName || dragRuleTableName || activeRuleTable).toLowerCase()
    if (!fromRuleId || fromRuleId === targetRuleId) return
    if (fromTableName !== String(targetTableName || '').toLowerCase()) return
    const ids = visibleRules.map((r) => r.id)
    const from = ids.indexOf(fromRuleId)
    const to = ids.indexOf(targetRuleId)
    if (from < 0 || to < 0 || from === to) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setError(null)
    setIsBusy(true)
    try {
      await reorderFirewallRules(props.auth, activeRuleTable, next)
      await refresh()
      setSelectedRuleIds([fromRuleId])
      setRuleAnchorId(fromRuleId)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setDragRuleId(null)
      setDragOverRuleId(null)
      setDragRuleTableName(null)
      setIsBusy(false)
    }
  }

  async function onReorderDropToEnd(targetTableName: string, droppedRuleId?: string, droppedRuleTableName?: string) {
    const fromRuleId = droppedRuleId || dragRuleId
    const fromTableName = (droppedRuleTableName || dragRuleTableName || activeRuleTable).toLowerCase()
    if (!fromRuleId) return
    if (fromTableName !== String(targetTableName || '').toLowerCase()) return
    const ids = visibleRules.map((r) => r.id)
    const from = ids.indexOf(fromRuleId)
    if (from < 0) return
    if (from === ids.length - 1) return
    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.push(moved)
    setError(null)
    setIsBusy(true)
    try {
      await reorderFirewallRules(props.auth, activeRuleTable, next)
      await refresh()
      setSelectedRuleIds([fromRuleId])
      setRuleAnchorId(fromRuleId)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setDragRuleId(null)
      setDragOverRuleId(null)
      setDragRuleTableName(null)
      setIsBusy(false)
    }
  }

  const isCollectionsTab = activeSection === 'collections'
  const isTablesTab = activeSection === 'table_builder'
  const isCustomRuleTableActive = !['filter', 'nat', 'raw', 'mangle'].includes(activeRuleTableName)
  const customTableNames = Array.from(new Set(tablesState.custom.filter((x) => x.enabled !== false).map((x) => x.table_name))).sort((a, b) => a.localeCompare(b))
  const tableRows = React.useMemo(() => [...tablesState.custom, ...tablesState.builtin], [tablesState.builtin, tablesState.custom])

  React.useEffect(() => {
    if (['filter', 'nat', 'raw', 'mangle'].includes(activeRuleTableName)) return
    const existsEnabled = tablesState.custom.some((x) => x.table_name === activeRuleTableName && x.enabled !== false)
    if (!existsEnabled) setActiveRuleTableName('filter')
  }, [activeRuleTableName, tablesState.custom])

  const allSetItems: Array<FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }> = [
    ...setsState.addr.map((x) => ({ ...x, kind: 'addr' as const })),
    ...setsState.port.map((x) => ({ ...x, kind: 'port' as const })),
    ...setsState.iface.map((x) => ({ ...x, kind: 'iface' as const })),
  ]
  const allMapItems: Array<FirewallMapItem & { kind: 'map' | 'vmap' }> = [
    ...mapsState.map.map((x) => ({ ...x, kind: 'map' as const })),
    ...mapsState.vmap.map((x) => ({ ...x, kind: 'vmap' as const })),
  ]
  const allCollectionItems: Array<(FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }) | (FirewallMapItem & { kind: 'map' | 'vmap' })> = [...allSetItems, ...allMapItems]
  const sortedCollectionItems = React.useMemo(() => {
    if (!collectionSort.key) return allCollectionItems
    const rows = [...allCollectionItems]
    const dir = collectionSort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (collectionSort.key === 'kind') return dir * compareStr(a.kind, b.kind)
      if (collectionSort.key === 'name') return dir * compareStr(String(a.name || ''), String(b.name || ''))
      if (collectionSort.key === 'status') {
        const av = a.enabled === false ? 'disabled' : 'enabled'
        const bv = b.enabled === false ? 'disabled' : 'enabled'
        return dir * compareStr(av, bv)
      }
      const av = a.kind === 'map' || a.kind === 'vmap'
        ? ((a as FirewallMapItem).entries || []).join(', ')
        : ((a as FirewallSetItem).elements || []).join(', ')
      const bv = b.kind === 'map' || b.kind === 'vmap'
        ? ((b as FirewallMapItem).entries || []).join(', ')
        : ((b as FirewallSetItem).elements || []).join(', ')
      return dir * compareStr(av, bv)
    })
    return rows
  }, [allCollectionItems, collectionSort])
  const sortedTableRows = React.useMemo(() => {
    const key = tableSort.key
    if (!key) return tableRows
    const rows = [...tableRows]
    const dir = tableSort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (key === 'priority') return dir * (Number(a.priority || 0) - Number(b.priority || 0))
      if (key === 'origin') return dir * compareStr(a.builtin ? 'built-in' : 'custom', b.builtin ? 'built-in' : 'custom')
      if (key === 'status') return dir * compareStr(a.enabled === false ? 'disabled' : 'enabled', b.enabled === false ? 'disabled' : 'enabled')
      const av = key === 'device' ? String(a.device || '') : String((a as Record<string, unknown>)[key] || '')
      const bv = key === 'device' ? String(b.device || '') : String((b as Record<string, unknown>)[key] || '')
      return dir * compareStr(av, bv)
    })
    return rows
  }, [tableRows, tableSort])
  const selectedCollection = sortedCollectionItems.find((x) => x.id === selectedCollectionIds[0]) || null

  function toggleCollectionSort(key: CollectionSortKey) {
    setCollectionSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  function toggleTableSort(key: TableSortKey) {
    setTableSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  function togglePolicySort(key: PolicySortKey) {
    setPolicySort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  function openCreateSetWindow() {
    setEditingSetId(null)
    setNewSetName('')
    setNewSetElements('')
    setNewSetComment('')
    setCollectionKind('addr')
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 360) / 2) - 40) })
    setSetOpen(true)
  }

  function openEditSetWindow(item: FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }) {
    setEditingSetId(item.id)
    setNewSetName(item.name || '')
    setNewSetElements((item.elements || []).join(', '))
    setNewSetComment(item.comment || '')
    setCollectionKind(item.kind)
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 360) / 2) - 40) })
    setSetOpen(true)
  }

  async function onSaveSet(): Promise<boolean> {
    setError(null)
    setIsBusy(true)
    try {
      const elements = newSetElements.split(',').map((x) => x.trim()).filter(Boolean)
      if (collectionKind === 'map' || collectionKind === 'vmap') {
        await upsertFirewallMap(props.auth, collectionKind, { id: editingSetId || undefined, name: newSetName.trim(), entries: elements, comment: newSetComment.trim() || null })
      } else {
        await upsertFirewallSet(props.auth, collectionKind, { id: editingSetId || undefined, name: newSetName.trim(), elements, comment: newSetComment.trim() || null })
      }
      setEditingSetId(null)
      setNewSetName('')
      setNewSetElements('')
      setNewSetComment('')
      await refresh()
      return true
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
      return false
    } finally {
      setIsBusy(false)
    }
  }

  async function onDeleteSet(item: FirewallSetItem, kind: 'addr' | 'port' | 'iface') {
    if (!confirm('Delete this set?')) return
    setError(null)
    setIsBusy(true)
    try {
      await deleteFirewallSet(props.auth, kind, item.id)
      setSelectedCollectionIds((prev) => prev.filter((id) => id !== item.id))
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabledSet(item: FirewallSetItem, kind: 'addr' | 'port' | 'iface', enabled: boolean) {
    setError(null)
    setIsBusy(true)
    try {
      await upsertFirewallSet(props.auth, kind, { id: item.id, name: item.name, elements: item.elements, enabled, comment: item.comment || null })
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  function openEditMapWindow(item: FirewallMapItem & { kind: 'map' | 'vmap' }) {
    setCollectionKind(item.kind)
    setEditingSetId(item.id)
    setNewSetName(item.name || '')
    setNewSetElements((item.entries || []).join(', '))
    setNewSetComment(item.comment || '')
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 360) / 2) - 40) })
    setSetOpen(true)
  }

  async function onDeleteMap(item: FirewallMapItem, kind: 'map' | 'vmap') {
    if (!confirm('Delete this map?')) return
    setError(null)
    setIsBusy(true)
    try {
      await deleteFirewallMap(props.auth, kind, item.id)
      setSelectedCollectionIds((prev) => prev.filter((id) => id !== item.id))
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabledMap(item: FirewallMapItem, kind: 'map' | 'vmap', enabled: boolean) {
    setError(null)
    setIsBusy(true)
    try {
      await upsertFirewallMap(props.auth, kind, {
        id: item.id,
        name: item.name,
        entries: item.entries || [],
        comment: item.comment || null,
        enabled,
      })
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  function openCreateTableWindow() {
    setEditingTableId(null)
    setNewTableFamily('inet')
    setNewTableName('')
    setNewChainName('')
    setNewChainType('filter')
    setNewHook('input')
    setNewDevice('')
    setNewPriority('-10')
    setNewPolicy('accept')
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 420) / 2) - 40) })
    setTableOpen(true)
  }

  function openEditTableWindow(item: FirewallTableItem) {
    if (item.builtin) return
    setEditingTableId(item.id)
    setNewTableFamily(item.family || 'inet')
    setNewTableName(item.table_name || '')
    setNewChainName(item.chain_name || '')
    setNewChainType((item.chain_type || 'filter') as 'filter' | 'nat' | 'route')
    setNewHook((item.hook || 'input') as 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress')
    setNewDevice(item.device || '')
    setNewPriority(String(item.priority ?? -10))
    setNewPolicy((item.policy || 'accept') as 'accept' | 'drop')
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 420) / 2) - 40) })
    setTableOpen(true)
  }

  async function onSaveTable(): Promise<boolean> {
    setError(null)
    const family = newTableFamily.trim().toLowerCase()
    const tableName = newTableName.trim()
    const chainName = newChainName.trim()
    const hook = newHook.trim().toLowerCase()
    const hookValue = newHook
    const priorityNum = Number(newPriority)
    const device = newDevice.trim() || null

    if (!tableName || !chainName) {
      setError('Table name and chain name are required.')
      return false
    }
    if (!Number.isFinite(priorityNum) || !Number.isInteger(priorityNum)) {
      setError('Priority must be an integer.')
      return false
    }
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
      setError('Table name allows only letters, numbers, and underscore.')
      return false
    }
    if (!/^[A-Za-z0-9_]+$/.test(chainName)) {
      setError('Chain name allows only letters, numbers, and underscore.')
      return false
    }

    const allRows = [...tablesState.builtin, ...tablesState.custom]
    const duplicateChainInTable = allRows.find((row) =>
      row.id !== editingTableId
      && row.family.toLowerCase() === family
      && row.table_name === tableName
      && row.chain_name === chainName
    )
    if (duplicateChainInTable) {
      setError(`Chain "${chainName}" already exists in table "${tableName}".`)
      return false
    }

    const hookPriorityConflict = allRows.find((row) =>
      row.id !== editingTableId
      && row.family.toLowerCase() === family
      && String(row.hook || '').toLowerCase() === hook
      && Number(row.priority) === priorityNum
    )
    if (hookPriorityConflict) {
      const origin = hookPriorityConflict.builtin ? 'built-in' : 'custom'
      setError(`Hook/priority conflict with ${origin} chain ${hookPriorityConflict.table_name}/${hookPriorityConflict.chain_name} (${hook}, ${priorityNum}).`)
      return false
    }

    setIsBusy(true)
    try {
      await upsertFirewallTable(props.auth, {
        id: editingTableId || undefined,
        family,
        table_name: tableName,
        chain_name: chainName,
        chain_type: newChainType,
        hook: hookValue,
        device,
        priority: priorityNum,
        policy: newPolicy,
        enabled: editingTableId ? (tablesState.custom.find((x) => x.id === editingTableId)?.enabled ?? true) : true,
      })
      setEditingTableId(null)
      await refresh()
      return true
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
      return false
    } finally {
      setIsBusy(false)
    }
  }

  async function onDeleteTable(item: FirewallTableItem) {
    if (item.builtin) return
    if (!confirm('Delete this custom table chain?')) return
    setError(null)
    setIsBusy(true)
    try {
      await deleteFirewallTable(props.auth, item.id)
      await refresh()
      setSelectedTableIds((prev) => prev.filter((id) => id !== item.id))
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabledTable(item: FirewallTableItem, enabled: boolean) {
    if (item.builtin) return
    setError(null)
    setIsBusy(true)
    try {
      await upsertFirewallTable(props.auth, {
        id: item.id,
        family: item.family,
        table_name: item.table_name,
        chain_name: item.chain_name,
        chain_type: item.chain_type,
        hook: item.hook,
        device: item.device || null,
        priority: Number(item.priority),
        policy: item.policy,
        enabled,
      })
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  const selectedRules = visibleRules.filter((r) => selectedRuleIds.includes(r.id))
  const selectedCollections = allCollectionItems.filter((r) => selectedCollectionIds.includes(r.id))
  const selectedCustomTables = tableRows.filter((r) => selectedTableIds.includes(r.id) && !r.builtin)

  async function onDeleteSelectedRules() {
    if (!selectedRules.length) return
    if (!confirm(`Delete ${selectedRules.length} selected rule(s)?`)) return
    setError(null)
    setIsBusy(true)
    try {
      for (const rule of selectedRules) await deleteFirewallRule(props.auth, rule.id)
      setSelectedRuleIds([])
      setRuleAnchorId(null)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabledSelectedRules(enabled: boolean) {
    if (!selectedRules.length) return
    setError(null)
    setIsBusy(true)
    try {
      for (const rule of selectedRules) await updateFirewallRule(props.auth, rule.id, { enabled })
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onDeleteSelectedCollections() {
    if (!selectedCollections.length) return
    if (!confirm(`Delete ${selectedCollections.length} selected collection item(s)?`)) return
    setError(null)
    setIsBusy(true)
    try {
      for (const item of selectedCollections) {
        if (item.kind === 'map' || item.kind === 'vmap') await deleteFirewallMap(props.auth, item.kind, item.id)
        else await deleteFirewallSet(props.auth, item.kind, item.id)
      }
      setSelectedCollectionIds([])
      setCollectionAnchorId(null)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabledSelectedCollections(enabled: boolean) {
    if (!selectedCollections.length) return
    setError(null)
    setIsBusy(true)
    try {
      for (const item of selectedCollections) {
        if (item.kind === 'map' || item.kind === 'vmap') {
          const mapItem = item as FirewallMapItem & { kind: 'map' | 'vmap' }
          await upsertFirewallMap(props.auth, mapItem.kind, {
            id: mapItem.id,
            name: mapItem.name,
            entries: mapItem.entries || [],
            comment: mapItem.comment || null,
            enabled,
          })
        } else {
          const setItem = item as FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }
          await upsertFirewallSet(props.auth, setItem.kind, {
            id: setItem.id,
            name: setItem.name,
            elements: setItem.elements || [],
            enabled,
            comment: setItem.comment || null,
          })
        }
      }
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onDeleteSelectedTables() {
    if (!selectedCustomTables.length) return
    if (!confirm(`Delete ${selectedCustomTables.length} selected custom table chain(s)?`)) return
    setError(null)
    setIsBusy(true)
    try {
      for (const row of selectedCustomTables) await deleteFirewallTable(props.auth, row.id)
      setSelectedTableIds([])
      setTableAnchorId(null)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabledSelectedTables(enabled: boolean) {
    if (!selectedCustomTables.length) return
    setError(null)
    setIsBusy(true)
    try {
      for (const item of selectedCustomTables) {
        await upsertFirewallTable(props.auth, {
          id: item.id,
          family: item.family,
          table_name: item.table_name,
          chain_name: item.chain_name,
          chain_type: item.chain_type,
          hook: item.hook,
          device: item.device || null,
          priority: Number(item.priority),
          policy: item.policy,
          enabled,
        })
      }
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 w-full flex-col gap-2 overflow-x-hidden'>
      <div><h2 className='text-lg font-semibold tracking-tight'>Firewall</h2></div>
      {error ? <div className='rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'>{error}</div> : null}
      <Card className='flex min-h-0 w-full flex-1 flex-col overflow-x-hidden text-xs'>
        <CardContent className='flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-4 pt-0'>
          <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as FirewallSectionTab)}>
            <TabsList className='h-9'>
              <TabsTrigger className='px-4 text-sm' value='policy'>policy</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='collections'>collections</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='table_builder'>table builder</TabsTrigger>
            </TabsList>
          </Tabs>
          {!isCollectionsTab && !isTablesTab ? (
            <div className='flex min-w-0 w-full items-center gap-2 overflow-hidden'>
              <div className='shrink-0'>
                <Tabs
                  value={isCustomRuleTableActive ? '__custom__' : activePolicyTab}
                  onValueChange={(v) => {
                    const next = v as FirewallPolicyTab
                    setActivePolicyTab(next)
                    setActiveRuleTableName(next)
                  }}
                >
                  <TabsList className='h-9'>
                    <TabsTrigger className='px-4 text-sm' value='filter'>filter</TabsTrigger>
                    <TabsTrigger className='px-4 text-sm' value='nat'>nat</TabsTrigger>
                    <TabsTrigger className='px-4 text-sm' value='raw'>raw</TabsTrigger>
                    <TabsTrigger className='px-4 text-sm' value='mangle'>mangle</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {customTableNames.length ? (
                <div className='min-w-0 max-w-full basis-0 flex-1'>
                  <Select
                    value={isCustomRuleTableActive ? activeRuleTableName : '__none__'}
                    onValueChange={(v) => {
                      if (v === '__none__') {
                        setActiveRuleTableName(activePolicyTab)
                        return
                      }
                      const row = tablesState.custom.find((x) => x.table_name === v)
                      if (row) {
                        setSelectedTableIds([row.id])
                        setTableAnchorId(row.id)
                      }
                      setActiveRuleTableName(v)
                      setActiveSection('policy')
                    }}
                  >
                    <SelectTrigger className='h-9 w-full border-amber-300 bg-amber-50 text-sm'>
                      <SelectValue placeholder='Custom table (optional)' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>System table only</SelectItem>
                      {customTableNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          {!isCollectionsTab && !isTablesTab ? <div className='flex gap-2'>
            <Button size='sm' onClick={openCreateWindow} disabled={isBusy}><Plus />Add</Button>
            <Button size='sm' variant='destructive' disabled={isBusy || !selectedRuleIds.length} onClick={() => void onDeleteSelectedRules()}>Del</Button>
            <Button size='sm' variant='outline' disabled={isBusy || !selectedRuleIds.length} onClick={() => void onSetEnabledSelectedRules(false)}>Disable</Button>
            <Button size='sm' disabled={isBusy || !selectedRuleIds.length} onClick={() => void onSetEnabledSelectedRules(true)}>Enable</Button>
            <Button
              size='sm'
              variant='outline'
              disabled={isBusy}
              onClick={async () => {
                setError(null)
                setIsBusy(true)
                try {
                  await resetFirewallCounters(props.auth, activeRuleTable)
                  if (addOpen && editingRuleId) {
                    setLiveChartPoints(buildEmptyLiveChart())
                    setForm((prev) => ({
                      ...prev,
                      runtime_packets: 0,
                      runtime_bytes: 0,
                      runtime_pps: 0,
                      runtime_bps: 0,
                      runtime_history: [],
                    }))
                  }
                  await refresh()
                } catch (exc) {
                  setError(exc instanceof Error ? exc.message : String(exc))
                } finally {
                  setIsBusy(false)
                }
              }}
            >
              Reset counters
            </Button>
            <DropdownMenu open={columnsOpen} onOpenChange={setColumnsOpen}>
              <DropdownMenuTrigger asChild>
                <Button size='sm' variant='outline'>Columns</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='start'
                side='bottom'
                sideOffset={6}
                className='z-[120] min-w-56 p-1.5'
              >
                {POLICY_COLUMN_ORDER.map((key) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    className='text-xs'
                    checked={!!visibleColumns[key]}
                    onCheckedChange={(checked) => {
                      setVisibleColumns((prev) => ({ ...prev, [key]: !!checked }))
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {POLICY_COLUMN_LABELS[key]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div> : isCollectionsTab ? (
            <div className='flex min-h-0 flex-1 flex-col gap-2'>
              <div className='flex gap-2'>
                <Button size='sm' onClick={openCreateSetWindow} disabled={isBusy}><Plus />Add</Button>
                <Button
                  size='sm'
                  variant='destructive'
                  disabled={isBusy || !selectedCollectionIds.length}
                  onClick={() => {
                    void onDeleteSelectedCollections()
                  }}
                >
                  Del
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={isBusy || !selectedCollectionIds.length}
                  onClick={() => {
                    void onSetEnabledSelectedCollections(false)
                  }}
                >
                  Disable
                </Button>
                <Button
                  size='sm'
                  disabled={isBusy || !selectedCollectionIds.length}
                  onClick={() => {
                    void onSetEnabledSelectedCollections(true)
                  }}
                >
                  Enable
                </Button>
              </div>
              <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleCollectionSort('kind')}>Type <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(collectionSort.key === 'kind', collectionSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleCollectionSort('name')}>Name <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(collectionSort.key === 'name', collectionSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleCollectionSort('values')}>Values <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(collectionSort.key === 'values', collectionSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleCollectionSort('status')}>Status <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(collectionSort.key === 'status', collectionSort.dir)}</span></button></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCollectionItems.map((row) => (
                      <TableRow
                        key={row.id}
                        className={`${row.comment ? 'h-9' : 'h-7'} cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selectedCollectionIds.includes(row.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${row.enabled === false ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
                        onMouseDown={(e) => {
                          if (e.shiftKey) e.preventDefault()
                        }}
                        onClick={(e) => {
                          const ordered = sortedCollectionItems.map((x) => x.id)
                          const next = computeSelection(ordered, selectedCollectionIds, collectionAnchorId, row.id, e)
                          setSelectedCollectionIds(next.selected)
                          setCollectionAnchorId(next.anchor)
                        }}
                        onDoubleClick={() => {
                          if (row.kind === 'map' || row.kind === 'vmap') openEditMapWindow(row as FirewallMapItem & { kind: 'map' | 'vmap' })
                          else openEditSetWindow(row as FirewallSetItem & { kind: 'addr' | 'port' | 'iface' })
                        }}
                      >
                        <TableCell className={row.comment ? 'relative align-bottom pb-0.5 pt-2' : undefined}>
                          {row.comment ? (
                            <div className='pointer-events-none absolute left-2 top-0.5 z-10 whitespace-nowrap text-[10px] font-bold leading-none text-black'>
                              # {row.comment}
                            </div>
                          ) : null}
                          <span className={row.comment ? 'block pt-1' : ''}>{(row as { kind: string }).kind}</span>
                        </TableCell>
                        <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.name}</span></TableCell>
                        <TableCell className={`max-w-[700px] truncate ${row.comment ? 'align-bottom pb-0.5 pt-2' : ''}`}>
                          <span className={row.comment ? 'block pt-1' : ''}>{(row.kind === 'map' || row.kind === 'vmap') ? (((row as FirewallMapItem).entries || []).join(', ') || '—') : (((row as FirewallSetItem).elements || []).join(', ') || '—')}</span>
                        </TableCell>
                        <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.enabled === false ? 'disabled' : 'enabled'}</span></TableCell>
                      </TableRow>
                    ))}
                    {!allCollectionItems.length
                      ? <TableRow><TableCell colSpan={4} className='py-6 text-center text-xs text-muted-foreground'>No collections yet.</TableCell></TableRow>
                      : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : isTablesTab ? (
            <div className='flex min-h-0 flex-1 flex-col gap-2'>
              <div className='flex gap-2'>
                <Button size='sm' onClick={openCreateTableWindow} disabled={isBusy}><Plus />Add</Button>
                <Button size='sm' variant='destructive' disabled={isBusy || !selectedCustomTables.length} onClick={() => void onDeleteSelectedTables()}>Del</Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={isBusy || !selectedCustomTables.length}
                  onClick={() => void onSetEnabledSelectedTables(false)}
                >
                  Disable
                </Button>
                <Button
                  size='sm'
                  disabled={isBusy || !selectedCustomTables.length}
                  onClick={() => void onSetEnabledSelectedTables(true)}
                >
                  Enable
                </Button>
              </div>
              <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('family')}>Family <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'family', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('table_name')}>Table name <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'table_name', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('chain_name')}>Chain name <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'chain_name', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('chain_type')}>Chain type <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'chain_type', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('hook')}>Hook <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'hook', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('device')}>Device <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'device', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('priority')}>Priority <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'priority', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('policy')}>Policy <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'policy', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('origin')}>Origin <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'origin', tableSort.dir)}</span></button></TableHead>
                      <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => toggleTableSort('status')}>Status <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(tableSort.key === 'status', tableSort.dir)}</span></button></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTableRows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={`h-7 cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selectedTableIds.includes(row.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${row.enabled === false ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
                        onMouseDown={(e) => {
                          if (e.shiftKey) e.preventDefault()
                        }}
                        onClick={(e) => {
                          const ordered = sortedTableRows.map((x) => x.id)
                          const next = computeSelection(ordered, selectedTableIds, tableAnchorId, row.id, e)
                          setSelectedTableIds(next.selected)
                          setTableAnchorId(next.anchor)
                        }}
                        onDoubleClick={() => {
                          if (row.builtin) return
                          openEditTableWindow(row)
                        }}
                      >
                        <TableCell>{row.family}</TableCell>
                        <TableCell>{row.table_name}</TableCell>
                        <TableCell>{row.chain_name}</TableCell>
                        <TableCell>{row.chain_type}</TableCell>
                        <TableCell>{row.hook}</TableCell>
                        <TableCell>{row.device || '—'}</TableCell>
                        <TableCell>{row.priority}</TableCell>
                        <TableCell>{row.policy}</TableCell>
                        <TableCell>{row.builtin ? 'built-in' : 'custom'}</TableCell>
                        <TableCell>{row.enabled === false ? 'disabled' : 'enabled'}</TableCell>
                      </TableRow>
                    ))}
                    {(!tablesState.builtin.length && !tablesState.custom.length) ? <TableRow><TableCell colSpan={10} className='py-6 text-center text-xs text-muted-foreground'>No table chains yet.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
          {!isCollectionsTab && !isTablesTab ? <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.chain ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('chain')}>{POLICY_COLUMN_LABELS.chain} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'chain', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.action ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('action')}>{POLICY_COLUMN_LABELS.action} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'action', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.proto ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('proto')}>{POLICY_COLUMN_LABELS.proto} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'proto', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.src ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('src')}>{POLICY_COLUMN_LABELS.src} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'src', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.dst ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('dst')}>{POLICY_COLUMN_LABELS.dst} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'dst', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.sport ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('sport')}>{POLICY_COLUMN_LABELS.sport} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'sport', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.dport ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('dport')}>{POLICY_COLUMN_LABELS.dport} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'dport', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.in_interface ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('in_interface')}>{POLICY_COLUMN_LABELS.in_interface} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'in_interface', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.out_interface ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('out_interface')}>{POLICY_COLUMN_LABELS.out_interface} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'out_interface', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.ct_state ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('ct_state')}>{POLICY_COLUMN_LABELS.ct_state} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'ct_state', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.packets ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('packets')}>{POLICY_COLUMN_LABELS.packets} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'packets', policySort.dir)}</span></button></TableHead> : null}
                  {visibleColumns.bytes ? <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => togglePolicySort('bytes')}>{POLICY_COLUMN_LABELS.bytes} <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(policySort.key === 'bytes', policySort.dir)}</span></button></TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVisibleRules.map((r) => {
                  const renderPolicyCell = (key: PolicySortKey, value: React.ReactNode, nowrap = false) => {
                    if (!visibleColumns[key]) return null
                    const commentHost = !!r.comment && firstVisiblePolicyColumn === key
                    return (
                      <TableCell className={`${r.comment ? 'relative align-bottom pb-0.5 pt-2' : ''} ${nowrap ? 'whitespace-nowrap' : ''}`}>
                        {commentHost ? (
                          <div className='pointer-events-none absolute left-2 top-0.5 z-10 whitespace-nowrap text-[10px] font-bold leading-none text-black'>
                            # {r.comment}
                          </div>
                        ) : null}
                        <span className={r.comment ? 'block pt-1' : ''}>{value}</span>
                      </TableCell>
                    )
                  }
                  return (
                    <TableRow
                      key={r.id}
                      draggable={!policySort.key}
                      onDragStart={(e) => {
                        if (policySort.key) return
                        setDragRuleId(r.id)
                        setDragRuleTableName(String(r.table || activeRuleTable))
                        try {
                          e.dataTransfer.setData('text/plain', r.id)
                          e.dataTransfer.setData('application/x-awg-rule-table', String(r.table || activeRuleTable))
                          e.dataTransfer.effectAllowed = 'move'
                        } catch {
                          // Ignore dataTransfer write issues; local state still supports DnD.
                        }
                      }}
                      onDragEnd={() => {
                        setDragRuleId(null)
                        setDragOverRuleId(null)
                        setDragRuleTableName(null)
                      }}
                      onDragOver={(e) => {
                        if (policySort.key) return
                        e.preventDefault()
                        if (dragRuleId !== r.id) setDragOverRuleId(r.id)
                      }}
                      onDragLeave={() => {
                        if (dragOverRuleId === r.id) setDragOverRuleId(null)
                      }}
                      onDrop={(e) => {
                        if (policySort.key) return
                        e.preventDefault()
                        let droppedId = ''
                        let droppedTable = ''
                        try {
                          droppedId = e.dataTransfer.getData('text/plain') || ''
                          droppedTable = e.dataTransfer.getData('application/x-awg-rule-table') || ''
                        } catch {
                          // fall back to state-managed drag data
                        }
                        setDragOverRuleId(null)
                        void onReorderDrop(r.id, String(r.table || activeRuleTable), droppedId || undefined, droppedTable || undefined)
                      }}
                      className={`${r.comment ? 'h-9' : 'h-7'} cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selectedRuleIds.includes(r.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${dragRuleId === r.id ? 'opacity-60' : ''} ${dragOverRuleId === r.id && dragRuleId !== r.id ? 'border-t-2 border-t-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : ''} ${!r.enabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
                      onMouseDown={(e) => {
                        if (e.shiftKey) e.preventDefault()
                      }}
                      onClick={(e) => {
                        const ordered = sortedVisibleRules.map((x) => x.id)
                        const next = computeSelection(ordered, selectedRuleIds, ruleAnchorId, r.id, e)
                        setSelectedRuleIds(next.selected)
                        setRuleAnchorId(next.anchor)
                      }}
                      onDoubleClick={() => openEditWindow(r)}
                    >
                      {renderPolicyCell('chain', r.chain)}
                      {renderPolicyCell('action', r.action)}
                      {renderPolicyCell('proto', r.proto || 'any')}
                      {renderPolicyCell('src', r.src || '—')}
                      {renderPolicyCell('dst', r.dst || '—')}
                      {renderPolicyCell('sport', r.sport || '—')}
                      {renderPolicyCell('dport', r.dport || '—')}
                      {renderPolicyCell('in_interface', r.in_interface || '—')}
                      {renderPolicyCell('out_interface', r.out_interface || '—')}
                      {renderPolicyCell('ct_state', r.ct_state || '—')}
                      {renderPolicyCell('packets', formatCounter(r.runtime_packets), true)}
                      {renderPolicyCell('bytes', formatCounter(r.runtime_bytes), true)}
                    </TableRow>
                  )
                })}
                {visibleRules.length && !policySort.key && !!dragRuleId ? (
                  <TableRow
                    className={`h-5 border-b ${dragOverRuleId === '__end__' ? 'bg-blue-50/50 dark:bg-blue-950/20 border-t-2 border-t-blue-500' : 'bg-muted/10'}`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverRuleId('__end__')
                    }}
                    onDragLeave={() => {
                      if (dragOverRuleId === '__end__') setDragOverRuleId(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      let droppedId = ''
                      let droppedTable = ''
                      try {
                        droppedId = e.dataTransfer.getData('text/plain') || ''
                        droppedTable = e.dataTransfer.getData('application/x-awg-rule-table') || ''
                      } catch {
                        // fall back to state-managed drag data
                      }
                      setDragOverRuleId(null)
                      void onReorderDropToEnd(String(activeRuleTable), droppedId || undefined, droppedTable || undefined)
                    }}
                  >
                    <TableCell colSpan={visiblePolicyColSpan} className='py-0 text-[1px] leading-none text-transparent select-none'>
                      .
                    </TableCell>
                  </TableRow>
                ) : null}
                {!visibleRules.length ? <TableRow><TableCell colSpan={visiblePolicyColSpan} className='py-6 text-center text-xs text-muted-foreground'>No rules in {activeRuleTable} table.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div> : null}
        </CardContent>
      </Card>

      {addOpen ? (
        <div className='fixed inset-0 z-40'>
          <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: winPos.x, top: winPos.y }}>
            <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={onDragStart}>
              <div className='flex items-center justify-between'>
                <span>{editingRuleId ? 'Edit Firewall Rule' : 'Add Firewall Rule'}</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => { setAddOpen(false); setEditingRuleId(null) }}><X className='size-3.5' /></button>
              </div>
            </div>
            <form className='flex max-h-[78vh] flex-col overflow-hidden rounded-b-xl bg-background text-xs' onSubmit={onSave}>
              <Tabs value={ruleEditorTab} onValueChange={(v) => setRuleEditorTab(v as EditorTab)} className='flex min-h-0 flex-1 flex-col'>
                <div className='z-20 border-b bg-background px-3 py-2'>
                  <TabsList className='h-9'>
                    <TabsTrigger className='px-3 text-xs' value='base'>Base match</TabsTrigger>
                    <TabsTrigger className='px-3 text-xs' value='advanced'>Advanced match</TabsTrigger>
                    <TabsTrigger className='px-3 text-xs' value='action'>Action</TabsTrigger>
                    <TabsTrigger className='px-3 text-xs' value='stats'>Statistics</TabsTrigger>
                  </TabsList>
                </div>
                <div className='min-h-0 flex-1 overflow-y-auto p-3'>

                <TabsContent value='base' className='mt-2 space-y-2.5'>
                  <div className='text-[11px] font-semibold text-muted-foreground'>Rule state</div>
                  <label className='flex items-center gap-2 text-xs rounded-md border p-2'><input type='checkbox' className='h-4 w-4' checked={!!form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />enabled</label>
                  <div className='space-y-1.5'>
                    <Label>Comment</Label>
                    <Input className='h-7' placeholder='Rule comment (optional)' value={form.comment || ''} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value || null }))} />
                  </div>

                  <div className='text-[11px] font-semibold text-muted-foreground'>Base rule placement</div>
                  <div className='space-y-1.5'>
                    <Label>Chain</Label>
                    <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.chain || 'input'} onChange={(e) => setForm((p) => ({ ...p, chain: e.target.value }))}>
                      {(
                        builtinRuleTables.has(String(form.table || '').toLowerCase())
                          ? (chainOptionsByTable[String(form.table || 'filter').toLowerCase()] || [])
                          : ((customChainRowsByTable[String(form.table || '').toLowerCase()] || []).map((row) => row.chain_name).filter(Boolean))
                      ).map((ch) => (<option key={ch} value={ch}>{ch}</option>))}
                    </select>
                  </div>

                  <div className='text-[11px] font-semibold text-muted-foreground'>L3 address match</div>
                  {hasSupport('src') || hasSupport('dst') ? <div className='grid grid-cols-2 gap-2'>
                    {hasSupport('src') ? <ToggleLine label='Source address' enabled={!!form.src} inactiveHint='192.168.1.0/24 or @trusted_hosts' onToggle={() => setForm((p) => ({ ...p, src: p.src ? null : '0.0.0.0/0' }))}>
                      <Input className='h-7' placeholder='192.168.1.0/24 or @trusted_hosts' value={form.src || ''} onChange={(e) => setForm((p) => ({ ...p, src: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                    {hasSupport('dst') ? <ToggleLine label='Destination address' enabled={!!form.dst} inactiveHint='10.0.0.10 or @servers' onToggle={() => setForm((p) => ({ ...p, dst: p.dst ? null : '10.8.0.0/24' }))}>
                      <Input className='h-7' placeholder='10.0.0.10 or @servers' value={form.dst || ''} onChange={(e) => setForm((p) => ({ ...p, dst: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                  </div> : null}

                  <div className='text-[11px] font-semibold text-muted-foreground'>L4 protocol and port match</div>
                  {hasSupport('proto') ? <ToggleLine label='Protocol' enabled={!!form.proto} inactiveHint='any / tcp / udp / icmp' onToggle={() => setForm((p) => ({ ...p, proto: p.proto ? null : 'tcp', sport: p.proto ? null : p.sport, dport: p.proto ? null : p.dport }))}>
                    <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.proto || ''} onChange={(e) => setForm((p) => ({ ...p, proto: (e.target.value || null) as any }))}>
                      <option value=''>any</option>
                      {(schema?.protos || ['tcp', 'udp', 'icmp', 'icmpv6']).map((proto) => <option key={proto} value={proto}>{proto}</option>)}
                      <option value='gre'>gre</option>
                      <option value='esp'>esp</option>
                    </select>
                  </ToggleLine> : null}
                  {hasSupport('sport') || hasSupport('dport') ? <div className='grid grid-cols-2 gap-2'>
                    {hasSupport('sport') ? <ToggleLine label='Source port' enabled={!!form.sport} inactiveHint='1024-65535 or @admin_ports' onToggle={() => setForm((p) => ({ ...p, sport: p.sport ? null : '1024:65535', proto: p.sport ? p.proto : (p.proto || 'tcp') }))}>
                      <Input className='h-7' placeholder='1024-65535 or @admin_ports' value={form.sport || ''} onChange={(e) => setForm((p) => ({ ...p, sport: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                    {hasSupport('dport') ? <ToggleLine label='Destination port' enabled={!!form.dport} inactiveHint='22,80,443 or @admin_ports' onToggle={() => setForm((p) => ({ ...p, dport: p.dport ? null : '22', proto: p.dport ? p.proto : (p.proto || 'tcp') }))}>
                      <Input className='h-7' placeholder='22, 80,443 or @admin_ports' value={form.dport || ''} onChange={(e) => setForm((p) => ({ ...p, dport: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                  </div> : null}

                  <div className='text-[11px] font-semibold text-muted-foreground'>Interface match</div>
                  {hasSupport('in_interface') || hasSupport('out_interface') ? <div className='grid grid-cols-2 gap-2'>
                    {hasSupport('in_interface') ? <ToggleLine label='Input interface' enabled={!!form.in_interface} inactiveHint='eth0 / lo / @lan_ifaces' onToggle={() => setForm((p) => ({ ...p, in_interface: p.in_interface ? null : 'eth0' }))}>
                      <Input className='h-7' placeholder='eth0 / lo / @lan_ifaces' value={form.in_interface || ''} onChange={(e) => setForm((p) => ({ ...p, in_interface: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                    {hasSupport('out_interface') ? <ToggleLine label='Output interface' enabled={!!form.out_interface} inactiveHint='eth0 / awg1 / @wan_ifaces' onToggle={() => setForm((p) => ({ ...p, out_interface: p.out_interface ? null : 'awg1' }))}>
                      <Input className='h-7' placeholder='eth0 / awg1 / @wan_ifaces' value={form.out_interface || ''} onChange={(e) => setForm((p) => ({ ...p, out_interface: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                  </div> : null}

                  <div className='text-[11px] font-semibold text-muted-foreground'>Connection tracking match</div>
                  {hasSupport('ct_state') && generalFieldState('ct_state') !== 'H' ? <ToggleLine label='Connection state' enabled={!!form.ct_state} inactiveHint='established,related / new / invalid' onToggle={() => setForm((p) => ({ ...p, ct_state: p.ct_state ? null : 'new' }))}>
                    <div className='grid grid-cols-2 gap-2 rounded-md border p-2'>
                      {(() => {
                        const flags = parseCtState(form.ct_state)
                        const setFlags = (patch: Partial<typeof flags>) => {
                          const next = { ...flags, ...patch }
                          if (patch.newState || patch.invalid || patch.untracked) {
                            if (patch.newState) {
                              next.invalid = false
                              next.untracked = false
                              next.established = false
                              next.related = false
                            }
                            if (patch.invalid) {
                              next.newState = false
                              next.untracked = false
                              next.established = false
                              next.related = false
                            }
                            if (patch.untracked) {
                              next.newState = false
                              next.invalid = false
                              next.established = false
                              next.related = false
                            }
                          }
                          if (patch.established || patch.related) {
                            next.newState = false
                            next.invalid = false
                            next.untracked = false
                          }
                          setForm((p) => ({ ...p, ct_state: buildCtState(next) }))
                        }
                        return (
                          <>
                            <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.established} onChange={(e) => setFlags({ established: e.target.checked })} />established</label>
                            <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.related} onChange={(e) => setFlags({ related: e.target.checked })} />related</label>
                            <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.newState} onChange={(e) => setFlags({ newState: e.target.checked })} />new</label>
                            <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.invalid} onChange={(e) => setFlags({ invalid: e.target.checked })} />invalid</label>
                            <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.untracked} onChange={(e) => setFlags({ untracked: e.target.checked })} />untracked</label>
                          </>
                        )
                      })()}
                    </div>
                  </ToggleLine> : null}
                  <div className='grid grid-cols-2 gap-2'>
                    <ToggleLine label='Connection mark' enabled={!!form.ct_mark_match} inactiveHint='0x1 / 10' onToggle={() => setForm((p) => ({ ...p, ct_mark_match: p.ct_mark_match ? null : '0x1' }))}>
                      <Input className='h-7' placeholder='0x1 / 10' value={form.ct_mark_match || ''} onChange={(e) => setForm((p) => ({ ...p, ct_mark_match: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='Packet mark' enabled={!!form.mark_match} inactiveHint='0x1 / 10' onToggle={() => setForm((p) => ({ ...p, mark_match: p.mark_match ? null : '0x1' }))}>
                      <Input className='h-7' placeholder='0x1 / 10' value={form.mark_match || ''} onChange={(e) => setForm((p) => ({ ...p, mark_match: e.target.value || null }))} />
                    </ToggleLine>
                  </div>

                  <div className='text-[11px] font-semibold text-muted-foreground'>Meta match</div>
                  <div className='grid grid-cols-2 gap-2'>
                    {hasSupport('limit_rate') ? <ToggleLine label='Rate limit' enabled={!!form.limit_rate} inactiveHint='10/second' onToggle={() => setForm((p) => ({ ...p, limit_rate: p.limit_rate ? null : '10/second' }))}>
                      <Input className='h-7' placeholder='10/second' value={form.limit_rate || ''} onChange={(e) => setForm((p) => ({ ...p, limit_rate: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                    <ToggleLine label='User ID' enabled={!!form.user_id} inactiveHint='1000' onToggle={() => setForm((p) => ({ ...p, user_id: p.user_id ? null : '1000' }))}>
                      <Input className='h-7' placeholder='1000' value={form.user_id || ''} onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value || null }))} />
                    </ToggleLine>
                  </div>
                  <div className='grid grid-cols-2 gap-2'>
                    <ToggleLine label='Hour' enabled={!!form.hour} inactiveHint='08:00-18:00' onToggle={() => setForm((p) => ({ ...p, hour: p.hour ? null : '08:00-18:00' }))}>
                      <Input className='h-7' placeholder='08:00-18:00' value={form.hour || ''} onChange={(e) => setForm((p) => ({ ...p, hour: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='DSCP' enabled={!!form.dscp} inactiveHint='cs5 / 46' onToggle={() => setForm((p) => ({ ...p, dscp: p.dscp ? null : 'cs5' }))}>
                      <Input className='h-7' placeholder='cs5 / 46' value={form.dscp || ''} onChange={(e) => setForm((p) => ({ ...p, dscp: e.target.value || null }))} />
                    </ToggleLine>
                  </div>

                </TabsContent>

                <TabsContent value='advanced' className='mt-2 space-y-2.5'>
                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => setAdvOpen((p) => ({ ...p, l4: !p.l4 }))}>Network & L4 extras {advOpen.l4 ? '−' : '+'}</button>
                    {advOpen.l4 ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='tcp flags' enabled={!!form.tcp_flags} inactiveHint='syn / syn,ack' onToggle={() => setForm((p) => ({ ...p, tcp_flags: p.tcp_flags ? null : 'syn', proto: p.tcp_flags ? p.proto : (p.proto || 'tcp') }))}>
                        <Input className='h-7' placeholder='syn / syn,ack' value={form.tcp_flags || ''} onChange={(e) => setForm((p) => ({ ...p, tcp_flags: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='icmp type' enabled={!!form.icmp_type} inactiveHint='echo-request' onToggle={() => setForm((p) => ({ ...p, icmp_type: p.icmp_type ? null : 'echo-request', proto: p.icmp_type ? p.proto : (p.proto || 'icmp') }))}>
                        <Input className='h-7' placeholder='echo-request' value={form.icmp_type || ''} onChange={(e) => setForm((p) => ({ ...p, icmp_type: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='icmp code' enabled={!!form.icmp_code} inactiveHint='0' onToggle={() => setForm((p) => ({ ...p, icmp_code: p.icmp_code ? null : '0', proto: p.icmp_code ? p.proto : (p.proto || 'icmp') }))}>
                        <Input className='h-7' placeholder='0' value={form.icmp_code || ''} onChange={(e) => setForm((p) => ({ ...p, icmp_code: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='icmpv6 type' enabled={!!form.icmpv6_type} inactiveHint='echo-request' onToggle={() => setForm((p) => ({ ...p, icmpv6_type: p.icmpv6_type ? null : 'echo-request', proto: p.icmpv6_type ? p.proto : (p.proto || 'icmpv6') }))}>
                        <Input className='h-7' placeholder='echo-request' value={form.icmpv6_type || ''} onChange={(e) => setForm((p) => ({ ...p, icmpv6_type: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='icmpv6 code' enabled={!!form.icmpv6_code} inactiveHint='0' onToggle={() => setForm((p) => ({ ...p, icmpv6_code: p.icmpv6_code ? null : '0', proto: p.icmpv6_code ? p.proto : (p.proto || 'icmpv6') }))}>
                        <Input className='h-7' placeholder='0' value={form.icmpv6_code || ''} onChange={(e) => setForm((p) => ({ ...p, icmpv6_code: e.target.value || null }))} />
                      </ToggleLine>
                      <div />
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => setAdvOpen((p) => ({ ...p, meta: !p.meta }))}>Meta match {advOpen.meta ? '−' : '+'}</button>
                    {advOpen.meta ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta length' enabled={!!form.meta_length} inactiveHint='64-1500' onToggle={() => setForm((p) => ({ ...p, meta_length: p.meta_length ? null : '64-1500' }))}>
                        <Input className='h-7' placeholder='64-1500' value={form.meta_length || ''} onChange={(e) => setForm((p) => ({ ...p, meta_length: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta priority' enabled={!!form.meta_priority} inactiveHint='1:10 / 0x10' onToggle={() => setForm((p) => ({ ...p, meta_priority: p.meta_priority ? null : '1:10' }))}>
                        <Input className='h-7' placeholder='1:10 / 0x10' value={form.meta_priority || ''} onChange={(e) => setForm((p) => ({ ...p, meta_priority: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta pkttype' enabled={!!form.meta_pkttype} inactiveHint='host/multicast' onToggle={() => setForm((p) => ({ ...p, meta_pkttype: p.meta_pkttype ? null : 'host' }))}>
                        <Input className='h-7' placeholder='host/multicast' value={form.meta_pkttype || ''} onChange={(e) => setForm((p) => ({ ...p, meta_pkttype: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta cpu' enabled={!!form.meta_cpu} inactiveHint='0-3' onToggle={() => setForm((p) => ({ ...p, meta_cpu: p.meta_cpu ? null : '0' }))}>
                        <Input className='h-7' placeholder='0-3' value={form.meta_cpu || ''} onChange={(e) => setForm((p) => ({ ...p, meta_cpu: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta iiftype' enabled={!!form.meta_iiftype} inactiveHint='1 (ARPHRD_ETHER)' onToggle={() => setForm((p) => ({ ...p, meta_iiftype: p.meta_iiftype ? null : '1' }))}>
                        <Input className='h-7' placeholder='1 (ARPHRD_ETHER)' value={form.meta_iiftype || ''} onChange={(e) => setForm((p) => ({ ...p, meta_iiftype: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta oiftype' enabled={!!form.meta_oiftype} inactiveHint='1 (ARPHRD_ETHER)' onToggle={() => setForm((p) => ({ ...p, meta_oiftype: p.meta_oiftype ? null : '1' }))}>
                        <Input className='h-7' placeholder='1 (ARPHRD_ETHER)' value={form.meta_oiftype || ''} onChange={(e) => setForm((p) => ({ ...p, meta_oiftype: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta iifgroup' enabled={!!form.meta_iifgroup} inactiveHint='10' onToggle={() => setForm((p) => ({ ...p, meta_iifgroup: p.meta_iifgroup ? null : '10' }))}>
                        <Input className='h-7' placeholder='10' value={form.meta_iifgroup || ''} onChange={(e) => setForm((p) => ({ ...p, meta_iifgroup: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta oifgroup' enabled={!!form.meta_oifgroup} inactiveHint='10' onToggle={() => setForm((p) => ({ ...p, meta_oifgroup: p.meta_oifgroup ? null : '10' }))}>
                        <Input className='h-7' placeholder='10' value={form.meta_oifgroup || ''} onChange={(e) => setForm((p) => ({ ...p, meta_oifgroup: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='packet mark match' enabled={!!form.mark_match} inactiveHint='0x1 / 10' onToggle={() => setForm((p) => ({ ...p, mark_match: p.mark_match ? null : '0x1' }))}>
                        <Input className='h-7' placeholder='0x1 / 10' value={form.mark_match || ''} onChange={(e) => setForm((p) => ({ ...p, mark_match: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct mark match' enabled={!!form.ct_mark_match} inactiveHint='0x1 / 10' onToggle={() => setForm((p) => ({ ...p, ct_mark_match: p.ct_mark_match ? null : '0x1' }))}>
                        <Input className='h-7' placeholder='0x1 / 10' value={form.ct_mark_match || ''} onChange={(e) => setForm((p) => ({ ...p, ct_mark_match: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => setAdvOpen((p) => ({ ...p, ct: !p.ct }))}>Conntrack match {advOpen.ct ? '−' : '+'}</button>
                    {advOpen.ct ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct direction' enabled={!!form.ct_direction} inactiveHint='original/reply' onToggle={() => setForm((p) => ({ ...p, ct_direction: p.ct_direction ? null : 'original' }))}>
                        <Input className='h-7' placeholder='original/reply' value={form.ct_direction || ''} onChange={(e) => setForm((p) => ({ ...p, ct_direction: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct status' enabled={!!form.ct_status} inactiveHint='dnat,snat,assured' onToggle={() => setForm((p) => ({ ...p, ct_status: p.ct_status ? null : 'dnat' }))}>
                        <Input className='h-7' placeholder='dnat,snat,assured' value={form.ct_status || ''} onChange={(e) => setForm((p) => ({ ...p, ct_status: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct original saddr' enabled={!!form.ct_original_saddr} inactiveHint='192.168.1.10' onToggle={() => setForm((p) => ({ ...p, ct_original_saddr: p.ct_original_saddr ? null : '192.168.1.10' }))}>
                        <Input className='h-7' placeholder='192.168.1.10' value={form.ct_original_saddr || ''} onChange={(e) => setForm((p) => ({ ...p, ct_original_saddr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct original daddr' enabled={!!form.ct_original_daddr} inactiveHint='203.0.113.10' onToggle={() => setForm((p) => ({ ...p, ct_original_daddr: p.ct_original_daddr ? null : '203.0.113.10' }))}>
                        <Input className='h-7' placeholder='203.0.113.10' value={form.ct_original_daddr || ''} onChange={(e) => setForm((p) => ({ ...p, ct_original_daddr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct reply saddr' enabled={!!form.ct_reply_saddr} inactiveHint='203.0.113.10' onToggle={() => setForm((p) => ({ ...p, ct_reply_saddr: p.ct_reply_saddr ? null : '203.0.113.10' }))}>
                        <Input className='h-7' placeholder='203.0.113.10' value={form.ct_reply_saddr || ''} onChange={(e) => setForm((p) => ({ ...p, ct_reply_saddr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct reply daddr' enabled={!!form.ct_reply_daddr} inactiveHint='192.168.1.10' onToggle={() => setForm((p) => ({ ...p, ct_reply_daddr: p.ct_reply_daddr ? null : '192.168.1.10' }))}>
                        <Input className='h-7' placeholder='192.168.1.10' value={form.ct_reply_daddr || ''} onChange={(e) => setForm((p) => ({ ...p, ct_reply_daddr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct expiration' enabled={!!form.ct_expiration} inactiveHint='30s / 1m' onToggle={() => setForm((p) => ({ ...p, ct_expiration: p.ct_expiration ? null : '30s' }))}>
                        <Input className='h-7' placeholder='30s / 1m' value={form.ct_expiration || ''} onChange={(e) => setForm((p) => ({ ...p, ct_expiration: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct helper' enabled={!!form.ct_helper_match} inactiveHint='ftp / sip' onToggle={() => setForm((p) => ({ ...p, ct_helper_match: p.ct_helper_match ? null : 'ftp' }))}>
                        <Input className='h-7' placeholder='ftp / sip' value={form.ct_helper_match || ''} onChange={(e) => setForm((p) => ({ ...p, ct_helper_match: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct label' enabled={!!form.ct_label} inactiveHint='label_name / 0x1' onToggle={() => setForm((p) => ({ ...p, ct_label: p.ct_label ? null : '0x1' }))}>
                        <Input className='h-7' placeholder='label_name / 0x1' value={form.ct_label || ''} onChange={(e) => setForm((p) => ({ ...p, ct_label: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct event' enabled={!!form.ct_event} inactiveHint='new,related,destroy' onToggle={() => setForm((p) => ({ ...p, ct_event: p.ct_event ? null : 'new,related,destroy' }))}>
                        <Input className='h-7' placeholder='new,related,destroy' value={form.ct_event || ''} onChange={(e) => setForm((p) => ({ ...p, ct_event: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => setAdvOpen((p) => ({ ...p, fib: !p.fib }))}>FIB / socket / routing / L2 {advOpen.fib ? '−' : '+'}</button>
                    {advOpen.fib ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='fib expression' enabled={!!form.fib_expr} inactiveHint='fib daddr . iif oif exists' onToggle={() => setForm((p) => ({ ...p, fib_expr: p.fib_expr ? null : 'fib daddr . iif oif exists' }))}>
                        <Input className='h-7' placeholder='fib daddr . iif oif exists' value={form.fib_expr || ''} onChange={(e) => setForm((p) => ({ ...p, fib_expr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='socket expression' enabled={!!form.socket_expr} inactiveHint='socket transparent 1' onToggle={() => setForm((p) => ({ ...p, socket_expr: p.socket_expr ? null : 'socket transparent 1' }))}>
                        <Input className='h-7' placeholder='socket transparent 1' value={form.socket_expr || ''} onChange={(e) => setForm((p) => ({ ...p, socket_expr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='rt expression' enabled={!!form.rt_expr} inactiveHint='rt nexthop 192.168.0.1' onToggle={() => setForm((p) => ({ ...p, rt_expr: p.rt_expr ? null : 'rt nexthop 192.168.0.1' }))}>
                        <Input className='h-7' placeholder='rt nexthop 192.168.0.1' value={form.rt_expr || ''} onChange={(e) => setForm((p) => ({ ...p, rt_expr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='exthdr expression' enabled={!!form.exthdr_expr} inactiveHint='exthdr frag missing' onToggle={() => setForm((p) => ({ ...p, exthdr_expr: p.exthdr_expr ? null : 'exthdr frag missing' }))}>
                        <Input className='h-7' placeholder='exthdr frag missing' value={form.exthdr_expr || ''} onChange={(e) => setForm((p) => ({ ...p, exthdr_expr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='fib check' enabled={!!form.fib_check} inactiveHint='daddr type local' onToggle={() => setForm((p) => ({ ...p, fib_check: p.fib_check ? null : 'daddr type local' }))}>
                        <Input className='h-7' placeholder='daddr type local' value={form.fib_check || ''} onChange={(e) => setForm((p) => ({ ...p, fib_check: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='socket match' enabled={!!form.socket_match} inactiveHint='transparent 1' onToggle={() => setForm((p) => ({ ...p, socket_match: p.socket_match ? null : 'transparent 1' }))}>
                        <Input className='h-7' placeholder='transparent 1' value={form.socket_match || ''} onChange={(e) => setForm((p) => ({ ...p, socket_match: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='rt nexthop' enabled={!!form.rt_nexthop} inactiveHint='192.0.2.1' onToggle={() => setForm((p) => ({ ...p, rt_nexthop: p.rt_nexthop ? null : '192.0.2.1' }))}>
                        <Input className='h-7' placeholder='192.0.2.1' value={form.rt_nexthop || ''} onChange={(e) => setForm((p) => ({ ...p, rt_nexthop: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='vlan id' enabled={!!form.vlan_id} inactiveHint='10' onToggle={() => setForm((p) => ({ ...p, vlan_id: p.vlan_id ? null : '10' }))}>
                        <Input className='h-7' placeholder='10' value={form.vlan_id || ''} onChange={(e) => setForm((p) => ({ ...p, vlan_id: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ether src' enabled={!!form.ether_src} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => setForm((p) => ({ ...p, ether_src: p.ether_src ? null : 'aa:bb:cc:dd:ee:ff' }))}>
                        <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={form.ether_src || ''} onChange={(e) => setForm((p) => ({ ...p, ether_src: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ether dst' enabled={!!form.ether_dst} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => setForm((p) => ({ ...p, ether_dst: p.ether_dst ? null : 'aa:bb:cc:dd:ee:ff' }))}>
                        <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={form.ether_dst || ''} onChange={(e) => setForm((p) => ({ ...p, ether_dst: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ether type' enabled={!!form.ether_type} inactiveHint='0x0800' onToggle={() => setForm((p) => ({ ...p, ether_type: p.ether_type ? null : '0x0800' }))}>
                        <Input className='h-7' placeholder='0x0800' value={form.ether_type || ''} onChange={(e) => setForm((p) => ({ ...p, ether_type: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ipv6 extension headers' enabled={!!form.ipv6_exthdrs} inactiveHint='frag missing' onToggle={() => setForm((p) => ({ ...p, ipv6_exthdrs: p.ipv6_exthdrs ? null : 'frag missing' }))}>
                        <Input className='h-7' placeholder='frag missing' value={form.ipv6_exthdrs || ''} onChange={(e) => setForm((p) => ({ ...p, ipv6_exthdrs: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => setAdvOpen((p) => ({ ...p, raw: !p.raw }))}>Raw expression & debug {advOpen.raw ? '−' : '+'}</button>
                    {advOpen.raw ? <>
                    {hasSupport('raw_expr') ? (
                      <ToggleLine
                        label='raw expression'
                        enabled={!!form.raw_expr}
                        inactiveHint='meta length > 80 / ip protocol tcp'
                        onToggle={() => setForm((p) => ({ ...p, raw_expr: p.raw_expr ? null : 'meta length > 80' }))}
                      >
                        <Input
                          className='h-7'
                          placeholder='meta length > 80 / ip protocol tcp'
                          value={form.raw_expr || ''}
                          onChange={(e) => setForm((p) => ({ ...p, raw_expr: e.target.value || null }))}
                        />
                      </ToggleLine>
                    ) : (
                      <ToggleLine label='raw expression' enabled={false} inactiveHint='available in raw table only' onToggle={() => {}}>
                        <Input className='h-7' disabled placeholder='available in raw table only' />
                      </ToggleLine>
                    )}
                    <div className='grid grid-cols-2 gap-2'>
                      {hasSupport('nftrace') ? (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs'>
                          <input
                            type='checkbox'
                            className='h-4 w-4'
                            checked={!!form.nftrace}
                            onChange={(e) => setForm((p) => ({ ...p, nftrace: e.target.checked }))}
                          />
                          nftrace
                        </label>
                      ) : (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground'>
                          <input type='checkbox' disabled className='h-4 w-4' />
                          nftrace (raw table only)
                        </label>
                      )}
                      {hasSupport('notrack') ? (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs'>
                          <input
                            type='checkbox'
                            className='h-4 w-4'
                            checked={!!form.notrack}
                            onChange={(e) => setForm((p) => ({ ...p, notrack: e.target.checked }))}
                          />
                          notrack (advanced mode)
                        </label>
                      ) : (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground'>
                          <input type='checkbox' disabled className='h-4 w-4' />
                          notrack (raw table only)
                        </label>
                      )}
                    </div>
                    <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900'>Warning: `notrack` is usually meaningful only in raw prerouting/output contexts.</div>
                    </> : null}
                  </div>

                  <div className='rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground'>
                    Advanced fields are now grouped by purpose; backend enablement will be added block-by-block.
                  </div>
                </TabsContent>

                <TabsContent value='action' className='mt-2 space-y-2.5'>
                  <div className='text-[11px] font-semibold text-muted-foreground'>Verdict / Action</div>
                  <div className='space-y-1.5'>
                    <Label>Action</Label>
                    <select
                      className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                      value={String(selectedAction)}
                      onChange={(e) => {
                        const v = e.target.value
                        if (['dnat', 'snat', 'masquerade', 'redirect'].includes(v)) {
                          setForm((p) => ({ ...p, nat_type: v as any, action: 'accept', target_chain: null }))
                        } else {
                          setForm((p) => ({ ...p, action: v as FirewallRule['action'], nat_type: null }))
                        }
                      }}
                    >
                      <option value='accept'>accept</option>
                      <option value='drop'>drop</option>
                      <option value='reject'>reject</option>
                      <option value='jump'>jump</option>
                      <option value='goto'>goto</option>
                      <option value='return'>return</option>
                      <option value='dnat'>dnat</option>
                      <option value='snat'>snat</option>
                      <option value='masquerade'>masquerade</option>
                      <option value='redirect'>redirect</option>
                    </select>
                  </div>
                  <ToggleLine
                    label='Target / to'
                    inactiveHint='192.168.1.10:80 / chain_name / :8080'
                    enabled={isNatActionSelected || form.action === 'jump' || form.action === 'goto'}
                    onToggle={() => setForm((p) => ({ ...p, target_chain: p.target_chain ? null : 'input', to_addr: p.to_addr ? null : '192.168.1.10' }))}
                  >
                    <Input
                      className='h-7'
                      placeholder='192.168.1.10:80 / chain_name / :8080'
                      value={isNatActionSelected ? `${form.to_addr || ''}${form.to_port ? `:${form.to_port}` : ''}` : (form.target_chain || '')}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (isNatActionSelected) {
                          const [addr, port] = raw.split(':')
                          setForm((p) => ({ ...p, to_addr: addr || null, to_port: port || null }))
                        } else {
                          setForm((p) => ({ ...p, target_chain: raw || null }))
                        }
                      }}
                    />
                  </ToggleLine>

                  {form.action === 'reject' ? (
                    <div className='space-y-1.5 rounded-md border p-2'>
                      <Label>Reject with</Label>
                      <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.reject_type || 'default'} onChange={(e) => setForm((p) => ({ ...p, reject_type: e.target.value === 'default' ? null : e.target.value }))}>
                        <option value='default'>default</option>
                        <option value='icmpx port-unreachable'>icmpx port-unreachable</option>
                        <option value='icmpx admin-prohibited'>icmpx admin-prohibited</option>
                        <option value='icmp type host-unreachable'>icmp type host-unreachable</option>
                        <option value='tcp reset'>tcp reset</option>
                      </select>
                    </div>
                  ) : null}

                  {isNatActionSelected ? (
                    <div className='space-y-1.5 rounded-md border p-2'>
                      <Label>NAT options</Label>
                      <div className='flex flex-wrap items-center gap-3 text-xs'>
                        <label className='flex items-center gap-2'><input type='checkbox' className='h-4 w-4' checked={!!form.nat_random} onChange={(e) => setForm((p) => ({ ...p, nat_random: e.target.checked }))} />random</label>
                        <label className='flex items-center gap-2'><input type='checkbox' className='h-4 w-4' checked={!!form.nat_fully_random} onChange={(e) => setForm((p) => ({ ...p, nat_fully_random: e.target.checked }))} />fully-random</label>
                        <label className='flex items-center gap-2'><input type='checkbox' className='h-4 w-4' checked={!!form.nat_persistent} onChange={(e) => setForm((p) => ({ ...p, nat_persistent: e.target.checked }))} />persistent</label>
                      </div>
                    </div>
                  ) : null}

                  <div className='grid grid-cols-2 gap-2'>
                    {hasSupport('mark_set') ? <ToggleLine label='meta mark set' enabled={!!form.mark_set} inactiveHint='0x1 or 10' onToggle={() => setForm((p) => ({ ...p, mark_set: p.mark_set ? null : '0x1' }))}>
                      <Input className='h-7' placeholder='0x1 or 10' value={form.mark_set || ''} onChange={(e) => setForm((p) => ({ ...p, mark_set: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                    {hasSupport('ct_mark_set') ? <ToggleLine label='ct mark set' enabled={!!form.ct_mark_set} inactiveHint='0x1 or 10' onToggle={() => setForm((p) => ({ ...p, ct_mark_set: p.ct_mark_set ? null : '0x1' }))}>
                      <Input className='h-7' placeholder='0x1 or 10' value={form.ct_mark_set || ''} onChange={(e) => setForm((p) => ({ ...p, ct_mark_set: e.target.value || null }))} />
                    </ToggleLine> : <div />}
                  </div>
                  <div className='grid grid-cols-3 gap-2'>
                    <ToggleLine label='ct helper set' enabled={!!form.ct_helper_set} inactiveHint='ftp-standard' onToggle={() => setForm((p) => ({ ...p, ct_helper_set: p.ct_helper_set ? null : 'ftp-standard' }))}>
                      <Input className='h-7' placeholder='ftp-standard' value={form.ct_helper_set || ''} onChange={(e) => setForm((p) => ({ ...p, ct_helper_set: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='ct timeout set' enabled={!!form.ct_timeout_set} inactiveHint='customtimeout' onToggle={() => setForm((p) => ({ ...p, ct_timeout_set: p.ct_timeout_set ? null : 'customtimeout' }))}>
                      <Input className='h-7' placeholder='customtimeout' value={form.ct_timeout_set || ''} onChange={(e) => setForm((p) => ({ ...p, ct_timeout_set: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='ct expectation set' enabled={!!form.ct_expectation_set} inactiveHint='expect' onToggle={() => setForm((p) => ({ ...p, ct_expectation_set: p.ct_expectation_set ? null : 'expect' }))}>
                      <Input className='h-7' placeholder='expect' value={form.ct_expectation_set || ''} onChange={(e) => setForm((p) => ({ ...p, ct_expectation_set: e.target.value || null }))} />
                    </ToggleLine>
                  </div>

                  <div className='space-y-1.5 border-t pt-2'>
                    <ToggleLine
                      label='Log level'
                      enabled={!!form.log_level}
                      inactiveHint='info'
                      onToggle={() => setForm((p) => ({ ...p, log_level: p.log_level ? null : 'info' }))}
                    >
                      <select
                        className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                        value={form.log_level || 'info'}
                        onChange={(e) => setForm((p) => ({ ...p, log_level: (e.target.value || null) as any }))}
                      >
                        <option value='emerg'>emerg</option>
                        <option value='alert'>alert</option>
                        <option value='crit'>crit</option>
                        <option value='err'>err</option>
                        <option value='warn'>warn</option>
                        <option value='notice'>notice</option>
                        <option value='info'>info</option>
                        <option value='debug'>debug</option>
                      </select>
                    </ToggleLine>
                    <ToggleLine
                      label='Log prefix'
                      enabled={!!form.log_prefix}
                      inactiveHint='FW input:'
                      onToggle={() => setForm((p) => ({ ...p, log_prefix: p.log_prefix ? null : 'FW input:' }))}
                    >
                      <Input
                        className='h-7'
                        placeholder='FW input:'
                        value={form.log_prefix || ''}
                        onChange={(e) => setForm((p) => ({ ...p, log_prefix: e.target.value || null }))}
                      />
                    </ToggleLine>
                  </div>

                </TabsContent>

                <TabsContent value='stats' className='mt-2 space-y-2.5'>
                  {hasSupport('counter') ? <label className='flex items-center gap-2 text-xs'><input type='checkbox' className='h-4 w-4' checked={!!form.counter} onChange={(e) => setForm((p) => ({ ...p, counter: e.target.checked }))} />Enable nft `counter` for this rule</label> : null}
                  <div className='grid grid-cols-2 gap-2'>
                    <div className='space-y-1'>
                      <Label className='text-[11px]'>packets</Label>
                      <Input className='h-7 text-[12px]' disabled value={formatCounter(currentRulePackets)} />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-[11px]'>bytes</Label>
                      <Input className='h-7 text-[12px]' disabled value={formatBytesIEC(currentRuleBytes)} />
                    </div>
                  </div>
                  <div className='grid grid-cols-2 gap-2'>
                    <div className='space-y-1'>
                      <Label className='text-[11px]'>bit rate</Label>
                      <Input className='h-7 text-[12px]' disabled value={formatBitrate(currentRuleBitrate)} />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-[11px]'>packet rate</Label>
                      <Input className='h-7 text-[12px]' disabled value={formatPacketRate(currentRulePps)} />
                    </div>
                  </div>
                  <div className='rounded-md border p-2'>
                    <div className='mb-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground'>
                      <span>Current rule traffic</span>
                      <span className='rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700'>live</span>
                    </div>
                    <div className='rounded-md border bg-muted/20 p-2'>
                      <div className='h-28 w-full'>
                        <ResponsiveContainer width='100%' height='100%'>
                          <LineChart data={statsChart.points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='hsl(var(--border))' />
                            <XAxis dataKey='slot' tickLine={false} axisLine={false} tick={false} />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 10 }}
                              width={60}
                              orientation='right'
                              domain={[0, statsSeries === 'packets' ? statsChart.maxPps : statsChart.maxBitsPerSec]}
                              tickFormatter={(v) => (
                                statsSeries === 'packets'
                                  ? formatPacketRate(Number(v || 0))
                                  : formatBitrate(Number(v || 0))
                              )}
                            />
                            <Tooltip
                              contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                              labelFormatter={(_, payload) => {
                                const row = payload?.[0]?.payload as LiveChartPoint | undefined
                                return row?.ts ? new Date(row.ts).toLocaleTimeString() : ''
                              }}
                              formatter={(value, name) => [
                                name === 'pps'
                                  ? formatPacketRate(Number(value || 0))
                                  : formatBitrate(Number(value || 0)),
                                name === 'pps' ? 'packet rate' : 'bit rate',
                              ]}
                            />
                            {statsSeries === 'bytes' ? <Line type='linear' dataKey={(x: LiveChartPoint) => x.bps * 8} stroke='#2563eb' strokeWidth={2} dot={false} isAnimationActive={false} /> : null}
                            {statsSeries === 'packets' ? <Line type='linear' dataKey='pps' stroke='#2563eb' strokeWidth={2} dot={false} isAnimationActive={false} /> : null}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {!form.counter ? (
                        <div className='mt-1 rounded border border-dashed px-2 py-1 text-[10px] text-muted-foreground'>
                          Counter disabled: enable `nft counter` to collect live chart data.
                        </div>
                      ) : null}
                      <div className='mt-2 flex items-center justify-between text-[10px]'>
                        <div className='flex items-center gap-2'>
                          <button type='button' className={`rounded border px-2 py-1 ${statsSeries === 'packets' ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-background text-muted-foreground'}`} onClick={() => setStatsSeries('packets')}>Packet rate</button>
                          <button type='button' className={`rounded border px-2 py-1 ${statsSeries === 'bytes' ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-background text-muted-foreground'}`} onClick={() => setStatsSeries('bytes')}>Bit rate</button>
                        </div>
                        <div className='text-[11px] text-muted-foreground'>
                          {statsSeries === 'bytes'
                            ? <>Bit rate: <span className='font-medium text-foreground'>{formatBitrate(currentRuleBitrate)}</span></>
                            : <>Packet Rate: <span className='font-medium text-foreground'>{formatPacketRate(currentRulePps)}</span></>}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                </div>
              </Tabs>

              <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type='submit' disabled={isBusy}><Plus />{editingRuleId ? 'Save' : 'Add'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {setOpen ? (
        <div className='fixed inset-0 z-40'>
          <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: winPos.x, top: winPos.y }}>
            <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={onDragStart}>
              <div className='flex items-center justify-between'>
                <span>{editingSetId ? `Edit ${collectionKind}` : 'Add collection'}</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => setSetOpen(false)}><X className='size-3.5' /></button>
              </div>
            </div>
            <div className='flex max-h-[78vh] flex-col overflow-hidden rounded-b-xl bg-background text-xs'>
              <div className='flex-1 overflow-y-auto p-3 space-y-3'>
                <div className='space-y-1.5'>
                  <Label>Type</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={collectionKind} onChange={(e) => setCollectionKind(e.target.value as CollectionKind)}>
                    <option value='addr'>addr</option>
                    <option value='port'>port</option>
                    <option value='iface'>iface</option>
                    <option value='map'>map</option>
                    <option value='vmap'>vmap</option>
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>Name</Label>
                  <Input className='h-7' placeholder={collectionKind === 'map' || collectionKind === 'vmap' ? 'map_name' : 'set_name'} value={newSetName} onChange={(e) => setNewSetName(e.target.value)} />
                </div>
                <div className='space-y-1.5'>
                  <Label>{collectionKind === 'map' || collectionKind === 'vmap' ? 'Entries (comma-separated, key:value)' : 'Elements (comma-separated)'}</Label>
                  <Input
                    className='h-7'
                    placeholder={
                      collectionKind === 'iface'
                        ? 'eth0, awg1'
                        : collectionKind === 'port'
                          ? '22, 443, 51820'
                          : collectionKind === 'map' || collectionKind === 'vmap'
                            ? 'tcp:accept, udp:drop'
                            : '10.0.0.0/24, 192.168.1.0/24'
                    }
                    value={newSetElements}
                    onChange={(e) => setNewSetElements(e.target.value)}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>Comment</Label>
                  <Input className='h-7' placeholder='Optional comment' value={newSetComment} onChange={(e) => setNewSetComment(e.target.value)} />
                </div>
              </div>
              <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
                <Button type='button' variant='outline' onClick={() => setSetOpen(false)}>Cancel</Button>
                <Button type='button' disabled={isBusy || !newSetName.trim()} onClick={async () => { const ok = await onSaveSet(); if (ok) setSetOpen(false) }}><Plus />{editingSetId ? 'Save' : 'Add'}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tableOpen ? (
        <div className='fixed inset-0 z-40'>
          <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: winPos.x, top: winPos.y }}>
            <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={onDragStart}>
              <div className='flex items-center justify-between'>
                <span>{editingTableId ? 'Edit Table Chain' : 'Add Table Chain'}</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => setTableOpen(false)}><X className='size-3.5' /></button>
              </div>
            </div>
            <div className='flex max-h-[78vh] flex-col overflow-hidden rounded-b-xl bg-background text-xs'>
              <div className='flex-1 overflow-y-auto p-3 space-y-3'>
                <div className='space-y-1.5'><Label>Family</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={newTableFamily} onChange={(e) => setNewTableFamily(e.target.value)}><option value='inet'>inet</option></select></div>
                <div className='space-y-1.5'><Label>Table name</Label><Input className='h-7' placeholder='custom_table' value={newTableName} onChange={(e) => setNewTableName(e.target.value)} /></div>
                <div className='space-y-1.5'><Label>Chain name</Label><Input className='h-7' placeholder='input_custom' value={newChainName} onChange={(e) => setNewChainName(e.target.value)} /></div>
                <div className='grid grid-cols-2 gap-2'>
                  <div className='space-y-1.5'><Label>Chain type</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={newChainType} onChange={(e) => setNewChainType(e.target.value as any)}><option value='filter'>filter</option><option value='nat'>nat</option><option value='route'>route</option></select></div>
                  <div className='space-y-1.5'><Label>Hook</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={newHook} onChange={(e) => setNewHook(e.target.value as any)}><option value='prerouting'>prerouting</option><option value='input'>input</option><option value='forward'>forward</option><option value='output'>output</option><option value='postrouting'>postrouting</option><option value='ingress'>ingress</option></select></div>
                </div>
                <div className='space-y-1.5'><Label>Device</Label><Input className='h-7' placeholder='eth0 (optional)' value={newDevice} onChange={(e) => setNewDevice(e.target.value)} /></div>
                <div className='grid grid-cols-2 gap-2'>
                  <div className='space-y-1.5'><Label>Priority</Label><Input className='h-7' value={newPriority} onChange={(e) => setNewPriority(e.target.value)} /></div>
                  <div className='space-y-1.5'><Label>Policy</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={newPolicy} onChange={(e) => setNewPolicy(e.target.value as any)}><option value='accept'>accept</option><option value='drop'>drop</option></select></div>
                </div>
                <div className='rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900'>
                  Built-in priorities are reserved: -300, -150, -100, 0, 100.
                </div>
              </div>
              <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
                <Button type='button' variant='outline' onClick={() => setTableOpen(false)}>Cancel</Button>
                <Button type='button' disabled={isBusy || !newTableName.trim() || !newChainName.trim()} onClick={async () => { const ok = await onSaveTable(); if (ok) setTableOpen(false) }}><Plus />{editingTableId ? 'Save' : 'Add'}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
