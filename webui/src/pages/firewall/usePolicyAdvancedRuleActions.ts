import * as React from 'react'
import type { AuthState, FirewallRule, FirewallTableItem } from '../api'
import { createFirewallRule, deleteFirewallRule, updateFirewallRule } from '../api'

type Params = {
  auth: AuthState
  activePolicyV2Family: 'bridge' | 'netdev'
  activePolicyV2TableName: string
  policyV2Form: Partial<FirewallRule>
  editingPolicyV2RuleId: string | null
  policyV2ChainMetaByName: Record<string, FirewallTableItem>
  selectedPolicyV2Rules: FirewallRule[]
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  setPolicyV2EditorOpen: React.Dispatch<React.SetStateAction<boolean>>
  setEditingPolicyV2RuleId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedPolicyV2RuleIds: React.Dispatch<React.SetStateAction<string[]>>
  setPolicyV2RuleAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  refresh: () => Promise<void>
  refreshPolicyV2Rules: () => Promise<void>
}

export function usePolicyAdvancedRuleActions(params: Params) {
  const onSavePolicyV2 = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    params.setError(null)
    params.setIsBusy(true)
    try {
      const selectedChain = String(params.policyV2Form.chain || '').toLowerCase()
      const chainMeta = params.policyV2ChainMetaByName[selectedChain]
      if (!chainMeta) throw new Error('Select valid chain from selected table')
      const family = params.activePolicyV2Family
      if (family === 'bridge' && params.policyV2Form.action === 'reject') {
        const hook = String(chainMeta.hook || '').toLowerCase()
        if (hook !== 'input' && hook !== 'prerouting') {
          throw new Error('Bridge reject is allowed only for chains with hook input/prerouting')
        }
      }
      if (family === 'netdev') {
        const hook = String(chainMeta.hook || '').toLowerCase()
        const chainType = String(chainMeta.chain_type || '').toLowerCase()
        if (chainType !== 'filter' || hook !== 'ingress' || !chainMeta.device) {
          throw new Error('Policy3 requires a netdev filter chain with hook ingress and device')
        }
        if (params.policyV2Form.action === 'fwd' && (!params.policyV2Form.fwd_to || !params.policyV2Form.fwd_dev)) {
          throw new Error('fwd action requires fwd to and fwd dev')
        }
      }
      const payload: Partial<FirewallRule> = {
        ...params.policyV2Form,
        family,
        table: params.activePolicyV2TableName,
        ...(family === 'bridge'
          ? { ct_expectation_set: null, fwd_to: null, fwd_dev: null, fwd_family: null }
          : {
              ibrname: null,
              obrname: null,
              out_interface: null,
              ct_helper_set: null,
              ct_timeout_set: null,
              ct_expectation_set: null,
              counter_name: null,
              limit_name: null,
              quota_name: null,
              dup_to: null,
              dup_dev: null,
            }),
      }
      if (params.editingPolicyV2RuleId) await updateFirewallRule(params.auth, params.editingPolicyV2RuleId, payload)
      else await createFirewallRule(params.auth, payload)
      params.setPolicyV2EditorOpen(false)
      params.setEditingPolicyV2RuleId(null)
      await params.refresh()
      await params.refreshPolicyV2Rules()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [
    params,
  ])

  const onDeleteSelectedPolicyV2Rules = React.useCallback(async () => {
    if (!params.selectedPolicyV2Rules.length) return
    if (!confirm(`Delete ${params.selectedPolicyV2Rules.length} selected ${params.activePolicyV2Family} rule(s)?`)) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const row of params.selectedPolicyV2Rules) await deleteFirewallRule(params.auth, row.id)
      params.setSelectedPolicyV2RuleIds([])
      params.setPolicyV2RuleAnchorId(null)
      await params.refresh()
      await params.refreshPolicyV2Rules()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onSetEnabledSelectedPolicyV2Rules = React.useCallback(async (enabled: boolean) => {
    if (!params.selectedPolicyV2Rules.length) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const row of params.selectedPolicyV2Rules) await updateFirewallRule(params.auth, row.id, { enabled })
      await params.refresh()
      await params.refreshPolicyV2Rules()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  return {
    onSavePolicyV2,
    onDeleteSelectedPolicyV2Rules,
    onSetEnabledSelectedPolicyV2Rules,
  }
}
