import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthState, FirewallMapsState, FirewallNamedObjects, FirewallRule, FirewallSchema, FirewallSetsState, FirewallState, FirewallTableItem, FirewallTablesState } from './api'
import { getFirewallObjects } from './api'
import { CollectionsSection } from './firewall/CollectionsSection'
import { FirewallModalStack } from './firewall/FirewallModalStack'
import { FirewallObjectsPanel } from './firewall/FirewallObjectsPanel'
import { formatFirewallObjectSummary } from './firewall/firewallObjectSummary'
import { PolicyRulesTable } from './firewall/PolicyRulesTable'
import { FirewallSectionTabs } from './firewall/FirewallSectionTabs'
import { PolicySectionToolbar } from './firewall/PolicySectionToolbar'
import { TablesSection } from './firewall/TablesSection'
import { defaultFirewallObjectForm, type FirewallObjectForm } from './firewall/firewallObjectForm'
import type { DynamicSetStatementOption, VmapStatementOption } from './firewall/PolicyRuleEditorActionTab'
import { useFirewallObjectActions } from './firewall/useFirewallObjectActions'
import { useFirewallObjectEditor } from './firewall/useFirewallObjectEditor'
import { useFirewallObjectBindings } from './firewall/useFirewallObjectBindings'
import { useFirewallDataSync } from './firewall/useFirewallDataSync'
import { useFirewallPageGuards } from './firewall/useFirewallPageGuards'
import { buildEmptyLiveChart, LIVE_CHART_WINDOW, type LiveChartPoint } from './firewall/policyLiveChart'
import { formatBitrate, formatBytesIEC, formatCounter, formatDateTime, formatDurationClock, formatPacketRate, getCollectionRemainingSeconds, normalizeCollectionTimeoutInput } from './firewall/policyUtils'
import { usePolicyRuleFormContext } from './firewall/usePolicyRuleFormContext'
import { usePolicyRuleLiveStats } from './firewall/usePolicyRuleLiveStats'
import { usePolicyRulesView } from './firewall/usePolicyRulesView'
import { ToggleLine } from './firewall/RuleFieldControls'
import { computeSelection, sortIndicator, type SortDirection } from './firewall/selectionUtils'
import { useDraggableWindow } from './firewall/useDraggableWindow'
import { useFirewallBulkActions } from './firewall/useFirewallBulkActions'
import { useFirewallCollectionsTablesView } from './firewall/useFirewallCollectionsTablesView'
import { useFirewallSelections } from './firewall/useFirewallSelections'
import { usePolicyRuleReorder } from './firewall/usePolicyRuleReorder'
import { usePolicyRuleEditorActions } from './firewall/usePolicyRuleEditorActions'
import { usePolicyRuleEditorSync } from './firewall/usePolicyRuleEditorSync'
import { useFirewallObjectState } from './firewall/useFirewallObjectState'
import { useCollectionsEditor } from './firewall/useCollectionsEditor'
import { useTableBuilderEditor } from './firewall/useTableBuilderEditor'

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
  log_flags: null,
  log_group: null,
  log_snaplen: null,
  log_queue_threshold: null,
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
  counter_name: null,
  limit_name: null,
  quota_name: null,
  queue_num: null,
  queue_flags: null,
  dup_to: null,
  dup_dev: null,
  fwd_to: null,
  fwd_dev: null,
  fwd_family: null,
  set_stmt_op: null,
  set_stmt_name: null,
  set_stmt_expr: null,
  set_stmt_timeout: null,
  set_stmt_comment: null,
  vmap_stmt_expr: null,
  vmap_stmt_name: null,
  limit_rate: null,
  counter: false,
}

type EditorTab = 'base' | 'advanced' | 'action' | 'stats'

type FirewallPolicyTab = 'filter' | 'nat' | 'raw' | 'mangle'
type FirewallSectionTab = 'policy' | 'collections' | 'objects' | 'table_builder'
type CollectionKind = 'addr' | 'port' | 'iface' | 'map' | 'vmap'
type CollectionSortKey = 'kind' | 'name' | 'values' | 'timeout' | 'created_at'
type TableSortKey = 'family' | 'table_name' | 'chain_name' | 'chain_type' | 'hook' | 'device' | 'priority' | 'policy' | 'origin' | 'status'
type PolicySortKey = 'chain' | 'action' | 'proto' | 'src' | 'dst' | 'sport' | 'dport' | 'in_interface' | 'out_interface' | 'ct_state' | 'packets' | 'bytes'
type TableChainType = 'filter' | 'nat' | 'route'
type TableHook = 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
type ObjectRulesFilter = 'all' | 'with_objects' | 'without_objects'
type FirewallObjectsFilter = 'all' | 'used' | 'unused'

const TABLE_ALLOWED_HOOKS: Record<TableChainType, TableHook[]> = {
  filter: ['prerouting', 'input', 'forward', 'output', 'postrouting', 'ingress'],
  nat: ['prerouting', 'input', 'output', 'postrouting'],
  route: ['output'],
}

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

