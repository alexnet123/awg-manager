import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsContent } from '@/components/ui/tabs'
import { ToggleLine } from './RuleFieldControls'
import type { FirewallRule } from '../api'

type Props = {
  selectedAction: string
  isNatActionSelected: boolean
  form: Partial<FirewallRule>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  hasSupport: (key: string) => boolean
}

export function PolicyRuleEditorActionTab(props: Props) {
  return (
    <TabsContent value='action' className='mt-2 space-y-2.5'>
      <div className='text-[11px] font-semibold text-muted-foreground'>Verdict / Action</div>
      <div className='space-y-1.5'>
        <Label>Action</Label>
        <select
          className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
          value={String(props.selectedAction)}
          onChange={(e) => {
            const v = e.target.value
            if (['dnat', 'snat', 'masquerade', 'redirect'].includes(v)) {
              props.setForm((p) => ({ ...p, nat_type: v as any, action: 'accept', target_chain: null }))
            } else {
              props.setForm((p) => ({ ...p, action: v as FirewallRule['action'], nat_type: null }))
            }
          }}
        >
          <option value='accept'>accept</option>
          <option value='drop'>drop</option>
          <option value='reject'>reject</option>
          <option value='jump'>jump</option>
          <option value='goto'>goto</option>
          <option value='return'>return</option>
          <option value='dnat'>dnat</option>
          <option value='snat'>snat</option>
          <option value='masquerade'>masquerade</option>
          <option value='redirect'>redirect</option>
        </select>
      </div>
      <ToggleLine
        label='Target / to'
        inactiveHint='192.168.1.10:80 / chain_name / :8080'
        enabled={props.isNatActionSelected || props.form.action === 'jump' || props.form.action === 'goto'}
        onToggle={() => props.setForm((p) => ({ ...p, target_chain: p.target_chain ? null : 'input', to_addr: p.to_addr ? null : '192.168.1.10' }))}
      >
        <Input
          className='h-7'
          placeholder='192.168.1.10:80 / chain_name / :8080'
          value={props.isNatActionSelected ? `${props.form.to_addr || ''}${props.form.to_port ? `:${props.form.to_port}` : ''}` : (props.form.target_chain || '')}
          onChange={(e) => {
            const raw = e.target.value
            if (props.isNatActionSelected) {
              const [addr, port] = raw.split(':')
              props.setForm((p) => ({ ...p, to_addr: addr || null, to_port: port || null }))
            } else {
              props.setForm((p) => ({ ...p, target_chain: raw || null }))
            }
          }}
        />
      </ToggleLine>

      {props.form.action === 'reject' ? (
        <div className='space-y-1.5 rounded-md border p-2'>
          <Label>Reject with</Label>
          <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.reject_type || 'default'} onChange={(e) => props.setForm((p) => ({ ...p, reject_type: e.target.value === 'default' ? null : e.target.value }))}>
            <option value='default'>default</option>
            <option value='icmpx port-unreachable'>icmpx port-unreachable</option>
            <option value='icmpx admin-prohibited'>icmpx admin-prohibited</option>
            <option value='icmp type host-unreachable'>icmp type host-unreachable</option>
            <option value='tcp reset'>tcp reset</option>
          </select>
        </div>
      ) : null}

      {props.isNatActionSelected ? (
        <div className='space-y-1.5 rounded-md border p-2'>
          <Label>NAT options</Label>
          <div className='flex flex-wrap items-center gap-3 text-xs'>
            <label className='flex items-center gap-2'><input type='checkbox' className='h-4 w-4' checked={!!props.form.nat_random} onChange={(e) => props.setForm((p) => ({ ...p, nat_random: e.target.checked }))} />random</label>
            <label className='flex items-center gap-2'><input type='checkbox' className='h-4 w-4' checked={!!props.form.nat_fully_random} onChange={(e) => props.setForm((p) => ({ ...p, nat_fully_random: e.target.checked }))} />fully-random</label>
            <label className='flex items-center gap-2'><input type='checkbox' className='h-4 w-4' checked={!!props.form.nat_persistent} onChange={(e) => props.setForm((p) => ({ ...p, nat_persistent: e.target.checked }))} />persistent</label>
          </div>
        </div>
      ) : null}

      <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('mark_set') ? <ToggleLine label='meta mark set' enabled={!!props.form.mark_set} inactiveHint='0x1 or 10' onToggle={() => props.setForm((p) => ({ ...p, mark_set: p.mark_set ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 or 10' value={props.form.mark_set || ''} onChange={(e) => props.setForm((p) => ({ ...p, mark_set: e.target.value || null }))} />
        </ToggleLine> : <div />}
        {props.hasSupport('ct_mark_set') ? <ToggleLine label='ct mark set' enabled={!!props.form.ct_mark_set} inactiveHint='0x1 or 10' onToggle={() => props.setForm((p) => ({ ...p, ct_mark_set: p.ct_mark_set ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 or 10' value={props.form.ct_mark_set || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_mark_set: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div>
      <div className='grid grid-cols-3 gap-2'>
        <ToggleLine label='ct helper set' enabled={!!props.form.ct_helper_set} inactiveHint='ftp-standard' onToggle={() => props.setForm((p) => ({ ...p, ct_helper_set: p.ct_helper_set ? null : 'ftp-standard' }))}>
          <Input className='h-7' placeholder='ftp-standard' value={props.form.ct_helper_set || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_helper_set: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='ct timeout set' enabled={!!props.form.ct_timeout_set} inactiveHint='customtimeout' onToggle={() => props.setForm((p) => ({ ...p, ct_timeout_set: p.ct_timeout_set ? null : 'customtimeout' }))}>
          <Input className='h-7' placeholder='customtimeout' value={props.form.ct_timeout_set || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_timeout_set: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='ct expectation set' enabled={!!props.form.ct_expectation_set} inactiveHint='expect' onToggle={() => props.setForm((p) => ({ ...p, ct_expectation_set: p.ct_expectation_set ? null : 'expect' }))}>
          <Input className='h-7' placeholder='expect' value={props.form.ct_expectation_set || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_expectation_set: e.target.value || null }))} />
        </ToggleLine>
      </div>

      <div className='space-y-1.5 border-t pt-2'>
        <ToggleLine
          label='Log level'
          enabled={!!props.form.log_level}
          inactiveHint='info'
          onToggle={() => props.setForm((p) => ({ ...p, log_level: p.log_level ? null : 'info' }))}
        >
          <select
            className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
            value={props.form.log_level || 'info'}
            onChange={(e) => props.setForm((p) => ({ ...p, log_level: (e.target.value || null) as any }))}
          >
            <option value='emerg'>emerg</option>
            <option value='alert'>alert</option>
            <option value='crit'>crit</option>
            <option value='err'>err</option>
            <option value='warn'>warn</option>
            <option value='notice'>notice</option>
            <option value='info'>info</option>
            <option value='debug'>debug</option>
          </select>
        </ToggleLine>
        <ToggleLine
          label='Log prefix'
          enabled={!!props.form.log_prefix}
          inactiveHint='FW input:'
          onToggle={() => props.setForm((p) => ({ ...p, log_prefix: p.log_prefix ? null : 'FW input:' }))}
        >
          <Input
            className='h-7'
            placeholder='FW input:'
            value={props.form.log_prefix || ''}
            onChange={(e) => props.setForm((p) => ({ ...p, log_prefix: e.target.value || null }))}
          />
        </ToggleLine>
      </div>
    </TabsContent>
  )
}
