import type { FirewallRule } from '../api'

export type PolicyV2ObjectBinding = {
  kind: 'counter' | 'limit' | 'quota' | 'ct_helper' | 'ct_timeout'
  name: string
  label: string
}

export function hasPolicyV2RuleObjectBinding(rule: Partial<FirewallRule>) {
  return getPolicyV2RuleObjectBindings(rule).length > 0
}

export function getPolicyV2RuleObjectBindings(rule: Partial<FirewallRule>): PolicyV2ObjectBinding[] {
  const parts: PolicyV2ObjectBinding[] = []
  if (rule.counter_name) parts.push({ kind: 'counter', name: rule.counter_name, label: `counter:${rule.counter_name}` })
  if (rule.limit_name) parts.push({ kind: 'limit', name: rule.limit_name, label: `limit:${rule.limit_name}` })
  if (rule.quota_name) parts.push({ kind: 'quota', name: rule.quota_name, label: `quota:${rule.quota_name}` })
  if (rule.ct_helper_set) parts.push({ kind: 'ct_helper', name: rule.ct_helper_set, label: `ct-helper:${rule.ct_helper_set}` })
  if (rule.ct_timeout_set) parts.push({ kind: 'ct_timeout', name: rule.ct_timeout_set, label: `ct-timeout:${rule.ct_timeout_set}` })
  return parts
}

export function buildPolicyV2ObjectUsageKey(kind: string, name: string) {
  return `${String(kind || '').trim().toLowerCase()}:${String(name || '').trim().toLowerCase()}`
}

export function ruleHasPolicyV2ObjectUsageKey(rule: FirewallRule, usageKey: string) {
  if (!usageKey) return true
  const key = usageKey.trim().toLowerCase()
  if (!key) return true
  return getPolicyV2RuleObjectBindings(rule).some((x) => buildPolicyV2ObjectUsageKey(x.kind, x.name) === key)
}

