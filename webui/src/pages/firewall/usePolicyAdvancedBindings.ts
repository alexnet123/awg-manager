import * as React from 'react'
import type { FirewallNamedObjectItem, FirewallRule } from '../api'
import { buildPolicyV2ObjectUsageKey, type PolicyV2ObjectBinding } from './objectBindings'

type PolicyV2DataTab = 'rules' | 'objects'
type PolicyV2RulesFilter = 'all' | 'with_objects' | 'without_objects'
type PolicyV2ObjectsFilter = 'all' | 'used' | 'unused'

type Params = {
  selectedPolicyV2Objects: FirewallNamedObjectItem[]
  openCreatePolicyV2Window: (prefill?: Partial<FirewallRule>) => void
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2DataTab: React.Dispatch<React.SetStateAction<PolicyV2DataTab>>
  setPolicyV2RulesFilter: React.Dispatch<React.SetStateAction<PolicyV2RulesFilter>>
  setPolicyV2RuleObjectFilterKey: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedPolicyV2RuleIds: React.Dispatch<React.SetStateAction<string[]>>
  setPolicyV2RuleAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2ObjectsFilter: React.Dispatch<React.SetStateAction<PolicyV2ObjectsFilter>>
  setPolicyV2ObjectFocusKey: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedPolicyV2ObjectIds: React.Dispatch<React.SetStateAction<string[]>>
  setPolicyV2ObjectAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2EditorOpen: React.Dispatch<React.SetStateAction<boolean>>
  setEditingPolicyV2RuleId: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2Form: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
}

export function usePolicyAdvancedBindings(params: Params) {
  const onFilterRulesByObject = React.useCallback((kind: string, name: string) => {
    if (!kind || !name) return
    const key = buildPolicyV2ObjectUsageKey(kind, name)
    params.setPolicyV2DataTab('rules')
    params.setPolicyV2RulesFilter('with_objects')
    params.setPolicyV2RuleObjectFilterKey(key)
    params.setSelectedPolicyV2RuleIds([])
    params.setPolicyV2RuleAnchorId(null)
  }, [params])

  const onFilterObjectsByRuleBinding = React.useCallback((kind: string, name: string) => {
    if (!kind || !name) return
    const key = buildPolicyV2ObjectUsageKey(kind, name)
    params.setPolicyV2DataTab('objects')
    params.setPolicyV2ObjectsFilter('all')
    params.setPolicyV2ObjectFocusKey(key)
    params.setSelectedPolicyV2ObjectIds([])
    params.setPolicyV2ObjectAnchorId(null)
  }, [params])

  const onCreateRuleWithObject = React.useCallback((kind: string, name: string) => {
    if (!kind || !name) return
    const normalizedKind = kind.trim().toLowerCase()
    const objectName = name.trim()
    if (!objectName) return
    if (normalizedKind === 'ct_expectation') {
      params.setError('ct_expectation is planned for family=bridge and temporarily disabled.')
      return
    }
    const prefill: Partial<FirewallRule> = {}
    if (normalizedKind === 'counter') prefill.counter_name = objectName
    else if (normalizedKind === 'limit') prefill.limit_name = objectName
    else if (normalizedKind === 'quota') prefill.quota_name = objectName
    else if (normalizedKind === 'ct_helper') prefill.ct_helper_set = objectName
    else if (normalizedKind === 'ct_timeout') prefill.ct_timeout_set = objectName
    else {
      params.setError(`Unsupported object kind for bridge rule binding: ${kind}`)
      return
    }
    params.setPolicyV2DataTab('rules')
    params.setPolicyV2RulesFilter('with_objects')
    params.setPolicyV2RuleObjectFilterKey(buildPolicyV2ObjectUsageKey(normalizedKind, objectName))
    params.setSelectedPolicyV2RuleIds([])
    params.setPolicyV2RuleAnchorId(null)
    params.openCreatePolicyV2Window(prefill)
  }, [params])

  const onCreateRuleFromSelectedObjects = React.useCallback(() => {
    if (!params.selectedPolicyV2Objects.length) return
    const prefill: Partial<FirewallRule> = {}
    const seenKinds = new Set<string>()
    for (const obj of params.selectedPolicyV2Objects) {
      const kind = String(obj.kind || '').trim().toLowerCase()
      const name = String(obj.name || '').trim()
      if (!kind || !name) continue
      if (kind === 'ct_expectation') {
        params.setError('ct_expectation is planned for family=bridge and temporarily disabled.')
        return
      }
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
    }
    if (!Object.keys(prefill).length) {
      params.setError('Selected objects cannot be converted to bridge rule bindings.')
      return
    }
    params.setPolicyV2DataTab('rules')
    params.setPolicyV2RulesFilter('with_objects')
    params.setPolicyV2RuleObjectFilterKey(null)
    params.setSelectedPolicyV2RuleIds([])
    params.setPolicyV2RuleAnchorId(null)
    params.openCreatePolicyV2Window(prefill)
  }, [params])

  const onOpenBindingObjectFromEditor = React.useCallback((binding: PolicyV2ObjectBinding) => {
    params.setPolicyV2EditorOpen(false)
    params.setEditingPolicyV2RuleId(null)
    onFilterObjectsByRuleBinding(binding.kind, binding.name)
  }, [params, onFilterObjectsByRuleBinding])

  const onUnbindObjectInEditor = React.useCallback((binding: PolicyV2ObjectBinding) => {
    params.setPolicyV2Form((prev) => {
      const next = { ...prev }
      if (binding.kind === 'counter') next.counter_name = null
      else if (binding.kind === 'limit') next.limit_name = null
      else if (binding.kind === 'quota') next.quota_name = null
      else if (binding.kind === 'ct_helper') next.ct_helper_set = null
      else if (binding.kind === 'ct_timeout') next.ct_timeout_set = null
      return next
    })
  }, [params])

  return {
    onFilterRulesByObject,
    onFilterObjectsByRuleBinding,
    onCreateRuleWithObject,
    onCreateRuleFromSelectedObjects,
    onOpenBindingObjectFromEditor,
    onUnbindObjectInEditor,
  }
}
