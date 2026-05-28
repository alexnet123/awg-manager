import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthState, FirewallMapsState, FirewallNamedObjects, FirewallRule, FirewallSchema, FirewallSetsState, FirewallState, FirewallTableItem, FirewallTablesState } from './api'
import { getPolicyAdvancedCapabilities } from './firewall/capabilities'
import { CollectionsSection } from './firewall/CollectionsSection'
import { FirewallModalStack } from './firewall/FirewallModalStack'
import { PolicyAdvancedPage } from './firewall/PolicyAdvancedPage'
import { formatPolicyV2ObjectSummary } from './firewall/policyV2ObjectSummary'
import { PolicyRulesTable } from './firewall/PolicyRulesTable'
import { FirewallSectionTabs } from './firewall/FirewallSectionTabs'
import { PolicySectionToolbar } from './firewall/PolicySectionToolbar'
import { TablesSection } from './firewall/TablesSection'
import { usePolicyAdvancedData } from './firewall/usePolicyAdvancedData'
import { defaultPolicyV2ObjectForm, type PolicyV2ObjectForm } from './firewall/policyV2ObjectForm'
import { usePolicyAdvancedObjectActions } from './firewall/usePolicyAdvancedObjectActions'
import { usePolicyAdvancedObjectEditor } from './firewall/usePolicyAdvancedObjectEditor'
import { usePolicyAdvancedBindings } from './firewall/usePolicyAdvancedBindings'
import { usePolicyAdvancedContextSync } from './firewall/usePolicyAdvancedContextSync'
import { usePolicyAdvancedRuleActions } from './firewall/usePolicyAdvancedRuleActions'
import { usePolicyAdvancedTableContext } from './firewall/usePolicyAdvancedTableContext'
import { useFirewallDataSync } from './firewall/useFirewallDataSync'
import { useFirewallPageGuards } from './firewall/useFirewallPageGuards'
import { buildEmptyLiveChart, LIVE_CHART_WINDOW, type LiveChartPoint } from './firewall/policyLiveChart'
import { buildPolicyV2BridgeExprSummary, formatBitrate, formatBytesIEC, formatCounter, formatDateTime, formatDurationClock, formatPacketRate, getCollectionRemainingSeconds, normalizeCollectionTimeoutInput } from './firewall/policyUtils'
import { usePolicyRuleFormContext } from './firewall/usePolicyRuleFormContext'
import { usePolicyRuleLiveStats } from './firewall/usePolicyRuleLiveStats'
import { usePolicyRulesView } from './firewall/usePolicyRulesView'
import { ToggleLine } from './firewall/RuleFieldControls'
import { getDefaultPolicyRuleForm } from './firewall/ruleForm'
import { getPolicyAdvancedSection, isPolicyAdvancedSection } from './firewall/sections'
import { computeSelection, sortIndicator, type SortDirection } from './firewall/selectionUtils'
import { useDraggableWindow } from './firewall/useDraggableWindow'
import { usePolicyAdvancedRuleEditor } from './firewall/usePolicyAdvancedRuleEditor'
import { useFirewallBulkActions } from './firewall/useFirewallBulkActions'
import { useFirewallCollectionsTablesView } from './firewall/useFirewallCollectionsTablesView'
import { useFirewallSelections } from './firewall/useFirewallSelections'
import { usePolicyRuleReorder } from './firewall/usePolicyRuleReorder'
import { usePolicyRuleEditorActions } from './firewall/usePolicyRuleEditorActions'
import { usePolicyRuleEditorSync } from './firewall/usePolicyRuleEditorSync'
import { usePolicyV2RuleObjectState } from './firewall/usePolicyV2RuleObjectState'
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
  limit_rate: null,
  counter: false,
}

type EditorTab = 'base' | 'advanced' | 'action' | 'stats'

type FirewallPolicyTab = 'filter' | 'nat' | 'raw' | 'mangle'
type FirewallSectionTab = 'policy' | 'policy_v2' | 'policy_v3' | 'collections' | 'table_builder'
type CollectionKind = 'addr' | 'port' | 'iface' | 'map' | 'vmap'
type CollectionSortKey = 'kind' | 'name' | 'values' | 'timeout' | 'created_at'
type TableSortKey = 'family' | 'table_name' | 'chain_name' | 'chain_type' | 'hook' | 'device' | 'priority' | 'policy' | 'origin' | 'status'
type PolicySortKey = 'chain' | 'action' | 'proto' | 'src' | 'dst' | 'sport' | 'dport' | 'in_interface' | 'out_interface' | 'ct_state' | 'packets' | 'bytes'
type TableChainType = 'filter' | 'nat' | 'route'
type TableHook = 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
type PolicyV2Family = 'bridge' | 'netdev'
type PolicyV2DataTab = 'rules' | 'objects'
type PolicyV2RulesFilter = 'all' | 'with_objects' | 'without_objects'
type PolicyV2ObjectsFilter = 'all' | 'used' | 'unused'

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
  raw: false,
}

