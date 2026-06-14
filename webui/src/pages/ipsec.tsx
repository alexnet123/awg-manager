import * as React from 'react'
import { ChevronDown, Copy, Eye, EyeOff, KeyRound, Plus, Save, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type {
  AuthState,
  IpsecActivePeer,
  IpsecIkeVersion,
  IpsecIdentity,
  IpsecInstalledSa,
  IpsecPeer,
  IpsecPhase1Profile,
  IpsecPhase2Proposal,
  IpsecPolicy,
} from './api'
import { useDraggableWindow } from './firewall/useDraggableWindow'
import {
  applyIpsec,
  deleteIpsecIdentity,
  deleteIpsecPeer,
  deleteIpsecPhase1Profile,
  deleteIpsecPhase2Proposal,
  deleteIpsecPolicy,
  getIpsecActivePeers,
  getIpsecIdentities,
  getIpsecIdentityPsk,
  getIpsecInstalledSas,
  getIpsecPeers,
  getIpsecPhase1Profiles,
  getIpsecPhase2Proposals,
  getIpsecPolicies,
  loadIpsecPeer,
  terminateIpsecPeer,
  upsertIpsecIdentity,
  upsertIpsecPeer,
  upsertIpsecPhase1Profile,
  upsertIpsecPhase2Proposal,
  upsertIpsecPolicy,
} from './api'

type IpsecTab = 'policies' | 'peers' | 'identities' | 'phase1' | 'phase2' | 'active' | 'installed'
type EditableTab = 'policies' | 'peers' | 'identities' | 'phase1' | 'phase2'
type EditorMode = 'create' | 'edit'
type SortDirection = 'asc' | 'desc'
type PolicyColumnKey =
  | 'name'
  | 'peer'
  | 'local_ts'
  | 'remote_ts'
  | 'proposal'
  | 'action'
  | 'level'
  | 'mode'
  | 'start_action'
  | 'close_action'
  | 'dpd_action'
  | 'rekey_time'
  | 'life_time'
  | 'rand_time'
  | 'policies'
  | 'policies_fwd_out'
  | 'reqid'
  | 'priority'
  | 'interface'
  | 'mark_in'
  | 'mark_in_sa'
  | 'mark_out'
  | 'set_mark_in'
  | 'set_mark_out'
  | 'if_id_in'
  | 'if_id_out'
type PeerColumnKey = 'name' | 'local_addrs' | 'remote_addrs' | 'phase1_profile' | 'ike_version' | 'dpd' | 'dpd_delay' | 'dpd_timeout' | 'nat_t' | 'mobike' | 'fragmentation' | 'rekey_time' | 'reauth_time' | 'over_time' | 'rand_time' | 'keyingtries' | 'send_initial_contact'
type IdentityColumnKey = 'peer' | 'auth_method' | 'local_id' | 'remote_id' | 'has_psk'
type Phase1ColumnKey = 'name' | 'encryption' | 'hash' | 'prf' | 'dh_group'
type Phase2ColumnKey = 'name' | 'encryption' | 'auth' | 'pfs_group' | 'esn'
type ActivePeerColumnKey = 'id' | 'state' | 'local_address' | 'local_port' | 'remote_address' | 'remote_port' | 'dynamic_address' | 'side' | 'uptime' | 'last_seen' | 'ph2_total' | 'tx_bytes' | 'rx_bytes' | 'tx_packets' | 'rx_packets'
type InstalledSaColumnKey = 'child_sa' | 'state' | 'reqid' | 'mode' | 'protocol' | 'spi_in' | 'spi_out' | 'bytes_in' | 'bytes_out' | 'packets_in' | 'packets_out' | 'install_time' | 'rekey_time' | 'life_time' | 'last_seen' | 'local_ts' | 'remote_ts' | 'esp_proposal'
type SortState<K extends string> = { key: K | null; dir: SortDirection }

type PeerForm = {
  name: string
  local_addrs: string
  remote_addrs: string
  phase1_profile: string
  ike_version: '1' | '2'
  enabled: boolean
  dpd: boolean
  dpd_delay: string
  dpd_timeout: string
  nat_t: boolean
  mobike: string
  fragmentation: string
  rekey_time: string
  reauth_time: string
  over_time: string
  rand_time: string
  keyingtries: string
  send_initial_contact: boolean
}

type IdentityForm = {
  peer: string
  local_id_mode: 'auto' | 'manual'
  local_id: string
  remote_id_mode: 'auto' | 'manual'
  remote_id: string
  enabled: boolean
  psk: string
  current_psk_set: boolean
}

type Phase1Form = {
  name: string
  encryption: string
  hash: string
  dh_group: string
  prf: string
  lifetime: string
  enabled: boolean
  proposal_check: string
  extra_proposals: string
}

type Phase2Form = {
  name: string
  encryption: string
  auth: string
  pfs_group: string
  esn: string
  lifetime: string
  enabled: boolean
  extra_proposals: string
}

type PolicyForm = {
  name: string
  peer: string
  local_ts: string
  local_ts_port: string
  remote_ts: string
  remote_ts_port: string
  ts_protocol: string
  ts_protocol_custom: string
  proposal: string
  action: 'encrypt'
  level: IpsecPolicy['level']
  mode: IpsecPolicy['mode']
  start_action: IpsecPolicy['start_action']
  close_action: IpsecPolicy['close_action']
  dpd_action: IpsecPolicy['dpd_action']
  rekey_time: string
  life_time: string
  rand_time: string
  policies: IpsecPolicy['policies']
  policies_fwd_out: IpsecPolicy['policies_fwd_out']
  reqid: string
  priority: string
  interface: string
  mark_in: string
  mark_in_sa: IpsecPolicy['mark_in_sa']
  mark_out: string
  set_mark_in: string
  set_mark_out: string
  if_id_in: string
  if_id_out: string
  enabled: boolean
}

const editableTabs: EditableTab[] = ['phase1', 'phase2', 'policies', 'peers', 'identities']
const IPSEC_EDITOR_WIDTH = 680
const IPSEC_EDITOR_ESTIMATED_HEIGHT = 660
const IPSEC_EDITOR_TOP_OFFSET = 36

const tabLabels: Record<IpsecTab, string> = {
  policies: 'Policies',
  peers: 'Peers',
  identities: 'Identities',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  active: 'Active Peers',
  installed: 'Installed SAs',
}

const editorLabels: Record<EditableTab, string> = {
  policies: 'Policy',
  peers: 'Peer',
  identities: 'Identity',
  phase1: 'Phase 1 Profile',
  phase2: 'Phase 2 Proposal',
}

const policyColumnOrder: PolicyColumnKey[] = [
  'peer',
  'local_ts',
  'remote_ts',
  'proposal',
  'action',
  'level',
  'mode',
  'start_action',
  'close_action',
  'dpd_action',
  'rekey_time',
  'life_time',
  'rand_time',
  'policies',
  'policies_fwd_out',
  'reqid',
  'priority',
  'interface',
  'mark_in',
  'mark_in_sa',
  'mark_out',
  'set_mark_in',
  'set_mark_out',
  'if_id_in',
  'if_id_out',
]

const policyColumnLabels: Record<PolicyColumnKey, string> = {
  name: 'Name',
  peer: 'Peer',
  local_ts: 'Src. Address',
  remote_ts: 'Dst. Address',
  proposal: 'Phase 2',
  action: 'Action',
  level: 'Level',
  mode: 'Mode',
  start_action: 'Start',
  close_action: 'Close',
  dpd_action: 'DPD',
  rekey_time: 'Rekey',
  life_time: 'Lifetime',
  rand_time: 'Rand time',
  policies: 'Install',
  policies_fwd_out: 'Forward out',
  reqid: 'ReqID',
  priority: 'Priority',
  interface: 'Interface',
  mark_in: 'Mark in',
  mark_in_sa: 'Mark in SA',
  mark_out: 'Mark out',
  set_mark_in: 'Set mark in',
  set_mark_out: 'Set mark out',
  if_id_in: 'IF ID in',
  if_id_out: 'IF ID out',
}

const defaultVisiblePolicyColumns: Record<PolicyColumnKey, boolean> = {
  name: false,
  peer: true,
  local_ts: true,
  remote_ts: true,
  proposal: true,
  action: true,
  level: false,
  mode: true,
  start_action: true,
  close_action: false,
  dpd_action: false,
  rekey_time: true,
  life_time: false,
  rand_time: false,
  policies: false,
  policies_fwd_out: false,
  reqid: true,
  priority: false,
  interface: false,
  mark_in: false,
  mark_in_sa: false,
  mark_out: false,
  set_mark_in: false,
  set_mark_out: false,
  if_id_in: false,
  if_id_out: false,
}

const peerColumnOrder: PeerColumnKey[] = [
  'name',
  'local_addrs',
  'remote_addrs',
  'phase1_profile',
  'ike_version',
  'dpd',
  'dpd_delay',
  'dpd_timeout',
  'nat_t',
  'mobike',
  'fragmentation',
  'rekey_time',
  'reauth_time',
  'over_time',
  'rand_time',
  'keyingtries',
  'send_initial_contact',
]

const peerColumnLabels: Record<PeerColumnKey, string> = {
  name: 'Name',
  local_addrs: 'local_addrs',
  remote_addrs: 'remote_addrs',
  phase1_profile: 'Phase 1',
  ike_version: 'Exchange mode',
  dpd: 'DPD',
  dpd_delay: 'dpd_delay',
  dpd_timeout: 'dpd_timeout',
  nat_t: 'NAT-T',
  mobike: 'MOBIKE',
  fragmentation: 'fragmentation',
  rekey_time: 'IKE rekey',
  reauth_time: 'IKE reauth',
  over_time: 'IKE over',
  rand_time: 'IKE rand',
  keyingtries: 'keyingtries',
  send_initial_contact: 'send_initial_contact',
}

const defaultVisiblePeerColumns: Record<PeerColumnKey, boolean> = {
  name: true,
  local_addrs: true,
  remote_addrs: true,
  phase1_profile: true,
  ike_version: true,
  dpd: true,
  dpd_delay: false,
  dpd_timeout: false,
  nat_t: true,
  mobike: true,
  fragmentation: true,
  rekey_time: false,
  reauth_time: false,
  over_time: false,
  rand_time: false,
  keyingtries: false,
  send_initial_contact: false,
}

const identityColumnOrder: IdentityColumnKey[] = ['peer', 'auth_method', 'local_id', 'remote_id', 'has_psk']
const identityColumnLabels: Record<IdentityColumnKey, string> = {
  peer: 'Peer',
  auth_method: 'Method',
  local_id: 'Local ID',
  remote_id: 'Remote ID',
  has_psk: 'PSK',
}
const defaultVisibleIdentityColumns: Record<IdentityColumnKey, boolean> = {
  peer: true,
  auth_method: false,
  local_id: true,
  remote_id: true,
  has_psk: true,
}

const phase1ColumnOrder: Phase1ColumnKey[] = ['name', 'encryption', 'hash', 'prf', 'dh_group']
const phase1ColumnLabels: Record<Phase1ColumnKey, string> = {
  name: 'Name',
  encryption: 'Encryption',
  hash: 'Hash',
  prf: 'PRF',
  dh_group: 'DH Group',
}
const defaultVisiblePhase1Columns: Record<Phase1ColumnKey, boolean> = {
  name: true,
  encryption: true,
  hash: true,
  prf: true,
  dh_group: true,
}

const phase2ColumnOrder: Phase2ColumnKey[] = ['name', 'encryption', 'auth', 'pfs_group', 'esn']
const phase2ColumnLabels: Record<Phase2ColumnKey, string> = {
  name: 'Name',
  encryption: 'Encryption Algorithm',
  auth: 'Auth Algorithm',
  pfs_group: 'PFS Group',
  esn: 'ESN Mode',
}
const defaultVisiblePhase2Columns: Record<Phase2ColumnKey, boolean> = {
  name: true,
  encryption: true,
  auth: true,
  pfs_group: true,
  esn: true,
}

const activePeerColumnOrder: ActivePeerColumnKey[] = ['id', 'state', 'local_address', 'local_port', 'remote_address', 'remote_port', 'dynamic_address', 'side', 'uptime', 'last_seen', 'ph2_total', 'tx_bytes', 'rx_bytes', 'tx_packets', 'rx_packets']
const activePeerColumnLabels: Record<ActivePeerColumnKey, string> = {
  id: 'ID',
  state: 'State',
  local_address: 'Local Address',
  local_port: 'Local Port',
  remote_address: 'Remote Address',
  remote_port: 'Remote Port',
  dynamic_address: 'Dynamic Address',
  side: 'Side',
  uptime: 'Uptime',
  last_seen: 'Last Seen',
  ph2_total: 'PH2 Total',
  tx_bytes: 'Tx Bytes',
  rx_bytes: 'Rx Bytes',
  tx_packets: 'Tx Packets',
  rx_packets: 'Rx Packets',
}
const defaultVisibleActivePeerColumns: Record<ActivePeerColumnKey, boolean> = {
  id: true,
  state: true,
  local_address: true,
  local_port: true,
  remote_address: true,
  remote_port: true,
  dynamic_address: true,
  side: true,
  uptime: true,
  last_seen: true,
  ph2_total: true,
  tx_bytes: true,
  rx_bytes: true,
  tx_packets: true,
  rx_packets: true,
}

const installedSaColumnOrder: InstalledSaColumnKey[] = ['child_sa', 'state', 'reqid', 'mode', 'protocol', 'spi_in', 'spi_out', 'bytes_in', 'bytes_out', 'packets_in', 'packets_out', 'install_time', 'rekey_time', 'life_time', 'last_seen', 'local_ts', 'remote_ts', 'esp_proposal']
const installedSaColumnLabels: Record<InstalledSaColumnKey, string> = {
  child_sa: 'CHILD_SA',
  state: 'State',
  reqid: 'ReqID',
  mode: 'Mode',
  protocol: 'Protocol',
  spi_in: 'SPI in',
  spi_out: 'SPI out',
  bytes_in: 'Bytes in',
  bytes_out: 'Bytes out',
  packets_in: 'Packets in',
  packets_out: 'Packets out',
  install_time: 'Installed',
  rekey_time: 'Rekey',
  life_time: 'Lifetime',
  last_seen: 'Last Seen',
  local_ts: 'local_ts',
  remote_ts: 'remote_ts',
  esp_proposal: 'ESP proposal',
}
const defaultVisibleInstalledSaColumns: Record<InstalledSaColumnKey, boolean> = {
  child_sa: true,
  state: true,
  reqid: true,
  mode: true,
  protocol: true,
  spi_in: true,
  spi_out: true,
  bytes_in: true,
  bytes_out: true,
  packets_in: true,
  packets_out: true,
  install_time: true,
  rekey_time: true,
  life_time: true,
  last_seen: true,
  local_ts: true,
  remote_ts: true,
  esp_proposal: true,
}

const emptyPeerForm: PeerForm = {
  name: '',
  local_addrs: '',
  remote_addrs: '',
  phase1_profile: '',
  ike_version: '2',
  enabled: true,
  dpd: true,
  dpd_delay: '30s',
  dpd_timeout: '120s',
  nat_t: true,
  mobike: 'yes',
  fragmentation: 'yes',
  rekey_time: '1d',
  reauth_time: '0s',
  over_time: '',
  rand_time: '',
  keyingtries: '0',
  send_initial_contact: true,
}
const emptyIdentityForm: IdentityForm = { peer: '', local_id_mode: 'auto', local_id: '', remote_id_mode: 'auto', remote_id: '', enabled: true, psk: '', current_psk_set: false }

function generateIpsecPsk(length = 48) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-'
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}
const emptyPhase1Form: Phase1Form = { name: '', encryption: 'aes256', hash: 'sha256', dh_group: 'modp2048', prf: 'auto', lifetime: '1d', enabled: true, proposal_check: 'obey', extra_proposals: '' }
const emptyPhase2Form: Phase2Form = { name: '', encryption: 'aes256', auth: 'sha256', pfs_group: 'modp2048', esn: '', lifetime: '1h', enabled: true, extra_proposals: '' }
const emptyPolicyForm: PolicyForm = {
  name: '',
  peer: '',
  local_ts: '',
  local_ts_port: '',
  remote_ts: '',
  remote_ts_port: '',
  ts_protocol: 'any',
  ts_protocol_custom: '',
  proposal: '',
  action: 'encrypt',
  level: 'require',
  mode: 'tunnel',
  start_action: 'start',
  close_action: 'none',
  dpd_action: 'restart',
  rekey_time: '1h',
  life_time: '',
  rand_time: '',
  policies: 'yes',
  policies_fwd_out: 'no',
  reqid: '',
  priority: '',
  interface: '',
  mark_in: '',
  mark_in_sa: 'no',
  mark_out: '',
  set_mark_in: '',
  set_mark_out: '',
  if_id_in: '',
  if_id_out: '',
  enabled: true,
}

const ikeEncryptionOptions = [
  'aes128',
  'aes192',
  'aes256',
  'aes128gcm16',
  'aes192gcm16',
  'aes256gcm16',
  'aes128gcm12',
  'aes256gcm12',
  'aes128ccm16',
  'aes256ccm16',
  'chacha20poly1305',
  'aes128ctr',
  'aes192ctr',
  'aes256ctr',
  'camellia128',
  'camellia192',
  'camellia256',
  'blowfish128',
  'blowfish192',
  'blowfish256',
  'cast128',
  '3des',
  'des',
]

const ikeHashOptions = [
  'sha256',
  'sha384',
  'sha512',
  'sha224',
  'sha1',
  'aesxcbc',
  'aescmac',
  'md5',
]

const ikePrfOptions = [
  'auto',
  'prfsha256',
  'prfsha384',
  'prfsha512',
  'prfsha224',
  'prfsha1',
  'prfaesxcbc',
  'prfaescmac',
  'prfmd5',
]

