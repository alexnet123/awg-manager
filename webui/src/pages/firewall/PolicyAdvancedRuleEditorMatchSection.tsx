import * as React from 'react'
import { Input } from '@/components/ui/input'
import type { FirewallRule } from '../api'
import { PlannedField, ToggleLine } from './RuleFieldControls'

type Props = {
  family: 'bridge' | 'netdev'
  policyV2Form: Partial<FirewallRule>
  setPolicyV2Form: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
}

export function PolicyAdvancedRuleEditorMatchSection(props: Props) {
  return (
    <div className='rounded-md border p-2.5'>
      <div className='mb-2 text-[11px] font-semibold text-muted-foreground'>L2 / L3 / L4 match</div>
      {props.family === 'bridge' ? (
        <div className='grid grid-cols-2 gap-2'>
          <ToggleLine label='ibrname' enabled={!!props.policyV2Form.ibrname} inactiveHint='br0 / eth0' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ibrname: p.ibrname ? null : 'br0' }))}>
            <Input className='h-7' placeholder='br0 / eth0' value={props.policyV2Form.ibrname || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ibrname: e.target.value || null }))} />
          </ToggleLine>
          <ToggleLine label='obrname' enabled={!!props.policyV2Form.obrname} inactiveHint='br1 / eth1' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, obrname: p.obrname ? null : 'br1' }))}>
            <Input className='h-7' placeholder='br1 / eth1' value={props.policyV2Form.obrname || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, obrname: e.target.value || null }))} />
          </ToggleLine>
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-2'>
          <ToggleLine label='iifname' enabled={!!props.policyV2Form.in_interface} inactiveHint='eth0' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, in_interface: p.in_interface ? null : 'eth0' }))}>
            <Input className='h-7' placeholder='eth0' value={props.policyV2Form.in_interface || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, in_interface: e.target.value || null }))} />
          </ToggleLine>
          <div className='rounded-md border border-blue-300/60 bg-blue-50/60 px-2.5 py-1.5 text-[10px] text-blue-900'>
            Ingress device comes from the selected netdev table chain.
          </div>
        </div>
      )}
      {props.family === 'netdev' ? (
        <div className='grid grid-cols-2 gap-2'>
          <ToggleLine label='src' enabled={!!props.policyV2Form.src} inactiveHint='192.0.2.10/32' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, src: p.src ? null : '192.0.2.10/32' }))}>
            <Input className='h-7' placeholder='192.0.2.10/32' value={props.policyV2Form.src || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, src: e.target.value || null }))} />
          </ToggleLine>
          <ToggleLine label='dst' enabled={!!props.policyV2Form.dst} inactiveHint='198.51.100.10/32' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, dst: p.dst ? null : '198.51.100.10/32' }))}>
            <Input className='h-7' placeholder='198.51.100.10/32' value={props.policyV2Form.dst || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, dst: e.target.value || null }))} />
          </ToggleLine>
        </div>
      ) : null}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine
          label='proto'
          enabled={!!props.policyV2Form.proto}
          inactiveHint='tcp / udp / icmp / icmpv6'
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, proto: p.proto ? null : 'tcp', sport: p.proto ? null : p.sport, dport: p.proto ? null : p.dport }))}
        >
          <select
            className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
            value={props.policyV2Form.proto || 'tcp'}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, proto: e.target.value as FirewallRule['proto'] }))}
          >
            <option value='tcp'>tcp</option>
            <option value='udp'>udp</option>
            <option value='icmp'>icmp</option>
            <option value='icmpv6'>icmpv6</option>
          </select>
        </ToggleLine>
        <ToggleLine label='ct state' enabled={!!props.policyV2Form.ct_state} inactiveHint='established,related' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ct_state: p.ct_state ? null : 'established,related' }))}>
          <select
            className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
            value={props.policyV2Form.ct_state || 'established,related'}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ct_state: e.target.value as FirewallRule['ct_state'] }))}
          >
            <option value='established,related'>established,related</option>
            <option value='established'>established</option>
            <option value='related'>related</option>
            <option value='new'>new</option>
            <option value='invalid'>invalid</option>
            <option value='untracked'>untracked</option>
          </select>
        </ToggleLine>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='meta pkttype' enabled={!!props.policyV2Form.meta_pkttype} inactiveHint='host / broadcast / multicast / other' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, meta_pkttype: p.meta_pkttype ? null : 'host' }))}>
          <select
            className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
            value={props.policyV2Form.meta_pkttype || 'host'}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, meta_pkttype: e.target.value || null }))}
          >
            <option value='host'>host</option>
            <option value='broadcast'>broadcast</option>
            <option value='multicast'>multicast</option>
            <option value='other'>other</option>
          </select>
        </ToggleLine>
        <ToggleLine label='meta iifgroup' enabled={!!props.policyV2Form.meta_iifgroup} inactiveHint='10' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, meta_iifgroup: p.meta_iifgroup ? null : '10' }))}>
          <Input className='h-7' placeholder='10' value={props.policyV2Form.meta_iifgroup || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, meta_iifgroup: e.target.value || null }))} />
        </ToggleLine>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        {props.family === 'bridge' ? (
          <ToggleLine label='meta oifgroup' enabled={!!props.policyV2Form.meta_oifgroup} inactiveHint='10' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, meta_oifgroup: p.meta_oifgroup ? null : '10' }))}>
            <Input className='h-7' placeholder='10' value={props.policyV2Form.meta_oifgroup || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, meta_oifgroup: e.target.value || null }))} />
          </ToggleLine>
        ) : (
          <ToggleLine label='meta iiftype' enabled={!!props.policyV2Form.meta_iiftype} inactiveHint='1' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, meta_iiftype: p.meta_iiftype ? null : '1' }))}>
            <Input className='h-7' placeholder='1' value={props.policyV2Form.meta_iiftype || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, meta_iiftype: e.target.value || null }))} />
          </ToggleLine>
        )}
        <ToggleLine label='mark match' enabled={!!props.policyV2Form.mark_match} inactiveHint='0x1 or 1' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, mark_match: p.mark_match ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 or 1' value={props.policyV2Form.mark_match || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, mark_match: e.target.value || null }))} />
        </ToggleLine>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='ct mark match' enabled={!!props.policyV2Form.ct_mark_match} inactiveHint='0x1 or 1' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ct_mark_match: p.ct_mark_match ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 or 1' value={props.policyV2Form.ct_mark_match || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ct_mark_match: e.target.value || null }))} />
        </ToggleLine>
        <div />
      </div>
      {props.family === 'bridge' ? (
        <>
          <div className='mt-1 rounded-md border border-blue-300/60 bg-blue-50/60 px-2.5 py-1.5 text-[10px] text-blue-900'>
            Structured expert expressions (`fib_check`, `socket_match`, `rt_nexthop`, `ipv6_exthdrs`) are planned for bridge and temporarily disabled on current runtime.
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <PlannedField label='fib check' placeholder='planned for bridge runtime' />
            <PlannedField label='socket match' placeholder='planned for bridge runtime' />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <PlannedField label='rt nexthop' placeholder='planned for bridge runtime' />
            <PlannedField label='ipv6 exthdrs' placeholder='planned for bridge runtime' />
          </div>
        </>
      ) : null}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine
          label='sport'
          enabled={!!props.policyV2Form.sport}
          inactiveHint='1024 or 1000:2000'
          disabled={!props.policyV2Form.proto || (props.policyV2Form.proto !== 'tcp' && props.policyV2Form.proto !== 'udp')}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, sport: p.sport ? null : '1024' }))}
        >
          <Input className='h-7' placeholder='1024 or 1000:2000' value={props.policyV2Form.sport || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, sport: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine
          label='dport'
          enabled={!!props.policyV2Form.dport}
          inactiveHint='443 or 1000:2000'
          disabled={!props.policyV2Form.proto || (props.policyV2Form.proto !== 'tcp' && props.policyV2Form.proto !== 'udp')}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, dport: p.dport ? null : '443' }))}
        >
          <Input className='h-7' placeholder='443 or 1000:2000' value={props.policyV2Form.dport || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, dport: e.target.value || null }))} />
        </ToggleLine>
      </div>
      {(!props.policyV2Form.proto || (props.policyV2Form.proto !== 'tcp' && props.policyV2Form.proto !== 'udp')) ? (
        <div className='text-[10px] text-muted-foreground'>Enable proto `tcp` or `udp` to unlock `sport` / `dport`.</div>
      ) : null}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='ether src' enabled={!!props.policyV2Form.ether_src} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ether_src: p.ether_src ? null : 'aa:bb:cc:dd:ee:ff' }))}>
          <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={props.policyV2Form.ether_src || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ether_src: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='ether dst' enabled={!!props.policyV2Form.ether_dst} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ether_dst: p.ether_dst ? null : 'aa:bb:cc:dd:ee:ff' }))}>
          <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={props.policyV2Form.ether_dst || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ether_dst: e.target.value || null }))} />
        </ToggleLine>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='ether type' enabled={!!props.policyV2Form.ether_type} inactiveHint='0x0800 or 2048' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ether_type: p.ether_type ? null : '0x0800' }))}>
          <Input className='h-7' placeholder='0x0800 or 2048' value={props.policyV2Form.ether_type || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ether_type: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='vlan id' enabled={!!props.policyV2Form.vlan_id} inactiveHint='1..4095' onToggle={() => props.setPolicyV2Form((p) => ({ ...p, vlan_id: p.vlan_id ? null : '10' }))}>
          <Input className='h-7' placeholder='1..4095' value={props.policyV2Form.vlan_id || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, vlan_id: e.target.value || null }))} />
        </ToggleLine>
      </div>
    </div>
  )
}
