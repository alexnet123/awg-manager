import * as React from 'react'
import { Input } from '@/components/ui/input'
import { TabsContent } from '@/components/ui/tabs'
import { ToggleLine } from './RuleFieldControls'
import type { FirewallRule } from '../api'

type Props = {
  form: Partial<FirewallRule>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  advOpen: Record<string, boolean>
  setAdvOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  hasSupport: (key: string) => boolean
}

export function PolicyRuleEditorAdvancedTab(props: Props) {
  return (
<TabsContent value='advanced' className='mt-2 space-y-2.5'>
                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, l4: !p.l4 }))}>Network & L4 extras {props.advOpen.l4 ? '−' : '+'}</button>
                    {props.advOpen.l4 ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='tcp flags' enabled={!!props.form.tcp_flags} inactiveHint='syn / syn,ack' onToggle={() => props.setForm((p) => ({ ...p, tcp_flags: p.tcp_flags ? null : 'syn', proto: p.tcp_flags ? p.proto : (p.proto || 'tcp') }))}>
                        <Input className='h-7' placeholder='syn / syn,ack' value={props.form.tcp_flags || ''} onChange={(e) => props.setForm((p) => ({ ...p, tcp_flags: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='icmp type' enabled={!!props.form.icmp_type} inactiveHint='echo-request' onToggle={() => props.setForm((p) => ({ ...p, icmp_type: p.icmp_type ? null : 'echo-request', proto: p.icmp_type ? p.proto : (p.proto || 'icmp') }))}>
                        <Input className='h-7' placeholder='echo-request' value={props.form.icmp_type || ''} onChange={(e) => props.setForm((p) => ({ ...p, icmp_type: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='icmp code' enabled={!!props.form.icmp_code} inactiveHint='0' onToggle={() => props.setForm((p) => ({ ...p, icmp_code: p.icmp_code ? null : '0', proto: p.icmp_code ? p.proto : (p.proto || 'icmp') }))}>
                        <Input className='h-7' placeholder='0' value={props.form.icmp_code || ''} onChange={(e) => props.setForm((p) => ({ ...p, icmp_code: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='icmpv6 type' enabled={!!props.form.icmpv6_type} inactiveHint='echo-request' onToggle={() => props.setForm((p) => ({ ...p, icmpv6_type: p.icmpv6_type ? null : 'echo-request', proto: p.icmpv6_type ? p.proto : (p.proto || 'icmpv6') }))}>
                        <Input className='h-7' placeholder='echo-request' value={props.form.icmpv6_type || ''} onChange={(e) => props.setForm((p) => ({ ...p, icmpv6_type: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='icmpv6 code' enabled={!!props.form.icmpv6_code} inactiveHint='0' onToggle={() => props.setForm((p) => ({ ...p, icmpv6_code: p.icmpv6_code ? null : '0', proto: p.icmpv6_code ? p.proto : (p.proto || 'icmpv6') }))}>
                        <Input className='h-7' placeholder='0' value={props.form.icmpv6_code || ''} onChange={(e) => props.setForm((p) => ({ ...p, icmpv6_code: e.target.value || null }))} />
                      </ToggleLine>
                      <div />
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, meta: !p.meta }))}>Meta match {props.advOpen.meta ? '−' : '+'}</button>
                    {props.advOpen.meta ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta length' enabled={!!props.form.meta_length} inactiveHint='64-1500' onToggle={() => props.setForm((p) => ({ ...p, meta_length: p.meta_length ? null : '64-1500' }))}>
                        <Input className='h-7' placeholder='64-1500' value={props.form.meta_length || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_length: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta priority' enabled={!!props.form.meta_priority} inactiveHint='1:10 / 0x10' onToggle={() => props.setForm((p) => ({ ...p, meta_priority: p.meta_priority ? null : '1:10' }))}>
                        <Input className='h-7' placeholder='1:10 / 0x10' value={props.form.meta_priority || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_priority: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta pkttype' enabled={!!props.form.meta_pkttype} inactiveHint='host/multicast' onToggle={() => props.setForm((p) => ({ ...p, meta_pkttype: p.meta_pkttype ? null : 'host' }))}>
                        <Input className='h-7' placeholder='host/multicast' value={props.form.meta_pkttype || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_pkttype: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta cpu' enabled={!!props.form.meta_cpu} inactiveHint='0-3' onToggle={() => props.setForm((p) => ({ ...p, meta_cpu: p.meta_cpu ? null : '0' }))}>
                        <Input className='h-7' placeholder='0-3' value={props.form.meta_cpu || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_cpu: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta iiftype' enabled={!!props.form.meta_iiftype} inactiveHint='1 (ARPHRD_ETHER)' onToggle={() => props.setForm((p) => ({ ...p, meta_iiftype: p.meta_iiftype ? null : '1' }))}>
                        <Input className='h-7' placeholder='1 (ARPHRD_ETHER)' value={props.form.meta_iiftype || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_iiftype: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta oiftype' enabled={!!props.form.meta_oiftype} inactiveHint='1 (ARPHRD_ETHER)' onToggle={() => props.setForm((p) => ({ ...p, meta_oiftype: p.meta_oiftype ? null : '1' }))}>
                        <Input className='h-7' placeholder='1 (ARPHRD_ETHER)' value={props.form.meta_oiftype || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_oiftype: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta iifgroup' enabled={!!props.form.meta_iifgroup} inactiveHint='10' onToggle={() => props.setForm((p) => ({ ...p, meta_iifgroup: p.meta_iifgroup ? null : '10' }))}>
                        <Input className='h-7' placeholder='10' value={props.form.meta_iifgroup || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_iifgroup: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='meta oifgroup' enabled={!!props.form.meta_oifgroup} inactiveHint='10' onToggle={() => props.setForm((p) => ({ ...p, meta_oifgroup: p.meta_oifgroup ? null : '10' }))}>
                        <Input className='h-7' placeholder='10' value={props.form.meta_oifgroup || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_oifgroup: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='packet mark match' enabled={!!props.form.mark_match} inactiveHint='0x1 / 10' onToggle={() => props.setForm((p) => ({ ...p, mark_match: p.mark_match ? null : '0x1' }))}>
                        <Input className='h-7' placeholder='0x1 / 10' value={props.form.mark_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, mark_match: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct mark match' enabled={!!props.form.ct_mark_match} inactiveHint='0x1 / 10' onToggle={() => props.setForm((p) => ({ ...p, ct_mark_match: p.ct_mark_match ? null : '0x1' }))}>
                        <Input className='h-7' placeholder='0x1 / 10' value={props.form.ct_mark_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_mark_match: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, ct: !p.ct }))}>Conntrack match {props.advOpen.ct ? '−' : '+'}</button>
                    {props.advOpen.ct ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct direction' enabled={!!props.form.ct_direction} inactiveHint='original/reply' onToggle={() => props.setForm((p) => ({ ...p, ct_direction: p.ct_direction ? null : 'original' }))}>
                        <Input className='h-7' placeholder='original/reply' value={props.form.ct_direction || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_direction: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct status' enabled={!!props.form.ct_status} inactiveHint='dnat,snat,assured' onToggle={() => props.setForm((p) => ({ ...p, ct_status: p.ct_status ? null : 'dnat' }))}>
                        <Input className='h-7' placeholder='dnat,snat,assured' value={props.form.ct_status || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_status: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct original saddr' enabled={!!props.form.ct_original_saddr} inactiveHint='192.168.1.10' onToggle={() => props.setForm((p) => ({ ...p, ct_original_saddr: p.ct_original_saddr ? null : '192.168.1.10' }))}>
                        <Input className='h-7' placeholder='192.168.1.10' value={props.form.ct_original_saddr || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_original_saddr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct original daddr' enabled={!!props.form.ct_original_daddr} inactiveHint='203.0.113.10' onToggle={() => props.setForm((p) => ({ ...p, ct_original_daddr: p.ct_original_daddr ? null : '203.0.113.10' }))}>
                        <Input className='h-7' placeholder='203.0.113.10' value={props.form.ct_original_daddr || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_original_daddr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct reply saddr' enabled={!!props.form.ct_reply_saddr} inactiveHint='203.0.113.10' onToggle={() => props.setForm((p) => ({ ...p, ct_reply_saddr: p.ct_reply_saddr ? null : '203.0.113.10' }))}>
                        <Input className='h-7' placeholder='203.0.113.10' value={props.form.ct_reply_saddr || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_reply_saddr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct reply daddr' enabled={!!props.form.ct_reply_daddr} inactiveHint='192.168.1.10' onToggle={() => props.setForm((p) => ({ ...p, ct_reply_daddr: p.ct_reply_daddr ? null : '192.168.1.10' }))}>
                        <Input className='h-7' placeholder='192.168.1.10' value={props.form.ct_reply_daddr || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_reply_daddr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct expiration' enabled={!!props.form.ct_expiration} inactiveHint='30s / 1m' onToggle={() => props.setForm((p) => ({ ...p, ct_expiration: p.ct_expiration ? null : '30s' }))}>
                        <Input className='h-7' placeholder='30s / 1m' value={props.form.ct_expiration || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_expiration: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct helper' enabled={!!props.form.ct_helper_match} inactiveHint='ftp / sip' onToggle={() => props.setForm((p) => ({ ...p, ct_helper_match: p.ct_helper_match ? null : 'ftp' }))}>
                        <Input className='h-7' placeholder='ftp / sip' value={props.form.ct_helper_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_helper_match: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct label' enabled={!!props.form.ct_label} inactiveHint='label_name / 0x1' onToggle={() => props.setForm((p) => ({ ...p, ct_label: p.ct_label ? null : '0x1' }))}>
                        <Input className='h-7' placeholder='label_name / 0x1' value={props.form.ct_label || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_label: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct event' enabled={!!props.form.ct_event} inactiveHint='new,related,destroy' onToggle={() => props.setForm((p) => ({ ...p, ct_event: p.ct_event ? null : 'new,related,destroy' }))}>
                        <Input className='h-7' placeholder='new,related,destroy' value={props.form.ct_event || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_event: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, fib: !p.fib }))}>FIB / socket / routing / L2 {props.advOpen.fib ? '−' : '+'}</button>
                    {props.advOpen.fib ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='fib expression' enabled={!!props.form.fib_expr} inactiveHint='fib daddr . iif oif exists' onToggle={() => props.setForm((p) => ({ ...p, fib_expr: p.fib_expr ? null : 'fib daddr . iif oif exists' }))}>
                        <Input className='h-7' placeholder='fib daddr . iif oif exists' value={props.form.fib_expr || ''} onChange={(e) => props.setForm((p) => ({ ...p, fib_expr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='socket expression' enabled={!!props.form.socket_expr} inactiveHint='socket transparent 1' onToggle={() => props.setForm((p) => ({ ...p, socket_expr: p.socket_expr ? null : 'socket transparent 1' }))}>
                        <Input className='h-7' placeholder='socket transparent 1' value={props.form.socket_expr || ''} onChange={(e) => props.setForm((p) => ({ ...p, socket_expr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='rt expression' enabled={!!props.form.rt_expr} inactiveHint='rt nexthop 192.168.0.1' onToggle={() => props.setForm((p) => ({ ...p, rt_expr: p.rt_expr ? null : 'rt nexthop 192.168.0.1' }))}>
                        <Input className='h-7' placeholder='rt nexthop 192.168.0.1' value={props.form.rt_expr || ''} onChange={(e) => props.setForm((p) => ({ ...p, rt_expr: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='exthdr expression' enabled={!!props.form.exthdr_expr} inactiveHint='exthdr frag missing' onToggle={() => props.setForm((p) => ({ ...p, exthdr_expr: p.exthdr_expr ? null : 'exthdr frag missing' }))}>
                        <Input className='h-7' placeholder='exthdr frag missing' value={props.form.exthdr_expr || ''} onChange={(e) => props.setForm((p) => ({ ...p, exthdr_expr: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='fib check' enabled={!!props.form.fib_check} inactiveHint='daddr type local' onToggle={() => props.setForm((p) => ({ ...p, fib_check: p.fib_check ? null : 'daddr type local' }))}>
                        <Input className='h-7' placeholder='daddr type local' value={props.form.fib_check || ''} onChange={(e) => props.setForm((p) => ({ ...p, fib_check: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='socket match' enabled={!!props.form.socket_match} inactiveHint='transparent 1' onToggle={() => props.setForm((p) => ({ ...p, socket_match: p.socket_match ? null : 'transparent 1' }))}>
                        <Input className='h-7' placeholder='transparent 1' value={props.form.socket_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, socket_match: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='rt nexthop' enabled={!!props.form.rt_nexthop} inactiveHint='192.0.2.1' onToggle={() => props.setForm((p) => ({ ...p, rt_nexthop: p.rt_nexthop ? null : '192.0.2.1' }))}>
                        <Input className='h-7' placeholder='192.0.2.1' value={props.form.rt_nexthop || ''} onChange={(e) => props.setForm((p) => ({ ...p, rt_nexthop: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='vlan id' enabled={!!props.form.vlan_id} inactiveHint='10' onToggle={() => props.setForm((p) => ({ ...p, vlan_id: p.vlan_id ? null : '10' }))}>
                        <Input className='h-7' placeholder='10' value={props.form.vlan_id || ''} onChange={(e) => props.setForm((p) => ({ ...p, vlan_id: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ether src' enabled={!!props.form.ether_src} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => props.setForm((p) => ({ ...p, ether_src: p.ether_src ? null : 'aa:bb:cc:dd:ee:ff' }))}>
                        <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={props.form.ether_src || ''} onChange={(e) => props.setForm((p) => ({ ...p, ether_src: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ether dst' enabled={!!props.form.ether_dst} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => props.setForm((p) => ({ ...p, ether_dst: p.ether_dst ? null : 'aa:bb:cc:dd:ee:ff' }))}>
                        <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={props.form.ether_dst || ''} onChange={(e) => props.setForm((p) => ({ ...p, ether_dst: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ether type' enabled={!!props.form.ether_type} inactiveHint='0x0800' onToggle={() => props.setForm((p) => ({ ...p, ether_type: p.ether_type ? null : '0x0800' }))}>
                        <Input className='h-7' placeholder='0x0800' value={props.form.ether_type || ''} onChange={(e) => props.setForm((p) => ({ ...p, ether_type: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ipv6 extension headers' enabled={!!props.form.ipv6_exthdrs} inactiveHint='frag missing' onToggle={() => props.setForm((p) => ({ ...p, ipv6_exthdrs: p.ipv6_exthdrs ? null : 'frag missing' }))}>
                        <Input className='h-7' placeholder='frag missing' value={props.form.ipv6_exthdrs || ''} onChange={(e) => props.setForm((p) => ({ ...p, ipv6_exthdrs: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, raw: !p.raw }))}>Raw expression & debug {props.advOpen.raw ? '−' : '+'}</button>
                    {props.advOpen.raw ? <>
                    {props.hasSupport('raw_expr') ? (
                      <ToggleLine
                        label='raw expression'
                        enabled={!!props.form.raw_expr}
                        inactiveHint='meta length > 80 / ip protocol tcp'
                        onToggle={() => props.setForm((p) => ({ ...p, raw_expr: p.raw_expr ? null : 'meta length > 80' }))}
                      >
                        <Input
                          className='h-7'
                          placeholder='meta length > 80 / ip protocol tcp'
                          value={props.form.raw_expr || ''}
                          onChange={(e) => props.setForm((p) => ({ ...p, raw_expr: e.target.value || null }))}
                        />
                      </ToggleLine>
                    ) : (
                      <ToggleLine label='raw expression' enabled={false} inactiveHint='available in raw table only' onToggle={() => {}}>
                        <Input className='h-7' disabled placeholder='available in raw table only' />
                      </ToggleLine>
                    )}
                    <div className='grid grid-cols-2 gap-2'>
                      {props.hasSupport('nftrace') ? (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs'>
                          <input
                            type='checkbox'
                            className='h-4 w-4'
                            checked={!!props.form.nftrace}
                            onChange={(e) => props.setForm((p) => ({ ...p, nftrace: e.target.checked }))}
                          />
                          nftrace
                        </label>
                      ) : (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground'>
                          <input type='checkbox' disabled className='h-4 w-4' />
                          nftrace (raw table only)
                        </label>
                      )}
                      {props.hasSupport('notrack') ? (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs'>
                          <input
                            type='checkbox'
                            className='h-4 w-4'
                            checked={!!props.form.notrack}
                            onChange={(e) => props.setForm((p) => ({ ...p, notrack: e.target.checked }))}
                          />
                          notrack (advanced mode)
                        </label>
                      ) : (
                        <label className='flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground'>
                          <input type='checkbox' disabled className='h-4 w-4' />
                          notrack (raw table only)
                        </label>
                      )}
                    </div>
                    <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900'>Warning: `notrack` is usually meaningful only in raw prerouting/output contexts.</div>
                    </> : null}
                  </div>

                  <div className='rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground'>
                    Advanced fields are now grouped by purpose; backend enablement will be added block-by-block.
                  </div>
                </TabsContent>
  )
}
