import * as React from 'react'
import type { FirewallNamedObjectItem, FirewallNamedObjects, FirewallRule } from '../api'
import { buildFirewallObjectUsageKey, hasFirewallRuleObjectBinding, ruleHasFirewallObjectUsageKey } from './firewallObjectBindings'

type Params = {
  firewallObjects: FirewallNamedObjects | null
  objectRules: FirewallRule[]
  firewallObjectsFilter: 'all' | 'used' | 'unused'
  firewallObjectFocusKey: string | null
  setFirewallObjectFocusKey: React.Dispatch<React.SetStateAction<string | null>>
  objectRulesFilter: 'all' | 'with_objects' | 'without_objects'
  objectRuleObjectFilterKey: string | null
  setObjectRuleObjectFilterKey: React.Dispatch<React.SetStateAction<string | null>>
  firewallObjectAnchorId: string | null
  setFirewallObjectAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedFirewallObjectIds: React.Dispatch<React.SetStateAction<string[]>>
}

type Result = {
  objectCounterNames: string[]
  objectLimitNames: string[]
  objectQuotaNames: string[]
  objectCtHelperNames: string[]
  objectCtTimeoutNames: string[]
  objectCtExpectationNames: string[]
  firewallManagedObjects: FirewallNamedObjectItem[]
  firewallObjectUsageByKey: Record<string, { count: number; samples: string[] }>
  firewallFilteredObjects: FirewallNamedObjectItem[]
  objectRulesWithObjectsCount: number
  objectRulesWithoutObjectsCount: number
  firewallObjectsUsedCount: number
  firewallObjectsFreeCount: number
}

