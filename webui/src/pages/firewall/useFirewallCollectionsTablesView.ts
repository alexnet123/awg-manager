import * as React from 'react'
import type { FirewallMapItem, FirewallMapsState, FirewallSetItem, FirewallSetsState, FirewallTableItem } from '../api'
import { getCollectionRemainingSeconds } from './policyUtils'
import { compareStr, nextSortState, type SortDirection } from './selectionUtils'

type CollectionSortKey = 'kind' | 'name' | 'values' | 'timeout' | 'created_at'
type TableSortKey = 'family' | 'table_name' | 'chain_name' | 'chain_type' | 'hook' | 'device' | 'priority' | 'policy' | 'origin' | 'status'

type CollectionRow =
  | (FirewallSetItem & { kind: 'addr' | 'port' | 'iface' })
  | (FirewallMapItem & { kind: 'map' | 'vmap' })

type Params = {
  setsState: FirewallSetsState
  mapsState: FirewallMapsState
  tableRows: FirewallTableItem[]
  collectionsNowSec: number
  collectionSort: { key: CollectionSortKey | null; dir: SortDirection }
  setCollectionSort: React.Dispatch<React.SetStateAction<{ key: CollectionSortKey | null; dir: SortDirection }>>
  tableSort: { key: TableSortKey | null; dir: SortDirection }
  setTableSort: React.Dispatch<React.SetStateAction<{ key: TableSortKey | null; dir: SortDirection }>>
  selectedCollectionIds: string[]
  selectedTableIds: string[]
}

export function useFirewallCollectionsTablesView(params: Params) {
  const allSetItems: Array<FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }> = [
    ...params.setsState.addr.map((x) => ({ ...x, kind: 'addr' as const })),
    ...params.setsState.port.map((x) => ({ ...x, kind: 'port' as const })),
    ...params.setsState.iface.map((x) => ({ ...x, kind: 'iface' as const })),
  ]

  const allMapItems: Array<FirewallMapItem & { kind: 'map' | 'vmap' }> = [
    ...params.mapsState.map.map((x) => ({ ...x, kind: 'map' as const })),
    ...params.mapsState.vmap.map((x) => ({ ...x, kind: 'vmap' as const })),
  ]

  const allCollectionItems: CollectionRow[] = [...allSetItems, ...allMapItems]

  const sortedCollectionItems = React.useMemo(() => {
    if (!params.collectionSort.key) return allCollectionItems
    const rows = [...allCollectionItems]
    const dir = params.collectionSort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (params.collectionSort.key === 'kind') return dir * compareStr(a.kind, b.kind)
      if (params.collectionSort.key === 'name') return dir * compareStr(String(a.name || ''), String(b.name || ''))
      if (params.collectionSort.key === 'timeout') return dir * ((getCollectionRemainingSeconds(a, params.collectionsNowSec) || 0) - (getCollectionRemainingSeconds(b, params.collectionsNowSec) || 0))
      if (params.collectionSort.key === 'created_at') return dir * (Number(a.created_at || 0) - Number(b.created_at || 0))
      const av = a.kind === 'map' || a.kind === 'vmap'
        ? ((a as FirewallMapItem).entries || []).join(', ')
        : ((a as FirewallSetItem).elements || []).join(', ')
      const bv = b.kind === 'map' || b.kind === 'vmap'
        ? ((b as FirewallMapItem).entries || []).join(', ')
        : ((b as FirewallSetItem).elements || []).join(', ')
      return dir * compareStr(av, bv)
    })
    return rows
  }, [allCollectionItems, params.collectionSort, params.collectionsNowSec])

  const sortedTableRows = React.useMemo(() => {
    const key = params.tableSort.key
    if (!key) return params.tableRows
    const rows = [...params.tableRows]
    const dir = params.tableSort.dir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (key === 'priority') return dir * (Number(a.priority || 0) - Number(b.priority || 0))
      if (key === 'origin') return dir * compareStr(a.builtin ? 'built-in' : 'custom', b.builtin ? 'built-in' : 'custom')
      if (key === 'status') return dir * compareStr(a.enabled === false ? 'disabled' : 'enabled', b.enabled === false ? 'disabled' : 'enabled')
      const av = key === 'device' ? String(a.device || '') : String((a as Record<string, unknown>)[key] || '')
      const bv = key === 'device' ? String(b.device || '') : String((b as Record<string, unknown>)[key] || '')
      return dir * compareStr(av, bv)
    })
    return rows
  }, [params.tableRows, params.tableSort])

  const selectedCollections = allCollectionItems.filter((r) => params.selectedCollectionIds.includes(r.id))
  const selectedTimedCollections = selectedCollections.filter((r) => !!r.timeout)
  const selectedCustomTables = params.tableRows.filter((r) => params.selectedTableIds.includes(r.id) && !r.builtin)

  const toggleCollectionSort = React.useCallback((key: CollectionSortKey) => {
    params.setCollectionSort((prev) => nextSortState(prev, key))
  }, [params.setCollectionSort])

  const toggleTableSort = React.useCallback((key: TableSortKey) => {
    params.setTableSort((prev) => nextSortState(prev, key))
  }, [params.setTableSort])

  return {
    allCollectionItems,
    sortedCollectionItems,
    sortedTableRows,
    selectedCollections,
    selectedTimedCollections,
    selectedCustomTables,
    toggleCollectionSort,
    toggleTableSort,
  }
}
