import * as React from 'react'
import type { FirewallNamedObjectItem, FirewallRule } from '../api'

type Params = {
  visibleRules: FirewallRule[]
  selectedRuleIds: string[]
  policyV2Rules: FirewallRule[]
  selectedPolicyV2RuleIds: string[]
  policyV2ManagedObjects: FirewallNamedObjectItem[]
  selectedPolicyV2ObjectIds: string[]
}

export function useFirewallSelections(params: Params) {
  const selectedRules = React.useMemo(
    () => params.visibleRules.filter((r) => params.selectedRuleIds.includes(r.id)),
    [params.visibleRules, params.selectedRuleIds],
  )

  const selectedPolicyV2Rules = React.useMemo(
    () => params.policyV2Rules.filter((r) => params.selectedPolicyV2RuleIds.includes(r.id)),
    [params.policyV2Rules, params.selectedPolicyV2RuleIds],
  )

  const selectedPolicyV2Objects = React.useMemo(
    () => params.policyV2ManagedObjects.filter((r) => params.selectedPolicyV2ObjectIds.includes(r.id)),
    [params.policyV2ManagedObjects, params.selectedPolicyV2ObjectIds],
  )

  return {
    selectedRules,
    selectedPolicyV2Rules,
    selectedPolicyV2Objects,
  }
}
