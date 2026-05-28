import * as React from 'react'
import type { FirewallNamedObjectItem, FirewallNamedObjects, FirewallRule } from '../api'
import { buildPolicyV2ObjectUsageKey, getPolicyV2RuleObjectBindings, hasPolicyV2RuleObjectBinding, ruleHasPolicyV2ObjectUsageKey, type PolicyV2ObjectBinding } from './objectBindings'

type Params = {
  policyV2Objects: FirewallNamedObjects | null
  policyV2Rules: FirewallRule[]
  policyV2Form: Partial<FirewallRule>
  policyV2ObjectsFilter: 'all' | 'used' | 'unused'
  policyV2ObjectFocusKey: string | null
  setPolicyV2ObjectFocusKey: React.Dispatch<React.SetStateAction<string | null>>
  policyV2RulesFilter: 'all' | 'with_objects' | 'without_objects'
  policyV2RuleObjectFilterKey: string | null
  setPolicyV2RuleObjectFilterKey: React.Dispatch<React.SetStateAction<string | null>>
  policyV2RuleAnchorId: string | null
  setPolicyV2RuleAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedPolicyV2RuleIds: React.Dispatch<React.SetStateAction<string[]>>
  policyV2ObjectAnchorId: string | null
  setPolicyV2ObjectAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedPolicyV2ObjectIds: React.Dispatch<React.SetStateAction<string[]>>
}

type Result = {
  policyV2CounterNames: string[]
  policyV2LimitNames: string[]
  policyV2QuotaNames: string[]
  policyV2CtHelperNames: string[]
  policyV2CtTimeoutNames: string[]
  policyV2ManagedObjects: FirewallNamedObjectItem[]
  policyV2ObjectUsageByKey: Record<string, { count: number; samples: string[] }>
  policyV2FilteredObjects: FirewallNamedObjectItem[]
  policyV2FilteredRules: FirewallRule[]
  policyV2RulesWithObjectsCount: number
  policyV2RulesWithoutObjectsCount: number
  policyV2ObjectsUsedCount: number
  policyV2ObjectsFreeCount: number
  policyV2FormObjectBindings: PolicyV2ObjectBinding[]
}

