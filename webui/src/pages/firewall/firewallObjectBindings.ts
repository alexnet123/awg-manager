import type { FirewallRule } from '../api'

export type FirewallObjectBinding = {
  kind: 'counter' | 'limit' | 'quota' | 'ct_helper' | 'ct_timeout' | 'ct_expectation'
  name: string
  label: string
}

export function hasFirewallRuleObjectBinding(rule: Partial<FirewallRule>) {
  return getFirewallRuleObjectBindings(rule).length > 0
}

export function getFirewallRuleObjectBindings(rule: Partial<FirewallRule>): FirewallObjectBinding[] {
  const parts: FirewallObjectBinding[] = []
  if (rule.counter_name) parts.push({ kind: 'counter', name: rule.counter_name, label: `counter:${rule.counter_name}` })
  if (rule.limit_name) parts.push({ kind: 'limit', name: rule.limit_name, label: `limit:${rule.limit_name}` })
  if (rule.quota_name) parts.push({ kind: 'quota', name: rule.quota_name, label: `quota:${rule.quota_name}` })
  if (rule.ct_helper_set) parts.push({ kind: 'ct_helper', name: rule.ct_helper_set, label: `ct-helper:${rule.ct_helper_set}` })
  if (rule.ct_timeout_set) parts.push({ kind: 'ct_timeout', name: rule.ct_timeout_set, label: `ct-timeout:${rule.ct_timeout_set}` })
  if (rule.ct_expectation_set) parts.push({ kind: 'ct_expectation', name: rule.ct_expectation_set, label: `ct-expectation:${rule.ct_expectation_set}` })
  return parts
}

export function buildFirewallObjectUsageKey(kind: string, name: string) {
  return `${String(kind || '').trim().toLowerCase()}:${String(name || '').trim().toLowerCase()}`
}

export function ruleHasFirewallObjectUsageKey(rule: FirewallRule, usageKey: string) {
  if (!usageKey) return true
  const key = usageKey.trim().toLowerCase()
  if (!key) return true
  return getFirewallRuleObjectBindings(rule).some((x) => buildFirewallObjectUsageKey(x.kind, x.name) === key)
}
