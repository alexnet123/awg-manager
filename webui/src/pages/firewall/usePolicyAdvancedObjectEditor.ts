import * as React from 'react'
import type { FirewallNamedObjectItem } from '../api'
import { defaultPolicyV2ObjectForm, type PolicyV2ObjectForm } from './policyV2ObjectForm'

export type PolicyV2ObjectPreset = 'counter_ssh' | 'limit_dns' | 'quota_bridge' | 'helper_ftp' | 'timeout_tcp'

type Params = {
  activePolicyV2Family: 'bridge' | 'netdev'
  activePolicyV2TableName: string
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setEditingPolicyV2ObjectId: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2ObjectForm: React.Dispatch<React.SetStateAction<PolicyV2ObjectForm>>
  setPolicyV2ObjectOpen: React.Dispatch<React.SetStateAction<boolean>>
}

function buildPolicyV2ObjectFormFromItem(item: FirewallNamedObjectItem): PolicyV2ObjectForm {
  const cfg = item.config || {}
  return {
    id: item.id,
    kind: item.kind,
    name: item.name || '',
    enabled: !!item.enabled,
    comment: item.comment || '',
    packets: cfg.packets === undefined || cfg.packets === null ? '' : String(cfg.packets),
    bytes: cfg.bytes === undefined || cfg.bytes === null ? '' : String(cfg.bytes),
    rate: cfg.rate ? String(cfg.rate) : '10/second',
    burst: cfg.burst ? String(cfg.burst) : '',
    over: !!cfg.over,
    quota_mode: String(cfg.mode || 'over') === 'until' ? 'until' : 'over',
    quota_bytes: cfg.bytes ? String(cfg.bytes) : '20 mbytes',
    quota_used: cfg.used ? String(cfg.used) : '',
    helper_type: cfg.helper_type ? String(cfg.helper_type) : 'ftp',
    l4proto: String(cfg.l4proto || 'tcp') === 'udp' ? 'udp' : 'tcp',
    l3proto: String(cfg.l3proto || '') === 'ip' || String(cfg.l3proto || '') === 'ip6' ? (String(cfg.l3proto || '') as 'ip' | 'ip6') : '',
    timeout_policy: cfg.timeout_policy ? String(cfg.timeout_policy) : 'established:120, close:20',
    dport: cfg.dport === undefined || cfg.dport === null ? '9876' : String(cfg.dport),
    timeout: cfg.timeout ? String(cfg.timeout) : '2m',
    size: cfg.size === undefined || cfg.size === null ? '8' : String(cfg.size),
  }
}

export function usePolicyAdvancedObjectEditor(params: Params) {
  const openCreatePolicyV2ObjectWindow = React.useCallback(() => {
    if (params.activePolicyV2Family !== 'bridge') {
      params.setError('Policy v2 objects are bridge-only in this sprint.')
      return
    }
    if (!params.activePolicyV2TableName) {
      params.setError('Select bridge table first in Policy v2.')
      return
    }
    params.setEditingPolicyV2ObjectId(null)
    params.setPolicyV2ObjectForm(defaultPolicyV2ObjectForm())
    params.setPolicyV2ObjectOpen(true)
  }, [params])

  const openEditPolicyV2ObjectWindow = React.useCallback((item: FirewallNamedObjectItem) => {
    if (item.kind === 'ct_expectation') {
      params.setError('ct_expectation is planned for bridge and temporarily disabled. Delete and recreate later when enabled.')
      return
    }
    params.setEditingPolicyV2ObjectId(item.id)
    params.setPolicyV2ObjectForm(buildPolicyV2ObjectFormFromItem(item))
    params.setPolicyV2ObjectOpen(true)
  }, [params])

  const applyPolicyV2ObjectPreset = React.useCallback((preset: PolicyV2ObjectPreset) => {
    const now = Date.now()
    if (preset === 'counter_ssh') {
      params.setPolicyV2ObjectForm((p) => ({
        ...p,
        kind: 'counter',
        name: `cnt_ssh_${now}`,
        enabled: true,
        comment: 'Count SSH attempts in bridge policy',
        packets: '',
        bytes: '',
      }))
      return
    }
    if (preset === 'limit_dns') {
      params.setPolicyV2ObjectForm((p) => ({
        ...p,
        kind: 'limit',
        name: `lim_dns_${now}`,
        enabled: true,
        comment: 'Limit DNS burst on bridge',
        rate: '30/second',
        burst: '100 packets',
        over: false,
      }))
      return
    }
    if (preset === 'quota_bridge') {
      params.setPolicyV2ObjectForm((p) => ({
        ...p,
        kind: 'quota',
        name: `quo_bridge_${now}`,
        enabled: true,
        comment: 'Total traffic budget for bridge rule',
        quota_mode: 'over',
        quota_bytes: '200 mbytes',
        quota_used: '',
      }))
      return
    }
    if (preset === 'helper_ftp') {
      params.setPolicyV2ObjectForm((p) => ({
        ...p,
        kind: 'ct_helper',
        name: `hlp_ftp_${now}`,
        enabled: true,
        comment: 'FTP conntrack helper',
        helper_type: 'ftp',
        l4proto: 'tcp',
        l3proto: 'ip',
      }))
      return
    }
    params.setPolicyV2ObjectForm((p) => ({
      ...p,
      kind: 'ct_timeout',
      name: `tmo_tcp_${now}`,
      enabled: true,
      comment: 'TCP timeout policy for bridge flows',
      l4proto: 'tcp',
      l3proto: 'ip',
      timeout_policy: 'established:120, close:20',
    }))
  }, [params])

  return {
    openCreatePolicyV2ObjectWindow,
    openEditPolicyV2ObjectWindow,
    applyPolicyV2ObjectPreset,
  }
}
