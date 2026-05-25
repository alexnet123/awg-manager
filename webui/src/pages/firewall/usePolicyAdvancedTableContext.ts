import * as React from 'react'
import type { FirewallTableItem } from '../api'
import { getPolicyAdvancedCapabilities } from './capabilities'
import { getPolicyAdvancedSection } from './sections'

type PolicyV2Family = 'bridge' | 'netdev'
type FirewallSectionTab = 'policy' | 'policy_v2' | 'policy_v3' | 'collections' | 'table_builder'

type Params = {
  activeSection: FirewallSectionTab
  activePolicyV2Family: PolicyV2Family
  activePolicyV2TableName: string
  customTables: FirewallTableItem[]
}

export function usePolicyAdvancedTableContext(params: Params) {
  const policyAdvancedCaps = React.useMemo(
    () => getPolicyAdvancedCapabilities(getPolicyAdvancedSection(params.activeSection)),
    [params.activeSection],
  )

  const policyAdvancedLabel = policyAdvancedCaps.policyLabel
  const policyAdvancedFamily = policyAdvancedCaps.family
  const policyAdvancedTableHint = policyAdvancedCaps.tableHint
  const policyAdvancedRuleLabel = policyAdvancedCaps.ruleLabel

  const policyAdvancedRulesColSpan =
    6
    + (policyAdvancedCaps.supportsObjectFilters ? 1 : 0)
    + 1
    + 1
    + (policyAdvancedCaps.showFwdColumns ? 1 : 0)
    + (policyAdvancedCaps.showDupColumns ? 1 : 0)
    + 1
    + (policyAdvancedCaps.showDestinationBridgeColumn ? 1 : 0)
    + 4
    + 2

  const policyV2TableNames = React.useMemo(
    () => Array.from(
      new Set(
        params.customTables
          .filter((x) => x.enabled !== false && String(x.family || '').toLowerCase() === params.activePolicyV2Family)
          .map((x) => String(x.table_name || '').toLowerCase())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b)),
    [params.customTables, params.activePolicyV2Family],
  )

  const policyV2TableRows = React.useMemo(
    () => params.customTables.filter((x) => x.enabled !== false
      && String(x.family || '').toLowerCase() === params.activePolicyV2Family
      && String(x.table_name || '').toLowerCase() === String(params.activePolicyV2TableName || '').toLowerCase()),
    [params.customTables, params.activePolicyV2Family, params.activePolicyV2TableName],
  )

  const policyV2ChainOptions = React.useMemo(
    () => Array.from(new Set(policyV2TableRows.map((x) => String(x.chain_name || '').toLowerCase()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [policyV2TableRows],
  )

  const policyV2ChainMetaByName = React.useMemo(() => {
    const out: Record<string, FirewallTableItem> = {}
    for (const row of policyV2TableRows) {
      const key = String(row.chain_name || '').toLowerCase()
      if (key && !out[key]) out[key] = row
    }
    return out
  }, [policyV2TableRows])

  return {
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
  }
}
