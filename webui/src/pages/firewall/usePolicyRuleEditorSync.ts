import * as React from 'react'
import type { FirewallRule, FirewallSchema, FirewallState } from '../api'

type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'

type Params = {
  addOpen: boolean
  editingRuleId: string | null
  activeRuleTableName: string
  activeRuleTableFamily: TableFamily
  activeChainOptions: string[]
  form: Partial<FirewallRule>
  contextMode: 'filter' | 'nat' | 'raw' | 'mangle'
  schema: FirewallSchema | null
  state: FirewallState | null
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
}

export function usePolicyRuleEditorSync(params: Params) {
  const firstActiveChain = params.activeChainOptions[0] || 'input'

  React.useEffect(() => {
    if (params.addOpen || params.editingRuleId) return
    params.setForm((p) => {
      if (!p.counter_name && !p.limit_name && !p.quota_name && !p.ct_helper_set && !p.ct_timeout_set && !p.ct_expectation_set) return p
      return {
        ...p,
        counter_name: null,
        limit_name: null,
        quota_name: null,
        ct_helper_set: null,
        ct_timeout_set: null,
        ct_expectation_set: null,
      }
    })
  }, [
    params.addOpen,
    params.editingRuleId,
    params.activeRuleTableFamily,
    params.activeRuleTableName,
    params.setForm,
  ])

  React.useEffect(() => {
    if (params.addOpen && !params.editingRuleId) {
      const ruleTable = params.activeRuleTableName
      params.setForm((p) => {
        if (p.family === params.activeRuleTableFamily && p.table === ruleTable && p.chain === firstActiveChain) return p
        const tableScopeChanged = p.family !== params.activeRuleTableFamily || p.table !== ruleTable
        return {
          ...p,
          family: params.activeRuleTableFamily,
          table: ruleTable,
          chain: firstActiveChain,
          ...(tableScopeChanged ? {
            counter_name: null,
            limit_name: null,
            quota_name: null,
            ct_helper_set: null,
            ct_timeout_set: null,
            ct_expectation_set: null,
          } : {}),
        }
      })
    }
  }, [
    params.addOpen,
    params.editingRuleId,
    params.activeRuleTableFamily,
    params.activeRuleTableName,
    firstActiveChain,
    params.setForm,
  ])

  React.useEffect(() => {
    if (!params.editingRuleId) return
    const live = (params.state?.rules || []).find((r) => r.id === params.editingRuleId)
    if (!live) return
    params.setForm((prev) => ({
      ...prev,
      runtime_packets: live.runtime_packets || 0,
      runtime_bytes: live.runtime_bytes || 0,
      runtime_pps: live.runtime_pps || 0,
      runtime_bps: live.runtime_bps || 0,
      runtime_history: live.runtime_history || [],
    }))
  }, [params.state, params.editingRuleId, params.setForm])

  React.useEffect(() => {
    if (!params.addOpen) return
    if (params.contextMode !== 'nat' && params.form.nat_type) {
      params.setForm((p) => ({ ...p, nat_type: null, to_addr: null, to_port: null }))
      return
    }
    if (params.contextMode === 'nat' && params.form.nat_type) {
      const chain = params.form.chain || 'prerouting'
      const allowedNat = params.schema?.tables?.nat?.nat_types_by_chain?.[chain] || ['dnat', 'redirect']
      if (!allowedNat.includes(params.form.nat_type)) {
        params.setForm((p) => ({ ...p, nat_type: null, to_addr: null, to_port: null }))
      }
    }
  }, [params.addOpen, params.form.chain, params.form.nat_type, params.contextMode, params.schema, params.setForm])
}
