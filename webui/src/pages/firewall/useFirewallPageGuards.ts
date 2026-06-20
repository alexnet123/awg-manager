import * as React from 'react'
import type { FirewallTableItem } from '../api'

type TableHook = 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'

type Params = {
  allowedHooksForChainType: TableHook[]
  newHook: TableHook
  setNewHook: React.Dispatch<React.SetStateAction<TableHook>>
  newDevice: string
  setNewDevice: React.Dispatch<React.SetStateAction<string>>
  activePolicyTab: 'filter' | 'nat' | 'raw' | 'mangle'
  setActiveRuleTableName: React.Dispatch<React.SetStateAction<string>>
  activeRuleTableFamily: TableFamily
  setActiveRuleTableFamily: React.Dispatch<React.SetStateAction<TableFamily>>
  activeRuleTableName: string
  customTables: FirewallTableItem[]
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
    params.setActiveRuleTableFamily('inet')
  }, [params.activePolicyTab, params.setActiveRuleTableFamily, params.setActiveRuleTableName])

  React.useEffect(() => {
    if (['filter', 'nat', 'raw', 'mangle'].includes(params.activeRuleTableName)) return
    const existsEnabled = params.customTables.some(
      (x) => (
        x.table_name === params.activeRuleTableName
        && x.enabled !== false
        && String(x.family || 'inet').toLowerCase() === params.activeRuleTableFamily
      ),
    )
    if (!existsEnabled) {
      params.setActiveRuleTableName('filter')
      params.setActiveRuleTableFamily('inet')
    }
  }, [
    params.activeRuleTableFamily,
    params.activeRuleTableName,
    params.customTables,
    params.setActiveRuleTableFamily,
    params.setActiveRuleTableName,
  ])

}