const ikeDhGroupOptions = [
  'curve25519',
  'curve448',
  'ecp256',
  'ecp384',
  'ecp521',
  'ecp224',
  'ecp192',
  'modp2048',
  'modp3072',
  'modp4096',
  'modp6144',
  'modp8192',
  'modp1536',
  'modp1024',
  'modp768',
]

const espEncryptionOptions = [
  'aes128',
  'aes192',
  'aes256',
  'aes128gcm16',
  'aes192gcm16',
  'aes256gcm16',
  'aes128gcm12',
  'aes256gcm12',
  'aes128ccm16',
  'aes256ccm16',
  'chacha20poly1305',
  'aes128ctr',
  'aes192ctr',
  'aes256ctr',
  'camellia128',
  'camellia192',
  'camellia256',
  'blowfish128',
  'blowfish192',
  'blowfish256',
  'cast128',
  '3des',
]

const espAuthOptions = [
  'sha256',
  'sha384',
  'sha512',
  'sha224',
  'sha1',
  'aesxcbc',
  'aescmac',
  'md5',
]

const yesNoOptions = ['yes', 'no']
const ikeVersionOptions: Array<{ value: PeerForm['ike_version']; label: string }> = [
  { value: '2', label: 'IKEv2' },
  { value: '1', label: 'IKEv1' },
]
const fragmentationOptions = ['yes', 'accept', 'force', 'no']
const policyInstallOptions = ['yes', 'no']
const esnOptions = ['esn', 'noesn']
const childModeOptions = ['tunnel', 'transport', 'beet', 'pass', 'drop']
const startActionOptions = ['start', 'trap', 'none']
const closeActionOptions = ['none', 'trap', 'start']
const dpdActionOptions = ['clear', 'trap', 'restart']
const trafficSelectorProtocolOptions = [
  { value: 'any', label: 'any', aliases: ['all'] },
  { value: 'icmp', label: 'ICMP (1)', aliases: ['1'] },
  { value: 'igmp', label: 'IGMP (2)', aliases: ['2'] },
  { value: 'egp', label: 'EGP (8)', aliases: ['8'] },
  { value: 'ggp', label: 'GGP (3)', aliases: ['3'] },
  { value: 'ipencap', label: 'IP-ENCAP (4)', aliases: ['4', 'ip-encap', 'encap'] },
  { value: 'tcp', label: 'TCP (6)', aliases: ['6'] },
  { value: 'udp', label: 'UDP (17)', aliases: ['17'] },
  { value: 'gre', label: 'GRE (47)', aliases: ['47'] },
  { value: 'esp', label: 'ESP (50)', aliases: ['50', 'ipsec'] },
  { value: 'ah', label: 'AH (51)', aliases: ['51'] },
  { value: 'sctp', label: 'SCTP (132)', aliases: ['132'] },
]

const dhGroupNumbers: Record<string, string> = {
  modp768: '1',
  modp1024: '2',
  modp1536: '5',
  modp2048: '14',
  modp3072: '15',
  modp4096: '16',
  modp6144: '17',
  modp8192: '18',
  ecp256: '19',
  ecp384: '20',
  ecp521: '21',
  ecp192: '25',
  ecp224: '26',
  curve25519: '31',
  curve448: '32',
}

const cryptoAlgorithmLabels: Record<string, string> = {
  aes128: 'AES-128',
  aes192: 'AES-192',
  aes256: 'AES-256',
  aes128gcm16: 'AES-128 GCM ICV16',
  aes192gcm16: 'AES-192 GCM ICV16',
  aes256gcm16: 'AES-256 GCM ICV16',
  aes128gcm12: 'AES-128 GCM ICV12',
  aes256gcm12: 'AES-256 GCM ICV12',
  aes128ccm16: 'AES-128 CCM ICV16',
  aes256ccm16: 'AES-256 CCM ICV16',
  chacha20poly1305: 'ChaCha20-Poly1305',
  aes128ctr: 'AES-128 CTR',
  aes192ctr: 'AES-192 CTR',
  aes256ctr: 'AES-256 CTR',
  camellia128: 'Camellia-128',
  camellia192: 'Camellia-192',
  camellia256: 'Camellia-256',
  blowfish128: 'Blowfish-128',
  blowfish192: 'Blowfish-192',
  blowfish256: 'Blowfish-256',
  cast128: 'CAST-128',
  '3des': '3DES',
  des: 'DES',
  sha1: 'SHA-1',
  sha224: 'SHA-224',
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
  aesxcbc: 'AES-XCBC',
  aescmac: 'AES-CMAC',
  prfsha1: 'PRF SHA-1',
  prfsha224: 'PRF SHA-224',
  prfsha256: 'PRF SHA-256',
  prfsha384: 'PRF SHA-384',
  prfsha512: 'PRF SHA-512',
  prfaesxcbc: 'PRF AES-XCBC',
  prfaescmac: 'PRF AES-CMAC',
  prfmd5: 'PRF MD5',
  auto: 'Auto',
  md5: 'MD5',
}