export function FirewallPage(props: { auth: AuthState; refreshNonce: number }) {
  const [state, setState] = React.useState<FirewallState | null>(null)
  const [schema, setSchema] = React.useState<FirewallSchema | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Partial<FirewallRule>>(defaultRule)
  const [isBusy, setIsBusy] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<FirewallSectionTab>('policy')
  const [activePolicyV2Family, setActivePolicyV2Family] = React.useState<PolicyV2Family>('bridge')
  const [activePolicyV2TableName, setActivePolicyV2TableName] = React.useState<string>('')
  const [policyV2DataTab, setPolicyV2DataTab] = React.useState<PolicyV2DataTab>('rules')
  const [policyV2Rules, setPolicyV2Rules] = React.useState<FirewallRule[]>([])
  const [policyV2RulesFilter, setPolicyV2RulesFilter] = React.useState<PolicyV2RulesFilter>('all')
  const [policyV2RuleObjectFilterKey, setPolicyV2RuleObjectFilterKey] = React.useState<string | null>(null)
  const [selectedPolicyV2RuleIds, setSelectedPolicyV2RuleIds] = React.useState<string[]>([])
  const [policyV2RuleAnchorId, setPolicyV2RuleAnchorId] = React.useState<string | null>(null)
  const [policyV2EditorOpen, setPolicyV2EditorOpen] = React.useState(false)
  const [editingPolicyV2RuleId, setEditingPolicyV2RuleId] = React.useState<string | null>(null)
  const [policyV2Form, setPolicyV2Form] = React.useState<Partial<FirewallRule>>(getDefaultPolicyRuleForm('bridge'))
  const [policyV2Objects, setPolicyV2Objects] = React.useState<FirewallNamedObjects | null>(null)
  const [policyV2ObjectOpen, setPolicyV2ObjectOpen] = React.useState(false)
  const [policyV2ObjectForm, setPolicyV2ObjectForm] = React.useState<PolicyV2ObjectForm>(defaultPolicyV2ObjectForm)
  const [editingPolicyV2ObjectId, setEditingPolicyV2ObjectId] = React.useState<string | null>(null)
  const [selectedPolicyV2ObjectIds, setSelectedPolicyV2ObjectIds] = React.useState<string[]>([])
  const [policyV2ObjectAnchorId, setPolicyV2ObjectAnchorId] = React.useState<string | null>(null)
  const [policyV2ObjectsFilter, setPolicyV2ObjectsFilter] = React.useState<PolicyV2ObjectsFilter>('all')
  const [policyV2ObjectFocusKey, setPolicyV2ObjectFocusKey] = React.useState<string | null>(null)
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
    activePolicyTab,
  })

  const selectedAction = form.nat_type || form.action || 'accept'
  const isNatActionSelected = ['dnat', 'snat', 'masquerade', 'redirect'].includes(String(selectedAction))
  const { refresh, refreshCollections } = useFirewallDataSync({
    auth: props.auth,
    refreshNonce: props.refreshNonce,
    activeSection,
    activePolicyV2Family,
    activePolicyV2TableName,
    setState,
    setSetsState,
    setMapsState,
    setTablesState,
    setPolicyV2Rules,
    setPolicyV2Objects,
    setSchema,
    setError,
    setCollectionsNowSec,
  })
  usePolicyRuleEditorSync({
    addOpen,
    editingRuleId,
    activeRuleTableName,
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
    policySort,
    setPolicySort,
    visibleColumns,
    policyColumnOrder: POLICY_COLUMN_ORDER,
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
  const isTablesTab = activeSection === 'table_builder'
  const isPolicyAdvancedTab = isPolicyAdvancedSection(activeSection)
  const isPolicyTab = activeSection === 'policy'
  const {
    policyAdvancedCaps,
    policyAdvancedLabel,
    policyAdvancedFamily,
    policyAdvancedTableHint,
    policyAdvancedRuleLabel,
    policyAdvancedRulesColSpan,
    policyV2TableNames,
    policyV2TableRows,
    policyV2ChainOptions,
    policyV2ChainMetaByName,
  } = usePolicyAdvancedTableContext({
    activeSection,
    activePolicyV2Family,
    activePolicyV2TableName,
    customTables: tablesState.custom,
  })
  useFirewallPageGuards({
    allowedHooksForChainType,
    newHook,
    setNewHook,
    newDevice,
    setNewDevice,
    activePolicyTab,
    setActiveRuleTableName,
    activeRuleTableName,
    customTables: tablesState.custom,
    policyV2EditorOpen,
    policyV2ChainOptions,
    policyV2Form,
    setPolicyV2Form,
  })
  const isCustomRuleTableActive = !['filter', 'nat', 'raw', 'mangle'].includes(activeRuleTableName)
  const customTableNames = Array.from(new Set(
    tablesState.custom
      .filter((x) => x.enabled !== false && String(x.family || 'inet').toLowerCase() === 'inet')
      .map((x) => x.table_name)
  )).sort((a, b) => a.localeCompare(b))
  const tableRows = React.useMemo(() => [...tablesState.custom, ...tablesState.builtin], [tablesState.builtin, tablesState.custom])
  const {
    policyV2CounterNames,
    policyV2LimitNames,
    policyV2QuotaNames,
    policyV2CtHelperNames,
    policyV2CtTimeoutNames,
    policyV2ManagedObjects,
    policyV2ObjectUsageByKey,
    policyV2FilteredObjects,
    policyV2FilteredRules,
    policyV2RulesWithObjectsCount,
    policyV2RulesWithoutObjectsCount,
    policyV2ObjectsUsedCount,
    policyV2ObjectsFreeCount,
    policyV2FormObjectBindings,
  } = usePolicyV2RuleObjectState({
    policyV2Objects,
    policyV2Rules,
    policyV2Form,
    policyV2ObjectsFilter,
    policyV2ObjectFocusKey,
    setPolicyV2ObjectFocusKey,
    policyV2RulesFilter,
    policyV2RuleObjectFilterKey,
    setPolicyV2RuleObjectFilterKey,
    policyV2RuleAnchorId,
    setPolicyV2RuleAnchorId,
    setSelectedPolicyV2RuleIds,
    policyV2ObjectAnchorId,
    setPolicyV2ObjectAnchorId,
    setSelectedPolicyV2ObjectIds,
  })
  const { refreshPolicyV2Rules, refreshPolicyV2Objects } = usePolicyAdvancedData({
    auth: props.auth,
    activeSection,
    activePolicyV2Family,
    activePolicyV2TableName,
    refreshNonce: props.refreshNonce,
    setPolicyV2Rules,
    setPolicyV2Objects,
    setError,
  })
  const { openCreatePolicyV2Window, openEditPolicyV2Window } = usePolicyAdvancedRuleEditor({
    activePolicyV2Family,
    activePolicyV2TableName,
    policyAdvancedLabel,
    policyV2ChainOptions,
    policyV2EditorOpen,
    policyV2Form,
    setPolicyV2Form,
    setEditingPolicyV2RuleId,
    setPolicyV2EditorOpen,
    setWinPos,
    setError,
  })
  usePolicyAdvancedContextSync({
    activeSection,
    activePolicyV2Family,
    activePolicyV2TableName,
    policyV2DataTab,
    policyV2TableNames,
    policyV2RulesFilter,
    setActivePolicyV2Family,
    setPolicyV2DataTab,
    setPolicyV2Objects,
    setSelectedPolicyV2ObjectIds,
    setPolicyV2ObjectFocusKey,
    setPolicyV2RuleObjectFilterKey,
    setActivePolicyV2TableName,
    setPolicyV2Rules,
    setSelectedPolicyV2RuleIds,
    setPolicyV2RulesFilter,
  })

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
    selectedPolicyV2Rules,
    selectedPolicyV2Objects,
  } = useFirewallSelections({
    visibleRules,
    selectedRuleIds,
    policyV2Rules,
    selectedPolicyV2RuleIds,
    policyV2ManagedObjects,
    selectedPolicyV2ObjectIds,
  })
  const {
    onSavePolicyV2,
    onDeleteSelectedPolicyV2Rules,
    onSetEnabledSelectedPolicyV2Rules,
  } = usePolicyAdvancedRuleActions({
    auth: props.auth,
    activePolicyV2Family,
    activePolicyV2TableName,
    policyV2Form,
    editingPolicyV2RuleId,
    policyV2ChainMetaByName,
    selectedPolicyV2Rules,
    setError,
    setIsBusy,
    setPolicyV2EditorOpen,
    setEditingPolicyV2RuleId,
    setSelectedPolicyV2RuleIds,
    setPolicyV2RuleAnchorId,
    refresh,
    refreshPolicyV2Rules,
  })
  const { onSavePolicyV2Object, onDeleteSelectedPolicyV2Objects } = usePolicyAdvancedObjectActions({
    auth: props.auth,
    activePolicyV2TableName,
    policyV2ObjectForm,
    editingPolicyV2ObjectId,
    selectedPolicyV2Objects,
    setError,
    setIsBusy,
    setPolicyV2ObjectOpen,
    setEditingPolicyV2ObjectId,
    setSelectedPolicyV2ObjectIds,
    setPolicyV2ObjectAnchorId,
    refreshPolicyV2Objects,
  })
  const {
    openCreatePolicyV2ObjectWindow,
    openEditPolicyV2ObjectWindow,
    applyPolicyV2ObjectPreset,
  } = usePolicyAdvancedObjectEditor({
    activePolicyV2Family,
    activePolicyV2TableName,
    setError,
    setEditingPolicyV2ObjectId,
    setPolicyV2ObjectForm,
    setPolicyV2ObjectOpen,
  })
  const {
    onFilterRulesByObject,
    onFilterObjectsByRuleBinding,
    onCreateRuleWithObject,
    onCreateRuleFromSelectedObjects,
    onOpenBindingObjectFromEditor,
    onUnbindObjectInEditor,
  } = usePolicyAdvancedBindings({
    selectedPolicyV2Objects,
    openCreatePolicyV2Window,
    setError,
    setPolicyV2DataTab,
    setPolicyV2RulesFilter,
    setPolicyV2RuleObjectFilterKey,
    setSelectedPolicyV2RuleIds,
    setPolicyV2RuleAnchorId,
    setPolicyV2ObjectsFilter,
    setPolicyV2ObjectFocusKey,
    setSelectedPolicyV2ObjectIds,
    setPolicyV2ObjectAnchorId,
    setPolicyV2EditorOpen,
    setEditingPolicyV2RuleId,
    setPolicyV2Form,
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
            onSectionChange={(next) => {
              if (isPolicyAdvancedSection(next)) {
                const nextCaps = getPolicyAdvancedCapabilities(getPolicyAdvancedSection(next))
                setActivePolicyV2Family(nextCaps.family)
                if (!nextCaps.supportsObjectsTab) setPolicyV2DataTab('rules')
              }
            }}
          />
          {isPolicyTab ? (
            <PolicySectionToolbar
              isCustomRuleTableActive={isCustomRuleTableActive}
              activePolicyTab={activePolicyTab}
              setActivePolicyTab={setActivePolicyTab}
              setActiveRuleTableName={setActiveRuleTableName}
              customTableNames={customTableNames}
              activeRuleTableName={activeRuleTableName}
              customTables={tablesState.custom}
              setSelectedTableIds={setSelectedTableIds}
              setTableAnchorId={setTableAnchorId}
              setActiveSection={setActiveSection}
              isBusy={isBusy}
              selectedRuleIdsLength={selectedRuleIds.length}
              openCreateWindow={openCreateWindow}
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
          ) : isPolicyAdvancedTab ? (
            <PolicyAdvancedPage
              policyAdvancedFamily={policyAdvancedFamily}
              activePolicyV2TableName={activePolicyV2TableName}
              setActivePolicyV2TableName={setActivePolicyV2TableName}
              policyAdvancedTableHint={policyAdvancedTableHint}
              policyV2TableNames={policyV2TableNames}
              policyAdvancedCaps={policyAdvancedCaps}
              policyV2DataTab={policyV2DataTab}
              setPolicyV2DataTab={setPolicyV2DataTab}
              isBusy={isBusy}
              openCreatePolicyV2Window={openCreatePolicyV2Window}
              onDeleteSelectedPolicyV2Rules={onDeleteSelectedPolicyV2Rules}
              onSetEnabledSelectedPolicyV2Rules={onSetEnabledSelectedPolicyV2Rules}
              policyV2RulesFilter={policyV2RulesFilter}
              setPolicyV2RulesFilter={setPolicyV2RulesFilter}
              policyV2RulesWithObjectsCount={policyV2RulesWithObjectsCount}
              policyV2RulesWithoutObjectsCount={policyV2RulesWithoutObjectsCount}
              policyV2RuleObjectFilterKey={policyV2RuleObjectFilterKey}
              setPolicyV2RuleObjectFilterKey={setPolicyV2RuleObjectFilterKey}
              policyV2FilteredRules={policyV2FilteredRules}
              policyV2RulesCount={policyV2Rules.length}
              activePolicyV2Family={activePolicyV2Family}
              policyAdvancedRulesColSpan={policyAdvancedRulesColSpan}
              formatCounter={formatCounter}
              buildPolicyV2BridgeExprSummary={buildPolicyV2BridgeExprSummary}
              onRuleRowDoubleClick={openEditPolicyV2Window}
              onFilterObjectsByRuleBinding={onFilterObjectsByRuleBinding}
              openCreatePolicyV2ObjectWindow={openCreatePolicyV2ObjectWindow}
              onCreateRuleFromSelectedObjects={onCreateRuleFromSelectedObjects}
              onDeleteSelectedPolicyV2Objects={onDeleteSelectedPolicyV2Objects}
              policyV2ObjectsFilter={policyV2ObjectsFilter}
              setPolicyV2ObjectsFilter={setPolicyV2ObjectsFilter}
              policyV2ObjectsUsedCount={policyV2ObjectsUsedCount}
              policyV2ObjectsFreeCount={policyV2ObjectsFreeCount}
              policyV2ObjectFocusKey={policyV2ObjectFocusKey}
              setPolicyV2ObjectFocusKey={setPolicyV2ObjectFocusKey}
              applyPolicyV2ObjectPreset={applyPolicyV2ObjectPreset}
              policyV2FilteredObjects={policyV2FilteredObjects}
              policyV2ManagedObjectsCount={policyV2ManagedObjects.length}
              selectedPolicyV2ObjectIds={selectedPolicyV2ObjectIds}
              policyV2ObjectUsageByKey={policyV2ObjectUsageByKey}
              formatPolicyV2ObjectSummary={formatPolicyV2ObjectSummary}
              onObjectRowDoubleClick={openEditPolicyV2ObjectWindow}
              onFilterRulesByObject={onFilterRulesByObject}
              onCreateRuleWithObject={onCreateRuleWithObject}
              selectedPolicyV2RuleIds={selectedPolicyV2RuleIds}
              policyV2RuleAnchorId={policyV2RuleAnchorId}
              setSelectedPolicyV2RuleIds={setSelectedPolicyV2RuleIds}
              setPolicyV2RuleAnchorId={setPolicyV2RuleAnchorId}
              policyV2ObjectAnchorId={policyV2ObjectAnchorId}
              setSelectedPolicyV2ObjectIds={setSelectedPolicyV2ObjectIds}
              setPolicyV2ObjectAnchorId={setPolicyV2ObjectAnchorId}
              computeSelection={computeSelection}
            />
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
              openEditWindow={openEditWindow}
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
          onClose: () => { setAddOpen(false); setEditingRuleId(null) },
          onSubmit: onSave,
          isBusy,
          form,
          setForm,
          hasSupport,
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
        }}
        policyAdvancedRuleEditor={{
          open: policyV2EditorOpen,
          winPos,
          onDragStart,
          editingPolicyV2RuleId,
          policyAdvancedRuleLabel,
          isBusy,
          activePolicyV2TableName,
          onClose: () => { setPolicyV2EditorOpen(false); setEditingPolicyV2RuleId(null) },
          onSubmit: onSavePolicyV2,
          policyV2Form,
          setPolicyV2Form,
          policyV2ChainOptions,
          policyAdvancedCaps,
          policyV2FormObjectBindings,
          onOpenBindingObjectFromEditor,
          onUnbindObjectInEditor,
          family: policyAdvancedFamily,
          policyV2CounterNames,
          policyV2LimitNames,
          policyV2QuotaNames,
          policyV2CtHelperNames,
          policyV2CtTimeoutNames,
        }}
        policyBridgeObject={{
          open: policyV2ObjectOpen,
          isBusy,
          activePolicyV2TableName,
          editingPolicyV2ObjectId,
          policyV2ObjectForm,
          setPolicyV2ObjectForm,
          setPolicyV2ObjectOpen,
          onSavePolicyV2Object,
          applyPolicyV2ObjectPreset,
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
