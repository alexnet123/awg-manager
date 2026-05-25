import * as React from 'react'
import type { AuthState, FirewallMapItem, FirewallRule, FirewallSetItem, FirewallTableItem } from '../api'
import {
  deleteFirewallMap,
  deleteFirewallRule,
  deleteFirewallSet,
  deleteFirewallTable,
  resetFirewallCounters,
  updateFirewallRule,
  upsertFirewallMap,
  upsertFirewallSet,
  upsertFirewallTable,
} from '../api'

type LiveChartPoint = {
  slot: number
  pps: number
  bps: number
  ts: number
}

type CollectionRow =
  | (FirewallSetItem & { kind: 'addr' | 'port' | 'iface' })
  | (FirewallMapItem & { kind: 'map' | 'vmap' })

type Params = {
  auth: AuthState
  selectedRules: FirewallRule[]
  selectedCollections: CollectionRow[]
  selectedTimedCollections: CollectionRow[]
  selectedCustomTables: FirewallTableItem[]
  activeRuleTable: string
  addOpen: boolean
  editingRuleId: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedRuleIds: React.Dispatch<React.SetStateAction<string[]>>
  setRuleAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedCollectionIds: React.Dispatch<React.SetStateAction<string[]>>
  setCollectionAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedTableIds: React.Dispatch<React.SetStateAction<string[]>>
  setTableAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setLiveChartPoints: React.Dispatch<React.SetStateAction<LiveChartPoint[]>>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  buildEmptyLiveChart: () => LiveChartPoint[]
  refresh: () => Promise<void>
  refreshCollections: () => Promise<void>
}

export function useFirewallBulkActions(params: Params) {
  const onDeleteSelectedRules = React.useCallback(async () => {
    if (!params.selectedRules.length) return
    if (!confirm(`Delete ${params.selectedRules.length} selected rule(s)?`)) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const rule of params.selectedRules) await deleteFirewallRule(params.auth, rule.id)
      params.setSelectedRuleIds([])
      params.setRuleAnchorId(null)
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onSetEnabledSelectedRules = React.useCallback(async (enabled: boolean) => {
    if (!params.selectedRules.length) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const rule of params.selectedRules) await updateFirewallRule(params.auth, rule.id, { enabled })
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onResetPolicyCounters = React.useCallback(async () => {
    params.setError(null)
    params.setIsBusy(true)
    try {
      await resetFirewallCounters(params.auth, params.activeRuleTable)
      if (params.addOpen && params.editingRuleId) {
        params.setLiveChartPoints(params.buildEmptyLiveChart())
        params.setForm((prev) => ({
          ...prev,
          runtime_packets: 0,
          runtime_bytes: 0,
          runtime_pps: 0,
          runtime_bps: 0,
          runtime_history: [],
        }))
      }
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onDeleteSelectedCollections = React.useCallback(async () => {
    if (!params.selectedCollections.length) return
    if (!confirm(`Delete ${params.selectedCollections.length} selected collection item(s)?`)) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const item of params.selectedCollections) {
        if (item.kind === 'map' || item.kind === 'vmap') await deleteFirewallMap(params.auth, item.kind, item.id)
        else await deleteFirewallSet(params.auth, item.kind, item.id)
      }
      params.setSelectedCollectionIds([])
      params.setCollectionAnchorId(null)
      await params.refreshCollections()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onSetEnabledSelectedCollections = React.useCallback(async (enabled: boolean) => {
    if (!params.selectedCollections.length) return
    if (params.selectedTimedCollections.length) {
      params.setError('Temporary collections cannot be enabled/disabled; delete them instead.')
      return
    }
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const item of params.selectedCollections) {
        if (item.kind === 'map' || item.kind === 'vmap') {
          const mapItem = item as FirewallMapItem & { kind: 'map' | 'vmap' }
          await upsertFirewallMap(params.auth, mapItem.kind, {
            id: mapItem.id,
            name: mapItem.name,
            entries: mapItem.entries || [],
            comment: mapItem.comment || null,
            timeout: mapItem.timeout || null,
            enabled,
          })
        } else {
          const setItem = item as FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }
          await upsertFirewallSet(params.auth, setItem.kind, {
            id: setItem.id,
            name: setItem.name,
            elements: setItem.elements || [],
            enabled,
            comment: setItem.comment || null,
            timeout: setItem.timeout || null,
          })
        }
      }
      await params.refreshCollections()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onDeleteSelectedTables = React.useCallback(async () => {
    if (!params.selectedCustomTables.length) return
    if (!confirm(`Delete ${params.selectedCustomTables.length} selected custom table chain(s)?`)) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const row of params.selectedCustomTables) await deleteFirewallTable(params.auth, row.id)
      params.setSelectedTableIds([])
      params.setTableAnchorId(null)
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onSetEnabledSelectedTables = React.useCallback(async (enabled: boolean) => {
    if (!params.selectedCustomTables.length) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const item of params.selectedCustomTables) {
        await upsertFirewallTable(params.auth, {
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
      await params.refresh()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  return {
    onDeleteSelectedRules,
    onSetEnabledSelectedRules,
    onResetPolicyCounters,
    onDeleteSelectedCollections,
    onSetEnabledSelectedCollections,
    onDeleteSelectedTables,
    onSetEnabledSelectedTables,
  }
}