function splitCsv(v: string): string[] {
  return v
    .split(/[,\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function joinCsv(v?: string[]): string {
  return (v || []).join(', ')
}

const trafficSelectorSuffixPattern = /^(.+?)(?:\[([A-Za-z0-9_-]+)(?:\/(\d+(?:-\d+)?))?\])?$/

function parseTrafficSelectorParts(value: string): { addresses: string; protocol: string; port: string } {
  const part = splitCsv(value)[0] || ''
  if (!part) return { addresses: '', protocol: '', port: '' }
  const match = trafficSelectorSuffixPattern.exec(part)
  return {
    addresses: match?.[1]?.trim() || part,
    protocol: match?.[2]?.trim().toLowerCase() || '',
    port: match?.[3]?.trim() || '',
  }
}

function buildTrafficSelectorValue(addresses: string, protocol: string, port: string): string {
  const address = splitCsv(addresses)[0] || addresses.trim()
  const proto = protocol.trim().toLowerCase()
  const suffix = port.trim()
  if (!address) return ''
  if (!proto) return address
  return suffix ? `${address}[${proto}/${suffix}]` : `${address}[${proto}]`
}

function resolvePolicySelectorProtocol(form: Pick<PolicyForm, 'ts_protocol' | 'ts_protocol_custom'>): string {
  if (form.ts_protocol === 'custom') return form.ts_protocol_custom.trim()
  return form.ts_protocol === 'any' ? '' : form.ts_protocol.trim().toLowerCase()
}

function selectorProtocolSupportsPorts(protocol: string): boolean {
  const value = protocol.trim().toLowerCase()
  return value === 'tcp' || value === 'udp' || value === '6' || value === '17'
}

function normalizeSelectorProtocolChoice(protocol: string): { protocol: string; custom: string } {
  const value = protocol.trim().toLowerCase()
  if (!value) return { protocol: 'any', custom: '' }
  if (trafficSelectorProtocolOptions.some((option) => option.value === value)) {
    return { protocol: value, custom: '' }
  }
  return { protocol: 'custom', custom: value }
}

function normalizeProtocolSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-')
}

function protocolOptionMatchesInput(option: (typeof trafficSelectorProtocolOptions)[number], value: string): boolean {
  const normalized = normalizeProtocolSearchText(value)
  if (!normalized) return false
  return option.value === normalized || option.aliases.includes(normalized) || normalizeProtocolSearchText(option.label) === normalized
}

function findProtocolOptionByInput(value: string) {
  return trafficSelectorProtocolOptions.find((option) => protocolOptionMatchesInput(option, value))
}

function formatProtocolInput(protocol: string, customProtocol: string): string {
  const selected = protocol || 'any'
  if (selected === 'custom') return customProtocol
  if (selected === 'any') return 'any'
  return trafficSelectorProtocolOptions.find((option) => option.value === selected)?.label || selected
}

function normalizeSingleTrafficSelectorAddress(value: string): string {
  return (splitCsv(value)[0] || value).trim()
}

function buildGeneratedPolicyName(form: PolicyForm, existingPolicies: IpsecPolicy[], originalName?: string) {
  const clean = (value: string) => (
    value
      .trim()
      .replace(/[,\s]+/g, '-')
      .replace(/[^A-Za-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 96)
  )
  const peer = clean(form.peer) || 'policy'
  const local = clean(splitCsv(form.local_ts)[0] || 'local')
  const remote = clean(splitCsv(form.remote_ts)[0] || 'remote')
  const base = clean(`${peer}-${local}-to-${remote}`) || 'policy'
  const reserved = new Set(existingPolicies.map((policy) => policy.name).filter((name) => name !== originalName))
  if (!reserved.has(base)) return base
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`
    if (!reserved.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

function buildCopyName(name: string, existingNames: string[]) {
  const clean = (value: string) => (
    value
      .trim()
      .replace(/[,\s]+/g, '-')
      .replace(/[^A-Za-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 96)
  )
  const base = clean(name ? `${name}-copy` : 'copy') || 'copy'
  const reserved = new Set(existingNames)
  if (!reserved.has(base)) return base
  for (let index = 2; index < 1000; index += 1) {
    const candidate = clean(`${base}-${index}`) || `copy-${index}`
    if (!reserved.has(candidate)) return candidate
  }
  return clean(`${base}-${Date.now()}`) || `copy-${Date.now()}`
}

function assertCreateNameAvailable(kind: string, name: string, existingNames: string[]) {
  const cleanName = name.trim()
  if (cleanName && existingNames.includes(cleanName)) {
    throw new Error(`${kind} "${cleanName}" already exists. Choose another name or edit the existing item.`)
  }
}

function isEditableTab(tab: IpsecTab): tab is EditableTab {
  return editableTabs.includes(tab as EditableTab)
}

function formatEnabled(value?: boolean) {
  return value ? 'enabled' : 'disabled'
}

function formatIkeVersion(value?: IpsecIkeVersion | string | number) {
  const version = Number(value || 2)
  if (version === 1) return 'IKEv1'
  return 'IKEv2'
}

function statusBadge(value?: string | boolean) {
  const text = typeof value === 'boolean' ? formatEnabled(value) : String(value || 'unknown')
  const positive = ['enabled', 'established', 'installed', 'ok', 'start'].includes(text.toLowerCase())
  return <Badge variant={positive ? 'default' : 'outline'} className='font-mono text-[11px]'>{text}</Badge>
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-1.5'>
      <Label className='text-xs text-muted-foreground'>{props.label}</Label>
      {props.children}
    </div>
  )
}

function CompactRow(props: { label: string; children: React.ReactNode; align?: 'start' | 'center' }) {
  return (
    <div className={`grid gap-2 md:grid-cols-[150px_minmax(0,1fr)] ${props.align === 'start' ? 'items-start' : 'items-center'}`}>
      <Label className='pt-0.5 text-right text-xs font-medium text-foreground md:pt-1'>{props.label}</Label>
      <div className='min-w-0'>{props.children}</div>
    </div>
  )
}

function IpsecToggleLine(props: { enabled: boolean; onToggle: () => void; children: React.ReactNode; inactiveHint: string }) {
  if (props.enabled) {
    return (
      <div className='relative max-w-xl'>
        <div className='pr-8'>{props.children}</div>
        <button
          type='button'
          className='absolute right-1 top-1 h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground'
          onClick={props.onToggle}
        >
          -
        </button>
      </div>
    )
  }

  return (
    <div className='flex h-7 max-w-xl items-center justify-between rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground'>
      <span className='truncate pr-2'>{props.inactiveHint}</span>
      <button type='button' className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground' onClick={props.onToggle}>+</button>
    </div>
  )
}

function TrafficSelectorEditor(props: {
  value: string
  port: string
  onChange: (value: string) => void
  onPortChange: (value: string) => void
  addressLabel: string
  portLabel: string
  portHelp: string
  addressPlaceholder: string
  protocol: string
}) {
  const portEnabled = Boolean(props.port.trim())
  const protocol = props.protocol.trim().toLowerCase()
  const supportsPort = selectorProtocolSupportsPorts(protocol)
  const enablePort = () => props.onPortChange('443')
  const disablePort = () => props.onPortChange('')

  return (
    <div className='space-y-2'>
      <CompactRow label={props.addressLabel} align='start'>
        <div className='mb-1 text-[11px] text-muted-foreground'>One traffic selector address or subnet. Create another policy for another prefix.</div>
        <Input
          className='h-7 max-w-xl text-xs'
          value={props.value}
          onChange={(e) => props.onChange(normalizeSingleTrafficSelectorAddress(e.target.value))}
          placeholder={props.addressPlaceholder}
        />
      </CompactRow>
      <CompactRow label={props.portLabel} align='start'>
        <div className='mb-1 text-[11px] text-muted-foreground'>{props.portHelp}</div>
        {supportsPort ? (
          <IpsecToggleLine enabled={portEnabled} inactiveHint={`Any ${protocol.toUpperCase()} port`} onToggle={portEnabled ? disablePort : enablePort}>
            <Input
              className='h-7 text-xs'
              value={props.port}
              onChange={(e) => props.onPortChange(e.target.value)}
              placeholder='443 or 500-4500'
            />
          </IpsecToggleLine>
        ) : (
          <div className='flex h-7 max-w-xl items-center rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground'>
            {protocol ? 'Port matching is available only for TCP/UDP traffic selectors' : 'Select TCP/UDP or protocol number 6/17 to limit ports'}
          </div>
        )}
      </CompactRow>
    </div>
  )
}

function PolicyProtocolEditor(props: {
  protocol: string
  customProtocol: string
  onProtocolChange: (value: string) => void
  onCustomProtocolChange: (value: string) => void
  onDisablePorts: () => void
}) {
  const [inputValue, setInputValue] = React.useState(() => formatProtocolInput(props.protocol, props.customProtocol))
  const [open, setOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const selectedProtocol = props.protocol || 'any'
  const effectiveProtocol = selectedProtocol === 'custom' ? props.customProtocol : selectedProtocol === 'any' ? '' : selectedProtocol
  const supportsPort = selectorProtocolSupportsPorts(effectiveProtocol)

  React.useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setInputValue(formatProtocolInput(props.protocol, props.customProtocol))
  }, [props.protocol, props.customProtocol])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const applyProtocolText = (rawValue: string) => {
    const value = rawValue.trim()
    const matchedOption = findProtocolOptionByInput(value)
    if (!value || matchedOption?.value === 'any') {
      props.onProtocolChange('any')
      props.onCustomProtocolChange('')
      props.onDisablePorts()
      return
    }
    if (matchedOption) {
      props.onProtocolChange(matchedOption.value)
      props.onCustomProtocolChange('')
      if (!selectorProtocolSupportsPorts(matchedOption.value)) props.onDisablePorts()
      return
    }
    const customValue = normalizeProtocolSearchText(value)
    props.onProtocolChange('custom')
    props.onCustomProtocolChange(customValue)
    if (!selectorProtocolSupportsPorts(customValue)) props.onDisablePorts()
  }

  const selectProtocolOption = (option: (typeof trafficSelectorProtocolOptions)[number]) => {
    setInputValue(option.label)
    applyProtocolText(option.value)
    setOpen(false)
  }

  const selectedLabel = formatProtocolInput(props.protocol, props.customProtocol)
  const filteredOptions = trafficSelectorProtocolOptions.filter((option) => {
    const query = inputValue === selectedLabel ? '' : normalizeProtocolSearchText(inputValue)
    if (!query) return true
    if (query === 'any' || query === 'all') return true
    if (/^\d+$/.test(query)) return true
    return (
      option.value.includes(query) ||
      normalizeProtocolSearchText(option.label).includes(query) ||
      option.aliases.some((alias) => alias.includes(query))
    )
  })

  const commitInput = () => {
    const value = inputValue.trim()
    applyProtocolText(value)
  }

  return (
    <CompactRow label='Protocol' align='start'>
      <div className='mb-1 text-[11px] text-muted-foreground'>
        One protected traffic protocol for this CHILD_SA. Live tests confirmed Any, ICMP, TCP, UDP, GRE, ESP, AH, and SCTP/numeric selectors load into XFRM.
      </div>
      <div ref={wrapperRef} className='relative max-w-xl'>
        <div className='flex h-7 items-center rounded-md border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50'>
          <Input
            ref={inputRef}
            aria-label='Protocol'
            className='h-6 flex-1 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0'
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value)
              applyProtocolText(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={commitInput}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                commitInput()
                setOpen(false)
              }
              if (event.key === 'Escape') setOpen(false)
            }}
            placeholder='any, tcp, udp, 132...'
          />
          <button
            type='button'
            aria-label='Open protocol menu'
            className='flex h-6 w-7 items-center justify-center text-muted-foreground'
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown className='h-3.5 w-3.5' />
          </button>
        </div>
        {open ? (
          <div className='absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-xs text-popover-foreground shadow-md'>
            {filteredOptions.length ? filteredOptions.map((option) => (
              <button
                key={option.value}
                type='button'
                role='option'
                aria-selected={option.value === selectedProtocol}
                className='flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground'
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectProtocolOption(option)}
              >
                <span>{option.label}</span>
                {option.value !== 'any' && option.aliases[0] ? <span className='text-[10px] text-muted-foreground'>{option.aliases[0]}</span> : null}
              </button>
            )) : (
              <div className='px-2 py-1.5 text-muted-foreground'>Press Enter to use custom protocol</div>
            )}
          </div>
        ) : null}
      </div>
      <div className='mt-1 text-[11px] text-muted-foreground'>
        {supportsPort ? 'For normal client-to-service traffic, usually set Dst. Port and leave Src. Port empty.' : 'Ports are available only for TCP/UDP or custom protocol number 6/17.'}
      </div>
    </CompactRow>
  )
}

function EnabledCheckbox(props: { checked: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button
      type='button'
      className='flex h-7 w-7 items-center justify-center rounded-md border text-xs'
      onClick={() => props.onChange(!props.checked)}
      aria-label={props.ariaLabel}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border text-[11px] ${
          props.checked ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-border bg-background'
        }`}
      >
        {props.checked ? '✓' : ''}
      </span>
    </button>
  )
}

function CheckChoiceGrid(props: {
  value: string
  options: string[]
  onChange: (value: string) => void
  formatLabel?: (value: string) => string
  columns?: 2 | 3
}) {
  const columns = props.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <div className={`grid gap-x-4 gap-y-2 rounded-md border bg-background/70 p-2 shadow-inner ${columns}`}>
      {props.options.map((option) => {
        const checked = props.value === option
        return (
          <button
            key={option}
            type='button'
            className={`flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors ${
              checked ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => props.onChange(option)}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px] ${
                checked ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-border bg-muted/40'
              }`}
            >
              {checked ? '✓' : ''}
            </span>
            <span className='truncate' title={props.formatLabel ? props.formatLabel(option) : option}>
              {props.formatLabel ? props.formatLabel(option) : option}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function MultiCheckChoiceGrid(props: {
  values: string[]
  options: string[]
  onToggle: (value: string) => void
  formatLabel?: (value: string) => string
  columns?: 2 | 3
}) {
  const selected = new Set(props.values)
  const columns = props.columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return (
    <div className={`grid gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 shadow-inner dark:border-slate-800 dark:bg-slate-950/20 ${columns}`}>
      {props.options.map((option) => {
        const checked = selected.has(option)
        return (
          <button
            key={option}
            type='button'
            className={`flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-xs transition-colors ${
              checked ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => props.onToggle(option)}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px] ${
                checked ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-border bg-muted/40'
              }`}
            >
              {checked ? '✓' : ''}
            </span>
            <span className='truncate' title={props.formatLabel ? props.formatLabel(option) : option}>
              {props.formatLabel ? props.formatLabel(option) : option}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function formatDhGroup(value?: string | null) {
  if (!value) return '-'
  const group = dhGroupNumbers[value]
  return group ? `${value} (Group ${group})` : value
}

function formatCryptoAlgorithm(value?: string | null) {
  if (!value) return '-'
  const label = cryptoAlgorithmLabels[value]
  return label || value
}

function getCenteredEditorPosition() {
  if (typeof window === 'undefined') return { x: 150, y: 88 }
  const maxHeight = Math.min(IPSEC_EDITOR_ESTIMATED_HEIGHT, window.innerHeight * 0.78)
  return {
    x: Math.max(12, Math.round((window.innerWidth - IPSEC_EDITOR_WIDTH) / 2)),
    y: Math.max(12, Math.round((window.innerHeight - maxHeight) / 2) - IPSEC_EDITOR_TOP_OFFSET),
  }
}

function isAeadAlgorithm(value?: string | null) {
  const alg = String(value || '').toLowerCase()
  return alg.includes('gcm') || alg.includes('ccm') || alg === 'chacha20poly1305'
}

function buildIkeProposalPreview(form: Phase1Form) {
  const prf = form.prf === 'auto' ? '' : form.prf
  return isAeadAlgorithm(form.encryption)
    ? [form.encryption, prf, form.dh_group].filter(Boolean).join('-')
    : [form.encryption, form.hash, prf, form.dh_group].filter(Boolean).join('-')
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function orderedSelection(options: string[], selected: string[], preferred: string) {
  const set = new Set(selected.filter(Boolean))
  const out = preferred && set.has(preferred) ? [preferred] : []
  for (const option of options) {
    if (set.has(option) && option !== preferred) out.push(option)
  }
  for (const value of set) {
    if (!out.includes(value)) out.push(value)
  }
  return out.length ? out : preferred ? [preferred] : []
}

function parseIkeProposalParts(proposal: string) {
  const parts = proposal.split('-').map((part) => part.trim()).filter(Boolean)
  return {
    encryption: parts.find((part) => ikeEncryptionOptions.includes(part)) || '',
    hash: parts.find((part) => ikeHashOptions.includes(part)) || '',
    prf: parts.find((part) => ikePrfOptions.includes(part)) || '',
    dh_group: parts.find((part) => ikeDhGroupOptions.includes(part)) || '',
  }
}

function phase1Selections(form: Phase1Form) {
  const proposals = [buildIkeProposalPreview(form), ...splitCsv(form.extra_proposals)]
  const parsed = proposals.map(parseIkeProposalParts)
  return {
    encryptions: uniqueValues([form.encryption, ...parsed.map((item) => item.encryption)]),
    hashes: uniqueValues([form.hash, ...parsed.map((item) => item.hash)]),
    prfs: uniqueValues([form.prf, ...parsed.map((item) => item.prf)]),
    dhGroups: uniqueValues([form.dh_group, ...parsed.map((item) => item.dh_group)]),
  }
}

function normalizePhase1SelectionToggle(
  key: keyof ReturnType<typeof phase1Selections>,
  currentValues: string[],
  value: string
) {
  if (key !== 'prfs') return toggleSelection(currentValues, value)
  if (value === 'auto') return ['auto']
  return toggleSelection(currentValues.filter((item) => item !== 'auto'), value)
}

function buildIkeProposalsFromSelections(selections: {
  encryptions: string[]
  hashes: string[]
  prfs: string[]
  dhGroups: string[]
}) {
  const proposals: string[] = []
  for (const encryption of selections.encryptions) {
    for (const prf of selections.prfs) {
      const proposalPrf = prf === 'auto' ? '' : prf
      for (const dh_group of selections.dhGroups) {
        if (isAeadAlgorithm(encryption)) {
          proposals.push([encryption, proposalPrf, dh_group].filter(Boolean).join('-'))
        } else {
          for (const hash of selections.hashes) {
            proposals.push([encryption, hash, proposalPrf, dh_group].filter(Boolean).join('-'))
          }
        }
      }
    }
  }
  return uniqueValues(proposals)
}

function updatePhase1Selections(form: Phase1Form, changes: Partial<ReturnType<typeof phase1Selections>>): Phase1Form {
  const current = phase1Selections(form)
  const next = {
    encryptions: orderedSelection(ikeEncryptionOptions, changes.encryptions || current.encryptions, form.encryption),
    hashes: orderedSelection(ikeHashOptions, changes.hashes || current.hashes, form.hash),
    prfs: orderedSelection(ikePrfOptions, changes.prfs || current.prfs, form.prf),
    dhGroups: orderedSelection(ikeDhGroupOptions, changes.dhGroups || current.dhGroups, form.dh_group),
  }
  const proposals = buildIkeProposalsFromSelections(next)
  const primary = parseIkeProposalParts(proposals[0] || buildIkeProposalPreview(form))
  return {
    ...form,
    encryption: primary.encryption || form.encryption,
    hash: primary.hash || form.hash,
    prf: next.prfs.includes('auto') ? 'auto' : primary.prf || form.prf,
    dh_group: primary.dh_group || form.dh_group,
    extra_proposals: proposals.slice(1).join(', '),
  }
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function buildEspProposalPreview(form: Phase2Form) {
  return isAeadAlgorithm(form.encryption)
    ? [form.encryption, form.pfs_group, form.esn].filter(Boolean).join('-')
    : [form.encryption, form.auth, form.pfs_group, form.esn].filter(Boolean).join('-')
}

function parseEspProposalParts(proposal: string) {
  const parts = proposal.split('-').map((part) => part.trim()).filter(Boolean)
  return {
    encryption: parts.find((part) => espEncryptionOptions.includes(part)) || '',
    auth: parts.find((part) => espAuthOptions.includes(part)) || '',
    pfs_group: parts.find((part) => ikeDhGroupOptions.includes(part)) || '',
    esn: parts.find((part) => esnOptions.includes(part)) || '',
  }
}

function phase2Selections(form: Phase2Form) {
  const proposals = [buildEspProposalPreview(form), ...splitCsv(form.extra_proposals)]
  const parsed = proposals.map(parseEspProposalParts)
  return {
    encryptions: uniqueValues([form.encryption, ...parsed.map((item) => item.encryption)]),
    auths: uniqueValues([form.auth, ...parsed.map((item) => item.auth)]),
    pfsGroups: uniqueValues([form.pfs_group || '__none__', ...parsed.map((item) => item.pfs_group || '__none__')]),
    esnModes: uniqueValues([form.esn || '__default__', ...parsed.map((item) => item.esn || '__default__')]),
  }
}

function normalizePhase2SelectionToggle(
  key: keyof ReturnType<typeof phase2Selections>,
  currentValues: string[],
  value: string
) {
  const next = toggleSelection(currentValues, value)
  if (next.length) return next
  if (key === 'pfsGroups') return ['__none__']
  if (key === 'esnModes') return ['__default__']
  return currentValues
}

function buildEspProposalsFromSelections(selections: {
  encryptions: string[]
  auths: string[]
  pfsGroups: string[]
  esnModes: string[]
}) {
  const proposals: string[] = []
  for (const encryption of selections.encryptions) {
    const auths = isAeadAlgorithm(encryption) ? [''] : selections.auths
    for (const auth of auths) {
      for (const pfsGroup of selections.pfsGroups) {
        const proposalPfs = pfsGroup === '__none__' ? '' : pfsGroup
        for (const esnMode of selections.esnModes) {
          const proposalEsn = esnMode === '__default__' ? '' : esnMode
          proposals.push([encryption, auth, proposalPfs, proposalEsn].filter(Boolean).join('-'))
        }
      }
    }
  }
  return uniqueValues(proposals)
}

function updatePhase2Selections(form: Phase2Form, changes: Partial<ReturnType<typeof phase2Selections>>): Phase2Form {
  const current = phase2Selections(form)
  const next = {
    encryptions: orderedSelection(espEncryptionOptions, changes.encryptions || current.encryptions, form.encryption),
    auths: orderedSelection(espAuthOptions, changes.auths || current.auths, form.auth),
    pfsGroups: orderedSelection(['__none__', ...ikeDhGroupOptions], changes.pfsGroups || current.pfsGroups, form.pfs_group || '__none__'),
    esnModes: orderedSelection(['__default__', ...esnOptions], changes.esnModes || current.esnModes, form.esn || '__default__'),
  }
  const proposals = buildEspProposalsFromSelections(next)
  const primary = parseEspProposalParts(proposals[0] || buildEspProposalPreview(form))
  return {
    ...form,
    encryption: primary.encryption || form.encryption,
    auth: primary.auth || form.auth,
    pfs_group: primary.pfs_group || '',
    esn: primary.esn || '',
    extra_proposals: proposals.slice(1).join(', '),
  }
}

function buildProposalSetPreview(primary: string, extra: string) {
  return [primary, ...splitCsv(extra)].filter(Boolean).join(', ')
}

function formatProposalSet(primary?: string | null, extra?: string[]) {
  return [primary, ...(extra || [])]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ') || '-'
}

function formatProposalSelectLabel(name: string, primary?: string | null, extra?: string[]) {
  const proposalSet = formatProposalSet(primary, extra)
  return proposalSet === '-' ? name : `${name} (${proposalSet})`
}

function formatProposalSetCell(primary?: string | null, extra?: string[]) {
  return truncateMiddle(formatProposalSet(primary, extra), 72)
}

function formatBytes(value?: number | null) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let current = bytes / 1024
  let idx = 0
  while (current >= 1024 && idx < units.length - 1) {
    current /= 1024
    idx += 1
  }
  return `${current.toFixed(current >= 10 ? 1 : 2)} ${units[idx]}`
}

function formatCount(value?: number | null) {
  return Number(value || 0).toLocaleString()
}

function truncateMiddle(value?: string | null, max = 18) {
  const text = String(value || '')
  if (!text) return '-'
  if (text.length <= max) return text
  const half = Math.floor((max - 3) / 2)
  return `${text.slice(0, half)}...${text.slice(-half)}`
}

function optionList(value: string, options: string[]) {
  return value && !options.includes(value) ? [value, ...options] : options
}

function OptionSelect(props: { value: string; options: string[]; onChange: (value: string) => void; placeholder?: string; formatLabel?: (value: string) => string; disabled?: boolean }) {
  return (
    <Select value={props.value || undefined} onValueChange={props.onChange} disabled={props.disabled}>
      <SelectTrigger className='h-8 w-full'><SelectValue placeholder={props.placeholder || 'Select'} /></SelectTrigger>
      <SelectContent>
        {optionList(props.value, props.options).map((option) => (
          <SelectItem key={option} value={option}>{props.formatLabel ? props.formatLabel(option) : option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PfsGroupSelect(props: { value: string; onChange: (value: string) => void }) {
  const customOptions = optionList(props.value, ikeDhGroupOptions)
  return (
    <Select value={props.value || '__none__'} onValueChange={(value) => props.onChange(value === '__none__' ? '' : value)}>
      <SelectTrigger className='h-8 w-full'><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value='__none__'>none</SelectItem>
        {customOptions.map((option) => (
          <SelectItem key={option} value={option}>{formatDhGroup(option)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EsnSelect(props: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={props.value || '__default__'} onValueChange={(value) => props.onChange(value === '__default__' ? '' : value)}>
      <SelectTrigger className='h-8 w-full'><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value='__default__'>default (no ESN flag)</SelectItem>
        {esnOptions.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function NamedSelect(props: { value: string; options: Array<{ value: string; label: string }>; placeholder: string; onChange: (value: string) => void }) {
  const hasCurrent = props.value && props.options.every((option) => option.value !== props.value)
  const options = hasCurrent ? [{ value: props.value, label: props.value }, ...props.options] : props.options
  return (
    <Select value={props.value || undefined} onValueChange={props.onChange} disabled={!options.length}>
      <SelectTrigger className='h-8 w-full'>
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function useStoredColumns<K extends string>(storageKey: string, defaults: Record<K, boolean>) {
  const [visible, setVisible] = React.useState<Record<K, boolean>>(() => {
    if (typeof window === 'undefined') return defaults
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return defaults
      const parsed = JSON.parse(raw) as Partial<Record<K, boolean>>
      return { ...defaults, ...parsed }
    } catch {
      return defaults
    }
  })

  React.useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(visible))
    } catch {
      // Column preferences are optional; ignore storage failures.
    }
  }, [storageKey, visible])

  return [visible, setVisible] as const
}

function EmptyRow(props: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={props.colSpan} className='py-8 text-center text-xs text-muted-foreground'>
        {props.text}
      </TableCell>
    </TableRow>
  )
}

function nextSortState<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (prev.key !== key) return { key, dir: 'asc' }
  if (prev.dir === 'asc') return { key, dir: 'desc' }
  return emptySort()
}

function sortIndicator(active: boolean, dir: SortDirection): string {
  if (!active) return '↕'
  return dir === 'asc' ? '▲' : '▼'
}

function normalizeSortValue(value: unknown): string | number {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return ''
  const text = String(value).trim()
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return text.toLowerCase()
}

function compareSortValues(a: unknown, b: unknown): number {
  const av = normalizeSortValue(a)
  const bv = normalizeSortValue(b)
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true })
}

function sortRows<T, K extends string>(rows: T[], sort: SortState<K>, getValue: (row: T, key: K) => unknown): T[] {
  if (!sort.key) return rows
  const dir = sort.dir === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const cmp = compareSortValues(getValue(a.row, sort.key as K), getValue(b.row, sort.key as K))
      return cmp === 0 ? a.index - b.index : dir * cmp
    })
    .map((item) => item.row)
}

function emptySort<K extends string>(): SortState<K> {
  return { key: null, dir: 'asc' }
}

function SortableHead<K extends string>(props: {
  sortKey: K
  label: string
  sort: SortState<K>
  onSort: (key: K) => void
}) {
  return (
    <TableHead>
      <button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.onSort(props.sortKey)}>
        {props.label}
        <span className='text-[10px] text-muted-foreground/70'>{sortIndicator(props.sort.key === props.sortKey, props.sort.dir)}</span>
      </button>
    </TableHead>
  )
}

function ColumnsDropdown<K extends string>(props: {
  order: K[]
  labels: Record<K, string>
  visible: Record<K, boolean>
  setVisible: React.Dispatch<React.SetStateAction<Record<K, boolean>>>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size='sm' variant='outline'>Columns</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' side='bottom' sideOffset={6} className='z-[120] max-h-[70vh] min-w-56 overflow-auto p-1.5'>
        {props.order.map((key) => (
          <DropdownMenuCheckboxItem
            key={key}
            className='text-xs'
            checked={!!props.visible[key]}
            onCheckedChange={(checked) => {
              props.setVisible((prev) => ({ ...prev, [key]: !!checked }))
            }}
            onSelect={(event) => event.preventDefault()}
          >
            {props.labels[key]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function IpsecPage(props: { auth: AuthState; refreshNonce: number }) {
  const [peers, setPeers] = React.useState<IpsecPeer[]>([])
  const [identities, setIdentities] = React.useState<IpsecIdentity[]>([])
  const [phase1, setPhase1] = React.useState<IpsecPhase1Profile[]>([])
  const [phase2, setPhase2] = React.useState<IpsecPhase2Proposal[]>([])
  const [policies, setPolicies] = React.useState<IpsecPolicy[]>([])
  const [active, setActive] = React.useState<IpsecActivePeer[]>([])
  const [installed, setInstalled] = React.useState<IpsecInstalledSa[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<IpsecTab>('phase1')
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorMode, setEditorMode] = React.useState<EditorMode>('create')
  const [editorTab, setEditorTab] = React.useState<EditableTab>('phase1')
  const [editorOriginalName, setEditorOriginalName] = React.useState('')
  const { winPos: editorWinPos, setWinPos: setEditorWinPos, onDragStart: onEditorDragStart } = useDraggableWindow({ x: 150, y: 88 })
  const [visiblePolicyColumns, setVisiblePolicyColumns] = useStoredColumns<PolicyColumnKey>('ipsec.columns.policies', defaultVisiblePolicyColumns)
  const [visiblePeerColumns, setVisiblePeerColumns] = useStoredColumns<PeerColumnKey>('ipsec.columns.peers', defaultVisiblePeerColumns)
  const [visibleIdentityColumns, setVisibleIdentityColumns] = useStoredColumns<IdentityColumnKey>('ipsec.columns.identities', defaultVisibleIdentityColumns)
  const [visiblePhase1Columns, setVisiblePhase1Columns] = useStoredColumns<Phase1ColumnKey>('ipsec.columns.phase1', defaultVisiblePhase1Columns)
  const [visiblePhase2Columns, setVisiblePhase2Columns] = useStoredColumns<Phase2ColumnKey>('ipsec.columns.phase2', defaultVisiblePhase2Columns)
  const [visibleActivePeerColumns, setVisibleActivePeerColumns] = useStoredColumns<ActivePeerColumnKey>('ipsec.columns.active-peers', defaultVisibleActivePeerColumns)
  const [visibleInstalledSaColumns, setVisibleInstalledSaColumns] = useStoredColumns<InstalledSaColumnKey>('ipsec.columns.installed-sas', defaultVisibleInstalledSaColumns)

  const [peerForm, setPeerForm] = React.useState<PeerForm>(emptyPeerForm)
  const [idForm, setIdForm] = React.useState<IdentityForm>(emptyIdentityForm)
  const [p1Form, setP1Form] = React.useState<Phase1Form>(emptyPhase1Form)
  const [p2Form, setP2Form] = React.useState<Phase2Form>(emptyPhase2Form)
  const [polForm, setPolForm] = React.useState<PolicyForm>(emptyPolicyForm)

  async function loadAll() {
    setError(null)
    try {
      const [p, i, p1, p2, pol, a, ins] = await Promise.all([
        getIpsecPeers(props.auth),
        getIpsecIdentities(props.auth),
        getIpsecPhase1Profiles(props.auth),
        getIpsecPhase2Proposals(props.auth),
        getIpsecPolicies(props.auth),
        getIpsecActivePeers(props.auth),
        getIpsecInstalledSas(props.auth),
      ])
      setPeers(p)
      setIdentities(i)
      setPhase1(p1)
      setPhase2(p2)
      setPolicies(pol)
      setActive(a)
      setInstalled(ins.items || [])
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  React.useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.refreshNonce])

  React.useEffect(() => {
    let cancelled = false
    async function refreshCurrentTab() {
      if (busy) return
      try {
        if (activeTab === 'policies') {
          const rows = await getIpsecPolicies(props.auth)
          if (!cancelled) setPolicies(rows)
        } else if (activeTab === 'peers') {
          const rows = await getIpsecPeers(props.auth)
          if (!cancelled) setPeers(rows)
        } else if (activeTab === 'identities') {
          const rows = await getIpsecIdentities(props.auth)
          if (!cancelled) setIdentities(rows)
        } else if (activeTab === 'phase1') {
          const rows = await getIpsecPhase1Profiles(props.auth)
          if (!cancelled) setPhase1(rows)
        } else if (activeTab === 'phase2') {
          const rows = await getIpsecPhase2Proposals(props.auth)
          if (!cancelled) setPhase2(rows)
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc))
      }
    }
    void refreshCurrentTab()
    const timer = window.setInterval(() => {
      void refreshCurrentTab()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeTab, busy, props.auth])

  React.useEffect(() => {
    if (activeTab !== 'active') return
    let cancelled = false
    async function refreshActivePeers() {
      try {
        const rows = await getIpsecActivePeers(props.auth)
        if (!cancelled) setActive(rows)
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc))
      }
    }
    void refreshActivePeers()
    const timer = window.setInterval(() => {
      void refreshActivePeers()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeTab, props.auth])

  React.useEffect(() => {
    if (activeTab !== 'installed') return
    let cancelled = false
    async function refreshInstalledSas() {
      try {
        const rows = await getIpsecInstalledSas(props.auth)
        if (!cancelled) setInstalled(rows.items || [])
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc))
      }
    }
    void refreshInstalledSas()
    const timer = window.setInterval(() => {
      void refreshInstalledSas()
    }, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeTab, props.auth])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await loadAll()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setBusy(false)
    }
  }

  function selectRow(id: string, event: React.MouseEvent) {
    setSelectedIds((prev) => {
      if (event.metaKey || event.ctrlKey) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      }
      return prev.includes(id) && prev.length === 1 ? [] : [id]
    })
  }

  function switchTab(next: string) {
    setActiveTab(next as IpsecTab)
    setSelectedIds([])
  }

  function resetForms() {
    setPeerForm(emptyPeerForm)
    setIdForm(emptyIdentityForm)
    setP1Form(emptyPhase1Form)
    setP2Form(emptyPhase2Form)
    setPolForm(emptyPolicyForm)
  }

  function openCreate(tab: EditableTab = isEditableTab(activeTab) ? activeTab : 'policies') {
    resetForms()
    setEditorMode('create')
    setEditorTab(tab)
    setEditorOriginalName('')
    setEditorWinPos(getCenteredEditorPosition())
    setEditorOpen(true)
  }

  function openEdit(tab: EditableTab, item: IpsecPolicy | IpsecPeer | IpsecIdentity | IpsecPhase1Profile | IpsecPhase2Proposal) {
    setEditorMode('edit')
    setEditorTab(tab)
    setEditorOriginalName('name' in item ? item.name : 'peer' in item ? item.peer : '')
    setEditorWinPos(getCenteredEditorPosition())
    if (tab === 'policies') {
      const policy = item as IpsecPolicy
      const localTsParts = parseTrafficSelectorParts(joinCsv(policy.local_ts))
      const remoteTsParts = parseTrafficSelectorParts(joinCsv(policy.remote_ts))
      const selectorProtocol = normalizeSelectorProtocolChoice(localTsParts.protocol || remoteTsParts.protocol)
      setPolForm({
        name: policy.name,
        peer: policy.peer,
        local_ts: localTsParts.addresses,
        local_ts_port: localTsParts.port,
        remote_ts: remoteTsParts.addresses,
        remote_ts_port: remoteTsParts.port,
        ts_protocol: selectorProtocol.protocol,
        ts_protocol_custom: selectorProtocol.custom,
        proposal: policy.proposal,
        action: policy.action || 'encrypt',
        level: policy.level || 'require',
        mode: policy.mode || 'tunnel',
        start_action: policy.start_action || 'start',
        close_action: policy.close_action || 'none',
        dpd_action: policy.dpd_action || 'restart',
        rekey_time: policy.rekey_time || '1h',
        life_time: policy.life_time || '',
        rand_time: policy.rand_time || '',
        policies: policy.policies || 'yes',
        policies_fwd_out: policy.policies_fwd_out || 'no',
        reqid: policy.reqid || '',
        priority: policy.priority || '',
        interface: policy.interface || '',
        mark_in: policy.mark_in || '',
        mark_in_sa: policy.mark_in_sa || 'no',
        mark_out: policy.mark_out || '',
        set_mark_in: policy.set_mark_in || '',
        set_mark_out: policy.set_mark_out || '',
        if_id_in: policy.if_id_in || '',
        if_id_out: policy.if_id_out || '',
        enabled: policy.enabled,
      })
    } else if (tab === 'peers') {
      const peer = item as IpsecPeer
      setPeerForm({
        name: peer.name,
        local_addrs: joinCsv(peer.local_addrs),
        remote_addrs: joinCsv(peer.remote_addrs),
        phase1_profile: peer.phase1_profile,
        ike_version: String(peer.ike_version || 2) as PeerForm['ike_version'],
        enabled: peer.enabled,
        dpd: peer.dpd,
        dpd_delay: peer.dpd_delay || '30s',
        dpd_timeout: peer.dpd_timeout || '120s',
        nat_t: peer.nat_t,
        mobike: peer.mobike || 'yes',
        fragmentation: peer.fragmentation || 'yes',
        rekey_time: peer.rekey_time || '1d',
        reauth_time: peer.reauth_time || '0s',
        over_time: peer.over_time || '',
        rand_time: peer.rand_time || '',
        keyingtries: peer.keyingtries || '0',
        send_initial_contact: peer.send_initial_contact,
      })
    } else if (tab === 'identities') {
      const identity = item as IpsecIdentity
      setIdForm({
        peer: identity.peer,
        local_id_mode: identity.local_id ? 'manual' : 'auto',
        local_id: identity.local_id,
        remote_id_mode: identity.remote_id ? 'manual' : 'auto',
        remote_id: identity.remote_id,
        enabled: identity.enabled !== false,
        psk: '',
        current_psk_set: Boolean(identity.has_psk),
      })
      if (identity.has_psk) {
        void getIpsecIdentityPsk(props.auth, identity.peer)
          .then((secret) => {
            setIdForm((current) => (
              current.peer === identity.peer
                ? { ...current, psk: secret.psk || '', current_psk_set: Boolean(secret.psk) || current.current_psk_set }
                : current
            ))
          })
          .catch((error) => setError(error instanceof Error ? error.message : String(error)))
      }
    } else if (tab === 'phase1') {
      const profile = item as IpsecPhase1Profile
      setP1Form({
        name: profile.name,
        encryption: profile.encryption,
        hash: profile.hash,
        dh_group: profile.dh_group,
        prf: profile.prf || 'auto',
        lifetime: profile.lifetime,
        enabled: profile.enabled !== false,
        proposal_check: profile.proposal_check || 'obey',
        extra_proposals: joinCsv(profile.extra_proposals),
      })
    } else if (tab === 'phase2') {
      const proposal = item as IpsecPhase2Proposal
      setP2Form({
        name: proposal.name,
        encryption: proposal.encryption,
        auth: proposal.auth,
        pfs_group: proposal.pfs_group || '',
        esn: proposal.esn || '',
        lifetime: proposal.lifetime,
        enabled: proposal.enabled !== false,
        extra_proposals: joinCsv(proposal.extra_proposals),
      })
    }
    setEditorOpen(true)
  }

  function copyEditorItem() {
    setEditorMode('create')
    setEditorOriginalName('')
    if (editorTab === 'policies') {
      setPolForm((form) => ({
        ...form,
        name: buildCopyName(form.name || buildGeneratedPolicyName(form, policies), policies.map((policy) => policy.name)),
        reqid: '',
        enabled: false,
      }))
    } else if (editorTab === 'peers') {
      setPeerForm((form) => ({
        ...form,
        name: buildCopyName(form.name, peers.map((peer) => peer.name)),
        enabled: false,
      }))
    } else if (editorTab === 'identities') {
      const targetPeer = peers.find((peer) => (
        peer.name !== idForm.peer && !identities.some((identity) => identity.peer === peer.name)
      ))
      setIdForm((form) => ({
        ...form,
        peer: targetPeer?.name || '',
        current_psk_set: Boolean(form.psk),
      }))
    } else if (editorTab === 'phase1') {
      setP1Form((form) => ({
        ...form,
        name: buildCopyName(form.name, phase1.map((profile) => profile.name)),
      }))
    } else if (editorTab === 'phase2') {
      setP2Form((form) => ({
        ...form,
        name: buildCopyName(form.name, phase2.map((proposal) => proposal.name)),
      }))
    }
  }

  function copyEditorDisabled() {
    if (busy || editorMode !== 'edit') return true
    if (editorTab !== 'identities') return false
    return !peers.some((peer) => (
      peer.name !== idForm.peer && !identities.some((identity) => identity.peer === peer.name)
    ))
  }

  function copyEditorTitle() {
    if (editorTab === 'identities' && copyEditorDisabled()) {
      return 'Copy requires another peer without an identity.'
    }
    if (editorTab === 'peers') return 'Create a disabled peer copy.'
    if (editorTab === 'policies') return 'Create a disabled policy copy with dynamic ReqID.'
    return 'Create a copy.'
  }

  async function saveEditor(event: React.FormEvent) {
    event.preventDefault()
    await run(async () => {
      if (editorTab === 'policies') {
        const originalPolicyName = editorMode === 'edit' ? editorOriginalName : undefined
        const policyName = polForm.name.trim() || buildGeneratedPolicyName(polForm, policies, originalPolicyName)
        if (editorMode === 'create') {
          assertCreateNameAvailable('Policy', policyName, policies.map((policy) => policy.name))
        }
        const selectorProtocol = resolvePolicySelectorProtocol(polForm)
        await upsertIpsecPolicy(props.auth, {
          original_name: originalPolicyName,
          name: policyName,
          peer: polForm.peer,
          local_ts: splitCsv(buildTrafficSelectorValue(polForm.local_ts, selectorProtocol, polForm.local_ts_port)),
          remote_ts: splitCsv(buildTrafficSelectorValue(polForm.remote_ts, selectorProtocol, polForm.remote_ts_port)),
          proposal: polForm.proposal,
          action: polForm.action,
          level: polForm.level,
          mode: polForm.mode,
          start_action: polForm.start_action || 'start',
          close_action: polForm.close_action || 'none',
          dpd_action: polForm.dpd_action || 'restart',
          rekey_time: polForm.rekey_time || '1h',
          life_time: polForm.life_time,
          rand_time: polForm.rand_time,
          policies: polForm.policies || 'yes',
          policies_fwd_out: polForm.policies_fwd_out || 'no',
          reqid: polForm.reqid,
          priority: polForm.priority,
          interface: polForm.interface,
          mark_in: polForm.mark_in,
          mark_in_sa: polForm.mark_in_sa || 'no',
          mark_out: polForm.mark_out,
          set_mark_in: polForm.set_mark_in,
          set_mark_out: polForm.set_mark_out,
          if_id_in: polForm.if_id_in,
          if_id_out: polForm.if_id_out,
          enabled: polForm.enabled,
        })
      } else if (editorTab === 'peers') {
        if (editorMode === 'create') {
          assertCreateNameAvailable('Peer', peerForm.name, peers.map((peer) => peer.name))
        }
        await upsertIpsecPeer(props.auth, {
          original_name: editorMode === 'edit' ? editorOriginalName : undefined,
          name: peerForm.name,
          local_addrs: splitCsv(peerForm.local_addrs),
          remote_addrs: splitCsv(peerForm.remote_addrs),
          phase1_profile: peerForm.phase1_profile,
          ike_version: Number(peerForm.ike_version) as IpsecIkeVersion,
          enabled: peerForm.enabled,
          dpd: peerForm.dpd,
          dpd_delay: peerForm.dpd_delay,
          dpd_timeout: peerForm.dpd_timeout,
          nat_t: peerForm.nat_t,
          mobike: (peerForm.ike_version === '1' ? 'no' : peerForm.mobike) as IpsecPeer['mobike'],
          fragmentation: peerForm.fragmentation as IpsecPeer['fragmentation'],
          rekey_time: peerForm.rekey_time,
          reauth_time: peerForm.reauth_time,
          over_time: peerForm.over_time,
          rand_time: peerForm.rand_time,
          keyingtries: peerForm.keyingtries.trim() || '0',
          send_initial_contact: peerForm.send_initial_contact,
        })
        if (peerForm.enabled) {
          await loadIpsecPeer(props.auth, peerForm.name)
        } else {
          await terminateIpsecPeer(props.auth, peerForm.name)
        }
      } else if (editorTab === 'identities') {
        const identityPeer = idForm.peer
        if (editorMode === 'create') {
          assertCreateNameAvailable('Identity for peer', identityPeer, identities.map((identity) => identity.peer))
        }
        await upsertIpsecIdentity(props.auth, {
          peer: identityPeer,
          auth_method: 'psk',
          local_id: idForm.local_id_mode === 'auto' ? '' : idForm.local_id,
          remote_id: idForm.remote_id_mode === 'auto' ? '' : idForm.remote_id,
          enabled: idForm.enabled,
          psk: idForm.psk,
        })
        if (identityPeer) {
          await loadIpsecPeer(props.auth, identityPeer)
        }
        setIdForm((s) => ({ ...s, current_psk_set: s.current_psk_set || Boolean(s.psk) }))
      } else if (editorTab === 'phase1') {
        if (editorMode === 'create') {
          assertCreateNameAvailable('Phase 1 profile', p1Form.name, phase1.map((profile) => profile.name))
        }
        await upsertIpsecPhase1Profile(props.auth, {
          ...p1Form,
          original_name: editorMode === 'edit' ? editorOriginalName : undefined,
          extra_proposals: splitCsv(p1Form.extra_proposals),
        })
      } else if (editorTab === 'phase2') {
        if (editorMode === 'create') {
          assertCreateNameAvailable('Phase 2 proposal', p2Form.name, phase2.map((proposal) => proposal.name))
        }
        await upsertIpsecPhase2Proposal(props.auth, {
          ...p2Form,
          original_name: editorMode === 'edit' ? editorOriginalName : undefined,
          pfs_group: p2Form.pfs_group.trim() || null,
          esn: p2Form.esn.trim() || null,
          extra_proposals: splitCsv(p2Form.extra_proposals),
        })
      }
      setEditorOpen(false)
    })
  }

  async function deleteSelected() {
    if (!selectedIds.length) return
    await run(async () => {
      let deletedConfig = false
      if (activeTab === 'policies') {
        if (!confirm(`Remove ${selectedIds.length} selected policy item(s)?`)) return
        await Promise.all(selectedIds.map((name) => deleteIpsecPolicy(props.auth, name)))
      } else if (activeTab === 'peers') {
        if (!confirm(`Remove ${selectedIds.length} selected peer item(s)?`)) return
        await Promise.all(selectedIds.map((name) => deleteIpsecPeer(props.auth, name)))
        deletedConfig = true
      } else if (activeTab === 'identities') {
        if (!confirm(`Remove ${selectedIds.length} selected identity item(s)?`)) return
        await Promise.all(selectedIds.map((peer) => deleteIpsecIdentity(props.auth, peer)))
        await Promise.all(selectedIds.map((peer) => terminateIpsecPeer(props.auth, peer)))
      } else if (activeTab === 'phase1') {
        const blockedName = selectedIds.find((name) => peers.some((peer) => peer.phase1_profile === name))
        if (blockedName) {
          const blockedPeers = peers.filter((peer) => peer.phase1_profile === blockedName).map((peer) => peer.name)
          throw new Error(`Cannot delete Phase 1 profile "${blockedName}": used by peer(s): ${blockedPeers.join(', ')}`)
        }
        if (!confirm(`Remove ${selectedIds.length} selected Phase 1 profile item(s)?`)) return
        await Promise.all(selectedIds.map((name) => deleteIpsecPhase1Profile(props.auth, name)))
        deletedConfig = true
      } else if (activeTab === 'phase2') {
        const blockedName = selectedIds.find((name) => policies.some((policy) => policy.proposal === name))
        if (blockedName) {
          const blockedPolicies = policies.filter((policy) => policy.proposal === blockedName).map((policy) => policy.name)
          throw new Error(`Cannot delete Phase 2 proposal "${blockedName}": used by policy(s): ${blockedPolicies.join(', ')}`)
        }
        if (!confirm(`Remove ${selectedIds.length} selected Phase 2 proposal item(s)?`)) return
        await Promise.all(selectedIds.map((name) => deleteIpsecPhase2Proposal(props.auth, name)))
        deletedConfig = true
      }
      if (deletedConfig) {
        await applyIpsec(props.auth)
      }
      setSelectedIds([])
    })
  }

  async function setSelectedEnabled(enabled: boolean) {
    if (!selectedIds.length) return
    await run(async () => {
      if (activeTab === 'policies') {
        const selected = policies.filter((row) => selectedIds.includes(row.name))
        await Promise.all(selected.map((row) => upsertIpsecPolicy(props.auth, { ...row, enabled })))
      } else if (activeTab === 'peers') {
        const selected = peers.filter((row) => selectedIds.includes(row.name))
        await Promise.all(selected.map((row) => upsertIpsecPeer(props.auth, { ...row, enabled })))
      } else if (activeTab === 'identities') {
        const selected = identities.filter((row) => selectedIds.includes(row.peer))
        await Promise.all(selected.map((row) => upsertIpsecIdentity(props.auth, { ...row, enabled })))
      } else if (activeTab === 'phase1') {
        const selected = phase1.filter((row) => selectedIds.includes(row.name))
        await Promise.all(selected.map((row) => upsertIpsecPhase1Profile(props.auth, { ...row, enabled })))
      } else if (activeTab === 'phase2') {
        const selected = phase2.filter((row) => selectedIds.includes(row.name))
        await Promise.all(selected.map((row) => upsertIpsecPhase2Proposal(props.auth, { ...row, enabled })))
      }
      await applyIpsec(props.auth)
      setSelectedIds([])
    })
  }

  async function resetSelectedPeer() {
    if (activeTab !== 'active' || !selectedIds.length) return
    await run(async () => {
      await Promise.all(selectedIds.map((peer) => terminateIpsecPeer(props.auth, peer)))
      setSelectedIds([])
    })
  }

  const addEnabled = isEditableTab(activeTab)
  const deleteEnabled = isEditableTab(activeTab) && selectedIds.length > 0
  const hasEnabledToggle = activeTab === 'policies' || activeTab === 'peers' || activeTab === 'identities' || activeTab === 'phase1' || activeTab === 'phase2'
  const enableToggleEnabled = hasEnabledToggle && selectedIds.length > 0
  const showConfigToolbar = isEditableTab(activeTab)
  const showActivePeersToolbar = activeTab === 'active'
  const showInstalledSasToolbar = activeTab === 'installed'

  function renderColumnsDropdown() {
    if (activeTab === 'policies') return <ColumnsDropdown order={policyColumnOrder} labels={policyColumnLabels} visible={visiblePolicyColumns} setVisible={setVisiblePolicyColumns} />
    if (activeTab === 'peers') return <ColumnsDropdown order={peerColumnOrder} labels={peerColumnLabels} visible={visiblePeerColumns} setVisible={setVisiblePeerColumns} />
    if (activeTab === 'identities') return <ColumnsDropdown order={identityColumnOrder} labels={identityColumnLabels} visible={visibleIdentityColumns} setVisible={setVisibleIdentityColumns} />
    if (activeTab === 'phase1') return <ColumnsDropdown order={phase1ColumnOrder} labels={phase1ColumnLabels} visible={visiblePhase1Columns} setVisible={setVisiblePhase1Columns} />
    if (activeTab === 'phase2') return <ColumnsDropdown order={phase2ColumnOrder} labels={phase2ColumnLabels} visible={visiblePhase2Columns} setVisible={setVisiblePhase2Columns} />
    if (activeTab === 'active') return <ColumnsDropdown order={activePeerColumnOrder} labels={activePeerColumnLabels} visible={visibleActivePeerColumns} setVisible={setVisibleActivePeerColumns} />
    if (activeTab === 'installed') return <ColumnsDropdown order={installedSaColumnOrder} labels={installedSaColumnLabels} visible={visibleInstalledSaColumns} setVisible={setVisibleInstalledSaColumns} />
    return null
  }

  return (
    <div
      className='flex h-full min-h-0 min-w-0 w-full flex-col gap-2 overflow-x-hidden'
      style={{ maxWidth: 'calc(100vw - var(--sidebar-width, 16rem) - 2rem)' }}
    >
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-lg font-semibold tracking-tight'>IPsec</h2>
        <div className='hidden'>
          <Label>ipsec-debug</Label>
        </div>
      </div>

      {error ? <div className='rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'>{error}</div> : null}

      <Card className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden text-xs'>
        <CardContent className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2 overflow-hidden px-4 pt-0'>
          <div className='flex min-w-0 flex-wrap items-center gap-2 pt-4'>
            <Tabs value={activeTab} onValueChange={switchTab}>
              <TabsList className='h-9 flex-wrap'>
                <TabsTrigger className='px-4 text-sm' value='phase1'>Phase 1</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='phase2'>Phase 2</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='peers'>Peers</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='identities'>Identities</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='policies'>Policies</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='active'>Active Peers</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='installed'>SAs</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {showConfigToolbar ? (
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' disabled={busy || !addEnabled} onClick={() => openCreate()}>
                <Plus />Add
              </Button>
              <Button size='sm' variant='destructive' disabled={busy || !deleteEnabled} onClick={() => void deleteSelected()}>
                Del
              </Button>
              {hasEnabledToggle ? (
                <>
                  <Button size='sm' variant='outline' disabled={busy || !enableToggleEnabled} onClick={() => void setSelectedEnabled(false)}>Disable</Button>
                  <Button size='sm' disabled={busy || !enableToggleEnabled} onClick={() => void setSelectedEnabled(true)}>Enable</Button>
                </>
              ) : null}
              {renderColumnsDropdown()}
            </div>
          ) : showActivePeersToolbar ? (
            <div className='flex flex-wrap gap-2'>
              <Button size='sm' variant='outline' disabled={busy || selectedIds.length === 0} onClick={() => void resetSelectedPeer()}>
                Reset peer
              </Button>
              {renderColumnsDropdown()}
            </div>
          ) : showInstalledSasToolbar ? (
            <div className='flex flex-wrap gap-2'>
              {renderColumnsDropdown()}
            </div>
          ) : null}

          {activeTab === 'policies' ? (
            <PoliciesTable
              rows={policies}
              selectedIds={selectedIds}
              selectRow={selectRow}
              openEdit={(item) => openEdit('policies', item)}
              visibleColumns={visiblePolicyColumns}
            />
          ) : activeTab === 'peers' ? (
            <PeersTable
              rows={peers}
              selectedIds={selectedIds}
              selectRow={selectRow}
              openEdit={(item) => openEdit('peers', item)}
              visibleColumns={visiblePeerColumns}
            />
          ) : activeTab === 'identities' ? (
            <IdentitiesTable
              rows={identities}
              selectedIds={selectedIds}
              selectRow={selectRow}
              openEdit={(item) => openEdit('identities', item)}
              visibleColumns={visibleIdentityColumns}
            />
          ) : activeTab === 'phase1' ? (
            <Phase1Table
              rows={phase1}
              selectedIds={selectedIds}
              selectRow={selectRow}
              openEdit={(item) => openEdit('phase1', item)}
              visibleColumns={visiblePhase1Columns}
            />
          ) : activeTab === 'phase2' ? (
            <Phase2Table
              rows={phase2}
              selectedIds={selectedIds}
              selectRow={selectRow}
              openEdit={(item) => openEdit('phase2', item)}
              visibleColumns={visiblePhase2Columns}
            />
          ) : activeTab === 'active' ? (
            <ActivePeersTable
              rows={active}
              selectedIds={selectedIds}
              selectRow={selectRow}
              visibleColumns={visibleActivePeerColumns}
            />
          ) : activeTab === 'installed' ? (
            <InstalledSasTable rows={installed} visibleColumns={visibleInstalledSaColumns} />
          ) : null}
        </CardContent>
      </Card>

      {editorOpen ? (
        <div className='pointer-events-none fixed inset-0 z-40'>
          <div
            className='pointer-events-auto absolute z-50 w-[680px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl'
            style={{ left: editorWinPos.x, top: editorWinPos.y }}
            role='dialog'
            aria-modal='true'
            aria-label={`${editorMode === 'edit' ? 'Edit' : 'Add'} IPsec ${editorLabels[editorTab]}`}
          >
            <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={onEditorDragStart}>
              <div className='flex items-center justify-between gap-3'>
                <span className='truncate'>{editorMode === 'edit' ? 'Edit' : 'Add'} IPsec {editorLabels[editorTab]}</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => setEditorOpen(false)}><X className='size-3.5' /></button>
              </div>
            </div>
            <form className='flex max-h-[78vh] min-h-0 flex-col overflow-hidden rounded-b-xl bg-background text-xs' onSubmit={(event) => void saveEditor(event)}>
              <div className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
                {editorTab === 'policies' ? (
                  <PolicyFormFields form={polForm} setForm={setPolForm} peers={peers} proposals={phase2} />
                ) : editorTab === 'peers' ? (
                  <PeerFormFields form={peerForm} setForm={setPeerForm} profiles={phase1} />
                ) : editorTab === 'identities' ? (
                  <IdentityFormFields form={idForm} setForm={setIdForm} peers={peers} peerLocked={editorMode === 'edit'} />
                ) : editorTab === 'phase1' ? (
                  <Phase1FormFields form={p1Form} setForm={setP1Form} />
                ) : (
                  <Phase2FormFields form={p2Form} setForm={setP2Form} />
                )}
              </div>
              <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
                {editorMode === 'edit' ? (
                  <Button type='button' variant='outline' disabled={copyEditorDisabled()} title={copyEditorTitle()} onClick={copyEditorItem}>
                    <Copy />Copy
                  </Button>
                ) : null}
                <Button type='button' variant='outline' onClick={() => setEditorOpen(false)}>Cancel</Button>
                <Button type='submit' disabled={busy}><Save />{editorMode === 'edit' ? 'Save' : 'Add'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function selectableRowClass(selected: boolean, disabled = false) {
  return `h-8 cursor-default select-none hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selected ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${disabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`
}

function PoliciesTable(props: {
  rows: IpsecPolicy[]
  selectedIds: string[]
  selectRow: (id: string, event: React.MouseEvent) => void
  openEdit: (item: IpsecPolicy) => void
  visibleColumns: Record<PolicyColumnKey, boolean>
}) {
  const [sort, setSort] = React.useState<SortState<PolicyColumnKey>>(emptySort<PolicyColumnKey>())
  const visibleKeys = policyColumnOrder.filter((key) => props.visibleColumns[key])
  const colSpan = Math.max(1, visibleKeys.length)
  const sortedRows = sortRows(
    props.rows,
    sort.key && visibleKeys.includes(sort.key) ? sort : emptySort<PolicyColumnKey>(),
    (row, key) => {      if (key === 'local_ts' || key === 'remote_ts') return row[key]
      return row[key]
    },
  )

  function renderPolicyCell(row: IpsecPolicy, key: PolicyColumnKey) {
    switch (key) {
      case 'name':
        return <TableCell className='font-medium'>{row.name}</TableCell>
      case 'peer':
        return <TableCell>{row.peer || '-'}</TableCell>
      case 'local_ts':
        return <TableCell title={joinCsv(row.local_ts)}>{joinCsv(row.local_ts) || '-'}</TableCell>
      case 'remote_ts':
        return <TableCell title={joinCsv(row.remote_ts)}>{joinCsv(row.remote_ts) || '-'}</TableCell>
      case 'proposal':
        return <TableCell>{row.proposal || '-'}</TableCell>
      case 'start_action':
        return <TableCell>{statusBadge(row.start_action)}</TableCell>
      case 'action':
      case 'level':
      case 'mode':
      case 'close_action':
      case 'dpd_action':
      case 'rekey_time':
      case 'life_time':
      case 'rand_time':
      case 'policies':
      case 'policies_fwd_out':
      case 'reqid':
      case 'priority':
      case 'interface':
      case 'mark_in':
      case 'mark_in_sa':
      case 'mark_out':
      case 'set_mark_in':
      case 'set_mark_out':
      case 'if_id_in':
      case 'if_id_out':
        return <TableCell className='font-mono text-[11px]'>{String(row[key] || '-')}</TableCell>
    }
  }

  return (
    <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
      <Table className='w-max min-w-full'>
        <TableHeader>
          <TableRow>
            {visibleKeys.map((key) => (
              <SortableHead key={key} sortKey={key} label={policyColumnLabels[key]} sort={sort} onSort={(next) => setSort((prev) => nextSortState(prev, next))} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.name}
              className={selectableRowClass(props.selectedIds.includes(row.name), row.enabled === false)}
              onClick={(event) => props.selectRow(row.name, event)}
              onDoubleClick={() => props.openEdit(row)}
            >
              {visibleKeys.map((key) => (
                <React.Fragment key={key}>{renderPolicyCell(row, key)}</React.Fragment>
              ))}
            </TableRow>
          ))}
          {!props.rows.length ? <EmptyRow colSpan={colSpan} text='No IPsec policies.' /> : null}
        </TableBody>
      </Table>
    </div>
  )
}

function PeersTable(props: {
  rows: IpsecPeer[]
  selectedIds: string[]
  selectRow: (id: string, event: React.MouseEvent) => void
  openEdit: (item: IpsecPeer) => void
  visibleColumns: Record<PeerColumnKey, boolean>
}) {
  const [sort, setSort] = React.useState<SortState<PeerColumnKey>>(emptySort<PeerColumnKey>())
  const visibleKeys = peerColumnOrder.filter((key) => props.visibleColumns[key])
  const effectiveSort = sort.key && visibleKeys.includes(sort.key) ? sort : emptySort<PeerColumnKey>()
  const sortedRows = sortRows(props.rows, effectiveSort, (row, key) => row[key])
  const onSort = (key: PeerColumnKey) => setSort((prev) => nextSortState(prev, key))
  const colSpan = Math.max(1, visibleKeys.length)

  function renderPeerCell(row: IpsecPeer, key: PeerColumnKey) {
    switch (key) {
      case 'name':
        return <TableCell className='font-medium'>{row.name}</TableCell>
      case 'local_addrs':
        return <TableCell title={joinCsv(row.local_addrs)}>{joinCsv(row.local_addrs) || '-'}</TableCell>
      case 'remote_addrs':
        return <TableCell title={joinCsv(row.remote_addrs)}>{joinCsv(row.remote_addrs) || '-'}</TableCell>
      case 'phase1_profile':
        return <TableCell>{row.phase1_profile || '-'}</TableCell>
      case 'ike_version':
        return <TableCell>{formatIkeVersion(row.ike_version)}</TableCell>
      case 'dpd':
      case 'nat_t':
      case 'send_initial_contact':
        return <TableCell>{statusBadge(row[key])}</TableCell>
      case 'mobike':
      case 'fragmentation':
      case 'dpd_delay':
      case 'dpd_timeout':
      case 'rekey_time':
      case 'reauth_time':
      case 'over_time':
      case 'rand_time':
      case 'keyingtries':
        return <TableCell className='font-mono text-[11px]'>{String(row[key] || '-')}</TableCell>
    }
  }

  return (
    <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
      <Table className='w-max min-w-full'>
        <TableHeader>
          <TableRow>
            {visibleKeys.map((key) => (
              <SortableHead key={key} sortKey={key} label={peerColumnLabels[key]} sort={sort} onSort={onSort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.name}
              className={selectableRowClass(props.selectedIds.includes(row.name), row.enabled === false)}
              onClick={(event) => props.selectRow(row.name, event)}
              onDoubleClick={() => props.openEdit(row)}
            >
              {visibleKeys.map((key) => (
                <React.Fragment key={key}>{renderPeerCell(row, key)}</React.Fragment>
              ))}
            </TableRow>
          ))}
          {!props.rows.length ? <EmptyRow colSpan={colSpan} text='No IPsec peers.' /> : null}
        </TableBody>
      </Table>
    </div>
  )
}

function IdentitiesTable(props: {
  rows: IpsecIdentity[]
  selectedIds: string[]
  selectRow: (id: string, event: React.MouseEvent) => void
  openEdit: (item: IpsecIdentity) => void
  visibleColumns: Record<IdentityColumnKey, boolean>
}) {
  const [sort, setSort] = React.useState<SortState<IdentityColumnKey>>(emptySort<IdentityColumnKey>())
  const visibleKeys = identityColumnOrder.filter((key) => props.visibleColumns[key])
  const effectiveSort = sort.key && visibleKeys.includes(sort.key) ? sort : emptySort<IdentityColumnKey>()
  const sortedRows = sortRows(props.rows, effectiveSort, (row, key) => row[key])
  const onSort = (key: IdentityColumnKey) => setSort((prev) => nextSortState(prev, key))
  const colSpan = Math.max(1, visibleKeys.length)

  function renderIdentityCell(row: IpsecIdentity, key: IdentityColumnKey) {
    switch (key) {
      case 'peer':
        return <TableCell className='font-medium'>{row.peer}</TableCell>
      case 'auth_method':
        return <TableCell>{row.auth_method}</TableCell>
      case 'local_id':
        return <TableCell>{row.local_id || <span className='text-muted-foreground'>auto</span>}</TableCell>
      case 'remote_id':
        return <TableCell>{row.remote_id || <span className='text-muted-foreground'>auto</span>}</TableCell>
      case 'has_psk':
        return <TableCell>{statusBadge(row.has_psk ? 'psk set' : 'missing')}</TableCell>
    }
  }

  return (
    <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
      <Table className='w-max min-w-full'>
        <TableHeader>
          <TableRow>
            {visibleKeys.map((key) => (
              <SortableHead key={key} sortKey={key} label={identityColumnLabels[key]} sort={sort} onSort={onSort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.peer}
              className={selectableRowClass(props.selectedIds.includes(row.peer), row.enabled === false)}
              onClick={(event) => props.selectRow(row.peer, event)}
              onDoubleClick={() => props.openEdit(row)}
            >
              {visibleKeys.map((key) => (
                <React.Fragment key={key}>{renderIdentityCell(row, key)}</React.Fragment>
              ))}
            </TableRow>
          ))}
          {!props.rows.length ? <EmptyRow colSpan={colSpan} text='No IPsec identities.' /> : null}
        </TableBody>
      </Table>
    </div>
  )
}

function Phase1Table(props: {
  rows: IpsecPhase1Profile[]
  selectedIds: string[]
  selectRow: (id: string, event: React.MouseEvent) => void
  openEdit: (item: IpsecPhase1Profile) => void
  visibleColumns: Record<Phase1ColumnKey, boolean>
}) {
  const [sort, setSort] = React.useState<SortState<Phase1ColumnKey>>(emptySort<Phase1ColumnKey>())
  const visibleKeys = phase1ColumnOrder.filter((key) => props.visibleColumns[key])
  const effectiveSort = sort.key && visibleKeys.includes(sort.key) ? sort : emptySort<Phase1ColumnKey>()
  const sortedRows = sortRows(props.rows, effectiveSort, (row, key) => row[key])
  const onSort = (key: Phase1ColumnKey) => setSort((prev) => nextSortState(prev, key))
  const colSpan = Math.max(1, visibleKeys.length)

  function renderPhase1Cell(row: IpsecPhase1Profile, key: Phase1ColumnKey) {
    switch (key) {
      case 'name':
        return <TableCell className='font-medium'>{row.name}</TableCell>
      case 'encryption':
        return <TableCell>{formatCryptoAlgorithm(row.encryption)}</TableCell>
      case 'hash':
        return <TableCell>{formatCryptoAlgorithm(row.hash)}</TableCell>
      case 'prf':
        return <TableCell>{formatCryptoAlgorithm(row.prf || 'auto')}</TableCell>
      case 'dh_group':
        return <TableCell>{formatDhGroup(row.dh_group)}</TableCell>
    }
  }

  return (
    <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
      <Table className='w-max min-w-full'>
        <TableHeader>
          <TableRow>
            {visibleKeys.map((key) => (
              <SortableHead key={key} sortKey={key} label={phase1ColumnLabels[key]} sort={sort} onSort={onSort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.name}
              className={selectableRowClass(props.selectedIds.includes(row.name), row.enabled === false)}
              onClick={(event) => props.selectRow(row.name, event)}
              onDoubleClick={() => props.openEdit(row)}
            >
              {visibleKeys.map((key) => (
                <React.Fragment key={key}>{renderPhase1Cell(row, key)}</React.Fragment>
              ))}
            </TableRow>
          ))}
          {!props.rows.length ? <EmptyRow colSpan={colSpan} text='No Phase 1 profiles.' /> : null}
        </TableBody>
      </Table>
    </div>
  )
}

function Phase2Table(props: {
  rows: IpsecPhase2Proposal[]
  selectedIds: string[]
  selectRow: (id: string, event: React.MouseEvent) => void
  openEdit: (item: IpsecPhase2Proposal) => void
  visibleColumns: Record<Phase2ColumnKey, boolean>
}) {
  const [sort, setSort] = React.useState<SortState<Phase2ColumnKey>>(emptySort<Phase2ColumnKey>())
  const visibleKeys = phase2ColumnOrder.filter((key) => props.visibleColumns[key])
  const effectiveSort = sort.key && visibleKeys.includes(sort.key) ? sort : emptySort<Phase2ColumnKey>()
  const sortedRows = sortRows(props.rows, effectiveSort, (row, key) => row[key])
  const onSort = (key: Phase2ColumnKey) => setSort((prev) => nextSortState(prev, key))
  const colSpan = Math.max(1, visibleKeys.length)

  function renderPhase2Cell(row: IpsecPhase2Proposal, key: Phase2ColumnKey) {
    switch (key) {
      case 'name':
        return <TableCell className='font-medium'>{row.name}</TableCell>
      case 'encryption':
        return <TableCell>{formatCryptoAlgorithm(row.encryption)}</TableCell>
      case 'auth':
        return <TableCell>{formatCryptoAlgorithm(row.auth)}</TableCell>
      case 'pfs_group':
        return <TableCell>{formatDhGroup(row.pfs_group)}</TableCell>
      case 'esn':
        return <TableCell>{row.esn || 'default'}</TableCell>
    }
  }

  return (
    <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
      <Table className='w-max min-w-full'>
        <TableHeader>
          <TableRow>
            {visibleKeys.map((key) => (
              <SortableHead key={key} sortKey={key} label={phase2ColumnLabels[key]} sort={sort} onSort={onSort} />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.name}
              className={selectableRowClass(props.selectedIds.includes(row.name), row.enabled === false)}
              onClick={(event) => props.selectRow(row.name, event)}
              onDoubleClick={() => props.openEdit(row)}
            >
              {visibleKeys.map((key) => (
                <React.Fragment key={key}>{renderPhase2Cell(row, key)}</React.Fragment>
              ))}
            </TableRow>
          ))}
          {!props.rows.length ? <EmptyRow colSpan={colSpan} text='No Phase 2 proposals.' /> : null}
        </TableBody>
      </Table>
    </div>
  )
}

function ActivePeersTable(props: {
  rows: IpsecActivePeer[]
  selectedIds: string[]
  selectRow: (id: string, event: React.MouseEvent) => void
  visibleColumns: Record<ActivePeerColumnKey, boolean>
}) {
  const [sort, setSort] = React.useState<SortState<ActivePeerColumnKey>>(emptySort<ActivePeerColumnKey>())
  const visibleKeys = activePeerColumnOrder.filter((key) => props.visibleColumns[key])
  const effectiveSort = sort.key && visibleKeys.includes(sort.key) ? sort : emptySort<ActivePeerColumnKey>()
  const sortedRows = sortRows(props.rows, effectiveSort, (row, key) => {
    if (key === 'id') return row.id || row.peer
    return row[key]
  })
  const onSort = (key: ActivePeerColumnKey) => setSort((prev) => nextSortState(prev, key))
  const colSpan = Math.max(1, visibleKeys.length)

  function renderActivePeerCell(row: IpsecActivePeer, key: ActivePeerColumnKey, idx: number) {
    const id = row.id || row.peer || `peer-${idx}`
    switch (key) {
      case 'id':
        return <TableCell className='font-medium'>{id}</TableCell>
      case 'state':
        return <TableCell>{statusBadge(row.state)}</TableCell>
      case 'local_address':
      case 'local_port':
      case 'remote_address':
      case 'remote_port':
      case 'dynamic_address':
      case 'side':
        return <TableCell>{row[key] || '-'}</TableCell>
      case 'uptime':
      case 'last_seen':
        return <TableCell className='font-mono text-[11px]'>{row[key] || '-'}</TableCell>
      case 'ph2_total':
      case 'tx_packets':
      case 'rx_packets':
        return <TableCell>{formatCount(row[key])}</TableCell>
      case 'tx_bytes':
      case 'rx_bytes':
        return <TableCell>{formatBytes(row[key])}</TableCell>
    }
  }

  return (
    <div className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2 overflow-hidden'>
      <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
        <Table className='w-max min-w-full'>
          <TableHeader>
            <TableRow>
              {visibleKeys.map((key) => (
                <SortableHead key={key} sortKey={key} label={activePeerColumnLabels[key]} sort={sort} onSort={onSort} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, idx) => {
              const id = row.id || row.peer || `peer-${idx}`
              return (
                <TableRow
                  key={`${id}-${idx}`}
                  className={selectableRowClass(props.selectedIds.includes(id))}
                  onClick={(event) => props.selectRow(id, event)}
                >
                  {visibleKeys.map((key) => (
                    <React.Fragment key={key}>{renderActivePeerCell(row, key, idx)}</React.Fragment>
                  ))}
                </TableRow>
              )
            })}
            {!props.rows.length ? <EmptyRow colSpan={colSpan} text='No active peers from VICI.' /> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function InstalledSasTable(props: { rows: IpsecInstalledSa[]; visibleColumns: Record<InstalledSaColumnKey, boolean> }) {
  const [sort, setSort] = React.useState<SortState<InstalledSaColumnKey>>(emptySort<InstalledSaColumnKey>())
  const visibleKeys = installedSaColumnOrder.filter((key) => props.visibleColumns[key])
  const effectiveSort = sort.key && visibleKeys.includes(sort.key) ? sort : emptySort<InstalledSaColumnKey>()
  const sortedRows = sortRows(props.rows, effectiveSort, (row, key) => row[key])
  const onSort = (key: InstalledSaColumnKey) => setSort((prev) => nextSortState(prev, key))
  const colSpan = Math.max(1, visibleKeys.length)

  function renderInstalledSaCell(row: IpsecInstalledSa, key: InstalledSaColumnKey) {
    switch (key) {
      case 'child_sa':
        return <TableCell className='font-medium'>{row.child_sa || '-'}</TableCell>
      case 'state':
        return <TableCell>{statusBadge(row.state)}</TableCell>
      case 'reqid':
      case 'mode':
      case 'protocol':
      case 'esp_proposal':
        return <TableCell>{row[key] || '-'}</TableCell>
      case 'spi_in':
      case 'spi_out':
        return <TableCell className='font-mono text-[11px]' title={row[key] || ''}>{truncateMiddle(row[key])}</TableCell>
      case 'bytes_in':
      case 'bytes_out':
        return <TableCell>{formatBytes(row[key])}</TableCell>
      case 'packets_in':
      case 'packets_out':
        return <TableCell>{formatCount(row[key])}</TableCell>
      case 'install_time':
      case 'rekey_time':
      case 'life_time':
      case 'last_seen':
        return <TableCell className='font-mono text-[11px]'>{row[key] || '-'}</TableCell>
      case 'local_ts':
      case 'remote_ts':
        return <TableCell title={joinCsv(row[key])}>{joinCsv(row[key]) || '-'}</TableCell>
    }
  }

  return (
    <div className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2 overflow-hidden'>
      <div className='min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-scroll overflow-y-auto rounded-xl border [scrollbar-gutter:stable]'>
        <Table className='w-max min-w-full'>
          <TableHeader>
            <TableRow>
              {visibleKeys.map((key) => (
                <SortableHead key={key} sortKey={key} label={installedSaColumnLabels[key]} sort={sort} onSort={onSort} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, idx) => (
              <TableRow key={`${row.child_sa || 'sa'}-${idx}`} className='h-8'>
                {visibleKeys.map((key) => (
                  <React.Fragment key={key}>{renderInstalledSaCell(row, key)}</React.Fragment>
                ))}
              </TableRow>
            ))}
            {!props.rows.length ? <EmptyRow colSpan={colSpan} text='No installed CHILD_SAs from VICI.' /> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function PolicyFormFields(props: {
  form: PolicyForm
  setForm: React.Dispatch<React.SetStateAction<PolicyForm>>
  peers: IpsecPeer[]
  proposals: IpsecPhase2Proposal[]
}) {
  const lifeTimeEnabled = props.form.life_time.trim() !== ''
  const randTimeEnabled = props.form.rand_time.trim() !== ''
  const effectiveSelectorProtocol = resolvePolicySelectorProtocol(props.form)
  const clearSelectorPorts = () => props.setForm((s) => ({ ...s, local_ts_port: '', remote_ts_port: '' }))
  const enableLifeTime = () => props.setForm((s) => ({ ...s, life_time: s.life_time.trim() || '70m' }))
  const disableLifeTime = () => props.setForm((s) => ({ ...s, life_time: '' }))
  const enableRandTime = () => props.setForm((s) => ({ ...s, rand_time: s.rand_time.trim() || '10m' }))
  const disableRandTime = () => props.setForm((s) => ({ ...s, rand_time: '' }))

  return (
    <div className='space-y-3'>
      <FormSection title='Policy / CHILD SA' description='Traffic selectors and ESP proposal that strongSwan loads as a VICI child.' plain alignHeaderWithFields>
        <Tabs defaultValue='general' className='space-y-3'>
          <TabsList className='h-9 w-fit'>
            <TabsTrigger className='px-4 text-xs' value='general'>General</TabsTrigger>
            <TabsTrigger className='px-4 text-xs' value='action'>Action</TabsTrigger>
            <TabsTrigger className='px-4 text-xs' value='advanced'>Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value='general' className='mt-0 space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
            <CompactRow label='Enabled'>
              <EnabledCheckbox checked={props.form.enabled} onChange={(enabled) => props.setForm((s) => ({ ...s, enabled }))} ariaLabel='Toggle IPsec policy enabled state' />
            </CompactRow>

            <CompactRow label='Peer' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Peer connection that owns this CHILD_SA.</div>
              <div className='max-w-xl'>
                <NamedSelect
                  value={props.form.peer}
                  options={props.peers.map((x) => ({ value: x.name, label: x.name }))}
                  placeholder='Create peer first'
                  onChange={(peer) => props.setForm((s) => ({ ...s, peer }))}
                />
              </div>
            </CompactRow>

            <TrafficSelectorEditor
              value={props.form.local_ts}
              protocol={effectiveSelectorProtocol}
              port={props.form.local_ts_port}
              onChange={(local_ts) => props.setForm((s) => ({ ...s, local_ts }))}
              onPortChange={(local_ts_port) => props.setForm((s) => ({ ...s, local_ts_port }))}
              addressLabel='Src. Address'
              portLabel='Src. Port'
              portHelp='Optional source TCP/UDP port or range. Rare for normal site-to-site traffic; leave empty unless the sender must use a fixed source port.'
              addressPlaceholder='10.11.12.0/24'
            />

            <PolicyProtocolEditor
              protocol={props.form.ts_protocol}
              customProtocol={props.form.ts_protocol_custom}
              onProtocolChange={(ts_protocol) => props.setForm((s) => ({ ...s, ts_protocol }))}
              onCustomProtocolChange={(ts_protocol_custom) => props.setForm((s) => ({ ...s, ts_protocol_custom }))}
              onDisablePorts={clearSelectorPorts}
            />

            <TrafficSelectorEditor
              value={props.form.remote_ts}
              protocol={effectiveSelectorProtocol}
              port={props.form.remote_ts_port}
              onChange={(remote_ts) => props.setForm((s) => ({ ...s, remote_ts }))}
              onPortChange={(remote_ts_port) => props.setForm((s) => ({ ...s, remote_ts_port }))}
              addressLabel='Dst. Address'
              portLabel='Dst. Port'
              portHelp='Optional destination TCP/UDP service port or range, for example tcp/443 or udp/12345. This does not change IKE UDP 500/4500.'
              addressPlaceholder='10.11.11.0/24'
            />

            <CompactRow label='Phase 2 proposal' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>ESP proposal profile loaded as child esp_proposals.</div>
              <div className='max-w-xl'>
                <NamedSelect
                  value={props.form.proposal}
                  options={props.proposals.map((x) => ({ value: x.name, label: x.name }))}
                  placeholder='Create Phase 2 proposal first'
                  onChange={(proposal) => props.setForm((s) => ({ ...s, proposal }))}
                />
              </div>
            </CompactRow>
          </TabsContent>

          <TabsContent value='action' className='mt-0 space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
            <CompactRow label='Start action' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>When to start this CHILD_SA: start = bring the CHILD_SA up immediately, trap = wait for matching traffic, none = load only.</div>
              <Select value={props.form.start_action} onValueChange={(start_action) => props.setForm((s) => ({ ...s, start_action: start_action as IpsecPolicy['start_action'] }))}>
                <SelectTrigger className='h-7 max-w-xl text-xs'><SelectValue /></SelectTrigger>
                <SelectContent>
                  {startActionOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CompactRow>

            <CompactRow label='Close action' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Close action after the remote peer closes this CHILD_SA: none = do nothing (VICI clear), trap = install an on-demand trap (VICI hold), start = recreate immediately (VICI restart).</div>
              <div className='max-w-xl'>
                <OptionSelect value={props.form.close_action} options={closeActionOptions} onChange={(close_action) => props.setForm((s) => ({ ...s, close_action: close_action as IpsecPolicy['close_action'] }))} />
              </div>
            </CompactRow>

            <CompactRow label='DPD action' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Action when DPD declares the IKE peer dead for this CHILD_SA: clear = remove the CHILD_SA, trap = install an on-demand trap (VICI hold), restart = recreate it immediately.</div>
              <div className='max-w-xl'>
                <OptionSelect value={props.form.dpd_action} options={dpdActionOptions} onChange={(dpd_action) => props.setForm((s) => ({ ...s, dpd_action: dpd_action as IpsecPolicy['dpd_action'] }))} />
              </div>
            </CompactRow>

            <CompactRow label='Mode' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>CHILD_SA mode: tunnel = normal site-to-site subnet policy; transport = endpoint/host policy without an outer tunnel header; pass/drop = local shunt policies that bypass or block matching traffic. VICI accepts beet, but the live MikroTik test did not establish.</div>
              <div className='max-w-xl'>
                <OptionSelect value={props.form.mode} options={childModeOptions} onChange={(mode) => props.setForm((s) => ({ ...s, mode: mode as IpsecPolicy['mode'] }))} />
              </div>
            </CompactRow>

            <CompactRow label='CHILD rekey time' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>CHILD_SA / Phase 2 rekey timer. Keep it aligned with the peer Phase 2 lifetime; examples: 10m, 1h, 15:00:00.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.rekey_time} onChange={(e) => props.setForm((s) => ({ ...s, rekey_time: e.target.value }))} placeholder='1h' />
            </CompactRow>

            <CompactRow label='CHILD life time' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Hard CHILD_SA lifetime. Auto lets strongSwan derive it from the rekey timer.</div>
              <IpsecToggleLine
                enabled={lifeTimeEnabled}
                inactiveHint='Auto'
                onToggle={lifeTimeEnabled ? disableLifeTime : enableLifeTime}
              >
                <Input className='h-7 text-xs' value={lifeTimeEnabled ? props.form.life_time : '70m'} onChange={(e) => props.setForm((s) => ({ ...s, life_time: e.target.value }))} placeholder='70m' />
              </IpsecToggleLine>
            </CompactRow>

            <CompactRow label='CHILD rand time' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Randomization window subtracted from CHILD_SA rekey/lifetime timers. Leave auto for normal site-to-site tunnels.</div>
              <IpsecToggleLine
                enabled={randTimeEnabled}
                inactiveHint='Auto'
                onToggle={randTimeEnabled ? disableRandTime : enableRandTime}
              >
                <Input className='h-7 text-xs' value={randTimeEnabled ? props.form.rand_time : '10m'} onChange={(e) => props.setForm((s) => ({ ...s, rand_time: e.target.value }))} placeholder='10m' />
              </IpsecToggleLine>
            </CompactRow>
          </TabsContent>

          <TabsContent value='advanced' className='mt-0 space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
            <CompactRow label='Install policies' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Whether strongSwan installs kernel IPsec policies for this child.</div>
              <div className='max-w-xl'>
                <OptionSelect value={props.form.policies} options={policyInstallOptions} onChange={(policies) => props.setForm((s) => ({ ...s, policies: policies as IpsecPolicy['policies'] }))} />
              </div>
            </CompactRow>

            <CompactRow label='Forward out policy' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional forward-output policy install switch for routed/XFRM scenarios.</div>
              <div className='max-w-xl'>
                <OptionSelect value={props.form.policies_fwd_out} options={policyInstallOptions} onChange={(policies_fwd_out) => props.setForm((s) => ({ ...s, policies_fwd_out: policies_fwd_out as IpsecPolicy['policies_fwd_out'] }))} />
              </div>
            </CompactRow>

            <CompactRow label='ReqID' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional request ID used to bind policies and SAs. Empty means automatic.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.reqid} onChange={(e) => props.setForm((s) => ({ ...s, reqid: e.target.value }))} placeholder='dynamic' />
            </CompactRow>

            <CompactRow label='Priority' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional kernel policy priority. Empty means strongSwan default.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.priority} onChange={(e) => props.setForm((s) => ({ ...s, priority: e.target.value }))} placeholder='dynamic' />
            </CompactRow>

            <CompactRow label='Interface' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional outbound interface constraint for installed policies.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.interface} onChange={(e) => props.setForm((s) => ({ ...s, interface: e.target.value }))} placeholder='eth0' />
            </CompactRow>

            <CompactRow label='Mark in' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional mark selector for inbound policy matching.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.mark_in} onChange={(e) => props.setForm((s) => ({ ...s, mark_in: e.target.value }))} placeholder='0x1/0xffffffff, %unique' />
            </CompactRow>

            <CompactRow label='Mark in SA' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Copy inbound mark handling to SA where supported.</div>
              <div className='max-w-xl'>
                <OptionSelect value={props.form.mark_in_sa} options={policyInstallOptions} onChange={(mark_in_sa) => props.setForm((s) => ({ ...s, mark_in_sa: mark_in_sa as IpsecPolicy['mark_in_sa'] }))} />
              </div>
            </CompactRow>

            <CompactRow label='Mark out' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional mark selector for outbound policy matching.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.mark_out} onChange={(e) => props.setForm((s) => ({ ...s, mark_out: e.target.value }))} placeholder='0x2/0xffffffff, %unique' />
            </CompactRow>

            <CompactRow label='Set mark in' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional packet mark set on inbound decapsulated traffic.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.set_mark_in} onChange={(e) => props.setForm((s) => ({ ...s, set_mark_in: e.target.value }))} placeholder='%same, 0x3/0xffffffff' />
            </CompactRow>

            <CompactRow label='Set mark out' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional packet mark set on outbound encapsulated traffic.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.set_mark_out} onChange={(e) => props.setForm((s) => ({ ...s, set_mark_out: e.target.value }))} placeholder='%same, 0x4/0xffffffff' />
            </CompactRow>

            <CompactRow label='IF ID in' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional inbound XFRM interface ID.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.if_id_in} onChange={(e) => props.setForm((s) => ({ ...s, if_id_in: e.target.value }))} placeholder='%unique, 1' />
            </CompactRow>

            <CompactRow label='IF ID out' align='start'>
              <div className='mb-1 text-[11px] text-muted-foreground'>Optional outbound XFRM interface ID.</div>
              <Input className='h-7 max-w-xl text-xs' value={props.form.if_id_out} onChange={(e) => props.setForm((s) => ({ ...s, if_id_out: e.target.value }))} placeholder='%unique, 1' />
            </CompactRow>
          </TabsContent>
        </Tabs>
      </FormSection>
    </div>
  )
}

function PeerFormFields(props: {
  form: PeerForm
  setForm: React.Dispatch<React.SetStateAction<PeerForm>>
  profiles: IpsecPhase1Profile[]
}) {
  const isIkev1 = props.form.ike_version === '1'
  const overTimeEnabled = props.form.over_time.trim() !== ''
  const randTimeEnabled = props.form.rand_time.trim() !== ''
  const reauthTimeValue = props.form.reauth_time.trim().toLowerCase()
  const reauthTimeEnabled = reauthTimeValue !== '' && reauthTimeValue !== '0' && reauthTimeValue !== '0s'
  const enableReauthTime = () => {
    props.setForm((s) => ({ ...s, reauth_time: s.reauth_time.trim() && s.reauth_time.trim() !== '0' && s.reauth_time.trim().toLowerCase() !== '0s' ? s.reauth_time : '7d' }))
  }
  const disableReauthTime = () => {
    props.setForm((s) => ({ ...s, reauth_time: '0s' }))
  }
  const updateReauthTime = (value: string) => {
    props.setForm((s) => ({ ...s, reauth_time: value.trim() ? value : '7d' }))
  }
  const enableOverTime = () => {
    props.setForm((s) => ({ ...s, over_time: s.over_time.trim() || '1h' }))
  }
  const disableOverTime = () => {
    props.setForm((s) => ({ ...s, over_time: '' }))
  }
  const updateOverTime = (value: string) => {
    props.setForm((s) => ({ ...s, over_time: value.trim() ? value : '1h' }))
  }
  const enableRandTime = () => {
    props.setForm((s) => ({ ...s, rand_time: s.rand_time.trim() || '30m' }))
  }
  const disableRandTime = () => {
    props.setForm((s) => ({ ...s, rand_time: '' }))
  }
  const updateRandTime = (value: string) => {
    props.setForm((s) => ({ ...s, rand_time: value.trim() ? value : '30m' }))
  }
  const keyingTriesValue = props.form.keyingtries.trim()
  const keyingTriesLimited = keyingTriesValue !== '' && keyingTriesValue !== '0'
  const enableKeyingTriesLimit = () => {
    props.setForm((s) => ({ ...s, keyingtries: s.keyingtries.trim() && s.keyingtries.trim() !== '0' ? s.keyingtries : '1' }))
  }
  const disableKeyingTriesLimit = () => {
    props.setForm((s) => ({ ...s, keyingtries: '0' }))
  }
  const updateKeyingTriesLimit = (value: string) => {
    const digits = value.replace(/\D/g, '')
    props.setForm((s) => ({ ...s, keyingtries: digits && digits !== '0' ? digits : '1' }))
  }
  return (
    <div className='space-y-3'>
      <FormSection title='VICI connection' description='Peer connection fields loaded through VICI.' plain alignHeaderWithFields>
        <div className='space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
          <CompactRow label='Enabled'>
            <EnabledCheckbox checked={props.form.enabled} onChange={(enabled) => props.setForm((s) => ({ ...s, enabled }))} ariaLabel='Toggle IPsec peer enabled state' />
          </CompactRow>

          <CompactRow label='Name'>
            <Input className='h-7 max-w-xl text-xs' value={props.form.name} onChange={(e) => props.setForm((s) => ({ ...s, name: e.target.value }))} />
          </CompactRow>

          <CompactRow label='Exchange mode' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Select the IKE exchange family loaded through VICI: IKEv1 for main mode, IKEv2 for ike2.</div>
            <Select
              value={props.form.ike_version}
              onValueChange={(ike_version) => props.setForm((s) => ({
                ...s,
                ike_version: ike_version as PeerForm['ike_version'],
                mobike: ike_version === '1' ? 'no' : s.mobike,
              }))}
            >
              <SelectTrigger className='h-7 max-w-xl text-xs'><SelectValue /></SelectTrigger>
              <SelectContent>
                {ikeVersionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CompactRow>

          <CompactRow label='Local address' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Local IKE endpoint address list accepted by strongSwan VICI.</div>
            <Input className='h-7 max-w-xl text-xs' value={props.form.local_addrs} onChange={(e) => props.setForm((s) => ({ ...s, local_addrs: e.target.value }))} placeholder='%any, 10.0.0.1' />
          </CompactRow>

          <CompactRow label='Remote address' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Remote peer address or FQDN used for IKE negotiation.</div>
            <Input className='h-7 max-w-xl text-xs' value={props.form.remote_addrs} onChange={(e) => props.setForm((s) => ({ ...s, remote_addrs: e.target.value }))} placeholder='203.0.113.1, vpn.example.com' />
          </CompactRow>

          <CompactRow label='Phase 1 profile' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Select the IKE proposal profile that will be loaded as VICI connection proposals.</div>
            <div className='max-w-xl'>
              <NamedSelect
                value={props.form.phase1_profile}
                options={props.profiles.map((profile) => ({ value: profile.name, label: profile.name }))}
                placeholder='Create Phase 1 profile first'
                onChange={(phase1_profile) => props.setForm((s) => ({ ...s, phase1_profile }))}
              />
            </div>
          </CompactRow>

          <CompactRow label='MOBIKE' align='start'>
            {isIkev1 ? (
              <div className='mb-1 text-[11px] text-muted-foreground'>
                MOBIKE is an IKEv2 feature; IKEv1/main mode keeps this disabled.
              </div>
            ) : null}
            <div className='max-w-xl'>
              <OptionSelect
                value={isIkev1 ? 'no' : props.form.mobike}
                options={yesNoOptions}
                disabled={isIkev1}
                onChange={(mobike) => props.setForm((s) => ({ ...s, mobike }))}
              />
            </div>
          </CompactRow>

          <CompactRow label='Fragmentation' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>
              Local strongSwan IKE fragmentation setting loaded through VICI; MikroTik has no matching peer field.
            </div>
            <div className='max-w-xl'>
              <OptionSelect value={props.form.fragmentation} options={fragmentationOptions} onChange={(fragmentation) => props.setForm((s) => ({ ...s, fragmentation }))} />
            </div>
          </CompactRow>
        </div>
      </FormSection>

      <FormSection title='IKE SA flags and timers' description='Connection-level IKE_SA flags and timers mapped into the loaded VICI connection where supported.' plain alignHeaderWithFields>
        <div className='space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
          <CompactRow label='NAT-T' align='start'>
            <div className='grid max-w-xl grid-cols-[24px_minmax(0,1fr)] items-start gap-2'>
              <div className='pt-0.5'>
                <EnabledCheckbox checked={props.form.nat_t} onChange={(nat_t) => props.setForm((s) => ({ ...s, nat_t }))} ariaLabel='Toggle IPsec peer NAT-T' />
              </div>
              <div className='text-[11px] text-muted-foreground'>
                Maps to strongSwan/VICI UDP encapsulation. On the live MikroTik peer this switched IKE/ESP from UDP 500 to UDP 4500 and CHILD_SA to TUNNEL-in-UDP.
              </div>
            </div>
          </CompactRow>

          <CompactRow label='Initial contact' align='start'>
            <div className='grid max-w-xl grid-cols-[24px_minmax(0,1fr)] items-start gap-2'>
              <div className='pt-0.5'>
                <EnabledCheckbox checked={props.form.send_initial_contact} onChange={(send_initial_contact) => props.setForm((s) => ({ ...s, send_initial_contact }))} ariaLabel='Toggle IPsec peer initial contact' />
              </div>
              <div className='text-[11px] text-muted-foreground'>
                Maps to loaded VICI duplicate-IKE_SA handling: enabled is UNIQUE_REPLACE, disabled is UNIQUE_NEVER. Live MikroTik reconnect stays compatible in both modes.
              </div>
            </div>
          </CompactRow>

          <CompactRow label='DPD' align='start'>
            <div className='max-w-xl space-y-2'>
              <div className='flex items-center gap-2'>
                <EnabledCheckbox checked={props.form.dpd} onChange={(dpd) => props.setForm((s) => ({ ...s, dpd }))} ariaLabel='Toggle IPsec peer DPD' />
                <span className='text-[11px] text-muted-foreground'>Enable dead peer detection; timers below are used only when DPD is enabled.</span>
              </div>
              <div className={`grid gap-2 sm:grid-cols-2 ${props.form.dpd ? '' : 'opacity-50'}`}>
                <div className='space-y-1'>
                  <Label className='text-[11px] text-muted-foreground'>DPD delay</Label>
                  <Input className='h-7 text-xs' value={props.form.dpd_delay} onChange={(e) => props.setForm((s) => ({ ...s, dpd_delay: e.target.value }))} placeholder='30s' disabled={!props.form.dpd} />
                </div>
                <div className='space-y-1'>
                  <Label className='text-[11px] text-muted-foreground'>DPD timeout</Label>
                  <Input className='h-7 text-xs' value={props.form.dpd_timeout} onChange={(e) => props.setForm((s) => ({ ...s, dpd_timeout: e.target.value }))} placeholder='120s' disabled={!props.form.dpd} />
                </div>
              </div>
            </div>
          </CompactRow>

          <CompactRow label='IKE rekey time' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Connection-level IKE_SA / Phase 1 rekey timer loaded through VICI. Keep it aligned with the peer Phase 1 lifetime; examples: 10m, 1d, 15:00:00.</div>
            <Input className='h-7 max-w-xl text-xs' value={props.form.rekey_time} onChange={(e) => props.setForm((s) => ({ ...s, rekey_time: e.target.value }))} placeholder='1d' />
          </CompactRow>

          <CompactRow label='IKE reauth time' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Full IKE_SA reauthentication timer loaded through VICI. Keep disabled for stable PSK site-to-site tunnels; if enabled, use a long interval such as 7d for periodic credential re-check.</div>
            <IpsecToggleLine
              enabled={reauthTimeEnabled}
              inactiveHint='Disabled (0s)'
              onToggle={reauthTimeEnabled ? disableReauthTime : enableReauthTime}
            >
              <Input
                className='h-7 text-xs'
                value={reauthTimeEnabled ? props.form.reauth_time : '7d'}
                onChange={(e) => updateReauthTime(e.target.value)}
                placeholder='7d'
              />
            </IpsecToggleLine>
          </CompactRow>

          <CompactRow label='IKE over time' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Automatic grace window after IKE rekey/reauth before the old IKE_SA expires. Leave auto unless debugging timer negotiation.</div>
            <IpsecToggleLine
              enabled={overTimeEnabled}
              inactiveHint='Auto'
              onToggle={overTimeEnabled ? disableOverTime : enableOverTime}
            >
              <Input
                className='h-7 text-xs'
                value={overTimeEnabled ? props.form.over_time : '1h'}
                onChange={(e) => updateOverTime(e.target.value)}
                placeholder='1h'
              />
            </IpsecToggleLine>
          </CompactRow>

          <CompactRow label='IKE rand time' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Automatic randomization window subtracted from rekey/reauth timers to avoid simultaneous rekey. Leave auto for normal site-to-site tunnels.</div>
            <IpsecToggleLine
              enabled={randTimeEnabled}
              inactiveHint='Auto'
              onToggle={randTimeEnabled ? disableRandTime : enableRandTime}
            >
              <Input
                className='h-7 text-xs'
                value={randTimeEnabled ? props.form.rand_time : '30m'}
                onChange={(e) => updateRandTime(e.target.value)}
                placeholder='30m'
              />
            </IpsecToggleLine>
          </CompactRow>

          <CompactRow label='Keying tries' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>IKE_SA setup retry count. Use 0 for unlimited retries; useful for always-on site-to-site tunnels.</div>
            <IpsecToggleLine
              enabled={keyingTriesLimited}
              inactiveHint='Unlimited retries (0)'
              onToggle={keyingTriesLimited ? disableKeyingTriesLimit : enableKeyingTriesLimit}
            >
              <Input
                className='h-7 text-xs'
                inputMode='numeric'
                value={keyingTriesLimited ? props.form.keyingtries : '1'}
                onChange={(e) => updateKeyingTriesLimit(e.target.value)}
                placeholder='1'
              />
            </IpsecToggleLine>
          </CompactRow>

        </div>
      </FormSection>

    </div>
  )
}

function IdentityFormFields(props: {
  form: IdentityForm
  setForm: React.Dispatch<React.SetStateAction<IdentityForm>>
  peers: IpsecPeer[]
  peerLocked?: boolean
}) {
  const [showPsk, setShowPsk] = React.useState(false)
  const localIdManual = props.form.local_id_mode === 'manual'
  const remoteIdManual = props.form.remote_id_mode === 'manual'
  const enableLocalId = () => props.setForm((s) => ({ ...s, local_id_mode: 'manual' }))
  const disableLocalId = () => props.setForm((s) => ({ ...s, local_id_mode: 'auto', local_id: '' }))
  const enableRemoteId = () => props.setForm((s) => ({ ...s, remote_id_mode: 'manual' }))
  const disableRemoteId = () => props.setForm((s) => ({ ...s, remote_id_mode: 'auto', remote_id: '' }))
  const pskStatus = props.form.current_psk_set
    ? 'Current PSK is loaded into this field and hidden by default. Edit or generate to replace it only for this identity peer; leave empty to keep the saved PSK.'
    : 'PSK is required for a new identity. Generate one or enter the same secret configured on the peer.'
  const generatePsk = () => {
    props.setForm((s) => ({ ...s, psk: generateIpsecPsk() }))
    setShowPsk(true)
  }
  React.useEffect(() => {
    setShowPsk(false)
  }, [props.form.peer])
  return (
    <div className='space-y-3'>
      <FormSection title='Identity / PSK' description='Peer authentication identity and pre-shared key used by the selected IPsec peer.' plain alignHeaderWithFields>
        <div className='space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
          <CompactRow label='Enabled'>
            <EnabledCheckbox checked={props.form.enabled} onChange={(enabled) => props.setForm((s) => ({ ...s, enabled }))} ariaLabel='Toggle IPsec identity enabled state' />
          </CompactRow>

          <CompactRow label='Peer' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Peer connection that will use this identity and PSK.</div>
            <div className='max-w-xl'>
              {props.peerLocked ? (
                <div className='h-7 rounded-md border bg-muted/20 px-2.5 py-1.5 font-mono text-[11px] text-foreground'>
                  {props.form.peer || '-'}
                </div>
              ) : (
                <NamedSelect
                  value={props.form.peer}
                  options={props.peers.map((peer) => ({ value: peer.name, label: peer.name }))}
                  placeholder='Create peer first'
                  onChange={(peer) => props.setForm((s) => ({ ...s, peer, psk: '', current_psk_set: false }))}
                />
              )}
            </div>
          </CompactRow>

          <CompactRow label='Authentication'>
            <div className='max-w-xl rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground'>PSK</div>
          </CompactRow>

          <CompactRow label='Local ID' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Auto leaves local.id empty so strongSwan derives it from the peer connection; use manual only when the peer expects a specific ID.</div>
            <IpsecToggleLine
              enabled={localIdManual}
              inactiveHint='Auto'
              onToggle={localIdManual ? disableLocalId : enableLocalId}
            >
              <Input
                className='h-7 text-xs'
                placeholder='195.133.67.169 or fqdn'
                value={props.form.local_id}
                onChange={(e) => props.setForm((s) => ({ ...s, local_id: e.target.value }))}
              />
            </IpsecToggleLine>
          </CompactRow>

          <CompactRow label='Remote ID' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Auto matches the negotiated peer identity; use manual when the remote gateway sends a fixed ID.</div>
            <IpsecToggleLine
              enabled={remoteIdManual}
              inactiveHint='Auto'
              onToggle={remoteIdManual ? disableRemoteId : enableRemoteId}
            >
              <Input
                className='h-7 text-xs'
                placeholder='195.133.53.242 or fqdn'
                value={props.form.remote_id}
                onChange={(e) => props.setForm((s) => ({ ...s, remote_id: e.target.value }))}
              />
            </IpsecToggleLine>
          </CompactRow>

          <CompactRow label='PSK' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>{pskStatus}</div>
            <div className='flex max-w-xl items-center gap-1'>
              <Input
                className='h-7 flex-1 font-mono text-xs'
                type={showPsk ? 'text' : 'password'}
                placeholder={props.form.current_psk_set ? 'current PSK hidden' : 'enter or generate PSK'}
                value={props.form.psk}
                onChange={(e) => props.setForm((s) => ({ ...s, psk: e.target.value }))}
              />
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='h-7 w-7 shrink-0'
                title={showPsk ? 'Hide PSK' : 'Show PSK'}
                onClick={() => setShowPsk((value) => !value)}
              >
                {showPsk ? <EyeOff className='size-3.5' /> : <Eye className='size-3.5' />}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='h-7 w-7 shrink-0'
                title='Generate PSK'
                onClick={generatePsk}
              >
                <KeyRound className='size-3.5' />
              </Button>
            </div>
          </CompactRow>
        </div>
      </FormSection>
    </div>
  )
}

function Phase1FormFields(props: {
  form: Phase1Form
  setForm: React.Dispatch<React.SetStateAction<Phase1Form>>
}) {
  const selections = phase1Selections(props.form)
  const togglePhase1Selection = (key: keyof ReturnType<typeof phase1Selections>, value: string) => {
    props.setForm((form) => {
      const current = phase1Selections(form)
      const nextValues = normalizePhase1SelectionToggle(key, current[key], value)
      if (!nextValues.length) return form
      return updatePhase1Selections(form, { [key]: nextValues })
    })
  }
  return (
    <div className='space-y-3'>
      <FormSection title='Phase 1 Profile' description='IKE proposal parameters used by peers and loaded through VICI.' plain alignHeaderWithFields>
        <div className='space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
          <CompactRow label='Enabled'>
            <EnabledCheckbox checked={props.form.enabled} onChange={(enabled) => props.setForm((s) => ({ ...s, enabled }))} ariaLabel='Toggle Phase 1 profile enabled state' />
          </CompactRow>

          <CompactRow label='Name'>
            <Input className='h-7 max-w-xl text-xs' value={props.form.name} onChange={(e) => props.setForm((s) => ({ ...s, name: e.target.value }))} />
          </CompactRow>

          <CompactRow label='Hash Algorithm' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>IKE integrity algorithms. AEAD encryption proposals omit this part automatically.</div>
            <MultiCheckChoiceGrid
              values={selections.hashes}
              options={ikeHashOptions}
              onToggle={(hash) => togglePhase1Selection('hashes', hash)}
              formatLabel={formatCryptoAlgorithm}
            />
          </CompactRow>

          <CompactRow label='Encryption Algorithm' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>IKE encryption algorithms; selected combinations are converted to VICI proposals.</div>
            <MultiCheckChoiceGrid
              values={selections.encryptions}
              options={ikeEncryptionOptions}
              onToggle={(encryption) => togglePhase1Selection('encryptions', encryption)}
              formatLabel={formatCryptoAlgorithm}
            />
          </CompactRow>

          <CompactRow label='PRF Algorithm' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>
              Auto does not write a PRF token into the IKE proposal; strongSwan and the peer choose a compatible PRF during negotiation.
            </div>
            <MultiCheckChoiceGrid
              values={selections.prfs}
              options={ikePrfOptions}
              onToggle={(prf) => togglePhase1Selection('prfs', prf)}
              formatLabel={formatCryptoAlgorithm}
            />
          </CompactRow>

          <CompactRow label='DH Groups' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>
              IKE Diffie-Hellman groups used for key exchange; the number in brackets is the standard group number.
            </div>
            <MultiCheckChoiceGrid
              values={selections.dhGroups}
              options={ikeDhGroupOptions}
              onToggle={(dh_group) => togglePhase1Selection('dhGroups', dh_group)}
              formatLabel={formatDhGroup}
            />
          </CompactRow>

          <CompactRow label='Generated IKE proposals' align='start'>
            <div className='rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground'>
              {buildProposalSetPreview(buildIkeProposalPreview(props.form), props.form.extra_proposals) || '-'}
            </div>
          </CompactRow>
        </div>
      </FormSection>
    </div>
  )
}

function Phase2FormFields(props: {
  form: Phase2Form
  setForm: React.Dispatch<React.SetStateAction<Phase2Form>>
}) {
  const selections = phase2Selections(props.form)
  const hasNonAeadEncryption = selections.encryptions.some((encryption) => !isAeadAlgorithm(encryption))
  const togglePhase2Selection = (key: keyof ReturnType<typeof phase2Selections>, value: string) => {
    props.setForm((form) => {
      const current = phase2Selections(form)
      const nextValues = normalizePhase2SelectionToggle(key, current[key], value)
      return updatePhase2Selections(form, { [key]: nextValues })
    })
  }
  return (
    <div className='space-y-3'>
      <FormSection title='ESP Proposal' description='CHILD_SA proposal parameters used by policies.'>
        <div className='space-y-2.5 rounded-md bg-muted/10 p-2.5 text-xs'>
          <CompactRow label='Enabled'>
            <EnabledCheckbox checked={props.form.enabled} onChange={(enabled) => props.setForm((s) => ({ ...s, enabled }))} ariaLabel='Toggle Phase 2 proposal enabled state' />
          </CompactRow>

          <CompactRow label='Name'>
            <Input className='h-7 max-w-xl text-xs' value={props.form.name} onChange={(e) => props.setForm((s) => ({ ...s, name: e.target.value }))} />
          </CompactRow>

          <CompactRow label='Encryption Algorithm' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Encryption or AEAD transform for ESP traffic; AEAD modes omit separate integrity.</div>
            <MultiCheckChoiceGrid
              values={selections.encryptions}
              options={espEncryptionOptions}
              onToggle={(encryption) => togglePhase2Selection('encryptions', encryption)}
              formatLabel={formatCryptoAlgorithm}
            />
          </CompactRow>

          <CompactRow label='Auth Algorithm' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>
              Authentication/integrity transform for non-AEAD ESP proposals. AEAD encryption proposals do not use this field.
            </div>
            {!hasNonAeadEncryption ? (
              <div className='rounded-md border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground'>Only AEAD encryption selected: auth is omitted.</div>
            ) : (
              <MultiCheckChoiceGrid
                values={selections.auths}
                options={espAuthOptions}
                onToggle={(auth) => togglePhase2Selection('auths', auth)}
                formatLabel={formatCryptoAlgorithm}
              />
            )}
          </CompactRow>

          <CompactRow label='PFS Group' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>Optional CHILD_SA key exchange method. When negotiated, this provides PFS for ESP rekey/create.</div>
            <MultiCheckChoiceGrid
              values={selections.pfsGroups}
              options={['__none__', ...ikeDhGroupOptions]}
              onToggle={(pfs_group) => togglePhase2Selection('pfsGroups', pfs_group)}
              formatLabel={(value) => value === '__none__' ? 'none' : formatDhGroup(value)}
            />
          </CompactRow>

          <CompactRow label='ESN Mode' align='start'>
            <div className='mb-1 text-[11px] text-muted-foreground'>ESP Extended Sequence Number indicator.</div>
            <MultiCheckChoiceGrid
              values={selections.esnModes}
              options={['__default__', ...esnOptions]}
              onToggle={(esn) => togglePhase2Selection('esnModes', esn)}
              formatLabel={(value) => value === '__default__' ? 'default (no ESN flag)' : value}
            />
          </CompactRow>

          <CompactRow label='Generated ESP proposals' align='start'>
            <div className='rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground'>
              {buildProposalSetPreview(buildEspProposalPreview(props.form), props.form.extra_proposals) || '-'}
            </div>
          </CompactRow>
        </div>
      </FormSection>
    </div>
  )
}

function FormSection(props: {
  title: string
  description?: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  plain?: boolean
  alignHeaderWithFields?: boolean
}) {
  const [open, setOpen] = React.useState(props.defaultOpen ?? true)
  const visible = props.collapsible ? open : true
  const plain = props.plain ?? true
  const alignHeaderWithFields = props.alignHeaderWithFields ?? true
  const sectionClassName = plain ? 'rounded-xl bg-transparent p-0' : 'rounded-xl border bg-card p-3 shadow-sm'
  const headerClassName = alignHeaderWithFields
    ? 'mb-2 flex items-start justify-between gap-3 px-2.5'
    : 'mb-3 flex flex-wrap items-start justify-between gap-2'
  const headerText = (
    <div className={alignHeaderWithFields ? 'min-w-0' : undefined}>
      <div className='text-[12px] font-semibold'>{props.title}</div>
      {props.description ? <div className='mt-0.5 text-[11px] text-muted-foreground'>{props.description}</div> : null}
    </div>
  )
  return (
    <section className={sectionClassName}>
      <div className={headerClassName}>
        {headerText}
        {props.collapsible ? (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-7 gap-1 px-2 text-[11px]'
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? 'Hide' : 'Show'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </Button>
        ) : null}
      </div>
      {visible ? props.children : null}
    </section>
  )
}

function ProposalPreview(props: { value: string }) {
  return (
    <div className='mt-3 rounded-md border bg-muted/30 p-2'>
      <div className='text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>VICI proposal string</div>
      <div className='mt-1 font-mono text-[11px]'>{props.value}</div>
    </div>
  )
}

function PolicyViciPreview(props: {
  localTs: string[]
  remoteTs: string[]
  espProposal: string
  startAction: string
  mode: string
  closeAction: string
  dpdAction: string
  rekeyTime: string
  lifeTime: string
  randTime: string
  policies: string
  policiesFwdOut: string
  reqid: string
  priority: string
  childInterface: string
  markIn: string
  markInSa: string
  markOut: string
  setMarkIn: string
  setMarkOut: string
  ifIdIn: string
  ifIdOut: string
}) {
  return (
    <div className='mt-3 rounded-md border bg-muted/30 p-2'>
      <div className='text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>VICI CHILD_SA preview</div>
      <div className='mt-1 grid gap-1 font-mono text-[11px]'>
        <div>local_ts: [{props.localTs.join(', ') || '-'}]</div>
        <div>remote_ts: [{props.remoteTs.join(', ') || '-'}]</div>
        <div>esp_proposals: [{props.espProposal}]</div>
        <div>start_action: {props.startAction}</div>
        <div>mode: {props.mode}</div>
        <div>close_action: {props.closeAction}</div>
        <div>dpd_action: {props.dpdAction}</div>
        <div>rekey_time: {props.rekeyTime || '1h'}</div>
        <div>life_time: {props.lifeTime || '-'}</div>
        <div>rand_time: {props.randTime || '-'}</div>
        <div>policies: {props.policies || 'yes'}</div>
        <div>policies_fwd_out: {props.policiesFwdOut || 'no'}</div>
        <div>reqid: {props.reqid || '-'}</div>
        <div>priority: {props.priority || '-'}</div>
        <div>interface: {props.childInterface || '-'}</div>
        <div>mark_in: {props.markIn || '-'}</div>
        <div>mark_in_sa: {props.markInSa || 'no'}</div>
        <div>mark_out: {props.markOut || '-'}</div>
        <div>set_mark_in: {props.setMarkIn || '-'}</div>
        <div>set_mark_out: {props.setMarkOut || '-'}</div>
        <div>if_id_in: {props.ifIdIn || '-'}</div>
        <div>if_id_out: {props.ifIdOut || '-'}</div>
      </div>
    </div>
  )
}

function IdentityViciPreview(props: { localId: string; remoteId: string }) {
  return (
    <div className='mt-3 rounded-md border bg-muted/30 p-2'>
      <div className='text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>VICI auth preview</div>
      <div className='mt-1 grid gap-1 font-mono text-[11px]'>
        <div>local.auth: psk</div>
        <div>local.id: {props.localId || '-'}</div>
        <div>remote.auth: psk</div>
        <div>remote.id: {props.remoteId || '-'}</div>
      </div>
    </div>
  )
}

function SecretViciPreview(props: { peer: string; localId: string; remoteId: string }) {
  return (
    <div className='mt-3 rounded-md border bg-muted/30 p-2'>
      <div className='text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>VICI load_shared preview</div>
      <div className='mt-1 grid gap-1 font-mono text-[11px]'>
        <div>id: {props.peer ? `ike-${props.peer}` : '-'}</div>
        <div>type: IKE</div>
        <div>owners: [{[props.localId, props.remoteId].filter(Boolean).join(', ') || '-'}]</div>
        <div>data: ********</div>
      </div>
    </div>
  )
}

function ReadonlyChip(props: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-2 text-xs'>
      <span>{props.label}</span>
      <span className='font-mono text-[11px] text-muted-foreground'>{props.value}</span>
    </div>
  )
}

function ToggleBool(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className='flex items-center justify-between gap-3 rounded-md border p-2 text-xs'>
      <span>{props.label}</span>
      <input
        type='checkbox'
        className='h-4 w-4'
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  )
}

function ComboInput(props: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className={props.options.length ? 'grid gap-2 md:grid-cols-[1fr_auto]' : ''}>
      <Input value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.options.length ? (
        <Select value={props.options.includes(props.value) ? props.value : undefined} onValueChange={props.onChange}>
          <SelectTrigger className='w-full md:w-44'>
            <SelectValue placeholder='Select' />
          </SelectTrigger>
          <SelectContent>
            {props.options.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
