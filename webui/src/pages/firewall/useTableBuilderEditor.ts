import * as React from 'react'
import type { AuthState, FirewallTableItem, FirewallTablesState } from '../api'
import { upsertFirewallTable } from '../api'

type TableChainType = 'filter' | 'nat' | 'route'
type TableHook = 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'

type Params = {
  auth: AuthState
  tablesState: FirewallTablesState
  editingTableId: string | null
  newTableFamily: TableFamily
  newTableName: string
  newChainName: string
  newChainType: TableChainType
  newHook: TableHook
  newDevice: string
  newPriority: string
  newPolicy: 'accept' | 'drop'
  tableAllowedHooks: Record<TableChainType, TableHook[]>
  setEditingTableId: React.Dispatch<React.SetStateAction<string | null>>
  setNewTableFamily: React.Dispatch<React.SetStateAction<TableFamily>>
  setNewTableName: React.Dispatch<React.SetStateAction<string>>
  setNewChainName: React.Dispatch<React.SetStateAction<string>>
  setNewChainType: React.Dispatch<React.SetStateAction<TableChainType>>
  setNewHook: React.Dispatch<React.SetStateAction<TableHook>>
  setNewDevice: React.Dispatch<React.SetStateAction<string>>
  setNewPriority: React.Dispatch<React.SetStateAction<string>>
  setNewPolicy: React.Dispatch<React.SetStateAction<'accept' | 'drop'>>
  setWinPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  setTableOpen: React.Dispatch<React.SetStateAction<boolean>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  refresh: () => Promise<void>
}

export function useTableBuilderEditor(params: Params) {
  const openCreateTableWindow = React.useCallback(() => {
    params.setEditingTableId(null)
    params.setNewTableFamily('inet')
    params.setNewTableName('')
    params.setNewChainName('')
    params.setNewChainType('filter')
    params.setNewHook('input')
    params.setNewDevice('')
    params.setNewPriority('-10')
    params.setNewPolicy('accept')
    params.setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 420) / 2) - 40) })
    params.setTableOpen(true)
  }, [params])

  const openEditTableWindow = React.useCallback((item: FirewallTableItem) => {
    if (item.builtin) return
    params.setEditingTableId(item.id)
    params.setNewTableFamily((item.family || 'inet') as TableFamily)
    params.setNewTableName(item.table_name || '')
    params.setNewChainName(item.chain_name || '')
    params.setNewChainType((item.chain_type || 'filter') as TableChainType)
    params.setNewHook((item.hook || 'input') as TableHook)
    params.setNewDevice(item.device || '')
    params.setNewPriority(String(item.priority ?? -10))
    params.setNewPolicy((item.policy || 'accept') as 'accept' | 'drop')
    params.setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 420) / 2) - 40) })
    params.setTableOpen(true)
  }, [params])

  const onSaveTable = React.useCallback(async (): Promise<boolean> => {
    params.setError(null)
    const family = params.newTableFamily.trim().toLowerCase() as TableFamily
    const tableName = params.newTableName.trim()
    const chainName = params.newChainName.trim()
    const hook = params.newHook.trim().toLowerCase()
    const hookValue = params.newHook
    const priorityNum = Number(params.newPriority)
    const device = hook === 'ingress' ? (params.newDevice.trim() || null) : null

    if (!tableName || !chainName) {
      params.setError('Table name and chain name are required.')
      return false
    }
    if (!Number.isFinite(priorityNum) || !Number.isInteger(priorityNum)) {
      params.setError('Priority must be an integer.')
      return false
    }
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
      params.setError('Table name allows only letters, numbers, and underscore.')
      return false
    }
    if (!/^[A-Za-z0-9_]+$/.test(chainName)) {
      params.setError('Chain name allows only letters, numbers, and underscore.')
      return false
    }
    if (!['inet', 'ip', 'ip6', 'bridge', 'netdev'].includes(family)) {
      params.setError('Family must be one of: inet, ip, ip6, bridge, netdev.')
      return false
    }
    if (!params.tableAllowedHooks[params.newChainType].includes(hookValue)) {
      params.setError(`Hook "${hookValue}" is not allowed for chain type "${params.newChainType}".`)
      return false
    }
    if (family === 'netdev' && (params.newChainType !== 'filter' || hookValue !== 'ingress')) {
      params.setError('netdev family supports only chain type "filter" with hook "ingress".')
      return false
    }
    if (hookValue === 'ingress' && !device) {
      params.setError('Device is required for ingress hook.')
      return false
    }
    if (hookValue !== 'ingress' && params.newDevice.trim()) {
      params.setError('Device can be set only for ingress hook.')
      return false
    }

    const allRows = [...params.tablesState.builtin, ...params.tablesState.custom]
    const duplicateChainInTable = allRows.find((row) =>
      row.id !== params.editingTableId
      && row.family.toLowerCase() === family
      && row.table_name === tableName
      && row.chain_name === chainName
    )
    if (duplicateChainInTable) {
      params.setError(`Chain "${chainName}" already exists in table "${tableName}".`)
      return false
    }

    const hookPriorityConflict = allRows.find((row) =>
      row.id !== params.editingTableId
      && row.family.toLowerCase() === family
      && String(row.hook || '').toLowerCase() === hook
      && Number(row.priority) === priorityNum
    )
    if (hookPriorityConflict) {
      const origin = hookPriorityConflict.builtin ? 'built-in' : 'custom'
      params.setError(`Hook/priority conflict with ${origin} chain ${hookPriorityConflict.table_name}/${hookPriorityConflict.chain_name} (${hook}, ${priorityNum}).`)
      return false
    }

    params.setIsBusy(true)
    try {
      await upsertFirewallTable(params.auth, {
        id: params.editingTableId || undefined,
        family,
        table_name: tableName,
        chain_name: chainName,
        chain_type: params.newChainType,
        hook: hookValue,
        device,
        priority: priorityNum,
        policy: params.newPolicy,
        enabled: params.editingTableId ? (params.tablesState.custom.find((x) => x.id === params.editingTableId)?.enabled ?? true) : true,
      })
      params.setEditingTableId(null)
      await params.refresh()
      return true
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
      return false
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  return {
    openCreateTableWindow,
    openEditTableWindow,
    onSaveTable,
  }
}