export function usePolicyV2RuleObjectState(params: Params): Result {
  const policyV2CounterNames = React.useMemo(() => [...(params.policyV2Objects?.counter || [])], [params.policyV2Objects])
  const policyV2LimitNames = React.useMemo(() => [...(params.policyV2Objects?.limit || [])], [params.policyV2Objects])
  const policyV2QuotaNames = React.useMemo(() => [...(params.policyV2Objects?.quota || [])], [params.policyV2Objects])
  const policyV2CtHelperNames = React.useMemo(() => [...(params.policyV2Objects?.ct_helper || [])], [params.policyV2Objects])
  const policyV2CtTimeoutNames = React.useMemo(() => [...(params.policyV2Objects?.ct_timeout || [])], [params.policyV2Objects])

  const policyV2ManagedObjects = React.useMemo(
    () => [...(params.policyV2Objects?.items || [])].sort((a, b) => {
      const k = String(a.kind || '').localeCompare(String(b.kind || ''))
      if (k !== 0) return k
      return String(a.name || '').localeCompare(String(b.name || ''))
    }),
    [params.policyV2Objects],
  )

  const policyV2ObjectUsageByKey = React.useMemo(() => {
    const out: Record<string, { count: number; samples: string[] }> = {}
    const pushUsage = (kind: string, name: string | null | undefined, sample: string) => {
      if (!name) return
      const key = buildPolicyV2ObjectUsageKey(kind, name)
      if (!out[key]) out[key] = { count: 0, samples: [] }
      out[key].count += 1
      if (!out[key].samples.includes(sample) && out[key].samples.length < 3) out[key].samples.push(sample)
    }
    for (const rule of params.policyV2Rules) {
      const sample = `${rule.chain || 'chain'}:${rule.proto || 'any'}:${rule.dport || '—'}`
      pushUsage('counter', rule.counter_name, sample)
      pushUsage('limit', rule.limit_name, sample)
      pushUsage('quota', rule.quota_name, sample)
      pushUsage('ct_helper', rule.ct_helper_set, sample)
      pushUsage('ct_timeout', rule.ct_timeout_set, sample)
    }
    return out
  }, [params.policyV2Rules])

  const policyV2FilteredObjects = React.useMemo(() => {
    let rows = policyV2ManagedObjects
    if (params.policyV2ObjectsFilter !== 'all') {
      rows = rows.filter((obj) => {
        const key = buildPolicyV2ObjectUsageKey(obj.kind, obj.name)
        const isUsed = Boolean(policyV2ObjectUsageByKey[key]?.count)
        return params.policyV2ObjectsFilter === 'used' ? isUsed : !isUsed
      })
    }
    if (params.policyV2ObjectFocusKey) {
      rows = rows.filter((obj) => buildPolicyV2ObjectUsageKey(obj.kind, obj.name) === params.policyV2ObjectFocusKey)
    }
    return rows
  }, [policyV2ManagedObjects, params.policyV2ObjectsFilter, policyV2ObjectUsageByKey, params.policyV2ObjectFocusKey])

  const policyV2FilteredRules = React.useMemo(() => {
    let rows = params.policyV2Rules
    const usageKey = params.policyV2RuleObjectFilterKey
    if (params.policyV2RulesFilter === 'with_objects') rows = rows.filter(hasPolicyV2RuleObjectBinding)
    else if (params.policyV2RulesFilter === 'without_objects') rows = rows.filter((rule) => !hasPolicyV2RuleObjectBinding(rule))
    if (usageKey) rows = rows.filter((rule) => ruleHasPolicyV2ObjectUsageKey(rule, usageKey))
    return rows
  }, [params.policyV2Rules, params.policyV2RulesFilter, params.policyV2RuleObjectFilterKey])

  const policyV2RulesWithObjectsCount = React.useMemo(
    () => params.policyV2Rules.filter(hasPolicyV2RuleObjectBinding).length,
    [params.policyV2Rules],
  )
  const policyV2RulesWithoutObjectsCount = React.useMemo(
    () => params.policyV2Rules.filter((rule) => !hasPolicyV2RuleObjectBinding(rule)).length,
    [params.policyV2Rules],
  )
  const policyV2ObjectsUsedCount = React.useMemo(
    () => policyV2ManagedObjects.filter((obj) => Boolean(policyV2ObjectUsageByKey[buildPolicyV2ObjectUsageKey(obj.kind, obj.name)]?.count)).length,
    [policyV2ManagedObjects, policyV2ObjectUsageByKey],
  )
  const policyV2ObjectsFreeCount = Math.max(0, policyV2ManagedObjects.length - policyV2ObjectsUsedCount)

  const policyV2FormObjectBindings = React.useMemo(
    () => getPolicyV2RuleObjectBindings(params.policyV2Form),
    [params.policyV2Form.counter_name, params.policyV2Form.limit_name, params.policyV2Form.quota_name, params.policyV2Form.ct_helper_set, params.policyV2Form.ct_timeout_set],
  )

  React.useEffect(() => {
    if (params.policyV2ObjectFocusKey && !policyV2ManagedObjects.some((obj) => buildPolicyV2ObjectUsageKey(obj.kind, obj.name) === params.policyV2ObjectFocusKey)) {
      params.setPolicyV2ObjectFocusKey(null)
    }
  }, [params.policyV2ObjectFocusKey, params.setPolicyV2ObjectFocusKey, policyV2ManagedObjects])

  React.useEffect(() => {
    const usageKey = params.policyV2RuleObjectFilterKey
    if (!usageKey) return
    const exists = params.policyV2Rules.some((rule) => ruleHasPolicyV2ObjectUsageKey(rule, usageKey))
    if (!exists) params.setPolicyV2RuleObjectFilterKey(null)
  }, [params.policyV2RuleObjectFilterKey, params.policyV2Rules, params.setPolicyV2RuleObjectFilterKey])

  React.useEffect(() => {
    const visibleIds = new Set(policyV2FilteredRules.map((row) => row.id))
    params.setSelectedPolicyV2RuleIds((prev) => prev.filter((id) => visibleIds.has(id)))
    if (params.policyV2RuleAnchorId && !visibleIds.has(params.policyV2RuleAnchorId)) params.setPolicyV2RuleAnchorId(null)
  }, [policyV2FilteredRules, params.policyV2RuleAnchorId, params.setPolicyV2RuleAnchorId, params.setSelectedPolicyV2RuleIds])

  React.useEffect(() => {
    params.setSelectedPolicyV2ObjectIds((prev) => prev.filter((id) => policyV2ManagedObjects.some((row) => row.id === id)))
    params.setPolicyV2ObjectAnchorId((prev) => (prev && policyV2ManagedObjects.some((row) => row.id === prev) ? prev : null))
  }, [policyV2ManagedObjects, params.setPolicyV2ObjectAnchorId, params.setSelectedPolicyV2ObjectIds])

  React.useEffect(() => {
    const visibleIds = new Set(policyV2FilteredObjects.map((row) => row.id))
    params.setSelectedPolicyV2ObjectIds((prev) => prev.filter((id) => visibleIds.has(id)))
    if (params.policyV2ObjectAnchorId && !visibleIds.has(params.policyV2ObjectAnchorId)) params.setPolicyV2ObjectAnchorId(null)
  }, [policyV2FilteredObjects, params.policyV2ObjectAnchorId, params.setPolicyV2ObjectAnchorId, params.setSelectedPolicyV2ObjectIds])

  return {
    policyV2CounterNames,
    policyV2LimitNames,
    policyV2QuotaNames,
    policyV2CtHelperNames,
    policyV2CtTimeoutNames,
    policyV2ManagedObjects,
    policyV2ObjectUsageByKey,
    policyV2FilteredObjects,
    policyV2FilteredRules,
    policyV2RulesWithObjectsCount,
    policyV2RulesWithoutObjectsCount,
    policyV2ObjectsUsedCount,
    policyV2ObjectsFreeCount,
    policyV2FormObjectBindings,
  }
}
