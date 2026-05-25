import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsContent } from '@/components/ui/tabs'
import { ToggleLine } from './RuleFieldControls'
import type { FirewallRule, FirewallSchema } from '../api'

type Props = {
  form: Partial<FirewallRule>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  hasSupport: (key: string) => boolean
  generalFieldState: (field: 'in_interface' | 'out_interface' | 'ct_state') => 'V' | 'H' | 'D' | 'W'
  schema: FirewallSchema | null
  builtinRuleTables: Set<string>
  chainOptionsByTable: Record<string, string[]>
  customChainRowsByTable: Record<string, { chain_name: string }[]>
}

function parseCtState(value?: FirewallRule['ct_state'] | null) {
  return {
    established: value === 'established' || value === 'established,related',
    related: value === 'related' || value === 'established,related',
    newState: value === 'new',
    invalid: value === 'invalid',
    untracked: value === 'untracked',
  }
}

function buildCtState(flags: { established: boolean; related: boolean; newState: boolean; invalid: boolean; untracked: boolean }): FirewallRule['ct_state'] | null {
  if (flags.established && flags.related) return 'established,related'
  if (flags.established) return 'established'
  if (flags.related) return 'related'
  if (flags.newState) return 'new'
  if (flags.invalid) return 'invalid'
  if (flags.untracked) return 'untracked'
  return null
}