export function useFirewallObjectState(params: Params): Result {
  const objectCounterNames = React.useMemo(() => [...(params.firewallObjects?.counter || [])], [params.firewallObjects])
  const objectLimitNames = React.useMemo(() => [...(params.firewallObjects?.limit || [])], [params.firewallObjects])
  const objectQuotaNames = React.useMemo(() => [...(params.firewallObjects?.quota || [])], [params.firewallObjects])
  const objectCtHelperNames = React.useMemo(() => [...(params.firewallObjects?.ct_helper || [])], [params.firewallObjects])
  const objectCtTimeoutNames = React.useMemo(() => [...(params.firewallObjects?.ct_timeout || [])], [params.firewallObjects])
  const objectCtExpectationNames = React.useMemo(() => [...(params.firewallObjects?.ct_expectation || [])], [params.firewallObjects])

  const firewallManagedObjects = React.useMemo(
    () => [...(params.firewallObjects?.items || [])].sort((a, b) => {
      const k = String(a.kind || '').localeCompare(String(b.kind || ''))
      if (k !== 0) return k
      return String(a.name || '').localeCompare(String(b.name || ''))
    }),
    [params.firewallObjects],
  )

  const firewallObjectUsageByKey = React.useMemo(() => {
    const out: Record<string, { count: number; samples: string[] }> = {}
    const pushUsage = (kind: string, name: string | null | undefined, sample: string) => {
      if (!name) return
      const key = buildFirewallObjectUsageKey(kind, name)
      if (!out[key]) out[key] = { count: 0, samples: [] }
      out[key].count += 1
      if (!out[key].samples.includes(sample) && out[key].samples.length < 3) out[key].samples.push(sample)
    }
    for (const rule of params.objectRules) {
      const sample = `${rule.chain || 'chain'}:${rule.proto || 'any'}:${rule.dport || '—'}`
      pushUsage('counter', rule.counter_name, sample)
      pushUsage('limit', rule.limit_name, sample)
      pushUsage('quota', rule.quota_name, sample)
      pushUsage('ct_helper', rule.ct_helper_set, sample)
      pushUsage('ct_timeout', rule.ct_timeout_set, sample)
      pushUsage('ct_expectation', rule.ct_expectation_set, sample)
    }
    return out
  }, [params.objectRules])

  const firewallFilteredObjects = React.useMemo(() => {
    let rows = firewallManagedObjects
    if (params.firewallObjectsFilter !== 'all') {
      rows = rows.filter((obj) => {
        const key = buildFirewallObjectUsageKey(obj.kind, obj.name)
        const isUsed = Boolean(firewallObjectUsageByKey[key]?.count)
        return params.firewallObjectsFilter === 'used' ? isUsed : !isUsed
      })
    }
    if (params.firewallObjectFocusKey) {
      rows = rows.filter((obj) => buildFirewallObjectUsageKey(obj.kind, obj.name) === params.firewallObjectFocusKey)
    }
    return rows
  }, [firewallManagedObjects, params.firewallObjectsFilter, firewallObjectUsageByKey, params.firewallObjectFocusKey])

  const objectRulesWithObjectsCount = React.useMemo(
    () => params.objectRules.filter(hasFirewallRuleObjectBinding).length,
    [params.objectRules],
  )
  const objectRulesWithoutObjectsCount = React.useMemo(
    () => params.objectRules.filter((rule) => !hasFirewallRuleObjectBinding(rule)).length,
    [params.objectRules],
  )
  const firewallObjectsUsedCount = React.useMemo(
    () => firewallManagedObjects.filter((obj) => Boolean(firewallObjectUsageByKey[buildFirewallObjectUsageKey(obj.kind, obj.name)]?.count)).length,
    [firewallManagedObjects, firewallObjectUsageByKey],
  )
  const firewallObjectsFreeCount = Math.max(0, firewallManagedObjects.length - firewallObjectsUsedCount)

  React.useEffect(() => {
    if (params.firewallObjectFocusKey && !firewallManagedObjects.some((obj) => buildFirewallObjectUsageKey(obj.kind, obj.name) === params.firewallObjectFocusKey)) {
      params.setFirewallObjectFocusKey(null)
    }
  }, [params.firewallObjectFocusKey, params.setFirewallObjectFocusKey, firewallManagedObjects])

  React.useEffect(() => {
    const usageKey = params.objectRuleObjectFilterKey
    if (!usageKey) return
    const exists = params.objectRules.some((rule) => ruleHasFirewallObjectUsageKey(rule, usageKey))
    if (!exists) params.setObjectRuleObjectFilterKey(null)
  }, [params.objectRuleObjectFilterKey, params.objectRules, params.setObjectRuleObjectFilterKey])

  React.useEffect(() => {
    params.setSelectedFirewallObjectIds((prev) => prev.filter((id) => firewallManagedObjects.some((row) => row.id === id)))
    params.setFirewallObjectAnchorId((prev) => (prev && firewallManagedObjects.some((row) => row.id === prev) ? prev : null))
  }, [firewallManagedObjects, params.setFirewallObjectAnchorId, params.setSelectedFirewallObjectIds])

  React.useEffect(() => {
    const visibleIds = new Set(firewallFilteredObjects.map((row) => row.id))
    params.setSelectedFirewallObjectIds((prev) => prev.filter((id) => visibleIds.has(id)))
    if (params.firewallObjectAnchorId && !visibleIds.has(params.firewallObjectAnchorId)) params.setFirewallObjectAnchorId(null)
  }, [firewallFilteredObjects, params.firewallObjectAnchorId, params.setFirewallObjectAnchorId, params.setSelectedFirewallObjectIds])

  return {
    objectCounterNames,
    objectLimitNames,
    objectQuotaNames,
    objectCtHelperNames,
    objectCtTimeoutNames,
    objectCtExpectationNames,
    firewallManagedObjects,
    firewallObjectUsageByKey,
    firewallFilteredObjects,
    objectRulesWithObjectsCount,
    objectRulesWithoutObjectsCount,
    firewallObjectsUsedCount,
    firewallObjectsFreeCount,
  }
}
