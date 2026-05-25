import type { FirewallNamedObjectKind } from '../api'

export type PolicyV2ObjectForm = {
  id: string | null
  kind: FirewallNamedObjectKind
  name: string
  enabled: boolean
  comment: string
  packets: string
  bytes: string
  rate: string
  burst: string
  over: boolean
  quota_mode: 'over' | 'until'
  quota_bytes: string
  quota_used: string
  helper_type: string
  l4proto: 'tcp' | 'udp'
  l3proto: '' | 'ip' | 'ip6'
  timeout_policy: string
  dport: string
  timeout: string
  size: string
}

export function defaultPolicyV2ObjectForm(): PolicyV2ObjectForm {
  return {
    id: null,
    kind: 'counter',
    name: '',
    enabled: true,
    comment: '',
    packets: '',
    bytes: '',
    rate: '10/second',
    burst: '',
    over: false,
    quota_mode: 'over',
    quota_bytes: '20 mbytes',
    quota_used: '',
    helper_type: 'ftp',
    l4proto: 'tcp',
    l3proto: 'ip',
    timeout_policy: 'established:120, close:20',
    dport: '9876',
    timeout: '2m',
    size: '8',
  }
}