export function PolicyRuleEditorBaseTab(props: Props) {
  return (
    <TabsContent value='base' className='mt-2 space-y-2.5'>
      <div className='text-[11px] font-semibold text-muted-foreground'>Rule state</div>
      <label className='flex items-center gap-2 text-xs rounded-md border p-2'><input type='checkbox' className='h-4 w-4' checked={!!props.form.enabled} onChange={(e) => props.setForm((p) => ({ ...p, enabled: e.target.checked }))} />enabled</label>
      <div className='space-y-1.5'>
        <Label>Comment</Label>
        <Input className='h-7' placeholder='Rule comment (optional)' value={props.form.comment || ''} onChange={(e) => props.setForm((p) => ({ ...p, comment: e.target.value || null }))} />
      </div>

      <div className='text-[11px] font-semibold text-muted-foreground'>Base rule placement</div>
      <div className='space-y-1.5'>
        <Label>Chain</Label>
        <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.chain || 'input'} onChange={(e) => props.setForm((p) => ({ ...p, chain: e.target.value }))}>
          {(
            props.builtinRuleTables.has(String(props.form.table || '').toLowerCase())
              ? (props.chainOptionsByTable[String(props.form.table || 'filter').toLowerCase()] || [])
              : ((props.customChainRowsByTable[String(props.form.table || '').toLowerCase()] || []).map((row) => row.chain_name).filter(Boolean))
          ).map((ch) => (<option key={ch} value={ch}>{ch}</option>))}
        </select>
      </div>

      <div className='text-[11px] font-semibold text-muted-foreground'>L3 address match</div>
      {props.hasSupport('src') || props.hasSupport('dst') ? <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('src') ? <ToggleLine label='Source address' enabled={!!props.form.src} inactiveHint='192.168.1.0/24 or @trusted_hosts' onToggle={() => props.setForm((p) => ({ ...p, src: p.src ? null : '0.0.0.0/0' }))}>
          <Input className='h-7' placeholder='192.168.1.0/24 or @trusted_hosts' value={props.form.src || ''} onChange={(e) => props.setForm((p) => ({ ...p, src: e.target.value || null }))} />
        </ToggleLine> : <div />}
        {props.hasSupport('dst') ? <ToggleLine label='Destination address' enabled={!!props.form.dst} inactiveHint='10.0.0.10 or @servers' onToggle={() => props.setForm((p) => ({ ...p, dst: p.dst ? null : '10.8.0.0/24' }))}>
          <Input className='h-7' placeholder='10.0.0.10 or @servers' value={props.form.dst || ''} onChange={(e) => props.setForm((p) => ({ ...p, dst: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div> : null}

      <div className='text-[11px] font-semibold text-muted-foreground'>L4 protocol and port match</div>
      {props.hasSupport('proto') ? <ToggleLine label='Protocol' enabled={!!props.form.proto} inactiveHint='any / tcp / udp / icmp' onToggle={() => props.setForm((p) => ({ ...p, proto: p.proto ? null : 'tcp', sport: p.proto ? null : p.sport, dport: p.proto ? null : p.dport }))}>
        <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.proto || ''} onChange={(e) => props.setForm((p) => ({ ...p, proto: (e.target.value || null) as any }))}>
          <option value=''>any</option>
          {(props.schema?.protos || ['tcp', 'udp', 'icmp', 'icmpv6']).map((proto) => <option key={proto} value={proto}>{proto}</option>)}
          <option value='gre'>gre</option>
          <option value='esp'>esp</option>
        </select>
      </ToggleLine> : null}
      {props.hasSupport('sport') || props.hasSupport('dport') ? <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('sport') ? <ToggleLine label='Source port' enabled={!!props.form.sport} inactiveHint='1024-65535 or @admin_ports' onToggle={() => props.setForm((p) => ({ ...p, sport: p.sport ? null : '1024:65535', proto: p.sport ? p.proto : (p.proto || 'tcp') }))}>
          <Input className='h-7' placeholder='1024-65535 or @admin_ports' value={props.form.sport || ''} onChange={(e) => props.setForm((p) => ({ ...p, sport: e.target.value || null }))} />
        </ToggleLine> : <div />}
        {props.hasSupport('dport') ? <ToggleLine label='Destination port' enabled={!!props.form.dport} inactiveHint='22,80,443 or @admin_ports' onToggle={() => props.setForm((p) => ({ ...p, dport: p.dport ? null : '22', proto: p.dport ? p.proto : (p.proto || 'tcp') }))}>
          <Input className='h-7' placeholder='22, 80,443 or @admin_ports' value={props.form.dport || ''} onChange={(e) => props.setForm((p) => ({ ...p, dport: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div> : null}

      <div className='text-[11px] font-semibold text-muted-foreground'>Interface match</div>
      {props.hasSupport('in_interface') || props.hasSupport('out_interface') ? <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('in_interface') ? <ToggleLine label='Input interface' enabled={!!props.form.in_interface} inactiveHint='eth0 / lo / @lan_ifaces' onToggle={() => props.setForm((p) => ({ ...p, in_interface: p.in_interface ? null : 'eth0' }))}>
          <Input className='h-7' placeholder='eth0 / lo / @lan_ifaces' value={props.form.in_interface || ''} onChange={(e) => props.setForm((p) => ({ ...p, in_interface: e.target.value || null }))} />
        </ToggleLine> : <div />}
        {props.hasSupport('out_interface') ? <ToggleLine label='Output interface' enabled={!!props.form.out_interface} inactiveHint='eth0 / awg1 / @wan_ifaces' onToggle={() => props.setForm((p) => ({ ...p, out_interface: p.out_interface ? null : 'awg1' }))}>
          <Input className='h-7' placeholder='eth0 / awg1 / @wan_ifaces' value={props.form.out_interface || ''} onChange={(e) => props.setForm((p) => ({ ...p, out_interface: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div> : null}

      <div className='text-[11px] font-semibold text-muted-foreground'>Connection tracking match</div>
      {props.hasSupport('ct_state') && props.generalFieldState('ct_state') !== 'H' ? <ToggleLine label='Connection state' enabled={!!props.form.ct_state} inactiveHint='established,related / new / invalid' onToggle={() => props.setForm((p) => ({ ...p, ct_state: p.ct_state ? null : 'new' }))}>
        <div className='grid grid-cols-2 gap-2 rounded-md border p-2'>
          {(() => {
            const flags = parseCtState(props.form.ct_state)
            const setFlags = (patch: Partial<typeof flags>) => {
              const next = { ...flags, ...patch }
              if (patch.newState || patch.invalid || patch.untracked) {
                if (patch.newState) {
                  next.invalid = false
                  next.untracked = false
                  next.established = false
                  next.related = false
                }
                if (patch.invalid) {
                  next.newState = false
                  next.untracked = false
                  next.established = false
                  next.related = false
                }
                if (patch.untracked) {
                  next.newState = false
                  next.invalid = false
                  next.established = false
                  next.related = false
                }
              }
              if (patch.established || patch.related) {
                next.newState = false
                next.invalid = false
                next.untracked = false
              }
              props.setForm((p) => ({ ...p, ct_state: buildCtState(next) }))
            }
            return (
              <>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.established} onChange={(e) => setFlags({ established: e.target.checked })} />established</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.related} onChange={(e) => setFlags({ related: e.target.checked })} />related</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.newState} onChange={(e) => setFlags({ newState: e.target.checked })} />new</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.invalid} onChange={(e) => setFlags({ invalid: e.target.checked })} />invalid</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.untracked} onChange={(e) => setFlags({ untracked: e.target.checked })} />untracked</label>
              </>
            )
          })()}
        </div>
      </ToggleLine> : null}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='Connection mark' enabled={!!props.form.ct_mark_match} inactiveHint='0x1 / 10' onToggle={() => props.setForm((p) => ({ ...p, ct_mark_match: p.ct_mark_match ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 / 10' value={props.form.ct_mark_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_mark_match: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='Packet mark' enabled={!!props.form.mark_match} inactiveHint='0x1 / 10' onToggle={() => props.setForm((p) => ({ ...p, mark_match: p.mark_match ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 / 10' value={props.form.mark_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, mark_match: e.target.value || null }))} />
        </ToggleLine>
      </div>

      <div className='text-[11px] font-semibold text-muted-foreground'>Meta match</div>
      <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('limit_rate') ? <ToggleLine label='Rate limit' enabled={!!props.form.limit_rate} inactiveHint='10/second' onToggle={() => props.setForm((p) => ({ ...p, limit_rate: p.limit_rate ? null : '10/second' }))}>
          <Input className='h-7' placeholder='10/second' value={props.form.limit_rate || ''} onChange={(e) => props.setForm((p) => ({ ...p, limit_rate: e.target.value || null }))} />
        </ToggleLine> : <div />}
        <ToggleLine label='User ID' enabled={!!props.form.user_id} inactiveHint='1000' onToggle={() => props.setForm((p) => ({ ...p, user_id: p.user_id ? null : '1000' }))}>
          <Input className='h-7' placeholder='1000' value={props.form.user_id || ''} onChange={(e) => props.setForm((p) => ({ ...p, user_id: e.target.value || null }))} />
        </ToggleLine>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='Hour' enabled={!!props.form.hour} inactiveHint='08:00-18:00' onToggle={() => props.setForm((p) => ({ ...p, hour: p.hour ? null : '08:00-18:00' }))}>
          <Input className='h-7' placeholder='08:00-18:00' value={props.form.hour || ''} onChange={(e) => props.setForm((p) => ({ ...p, hour: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='DSCP' enabled={!!props.form.dscp} inactiveHint='cs5 / 46' onToggle={() => props.setForm((p) => ({ ...p, dscp: p.dscp ? null : 'cs5' }))}>
          <Input className='h-7' placeholder='cs5 / 46' value={props.form.dscp || ''} onChange={(e) => props.setForm((p) => ({ ...p, dscp: e.target.value || null }))} />
        </ToggleLine>
      </div>
    </TabsContent>
  )
}
