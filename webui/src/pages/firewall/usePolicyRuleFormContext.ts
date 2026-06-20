import * as React from 'react'
import type { FirewallRule, FirewallSchema, FirewallTableItem } from '../api'
import { getGeneralFieldState, type FieldState } from './policyFieldStates'

type FirewallPolicyTab = 'filter' | 'nat' | 'raw' | 'mangle'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'

type Params = {
  schema: FirewallSchema | null
  customTables: FirewallTableItem[]
  form: Partial<FirewallRule>
  activeRuleTableName: string
  activeRuleTableFamily: TableFamily
  activePolicyTab: FirewallPolicyTab
}

export function usePolicyRuleFormContext(params: Params) {
  const chainOptionsByTable: Record<string, string[]> = {
    filter: params.schema?.tables?.filter?.chains || ['input', 'forward', 'output'],
    nat: params.schema?.tables?.nat?.chains || ['prerouting', 'input', 'output', 'postrouting'],
    raw: params.schema?.tables?.raw?.chains || ['prerouting', 'output'],
    mangle: params.schema?.tables?.mangle?.chains || ['prerouting', 'input', 'forward', 'output', 'postrouting'],
  }

  const builtinRuleTables = new Set(['filter', 'nat', 'raw', 'mangle'])

  const customChainRowsByTable = React.useMemo(() => {
    const out: Record<string, FirewallTableItem[]> = {}
    for (const row of params.customTables.filter((x) => String(x.family || 'inet').toLowerCase() === params.activeRuleTableFamily)) {
      const t = String(row.table_name || '').toLowerCase()
      if (!t) continue
      if (!out[t]) out[t] = []
      out[t].push(row)
    }
    return out
  }, [params.activeRuleTableFamily, params.customTables])

  const activeFormTable = String(params.form.table || params.activeRuleTableName || params.activePolicyTab).toLowerCase()
  const activeFormFamily = String(params.form.family || params.activeRuleTableFamily || 'inet').toLowerCase()
  const isBuiltinActiveTable = activeFormFamily === 'inet' && builtinRuleTables.has(activeFormTable)

  const defaultChainMode = isBuiltinActiveTable
    ? activeFormTable
    : ((customChainRowsByTable[activeFormTable]?.find((row) => row.chain_name === params.form.chain)?.chain_type
        || customChainRowsByTable[activeFormTable]?.[0]?.chain_type
        || 'filter') === 'nat' ? 'nat' : 'filter')

  const tableSupports = new Set(params.schema?.tables?.[(defaultChainMode as 'filter' | 'nat' | 'raw' | 'mangle')]?.supports || [])
  const hasSupport = (key: string) => tableSupports.has(key)

  const activeChainOptions = isBuiltinActiveTable
    ? (chainOptionsByTable[activeFormTable] || ['input'])
    : ((customChainRowsByTable[activeFormTable] || []).map((row) => row.chain_name).filter(Boolean))

  const effectiveChain = (params.form.chain || activeChainOptions[0] || 'input') as string
  const contextMode: 'filter' | 'nat' | 'raw' | 'mangle' = builtinRuleTables.has(activeFormTable)
    && isBuiltinActiveTable
    ? (activeFormTable as 'filter' | 'nat' | 'raw' | 'mangle')
    : (defaultChainMode as 'filter' | 'nat' | 'raw' | 'mangle')

  const contextKey = `${contextMode}:${effectiveChain}`

  function generalFieldState(field: 'in_interface' | 'out_interface' | 'ct_state'): FieldState {
    return getGeneralFieldState(contextKey, field)
  }

  const toPortState: FieldState = contextKey === 'nat:postrouting' ? 'W' : 'V'

  return {
    chainOptionsByTable,
    builtinRuleTables,
    customChainRowsByTable,
    activeChainOptions,
    contextMode,
    hasSupport,
    generalFieldState,
    toPortState,
  }
}