const ADVANCED_SECTIONS_CLOSED = {
  l4: false,
  meta: false,
  ct: false,
  fib: false,
  l2: false,
}

export function FirewallPage(props: { auth: AuthState; refreshNonce: number }) {
  const [state, setState] = React.useState<FirewallState | null>(null)
  const [schema, setSchema] = React.useState<FirewallSchema | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Partial<FirewallRule>>(defaultRule)
  const [isBusy, setIsBusy] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<FirewallSectionTab>('policy')
  const [objectRules, setObjectRules] = React.useState<FirewallRule[]>([])
  const [objectRulesFilter, setObjectRulesFilter] = React.useState<ObjectRulesFilter>('all')
  const [objectRuleObjectFilterKey, setObjectRuleObjectFilterKey] = React.useState<string | null>(null)
  const [firewallObjects, setFirewallObjects] = React.useState<FirewallNamedObjects | null>(null)
  const [firewallObjectOpen, setFirewallObjectOpen] = React.useState(false)
  const [firewallObjectForm, setFirewallObjectForm] = React.useState<FirewallObjectForm>(defaultFirewallObjectForm)
  const [editingFirewallObjectId, setEditingFirewallObjectId] = React.useState<string | null>(null)
  const [selectedFirewallObjectIds, setSelectedFirewallObjectIds] = React.useState<string[]>([])
  const [firewallObjectAnchorId, setFirewallObjectAnchorId] = React.useState<string | null>(null)
  const [firewallObjectsFilter, setFirewallObjectsFilter] = React.useState<FirewallObjectsFilter>('all')
  const [firewallObjectFocusKey, setFirewallObjectFocusKey] = React.useState<string | null>(null)
  const [activePolicyTab, setActivePolicyTab] = React.useState<FirewallPolicyTab>('filter')
  const [activeRuleTableName, setActiveRuleTableName] = React.useState<string>('filter')
  const [activeRuleTableFamily, setActiveRuleTableFamily] = React.useState<TableFamily>('inet')
  const [activeObjectTableName, setActiveObjectTableName] = React.useState<string>('')
  const [activeObjectTableFamily, setActiveObjectTableFamily] = React.useState<TableFamily>('bridge')
  const [selectedRuleIds, setSelectedRuleIds] = React.useState<string[]>([])
  const [ruleAnchorId, setRuleAnchorId] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null)
  const [ruleEditorTab, setRuleEditorTab] = React.useState<EditorTab>('base')
  const [dragRuleId, setDragRuleId] = React.useState<string | null>(null)
  const [dragOverRuleId, setDragOverRuleId] = React.useState<string | null>(null)
  const [dragRuleTableName, setDragRuleTableName] = React.useState<string | null>(null)
  const { winPos, setWinPos, onDragStart } = useDraggableWindow({ x: 120, y: 120 })
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
  const [statsSeries, setStatsSeries] = React.useState<'packets' | 'bytes'>('packets')
  const [setsState, setSetsState] = React.useState<FirewallSetsState>({ addr: [], port: [], iface: [] })
  const [mapsState, setMapsState] = React.useState<FirewallMapsState>({ map: [], vmap: [] })
  const [tablesState, setTablesState] = React.useState<FirewallTablesState>({ builtin: [], custom: [] })
  const [collectionKind, setCollectionKind] = React.useState<CollectionKind>('addr')
  const [selectedCollectionIds, setSelectedCollectionIds] = React.useState<string[]>([])
  const [collectionAnchorId, setCollectionAnchorId] = React.useState<string | null>(null)
  const [collectionSort, setCollectionSort] = React.useState<{ key: CollectionSortKey | null; dir: SortDirection }>({ key: null, dir: 'asc' })
  const [collectionsNowSec, setCollectionsNowSec] = React.useState(() => Math.floor(Date.now() / 1000))
  const [newSetName, setNewSetName] = React.useState('')
  const [newSetElements, setNewSetElements] = React.useState('')
  const [newSetComment, setNewSetComment] = React.useState('')
  const [newSetTimeoutEnabled, setNewSetTimeoutEnabled] = React.useState(false)
  const [newSetTimeout, setNewSetTimeout] = React.useState('')
  const [newSetReadOnly, setNewSetReadOnly] = React.useState(false)
  const [setOpen, setSetOpen] = React.useState(false)
  const [editingSetId, setEditingSetId] = React.useState<string | null>(null)
  const [selectedTableIds, setSelectedTableIds] = React.useState<string[]>([])
  const [tableAnchorId, setTableAnchorId] = React.useState<string | null>(null)
  const [tableSort, setTableSort] = React.useState<{ key: TableSortKey | null; dir: SortDirection }>({ key: null, dir: 'asc' })
  const [tableOpen, setTableOpen] = React.useState(false)
  const [editingTableId, setEditingTableId] = React.useState<string | null>(null)
  const [newTableFamily, setNewTableFamily] = React.useState<TableFamily>('inet')
  const [newTableName, setNewTableName] = React.useState('')
  const [newChainName, setNewChainName] = React.useState('')
  const [newChainType, setNewChainType] = React.useState<TableChainType>('filter')
  const [newHook, setNewHook] = React.useState<TableHook>('input')
  const [newDevice, setNewDevice] = React.useState('')
  const [newPriority, setNewPriority] = React.useState('-10')
  const [newPolicy, setNewPolicy] = React.useState<'accept' | 'drop'>('accept')
  const [advOpen, setAdvOpen] = React.useState<Record<string, boolean>>({ ...ADVANCED_SECTIONS_CLOSED })
  const collectionFieldClass = 'h-7 text-[11px] md:text-[11px] placeholder:text-[11px]'
  const allowedHooksForChainType = TABLE_ALLOWED_HOOKS[newChainType]
  const deviceRequiredForHook = newHook === 'ingress'

  const {
    chainOptionsByTable,
    builtinRuleTables,
    customChainRowsByTable,
    activeChainOptions,
    contextMode,
    hasSupport,
    generalFieldState,
    toPortState,
  } = usePolicyRuleFormContext({
    schema,
    customTables: tablesState.custom,
    form,
    activeRuleTableName,
    activeRuleTableFamily,
    activePolicyTab,
  })

  const selectedAction = form.nat_type || (form.vmap_stmt_name ? '' : (form.action || 'accept'))
  const isNatActionSelected = ['dnat', 'snat', 'masquerade', 'redirect'].includes(String(selectedAction))
  const natActionOptions = React.useMemo(() => {
    if (contextMode !== 'nat') return []
    const chain = String(form.chain || activeChainOptions[0] || 'prerouting')
    return (schema?.tables?.nat?.nat_types_by_chain?.[chain] || []).filter(Boolean).map(String)
  }, [activeChainOptions, contextMode, form.chain, schema])
  const dynamicSetOptions = React.useMemo<DynamicSetStatementOption[]>(() => {
    const dynamicAddr = setsState.addr
      .filter((item) => item.enabled !== false && item.dynamic && item.timeout && item.size)
      .map((item) => ({
        kind: 'addr' as const,
        name: item.name,
        expressions: ['ip saddr', 'ip daddr'] as DynamicSetStatementOption['expressions'],
      }))
    const dynamicPorts = setsState.port
      .filter((item) => item.enabled !== false && item.dynamic && item.timeout && item.size)
      .map((item) => ({
        kind: 'port' as const,
        name: item.name,
        expressions: ['tcp dport', 'udp dport'] as DynamicSetStatementOption['expressions'],
      }))
    return [...dynamicAddr, ...dynamicPorts]
      .filter((item) => item.name)
      .sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`))
  }, [setsState.addr, setsState.port])
  const vmapStatementOptions = React.useMemo<VmapStatementOption[]>(() => {
    const protocolTokens = new Set(['tcp', 'udp', 'udplite', 'icmp', 'icmpv6', 'sctp', 'dccp'])
    return mapsState.vmap
      .filter((item) => item.enabled !== false && item.name)
      .filter((item) => {
        const entries = item.entries || []
        if (!entries.length) return false
        return entries.every((entry) => {
          const [key] = String(entry || '').split(':', 1)
          return protocolTokens.has(key.trim().toLowerCase())
        })
      })
      .map((item) => ({
        kind: 'vmap' as const,
        name: item.name,
        expressions: ['meta l4proto'] as VmapStatementOption['expressions'],
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [mapsState.vmap])
  const { refresh, refreshCollections } = useFirewallDataSync({
    auth: props.auth,
    refreshNonce: props.refreshNonce,
    activeSection,
    activeRuleTableFamily,
    activeRuleTableName,
    activeObjectTableFamily,
    activeObjectTableName,
    setState,
    setSetsState,
    setMapsState,
    setTablesState,
    setObjectRules,
    setFirewallObjects,
    setSchema,
    setError,
    setCollectionsNowSec,
  })
  usePolicyRuleEditorSync({
    addOpen,
    editingRuleId,
    activeRuleTableName,
    activeRuleTableFamily,
    activeChainOptions,
    form,
    contextMode,
    schema,
    state,
    setForm,
  })

  const {
    currentRulePackets,
    currentRuleBytes,
    currentRulePps,
    currentRuleBitrate,
    statsChart,
    setLiveChartPoints,
  } = usePolicyRuleLiveStats({
    form,
    addOpen,
    editingRuleId,
    ruleEditorTab,
    buildEmptyLiveChart,
    liveChartWindow: LIVE_CHART_WINDOW,
  })

  const {
    onSave,
    onDelete,
    onSetEnabled,
    openCreateWindow,
    openEditWindow,
  } = usePolicyRuleEditorActions({
    auth: props.auth,
    form,
    editingRuleId,
    activeRuleTableName,
    activeRuleTableFamily,
    activeChainOptions,
    defaultRule,
    advancedSectionsClosed: ADVANCED_SECTIONS_CLOSED,
    setError,
    setIsBusy,
    setForm,
    setEditingRuleId,
    setAddOpen,
    setRuleEditorTab,
    setAdvOpen,
    setWinPos,
    setLiveChartPoints,
    buildEmptyLiveChart,
    refresh,
  })

  const {
    activeRuleTable,
    visibleRules,
    sortedVisibleRules,
    visiblePolicyColSpan,
    firstVisiblePolicyColumn,
    togglePolicySort,
  } = usePolicyRulesView({
    state,
    activeRuleTableName,
    activeRuleTableFamily,
    policySort,
    setPolicySort,
    visibleColumns,
    policyColumnOrder: POLICY_COLUMN_ORDER,
    objectRulesFilter: objectRulesFilter,
    objectRuleObjectFilterKey: objectRuleObjectFilterKey,
  })

  const { onReorderDrop, onReorderDropToEnd } = usePolicyRuleReorder({
    auth: props.auth,
    activeRuleTable,
    visibleRules,
    dragRuleId,
    dragRuleTableName,
    setError,
    setIsBusy,
    setSelectedRuleIds,
    setRuleAnchorId,
    setDragRuleId,
    setDragOverRuleId,
    setDragRuleTableName,
    refresh,
  })

  const isCollectionsTab = activeSection === 'collections'
  const isObjectsTab = activeSection === 'objects'
  const isTablesTab = activeSection === 'table_builder'
  const isPolicyTab = activeSection === 'policy'
  useFirewallPageGuards({
    allowedHooksForChainType,
    newHook,
    setNewHook,
    newDevice,
    setNewDevice,
    activePolicyTab,
    setActiveRuleTableName,
    activeRuleTableFamily,
    setActiveRuleTableFamily,
    activeRuleTableName,
    customTables: tablesState.custom,
  })
  const isCustomRuleTableActive = activeRuleTableFamily !== 'inet' || !['filter', 'nat', 'raw', 'mangle'].includes(activeRuleTableName)
  const customTableOptions = React.useMemo(() => {
    const builtinOptions = ['filter', 'nat', 'raw', 'mangle'].map((tableName) => ({
      key: `inet:${tableName}`,
      family: 'inet' as TableFamily,
      tableName,
      label: tableName,
    }))
    const seen = new Set(builtinOptions.map((x) => x.key))
    const customOptions = tablesState.custom
      .filter((x) => x.enabled !== false)
      .map((x) => {
        const family = (String(x.family || 'inet').toLowerCase() as TableFamily)
        const tableName = String(x.table_name || '').toLowerCase()
        return {
          key: `${family}:${tableName}`,
          family,
          tableName,
          label: family === 'inet' ? tableName : `${family} / ${tableName}`,
        }
      })
      .filter((x) => x.tableName && ['inet', 'ip', 'ip6', 'bridge', 'netdev'].includes(x.family))
      .filter((x) => {
        if (seen.has(x.key)) return false
        seen.add(x.key)
        return true
      })
      .sort((a, b) => a.label.localeCompare(b.label))
    return [...builtinOptions, ...customOptions]
  }, [tablesState.custom])
  const tableRows = React.useMemo(() => [...tablesState.custom, ...tablesState.builtin], [tablesState.builtin, tablesState.custom])
  React.useEffect(() => {
    if (activeObjectTableName) return
    const firstBridge = customTableOptions.find((x) => x.family === 'bridge')
    const firstAny = customTableOptions[0]
    const next = firstBridge || firstAny
    if (!next) return
    setActiveObjectTableFamily(next.family)
    setActiveObjectTableName(next.tableName)
  }, [activeObjectTableName, customTableOptions])
  const {
    objectCounterNames,
    objectLimitNames,
    objectQuotaNames,
    objectCtHelperNames,
    objectCtTimeoutNames,
    objectCtExpectationNames,
    firewallManagedObjects,
    firewallObjectUsageByKey,
    firewallFilteredObjects,
    firewallObjectsUsedCount,
    firewallObjectsFreeCount,
  } = useFirewallObjectState({
    firewallObjects,
    objectRules,
    firewallObjectsFilter,
    firewallObjectFocusKey,
    setFirewallObjectFocusKey,
    objectRulesFilter,
    objectRuleObjectFilterKey,
    setObjectRuleObjectFilterKey,
    firewallObjectAnchorId,
    setFirewallObjectAnchorId,
    setSelectedFirewallObjectIds,
  })
  const activeFirewallObjectFamily = isObjectsTab ? activeObjectTableFamily : 'bridge'
  const activeFirewallObjectTableName = isObjectsTab ? activeObjectTableName : (activeSection === 'policy' && activeRuleTableFamily === 'bridge' ? activeRuleTableName : '')
  const refreshFirewallObjects = React.useCallback(async () => {
    if (!activeFirewallObjectTableName) {
      setFirewallObjects(null)
      return
    }
    setFirewallObjects(await getFirewallObjects(props.auth, { family: activeFirewallObjectFamily, table: activeFirewallObjectTableName }))
  }, [activeFirewallObjectFamily, activeFirewallObjectTableName, props.auth])
  const activeCustomPolicyChainOptions = React.useMemo(() => (
    tablesState.custom
      .filter((row) => (
        row.enabled !== false
        && String(row.family || 'inet').toLowerCase() === activeRuleTableFamily
        && row.table_name === activeRuleTableName
      ))
      .map((row) => row.chain_name)
      .filter(Boolean)
  ), [activeRuleTableFamily, activeRuleTableName, tablesState.custom])
  const activeObjectRuleChainOptions = React.useMemo(() => (
    tablesState.custom
      .filter((row) => (
        row.enabled !== false
        && String(row.family || 'inet').toLowerCase() === activeObjectTableFamily
        && row.table_name === activeObjectTableName
      ))
      .map((row) => row.chain_name)
      .filter(Boolean)
  ), [activeObjectTableFamily, activeObjectTableName, tablesState.custom])
  const openCreateUnifiedPolicyWindow = React.useCallback(() => {
    if (activeRuleTableFamily === 'bridge' || activeRuleTableFamily === 'netdev') {
      if (!activeCustomPolicyChainOptions[0]) {
        setError(`No enabled ${activeRuleTableFamily} chains in selected table.`)
        return
      }
    }
    openCreateWindow()
  }, [
    activeCustomPolicyChainOptions,
    activeRuleTableFamily,
    openCreateWindow,
    setError,
  ])
  const openEditUnifiedPolicyWindow = React.useCallback((rule: FirewallRule) => {
    openEditWindow(rule)
  }, [openEditWindow])
  const openCreateRuleFromObjects = React.useCallback((prefill?: Partial<FirewallRule>) => {
    if (activeObjectTableFamily === 'netdev') {
      setError('Rule prefill from Objects is not supported for netdev tables.')
      return
    }
    if (!activeObjectTableName || !activeObjectRuleChainOptions[0]) {
      setError('Select object table with an enabled chain first.')
      return
    }
    setActiveSection('policy')
    setActiveRuleTableFamily(activeObjectTableFamily)
    setActiveRuleTableName(activeObjectTableName)
    setEditingRuleId(null)
    setRuleEditorTab('base')
    setAdvOpen({ ...ADVANCED_SECTIONS_CLOSED })
    setForm({
      ...defaultRule,
      family: activeObjectTableFamily,
      table: activeObjectTableName,
      chain: activeObjectRuleChainOptions[0],
      ...(prefill || {}),
    })
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 760) / 2) - 60) })
    setAddOpen(true)
  }, [activeObjectRuleChainOptions, activeObjectTableFamily, activeObjectTableName, setWinPos])
  const {
    allCollectionItems,
    sortedCollectionItems,
    sortedTableRows,
    selectedCollections,
    selectedTimedCollections,
    selectedCustomTables,
    toggleCollectionSort,
    toggleTableSort,
  } = useFirewallCollectionsTablesView({
    setsState,
    mapsState,
    tableRows,
    collectionsNowSec,
    collectionSort,
    setCollectionSort,
    tableSort,
    setTableSort,
    selectedCollectionIds,
    selectedTableIds,
  })

  const {
    selectedRules,
    selectedFirewallObjects,
  } = useFirewallSelections({
    visibleRules,
    selectedRuleIds,
    firewallManagedObjects,
    selectedFirewallObjectIds,
  })
  const { onSaveFirewallObject, onDeleteSelectedFirewallObjects } = useFirewallObjectActions({
    auth: props.auth,
    activeObjectFamily: activeFirewallObjectFamily,
    activeObjectTableName: activeFirewallObjectTableName,
    firewallObjectForm,
    editingFirewallObjectId,
    selectedFirewallObjects,
    setError,
    setIsBusy,
    setFirewallObjectOpen,
    setEditingFirewallObjectId,
    setSelectedFirewallObjectIds,
    setFirewallObjectAnchorId,
    refreshFirewallObjects,
  })
  const {
    openCreateFirewallObjectWindow,
    openEditFirewallObjectWindow,
    applyFirewallObjectPreset,
  } = useFirewallObjectEditor({
    activeObjectFamily: activeFirewallObjectFamily,
    activeObjectTableName: activeFirewallObjectTableName,
    setError,
    setEditingFirewallObjectId,
    setFirewallObjectForm,
    setFirewallObjectOpen,
  })
  const {
    onFilterRulesByObject,
    onCreateRuleWithObject,
    onCreateRuleFromSelectedObjects,
  } = useFirewallObjectBindings({
    selectedFirewallObjects,
    openCreateObjectRuleWindow: openCreateRuleFromObjects,
    setError,
    setObjectRulesFilter,
    setObjectRuleObjectFilterKey,
    setFirewallObjectsFilter,
    setFirewallObjectFocusKey,
    setSelectedFirewallObjectIds,
    setFirewallObjectAnchorId,
  })
  const {
    openCreateSetWindow,
    openEditSetWindow,
    openEditMapWindow,
    onSaveSet,
  } = useCollectionsEditor({
    auth: props.auth,
    editingSetId,
    newSetReadOnly,
    newSetName,
    newSetElements,
    newSetComment,
    newSetTimeoutEnabled,
    newSetTimeout,
    collectionKind,
    setEditingSetId,
    setNewSetReadOnly,
    setNewSetName,
    setNewSetElements,
    setNewSetComment,
    setNewSetTimeoutEnabled,
    setNewSetTimeout,
    setCollectionKind,
    setWinPos,
    setSetOpen,
    setError,
    setIsBusy,
    normalizeCollectionTimeoutInput,
    refreshCollections,
  })
  const {
    openCreateTableWindow,
    openEditTableWindow,
    onSaveTable,
  } = useTableBuilderEditor({
    auth: props.auth,
    tablesState,
    editingTableId,
    newTableFamily,
    newTableName,
    newChainName,
    newChainType,
    newHook,
    newDevice,
    newPriority,
    newPolicy,
    tableAllowedHooks: TABLE_ALLOWED_HOOKS,
    setEditingTableId,
    setNewTableFamily,
    setNewTableName,
    setNewChainName,
    setNewChainType,
    setNewHook,
    setNewDevice,
    setNewPriority,
    setNewPolicy,
    setWinPos,
    setTableOpen,
    setError,
    setIsBusy,
    refresh,
  })
  const {
    onDeleteSelectedRules,
    onSetEnabledSelectedRules,
    onResetPolicyCounters,
    onDeleteSelectedCollections,
    onSetEnabledSelectedCollections,
    onDeleteSelectedTables,
    onSetEnabledSelectedTables,
  } = useFirewallBulkActions({
    auth: props.auth,
    selectedRules,
    selectedCollections,
    selectedTimedCollections,
    selectedCustomTables,
    activeRuleTable,
    addOpen,
    editingRuleId,
    setError,
    setIsBusy,
    setSelectedRuleIds,
    setRuleAnchorId,
    setSelectedCollectionIds,
    setCollectionAnchorId,
    setSelectedTableIds,
    setTableAnchorId,
    setLiveChartPoints,
    setForm,
    buildEmptyLiveChart,
    refresh,
    refreshCollections,
  })

  return (
    <div className='flex h-full min-h-0 w-full flex-col gap-2 overflow-x-hidden'>
      <div><h2 className='text-lg font-semibold tracking-tight'>Firewall</h2></div>
      {error ? <div className='rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'>{error}</div> : null}
      <Card className='flex min-h-0 w-full flex-1 flex-col overflow-x-hidden text-xs'>
        <CardContent className='flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-4 pt-0'>
          <FirewallSectionTabs
            activeSection={activeSection}
            setActiveSection={setActiveSection}
          />
          {isPolicyTab ? (
            <PolicySectionToolbar
              isCustomRuleTableActive={isCustomRuleTableActive}
              activePolicyTab={activePolicyTab}
              setActivePolicyTab={setActivePolicyTab}
              setActiveRuleTableName={setActiveRuleTableName}
              activeRuleTableFamily={activeRuleTableFamily}
              setActiveRuleTableFamily={setActiveRuleTableFamily}
              customTableOptions={customTableOptions}
              activeRuleTableName={activeRuleTableName}
              customTables={tablesState.custom}
              setSelectedTableIds={setSelectedTableIds}
              setTableAnchorId={setTableAnchorId}
              setActiveSection={setActiveSection}
              isBusy={isBusy}
              selectedRuleIdsLength={selectedRuleIds.length}
              openCreateWindow={openCreateUnifiedPolicyWindow}
              onDeleteSelectedRules={onDeleteSelectedRules}
              onSetEnabledSelectedRules={onSetEnabledSelectedRules}
              onResetCounters={onResetPolicyCounters}
              columnsOpen={columnsOpen}
              setColumnsOpen={setColumnsOpen}
              policyColumnOrder={POLICY_COLUMN_ORDER}
              policyColumnLabels={POLICY_COLUMN_LABELS}
              visibleColumns={visibleColumns}
              setVisibleColumns={setVisibleColumns}
            />
          ) : null}
          {isObjectsTab ? (
            <div className='flex min-h-0 flex-1 flex-col gap-2'>
              <div className='flex flex-wrap items-end gap-2 rounded-xl border bg-muted/10 p-2'>
                <div className='space-y-1.5'>
                  <Label className='text-[11px]'>Object table</Label>
                  <select
                    className='h-8 min-w-[260px] rounded-md border bg-background px-2.5 text-xs'
                    value={activeObjectTableName ? `${activeObjectTableFamily}:${activeObjectTableName}` : ''}
                    onChange={(e) => {
                      const [family, tableName] = e.target.value.split(':')
                      setActiveObjectTableFamily((family || 'bridge') as TableFamily)
                      setActiveObjectTableName(tableName || '')
                      setSelectedFirewallObjectIds([])
                      setFirewallObjectAnchorId(null)
                      setFirewallObjectFocusKey(null)
                      setObjectRuleObjectFilterKey(null)
                      setObjectRulesFilter('all')
                    }}
                  >
                    <option value=''>Select custom table</option>
                    {customTableOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className='pb-1 text-[11px] text-muted-foreground'>
                  nftables named objects are scoped by family/table. Rule prefill is enabled for inet/ip/ip6/bridge tables; netdev object bindings stay disabled by backend validation.
                </div>
              </div>
              <FirewallObjectsPanel
                isBusy={isBusy}
                activeFamily={activeObjectTableFamily}
                activeTableName={activeObjectTableName}
                selectedObjectIdsCount={selectedFirewallObjectIds.length}
                openCreateObjectWindow={openCreateFirewallObjectWindow}
                onCreateRuleFromSelectedObjects={onCreateRuleFromSelectedObjects}
                onDeleteSelectedObjects={onDeleteSelectedFirewallObjects}
                objectsFilter={firewallObjectsFilter}
                setObjectsFilter={setFirewallObjectsFilter}
                objectsUsedCount={firewallObjectsUsedCount}
                objectsFreeCount={firewallObjectsFreeCount}
                objectFocusKey={firewallObjectFocusKey}
                setObjectFocusKey={setFirewallObjectFocusKey}
                onCreateObjectWithPreset={(preset) => {
                  openCreateFirewallObjectWindow()
                  applyFirewallObjectPreset(preset)
                }}
                filteredObjects={firewallFilteredObjects}
                managedObjectsCount={firewallManagedObjects.length}
                selectedObjectIds={selectedFirewallObjectIds}
                objectUsageByKey={firewallObjectUsageByKey}
                formatObjectSummary={formatFirewallObjectSummary}
                onObjectRowMouseDown={(e) => {
                  if (e.shiftKey) e.preventDefault()
                }}
                onObjectRowClick={(row, e) => {
                  const ordered = firewallFilteredObjects.map((x) => x.id)
                  const next = computeSelection(ordered, selectedFirewallObjectIds, firewallObjectAnchorId, row.id, e)
                  setSelectedFirewallObjectIds(next.selected)
                  setFirewallObjectAnchorId(next.anchor)
                }}
                onObjectRowDoubleClick={openEditFirewallObjectWindow}
                onFilterRulesByObject={(kind, name) => {
                  if (activeObjectTableFamily !== 'netdev') {
                    setActiveRuleTableFamily(activeObjectTableFamily)
                    setActiveRuleTableName(activeObjectTableName)
                    setActiveSection('policy')
                    onFilterRulesByObject(kind, name)
                  }
                }}
                onCreateRuleWithObject={onCreateRuleWithObject}
              />
            </div>
          ) : isCollectionsTab ? (
            <CollectionsSection
              isBusy={isBusy}
              selectedCollectionIds={selectedCollectionIds}
              selectedTimedCollectionsLength={selectedTimedCollections.length}
              openCreateSetWindow={openCreateSetWindow}
              onDeleteSelectedCollections={onDeleteSelectedCollections}
              onSetEnabledSelectedCollections={onSetEnabledSelectedCollections}
              sortedCollectionItems={sortedCollectionItems}
              collectionSort={collectionSort}
              toggleCollectionSort={toggleCollectionSort}
              sortIndicator={sortIndicator}
              computeSelection={computeSelection}
              collectionAnchorId={collectionAnchorId}
              setSelectedCollectionIds={setSelectedCollectionIds}
              setCollectionAnchorId={setCollectionAnchorId}
              openEditMapWindow={openEditMapWindow}
              openEditSetWindow={openEditSetWindow}
              formatDurationClock={formatDurationClock}
              getCollectionRemainingSeconds={getCollectionRemainingSeconds}
              collectionsNowSec={collectionsNowSec}
              formatDateTime={formatDateTime}
              allCollectionItemsLength={allCollectionItems.length}
            />
          ) : isTablesTab ? (
            <TablesSection
              isBusy={isBusy}
              selectedCustomTablesLength={selectedCustomTables.length}
              openCreateTableWindow={openCreateTableWindow}
              onDeleteSelectedTables={onDeleteSelectedTables}
              onSetEnabledSelectedTables={onSetEnabledSelectedTables}
              tableSort={tableSort}
              toggleTableSort={toggleTableSort}
              sortIndicator={sortIndicator}
              sortedTableRows={sortedTableRows}
              selectedTableIds={selectedTableIds}
              computeSelection={computeSelection}
              tableAnchorId={tableAnchorId}
              setSelectedTableIds={setSelectedTableIds}
              setTableAnchorId={setTableAnchorId}
              openEditTableWindow={openEditTableWindow}
              hasAnyTables={!!(tablesState.builtin.length || tablesState.custom.length)}
            />
          ) : null}
          {isPolicyTab && activeRuleTableFamily !== 'netdev' && (objectRuleObjectFilterKey || objectRulesFilter !== 'all') ? (
            <div className='flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] text-blue-900'>
              <span>
                rules filter: {objectRuleObjectFilterKey ? `object: ${objectRuleObjectFilterKey}` : objectRulesFilter}
              </span>
              <button
                type='button'
                className='rounded border border-blue-300 bg-background px-1.5 py-0.5 text-[11px] hover:bg-muted'
                onClick={() => {
                  setObjectRulesFilter('all')
                  setObjectRuleObjectFilterKey(null)
                }}
              >
                clear
              </button>
            </div>
          ) : null}
          {isPolicyTab ? (
            <PolicyRulesTable
              visibleColumns={visibleColumns}
              policySort={policySort}
              togglePolicySort={togglePolicySort}
              policyColumnLabels={POLICY_COLUMN_LABELS}
              sortIndicator={sortIndicator}
              sortedVisibleRules={sortedVisibleRules}
              visibleRules={visibleRules}
              selectedRuleIds={selectedRuleIds}
              setSelectedRuleIds={setSelectedRuleIds}
              ruleAnchorId={ruleAnchorId}
              setRuleAnchorId={setRuleAnchorId}
              computeSelection={computeSelection}
              openEditWindow={openEditUnifiedPolicyWindow}
              dragRuleId={dragRuleId}
              setDragRuleId={setDragRuleId}
              dragOverRuleId={dragOverRuleId}
              setDragOverRuleId={setDragOverRuleId}
              activeRuleTable={activeRuleTable}
              dragRuleTableName={dragRuleTableName}
              setDragRuleTableName={setDragRuleTableName}
              onReorderDrop={onReorderDrop}
              onReorderDropToEnd={onReorderDropToEnd}
              visiblePolicyColSpan={visiblePolicyColSpan}
              firstVisiblePolicyColumn={firstVisiblePolicyColumn}
              formatCounter={formatCounter}
            />
          ) : null}
        </CardContent>
      </Card>

      <FirewallModalStack
        policyRuleEditor={{
          open: addOpen,
          winPos,
          onDragStart,
          editingRuleId,
          ruleEditorTab,
          setRuleEditorTab,
          onClose: () => { setAddOpen(false); setEditingRuleId(null); setForm(defaultRule) },
          onSubmit: onSave,
          isBusy,
          form,
          setForm,
          hasSupport,
          natActionOptions,
          generalFieldState,
          schema,
          builtinRuleTables,
          chainOptionsByTable,
          customChainRowsByTable,
          advOpen,
          setAdvOpen,
          selectedAction: String(selectedAction),
          isNatActionSelected,
          formatCounter,
          formatBytesIEC,
          formatBitrate,
          formatPacketRate,
          currentRulePackets,
          currentRuleBytes,
          currentRuleBitrate,
          currentRulePps,
          statsChart,
          statsSeries,
          setStatsSeries,
          objectCounterNames,
          objectLimitNames,
          objectQuotaNames,
          objectCtHelperNames,
          objectCtTimeoutNames,
          objectCtExpectationNames,
          dynamicSetOptions,
          vmapStatementOptions,
        }}
        firewallObject={{
          open: firewallObjectOpen,
          isBusy,
          activeObjectFamily: activeFirewallObjectFamily,
          activeObjectTableName: activeFirewallObjectTableName,
          editingFirewallObjectId,
          firewallObjectForm,
          setFirewallObjectForm,
          setFirewallObjectOpen,
          onSaveFirewallObject,
          applyFirewallObjectPreset,
        }}
        collections={{
          open: setOpen,
          winPos,
          onDragStart,
          editingSetId,
          collectionKind,
          setCollectionKind,
          newSetReadOnly,
          collectionFieldClass,
          newSetName,
          setNewSetName,
          newSetElements,
          setNewSetElements,
          newSetTimeoutEnabled,
          setNewSetTimeoutEnabled,
          newSetTimeout,
          setNewSetTimeout,
          newSetComment,
          setNewSetComment,
          isBusy,
          setSetOpen,
          onSaveSet,
        }}
        tableBuilder={{
          open: tableOpen,
          winPos,
          onDragStart,
          editingTableId,
          newTableFamily,
          setNewTableFamily,
          newTableName,
          setNewTableName,
          newChainName,
          setNewChainName,
          newChainType,
          setNewChainType,
          newHook,
          setNewHook,
          allowedHooksForChainType,
          deviceRequiredForHook,
          newDevice,
          setNewDevice,
          newPriority,
          setNewPriority,
          newPolicy,
          setNewPolicy,
          isBusy,
          setTableOpen,
          onSaveTable,
        }}
      />
    </div>
  )
}
