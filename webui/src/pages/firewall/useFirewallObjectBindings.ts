import * as React from 'react'
import type { FirewallNamedObjectItem, FirewallRule } from '../api'
import { buildFirewallObjectUsageKey } from './firewallObjectBindings'

type ObjectRulesFilter = 'all' | 'with_objects' | 'without_objects'
type FirewallObjectsFilter = 'all' | 'used' | 'unused'

type Params = {
  selectedFirewallObjects: FirewallNamedObjectItem[]
  openCreateObjectRuleWindow: (prefill?: Partial<FirewallRule>) => void
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setObjectRulesFilter: React.Dispatch<React.SetStateAction<ObjectRulesFilter>>
  setObjectRuleObjectFilterKey: React.Dispatch<React.SetStateAction<string | null>>
  setFirewallObjectsFilter: React.Dispatch<React.SetStateAction<FirewallObjectsFilter>>
  setFirewallObjectFocusKey: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedFirewallObjectIds: React.Dispatch<React.SetStateAction<string[]>>
  setFirewallObjectAnchorId: React.Dispatch<React.SetStateAction<string | null>>
}

export function useFirewallObjectBindings(params: Params) {
  const onFilterRulesByObject = React.useCallback((kind: string, name: string) => {
    if (!kind || !name) return
    const key = buildFirewallObjectUsageKey(kind, name)
    params.setObjectRulesFilter('with_objects')
    params.setObjectRuleObjectFilterKey(key)
  }, [params])

  const onCreateRuleWithObject = React.useCallback((kind: string, name: string) => {
    if (!kind || !name) return
    const normalizedKind = kind.trim().toLowerCase()
    const objectName = name.trim()
    if (!objectName) return
    const prefill: Partial<FirewallRule> = {}
    if (normalizedKind === 'counter') prefill.counter_name = objectName
    else if (normalizedKind === 'limit') prefill.limit_name = objectName
    else if (normalizedKind === 'quota') prefill.quota_name = objectName
    else if (normalizedKind === 'ct_helper') prefill.ct_helper_set = objectName
    else if (normalizedKind === 'ct_timeout') prefill.ct_timeout_set = objectName
    else if (normalizedKind === 'ct_expectation') prefill.ct_expectation_set = objectName
    else {
      params.setError(`Unsupported object kind for rule binding: ${kind}`)
      return
    }
    params.setObjectRulesFilter('with_objects')
    params.setObjectRuleObjectFilterKey(buildFirewallObjectUsageKey(normalizedKind, objectName))
    params.openCreateObjectRuleWindow(prefill)
  }, [params])

  const onCreateRuleFromSelectedObjects = React.useCallback(() => {
    if (!params.selectedFirewallObjects.length) return
    const prefill: Partial<FirewallRule> = {}
    const seenKinds = new Set<string>()
    for (const obj of params.selectedFirewallObjects) {
      const kind = String(obj.kind || '').trim().toLowerCase()
      const name = String(obj.name || '').trim()
      if (!kind || !name) continue
      if (seenKinds.has(kind)) {
        params.setError(`Select only one object per kind. Duplicate kind: ${kind}`)
        return
      }
      seenKinds.add(kind)
      if (kind === 'counter') prefill.counter_name = name
      else if (kind === 'limit') prefill.limit_name = name
      else if (kind === 'quota') prefill.quota_name = name
      else if (kind === 'ct_helper') prefill.ct_helper_set = name
      else if (kind === 'ct_timeout') prefill.ct_timeout_set = name
      else if (kind === 'ct_expectation') prefill.ct_expectation_set = name
    }
    if (!Object.keys(prefill).length) {
      params.setError('Selected objects cannot be converted to rule bindings.')
      return
    }
    params.setObjectRulesFilter('with_objects')
    params.setObjectRuleObjectFilterKey(null)
    params.openCreateObjectRuleWindow(prefill)
  }, [params])

  return {
    onFilterRulesByObject,
    onCreateRuleWithObject,
    onCreateRuleFromSelectedObjects,
  }
}
