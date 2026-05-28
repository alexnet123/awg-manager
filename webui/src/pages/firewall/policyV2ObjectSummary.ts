import type { FirewallNamedObjectItem } from '../api'

export function formatPolicyV2ObjectSummary(item: FirewallNamedObjectItem) {
  const cfg = item.config || {}
  if (item.kind === 'counter') {
    const p = cfg.packets === undefined || cfg.packets === null ? 'auto' : String(cfg.packets)
    const b = cfg.bytes === undefined || cfg.bytes === null ? 'auto' : String(cfg.bytes)
    return `packets=${p}, bytes=${b}`
  }
  if (item.kind === 'limit') {
    const rate = cfg.rate ? String(cfg.rate) : 'n/a'
    const burst = cfg.burst ? ` burst=${String(cfg.burst)}` : ''
    const over = cfg.over ? ' over' : ''
    return `rate=${rate}${burst}${over}`
  }
  if (item.kind === 'quota') {
    const mode = cfg.mode ? String(cfg.mode) : 'over'
    const bytes = cfg.bytes ? String(cfg.bytes) : 'n/a'
    const used = cfg.used ? ` used=${String(cfg.used)}` : ''
    return `${mode} ${bytes}${used}`
  }
  if (item.kind === 'ct_helper') {
    return `type=${String(cfg.helper_type || 'n/a')} proto=${String(cfg.l4proto || 'n/a')}${cfg.l3proto ? ` l3=${String(cfg.l3proto)}` : ''}`
  }
  if (item.kind === 'ct_timeout') {
    return `proto=${String(cfg.l4proto || 'n/a')} policy=${String(cfg.timeout_policy || 'n/a')}${cfg.l3proto ? ` l3=${String(cfg.l3proto)}` : ''}`
  }
  if (item.kind === 'ct_expectation') {
    return `proto=${String(cfg.l4proto || 'n/a')} dport=${String(cfg.dport || 'n/a')} timeout=${String(cfg.timeout || 'n/a')} size=${String(cfg.size || 'n/a')}${cfg.l3proto ? ` l3=${String(cfg.l3proto)}` : ''}`
  }
  return ''
}
