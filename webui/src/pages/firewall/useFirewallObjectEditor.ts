import * as React from 'react'
import type { FirewallNamedObjectItem } from '../api'
import { defaultFirewallObjectForm, type FirewallObjectForm } from './firewallObjectForm'

export type FirewallObjectPreset = 'counter_ssh' | 'limit_dns' | 'quota_bridge' | 'helper_ftp' | 'timeout_tcp' | 'expectation_ftp'

type Params = {
  activeObjectFamily: 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
  activeObjectTableName: string
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setEditingFirewallObjectId: React.Dispatch<React.SetStateAction<string | null>>
  setFirewallObjectForm: React.Dispatch<React.SetStateAction<FirewallObjectForm>>
  setFirewallObjectOpen: React.Dispatch<React.SetStateAction<boolean>>
}

function buildFirewallObjectFormFromItem(item: FirewallNamedObjectItem): FirewallObjectForm {
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

export function useFirewallObjectEditor(params: Params) {
  const openCreateFirewallObjectWindow = React.useCallback(() => {
    if (!params.activeObjectTableName) {
      params.setError('Select object table first.')
      return
    }
    params.setEditingFirewallObjectId(null)
    params.setFirewallObjectForm(defaultFirewallObjectForm())
    params.setFirewallObjectOpen(true)
  }, [params])

  const openEditFirewallObjectWindow = React.useCallback((item: FirewallNamedObjectItem) => {
    params.setEditingFirewallObjectId(item.id)
    params.setFirewallObjectForm(buildFirewallObjectFormFromItem(item))
    params.setFirewallObjectOpen(true)
  }, [params])

  const applyFirewallObjectPreset = React.useCallback((preset: FirewallObjectPreset) => {
    const now = Date.now()
    if (preset === 'counter_ssh') {
      params.setFirewallObjectForm((p) => ({
        ...p,
        kind: 'counter',
        name: `cnt_ssh_${now}`,
        enabled: true,
        comment: 'Count SSH attempts in firewall policy',
        packets: '',
        bytes: '',
      }))
      return
    }
    if (preset === 'limit_dns') {
      params.setFirewallObjectForm((p) => ({
        ...p,
        kind: 'limit',
        name: `lim_dns_${now}`,
        enabled: true,
        comment: 'Limit DNS burst',
        rate: '30/second',
        burst: '100 packets',
        over: false,
      }))
      return
    }
    if (preset === 'quota_bridge') {
      params.setFirewallObjectForm((p) => ({
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
      params.setFirewallObjectForm((p) => ({
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
    if (preset === 'expectation_ftp') {
      if (params.activeObjectFamily === 'bridge' || params.activeObjectFamily === 'netdev') {
        params.setError(`ct_expectation is not supported for family=${params.activeObjectFamily}.`)
        return
      }
      params.setFirewallObjectForm((p) => ({
        ...p,
        kind: 'ct_expectation',
        name: `exp_ftp_${now}`,
        enabled: true,
        comment: 'FTP conntrack expectation',
        l4proto: 'tcp',
        l3proto: params.activeObjectFamily === 'ip6' ? 'ip6' : 'ip',
        dport: '21',
        timeout: '2m',
        size: '8',
      }))
      return
    }
    params.setFirewallObjectForm((p) => ({
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
    openCreateFirewallObjectWindow,
    openEditFirewallObjectWindow,
    applyFirewallObjectPreset,
  }
}
