import * as React from 'react'
import type { AuthState, FirewallRule } from '../api'
import { createFirewallRule, deleteFirewallRule, updateFirewallRule } from '../api'

type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'

type LiveChartPoint = {
  slot: number
  pps: number
  bps: number
  ts: number
}

type Params = {
  auth: AuthState
  form: Partial<FirewallRule>
  editingRuleId: string | null
  activeRuleTableName: string
  activeRuleTableFamily: TableFamily
  activeChainOptions: string[]
  defaultRule: Partial<FirewallRule>
  advancedSectionsClosed: Record<string, boolean>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  setEditingRuleId: React.Dispatch<React.SetStateAction<string | null>>
  setAddOpen: React.Dispatch<React.SetStateAction<boolean>>
  setRuleEditorTab: React.Dispatch<React.SetStateAction<'base' | 'advanced' | 'action' | 'stats'>>
  setAdvOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setWinPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  setLiveChartPoints: React.Dispatch<React.SetStateAction<LiveChartPoint[]>>
  buildEmptyLiveChart: () => LiveChartPoint[]
  refresh: () => Promise<void>
}

function toEditableForm(rule: FirewallRule): Partial<FirewallRule> {
  return {
    table: rule.table,
    family: rule.family,
    chain: rule.chain,
    action: rule.action,
    proto: rule.proto || null,
    src: rule.src || null,
    dst: rule.dst || null,
    in_interface: rule.in_interface || null,
    out_interface: rule.out_interface || null,
    ibrname: rule.ibrname || null,
    obrname: rule.obrname || null,
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
    log_flags: Array.isArray(rule.log_flags) ? rule.log_flags : (rule.log_flags ? [String(rule.log_flags) as any] : null),
    log_group: rule.log_group ?? null,
    log_snaplen: rule.log_snaplen ?? null,
    log_queue_threshold: rule.log_queue_threshold ?? null,
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
    counter_name: rule.counter_name || null,
    limit_name: rule.limit_name || null,
    quota_name: rule.quota_name || null,
    queue_num: rule.queue_num || null,
    queue_flags: Array.isArray(rule.queue_flags) ? rule.queue_flags : (rule.queue_flags ? [String(rule.queue_flags) as any] : null),
    dup_to: rule.dup_to || null,
    dup_dev: rule.dup_dev || null,
    fwd_to: rule.fwd_to || null,
    fwd_dev: rule.fwd_dev || null,
    fwd_family: rule.fwd_family || null,
    set_stmt_op: rule.set_stmt_op || null,
    set_stmt_name: rule.set_stmt_name || null,
    set_stmt_expr: rule.set_stmt_expr || null,
    set_stmt_timeout: rule.set_stmt_timeout || null,
    set_stmt_comment: null,
    vmap_stmt_expr: rule.vmap_stmt_expr || null,
    vmap_stmt_name: rule.vmap_stmt_name || null,
    limit_rate: rule.limit_rate || null,
    counter: !!rule.counter,
    enabled: rule.enabled,
  }
}

