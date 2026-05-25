import * as React from 'react'
import type { FirewallRule, FirewallState } from '../api'
import { compareStr, nextSortState, type SortDirection } from './selectionUtils'

type PolicySortKey = 'chain' | 'action' | 'proto' | 'src' | 'dst' | 'sport' | 'dport' | 'in_interface' | 'out_interface' | 'ct_state' | 'packets' | 'bytes'

type Params = {
  state: FirewallState | null
  activeRuleTableName: string
  policySort: { key: PolicySortKey | null; dir: SortDirection }
  setPolicySort: React.Dispatch<React.SetStateAction<{ key: PolicySortKey | null; dir: SortDirection }>>
  visibleColumns: Record<string, boolean>
  policyColumnOrder: PolicySortKey[]
}

export function usePolicyRulesView(params: Params) {
  const activeRuleTable = params.activeRuleTableName

  const visibleRules = React.useMemo(
    () => (params.state?.rules || []).filter((r) => r.table === activeRuleTable && String(r.family || 'inet').toLowerCase() === 'inet'),
    [params.state?.rules, activeRuleTable],
  )

  const sortedVisibleRules = React.useMemo(() => {
    const key = params.policySort.key
    if (!key) return visibleRules
    const rows = [...visibleRules]
    const dir = params.policySort.dir === 'asc' ? 1 : -1
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
  }, [visibleRules, params.policySort])

  const visiblePolicyColSpan = React.useMemo(
    () => Math.max(1, params.policyColumnOrder.reduce((acc, key) => acc + (params.visibleColumns[key] ? 1 : 0), 0)),
    [params.policyColumnOrder, params.visibleColumns],
  )

  const firstVisiblePolicyColumn = React.useMemo<PolicySortKey>(
    () => params.policyColumnOrder.find((key) => !!params.visibleColumns[key]) || 'chain',
    [params.policyColumnOrder, params.visibleColumns],
  )

  const togglePolicySort = React.useCallback((key: PolicySortKey) => {
    params.setPolicySort((prev) => nextSortState(prev, key))
  }, [params.setPolicySort])

  return {
    activeRuleTable,
    visibleRules,
    sortedVisibleRules,
    visiblePolicyColSpan,
    firstVisiblePolicyColumn,
    togglePolicySort,
  }
}
