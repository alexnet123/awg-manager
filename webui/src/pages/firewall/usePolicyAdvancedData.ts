import * as React from 'react'
import type { AuthState, FirewallNamedObjects, FirewallRule } from '../api'
import { getFirewallObjects, getFirewallRules } from '../api'
import { isPolicyAdvancedSection } from './sections'

type Params = {
  auth: AuthState
  activeSection: string
  activePolicyV2Family: 'bridge' | 'netdev'
  activePolicyV2TableName: string
  refreshNonce: number
  setPolicyV2Rules: React.Dispatch<React.SetStateAction<FirewallRule[]>>
  setPolicyV2Objects: React.Dispatch<React.SetStateAction<FirewallNamedObjects | null>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

export function usePolicyAdvancedData(params: Params) {
  const refreshPolicyV2Rules = React.useCallback(async () => {
    if (!params.activePolicyV2TableName) {
      params.setPolicyV2Rules([])
      params.setPolicyV2Objects(null)
      return
    }
    const items = await getFirewallRules(params.auth, { family: params.activePolicyV2Family, table: params.activePolicyV2TableName })
    params.setPolicyV2Rules(items)
  }, [params.activePolicyV2TableName, params.setPolicyV2Rules, params.setPolicyV2Objects, params.auth, params.activePolicyV2Family])

  const refreshPolicyV2Objects = React.useCallback(async () => {
    if (!params.activePolicyV2TableName) {
      params.setPolicyV2Objects(null)
      return
    }
    if (params.activePolicyV2Family !== 'bridge') {
      params.setPolicyV2Objects(null)
      return
    }
    const item = await getFirewallObjects(params.auth, { family: params.activePolicyV2Family, table: params.activePolicyV2TableName })
    params.setPolicyV2Objects(item)
  }, [params.activePolicyV2TableName, params.activePolicyV2Family, params.auth, params.setPolicyV2Objects])

  React.useEffect(() => {
    if (!isPolicyAdvancedSection(params.activeSection)) return
    void Promise.all([refreshPolicyV2Rules(), refreshPolicyV2Objects()]).catch((exc) => params.setError(exc instanceof Error ? exc.message : String(exc)))
  }, [
    params.activeSection,
    params.activePolicyV2Family,
    params.activePolicyV2TableName,
    params.refreshNonce,
    refreshPolicyV2Rules,
    refreshPolicyV2Objects,
    params.setError,
  ])

  return {
    refreshPolicyV2Rules,
    refreshPolicyV2Objects,
  }
}
