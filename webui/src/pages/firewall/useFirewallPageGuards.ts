import * as React from 'react'
import type { FirewallRule, FirewallTableItem } from '../api'

type TableHook = 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'

type Params = {
  allowedHooksForChainType: TableHook[]
  newHook: TableHook
  setNewHook: React.Dispatch<React.SetStateAction<TableHook>>
  newDevice: string
  setNewDevice: React.Dispatch<React.SetStateAction<string>>
  activePolicyTab: 'filter' | 'nat' | 'raw' | 'mangle'
  setActiveRuleTableName: React.Dispatch<React.SetStateAction<string>>
  activeRuleTableName: string
  customTables: FirewallTableItem[]
  policyV2EditorOpen: boolean
  policyV2ChainOptions: string[]
  policyV2Form: Partial<FirewallRule>
  setPolicyV2Form: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
}

export function useFirewallPageGuards(params: Params) {
  React.useEffect(() => {
    if (!params.allowedHooksForChainType.includes(params.newHook)) {
      params.setNewHook(params.allowedHooksForChainType[0])
    }
  }, [params.allowedHooksForChainType, params.newHook, params.setNewHook])

  React.useEffect(() => {
    if (params.newHook !== 'ingress' && params.newDevice) {
      params.setNewDevice('')
    }
  }, [params.newHook, params.newDevice, params.setNewDevice])

  React.useEffect(() => {
    params.setActiveRuleTableName(params.activePolicyTab)
  }, [params.activePolicyTab, params.setActiveRuleTableName])

  React.useEffect(() => {
    if (['filter', 'nat', 'raw', 'mangle'].includes(params.activeRuleTableName)) return
    const existsEnabled = params.customTables.some(
      (x) => x.table_name === params.activeRuleTableName && x.enabled !== false && String(x.family || 'inet').toLowerCase() === 'inet',
    )
    if (!existsEnabled) params.setActiveRuleTableName('filter')
  }, [params.activeRuleTableName, params.customTables, params.setActiveRuleTableName])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    if (!params.policyV2ChainOptions.length) return
    const current = String(params.policyV2Form.chain || '').toLowerCase()
    if (!current || !params.policyV2ChainOptions.includes(current)) {
      params.setPolicyV2Form((p) => ({ ...p, chain: params.policyV2ChainOptions[0] }))
    }
  }, [params.policyV2EditorOpen, params.policyV2Form.chain, params.policyV2ChainOptions, params.setPolicyV2Form])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    const proto = params.policyV2Form.proto
    if (proto && proto !== 'tcp' && proto !== 'udp' && (params.policyV2Form.sport || params.policyV2Form.dport)) {
      params.setPolicyV2Form((p) => ({ ...p, sport: null, dport: null }))
    }
  }, [
    params.policyV2EditorOpen,
    params.policyV2Form.proto,
    params.policyV2Form.sport,
    params.policyV2Form.dport,
    params.setPolicyV2Form,
  ])
}