function buildSavePayload(form: Partial<FirewallRule>): Partial<FirewallRule> {
  const family = String(form.family || 'inet').toLowerCase()
  const action = form.action || 'accept'
  const isNatAction = !!form.nat_type
  const payload: Partial<FirewallRule> = {
    ...form,
    ...(action !== 'queue' ? { queue_num: null, queue_flags: null } : {}),
    ...(action !== 'fwd' ? { fwd_to: null, fwd_dev: null, fwd_family: null } : {}),
    ...(action !== 'reject' ? { reject_type: null } : {}),
    ...(!isNatAction ? {
      to_addr: null,
      to_port: null,
      nat_random: false,
      nat_fully_random: false,
      nat_persistent: false,
    } : {}),
    ...(family !== 'inet' || !form.set_stmt_name ? {
      set_stmt_op: null,
      set_stmt_name: null,
      set_stmt_expr: null,
      set_stmt_timeout: null,
      set_stmt_comment: null,
    } : {
      set_stmt_comment: null,
    }),
    ...(family !== 'inet' || !form.vmap_stmt_name ? {
      vmap_stmt_expr: null,
      vmap_stmt_name: null,
    } : {
      action: '',
      nat_type: null,
      target_chain: null,
      reject_type: null,
      set_stmt_op: null,
      set_stmt_name: null,
      set_stmt_expr: null,
      set_stmt_timeout: null,
      set_stmt_comment: null,
    }),
  }

  if (family === 'bridge') {
    return {
      ...payload,
      in_interface: null,
      out_interface: null,
      fwd_to: null,
      fwd_dev: null,
      fwd_family: null,
      nat_type: null,
      to_addr: null,
      to_port: null,
      nat_random: false,
      nat_fully_random: false,
      nat_persistent: false,
      set_stmt_op: null,
      set_stmt_name: null,
      set_stmt_expr: null,
      set_stmt_timeout: null,
      set_stmt_comment: null,
      vmap_stmt_expr: null,
      vmap_stmt_name: null,
    }
  }

  if (family === 'netdev') {
    return {
      ...payload,
      out_interface: null,
      ibrname: null,
      obrname: null,
      ct_helper_set: null,
      ct_timeout_set: null,
      ct_expectation_set: null,
      counter_name: null,
      limit_name: null,
      quota_name: null,
      dup_to: null,
      dup_dev: null,
      reject_type: null,
      nat_type: null,
      to_addr: null,
      to_port: null,
      nat_random: false,
      nat_fully_random: false,
      nat_persistent: false,
      set_stmt_op: null,
      set_stmt_name: null,
      set_stmt_expr: null,
      set_stmt_timeout: null,
      set_stmt_comment: null,
      vmap_stmt_expr: null,
      vmap_stmt_name: null,
    }
  }

  return payload
}

export function usePolicyRuleEditorActions(params: Params) {
  const onSave = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    params.setError(null)
    const payload = buildSavePayload(params.form)
    params.setIsBusy(true)
    try {
      if (params.editingRuleId) await updateFirewallRule(params.auth, params.editingRuleId, payload)
      else await createFirewallRule(params.auth, payload)
      params.setForm(params.defaultRule)
      params.setEditingRuleId(null)
      params.setAddOpen(false)
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onDelete = React.useCallback(async (rule: FirewallRule) => {
    if (!confirm('Delete this firewall rule?')) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      await deleteFirewallRule(params.auth, rule.id)
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onSetEnabled = React.useCallback(async (rule: FirewallRule, enabled: boolean) => {
    params.setError(null)
    params.setIsBusy(true)
    try {
      await updateFirewallRule(params.auth, rule.id, { enabled })
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const openCreateWindow = React.useCallback((prefill?: Partial<FirewallRule>) => {
    params.setEditingRuleId(null)
    params.setRuleEditorTab('base')
    params.setAdvOpen({ ...params.advancedSectionsClosed })
    const ruleTable = params.activeRuleTableName
    params.setForm({ ...params.defaultRule, family: params.activeRuleTableFamily, table: ruleTable, chain: params.activeChainOptions[0] || 'input', ...(prefill || {}) })
    params.setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 760) / 2) - 60) })
    params.setAddOpen(true)
  }, [params])

  const openEditWindow = React.useCallback((rule: FirewallRule) => {
    params.setEditingRuleId(rule.id)
    params.setRuleEditorTab('base')
    params.setAdvOpen({ ...params.advancedSectionsClosed })
    params.setForm(toEditableForm(rule))
    params.setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 760) / 2) - 60) })
    params.setLiveChartPoints(params.buildEmptyLiveChart())
    params.setAddOpen(true)
  }, [params])

  return {
    onSave,
    onDelete,
    onSetEnabled,
    openCreateWindow,
    openEditWindow,
  }
}
