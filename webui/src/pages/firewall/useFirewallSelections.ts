import * as React from 'react'
import type { FirewallNamedObjectItem, FirewallRule } from '../api'

type Params = {
  visibleRules: FirewallRule[]
  selectedRuleIds: string[]
  firewallManagedObjects: FirewallNamedObjectItem[]
  selectedFirewallObjectIds: string[]
}

export function useFirewallSelections(params: Params) {
  const selectedRules = React.useMemo(
    () => params.visibleRules.filter((r) => params.selectedRuleIds.includes(r.id)),
    [params.visibleRules, params.selectedRuleIds],
  )

  const selectedFirewallObjects = React.useMemo(
    () => params.firewallManagedObjects.filter((r) => params.selectedFirewallObjectIds.includes(r.id)),
    [params.firewallManagedObjects, params.selectedFirewallObjectIds],
  )

  return {
    selectedRules,
    selectedFirewallObjects,
  }
}
