import * as React from 'react'
import type { FirewallRule } from '../api'
import { buildPolicyRuleCreateForm, buildPolicyRuleEditForm } from './ruleForm'

type EditorPosition = { x: number; y: number }

type Params = {
  activePolicyV2Family: 'bridge' | 'netdev'
  activePolicyV2TableName: string
  policyAdvancedLabel: string
  policyV2ChainOptions: string[]
  policyV2EditorOpen: boolean
  policyV2Form: Partial<FirewallRule>
  setPolicyV2Form: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  setEditingPolicyV2RuleId: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2EditorOpen: React.Dispatch<React.SetStateAction<boolean>>
  setWinPos: React.Dispatch<React.SetStateAction<EditorPosition>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

function getCenteredEditorPosition(): EditorPosition {
  return {
    x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)),
    y: Math.max(8, Math.floor((window.innerHeight - 560) / 2) - 40),
  }
}

export function usePolicyAdvancedRuleEditor(params: Params) {
  const openCreatePolicyV2Window = React.useCallback((prefill?: Partial<FirewallRule>) => {
    if (params.activePolicyV2Family !== 'bridge' && params.activePolicyV2Family !== 'netdev') {
      params.setError('Policy editor supports only bridge (Policy2) and netdev (Policy3).')
      return
    }
    if (!params.activePolicyV2TableName) {
      params.setError(`Select ${params.activePolicyV2Family} table first in ${params.policyAdvancedLabel}.`)
      return
    }
    const isNetdev = params.activePolicyV2Family === 'netdev'
    params.setEditingPolicyV2RuleId(null)
    params.setPolicyV2Form(buildPolicyRuleCreateForm(
      params.activePolicyV2Family,
      params.activePolicyV2TableName,
      params.policyV2ChainOptions[0] || (isNetdev ? 'ingress' : 'forward'),
      prefill,
    ))
    params.setWinPos(getCenteredEditorPosition())
    params.setPolicyV2EditorOpen(true)
  }, [
    params.activePolicyV2Family,
    params.activePolicyV2TableName,
    params.policyAdvancedLabel,
    params.policyV2ChainOptions,
    params.setEditingPolicyV2RuleId,
    params.setPolicyV2Form,
    params.setPolicyV2EditorOpen,
    params.setWinPos,
    params.setError,
  ])

  const openEditPolicyV2Window = React.useCallback((rule: FirewallRule) => {
    params.setEditingPolicyV2RuleId(rule.id)
    params.setPolicyV2Form(buildPolicyRuleEditForm(rule, params.activePolicyV2Family))
    params.setWinPos(getCenteredEditorPosition())
    params.setPolicyV2EditorOpen(true)
  }, [params.setEditingPolicyV2RuleId, params.setPolicyV2Form, params.activePolicyV2Family, params.setWinPos, params.setPolicyV2EditorOpen])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    const action = params.policyV2Form.action || 'accept'
    if (action !== 'reject' && params.policyV2Form.reject_type) {
      params.setPolicyV2Form((p) => ({ ...p, reject_type: null }))
      return
    }
    if (action !== 'jump' && action !== 'goto') {
      if (params.policyV2Form.target_chain) {
        params.setPolicyV2Form((p) => ({ ...p, target_chain: null }))
        return
      }
    }
    if (action !== 'queue' && (params.policyV2Form.queue_num || (Array.isArray(params.policyV2Form.queue_flags) && params.policyV2Form.queue_flags.length))) {
      params.setPolicyV2Form((p) => ({ ...p, queue_num: null, queue_flags: null }))
      return
    }
    if (action !== 'fwd' && (params.policyV2Form.fwd_to || params.policyV2Form.fwd_dev || params.policyV2Form.fwd_family)) {
      params.setPolicyV2Form((p) => ({ ...p, fwd_to: null, fwd_dev: null, fwd_family: null }))
    }
  }, [
    params.policyV2EditorOpen,
    params.policyV2Form.action,
    params.policyV2Form.reject_type,
    params.policyV2Form.target_chain,
    params.policyV2Form.queue_num,
    params.policyV2Form.queue_flags,
    params.policyV2Form.fwd_to,
    params.policyV2Form.fwd_dev,
    params.policyV2Form.fwd_family,
    params.setPolicyV2Form,
  ])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    const hasLogGroup = params.policyV2Form.log_group !== null && params.policyV2Form.log_group !== undefined
    if (!hasLogGroup && (params.policyV2Form.log_snaplen !== null && params.policyV2Form.log_snaplen !== undefined || params.policyV2Form.log_queue_threshold !== null && params.policyV2Form.log_queue_threshold !== undefined)) {
      params.setPolicyV2Form((p) => ({ ...p, log_snaplen: null, log_queue_threshold: null }))
    }
  }, [params.policyV2EditorOpen, params.policyV2Form.log_group, params.policyV2Form.log_snaplen, params.policyV2Form.log_queue_threshold, params.setPolicyV2Form])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    const hasLogGroup = params.policyV2Form.log_group !== null && params.policyV2Form.log_group !== undefined
    const hasLogFlags = Array.isArray(params.policyV2Form.log_flags) && params.policyV2Form.log_flags.length > 0
    if (hasLogGroup && hasLogFlags) {
      params.setPolicyV2Form((p) => ({ ...p, log_flags: null }))
    }
  }, [params.policyV2EditorOpen, params.policyV2Form.log_group, params.policyV2Form.log_flags, params.setPolicyV2Form])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    if (params.policyV2Form.limit_rate && params.policyV2Form.limit_name) {
      params.setPolicyV2Form((p) => ({ ...p, limit_name: null }))
    }
  }, [params.policyV2EditorOpen, params.policyV2Form.limit_rate, params.policyV2Form.limit_name, params.setPolicyV2Form])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    if (params.policyV2Form.counter && params.policyV2Form.counter_name) {
      params.setPolicyV2Form((p) => ({ ...p, counter_name: null }))
    }
  }, [params.policyV2EditorOpen, params.policyV2Form.counter, params.policyV2Form.counter_name, params.setPolicyV2Form])

  React.useEffect(() => {
    if (!params.policyV2EditorOpen) return
    if (params.policyV2Form.fib_check || params.policyV2Form.socket_match || params.policyV2Form.rt_nexthop || params.policyV2Form.ipv6_exthdrs) {
      params.setPolicyV2Form((p) => ({ ...p, fib_check: null, socket_match: null, rt_nexthop: null, ipv6_exthdrs: null }))
    }
  }, [params.policyV2EditorOpen, params.policyV2Form.fib_check, params.policyV2Form.socket_match, params.policyV2Form.rt_nexthop, params.policyV2Form.ipv6_exthdrs, params.setPolicyV2Form])

  return {
    openCreatePolicyV2Window,
    openEditPolicyV2Window,
  }
}
