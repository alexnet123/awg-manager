import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsContent } from '@/components/ui/tabs'
import { CtEventPicker } from './CtEventPicker'
import { PacketPriorityInput } from './PacketPriorityInput'
import { ToggleLine } from './RuleFieldControls'
import type { FirewallRule } from '../api'

export type DynamicSetStatementOption = {
  kind: 'addr' | 'port'
  name: string
  expressions: Array<NonNullable<FirewallRule['set_stmt_expr']>>
}

export type VmapStatementOption = {
  kind: 'vmap'
  name: string
  expressions: Array<NonNullable<FirewallRule['vmap_stmt_expr']>>
}

type Props = {
  selectedAction: string
  isNatActionSelected: boolean
  form: Partial<FirewallRule>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  hasSupport: (key: string) => boolean
  natActionOptions: string[]
  objectLimitNames: string[]
  objectQuotaNames: string[]
  objectCtHelperNames: string[]
  objectCtTimeoutNames: string[]
  objectCtExpectationNames: string[]
  dynamicSetOptions: DynamicSetStatementOption[]
  vmapStatementOptions: VmapStatementOption[]
}

export function PolicyRuleEditorActionTab(props: Props) {
  const family = String(props.form.family || 'inet').toLowerCase()
  const chain = String(props.form.chain || '').toLowerCase()
  const natActionOptions = new Set(props.natActionOptions)
  const supportsNatActions = (family === 'inet' || family === 'ip' || family === 'ip6') && props.hasSupport('nat_type') && natActionOptions.size > 0
  const supportsFwdAction = family === 'netdev'
  const supportsObjectBindings = family !== 'netdev'
  const supportsDynamicSetStatements = family === 'inet'
  const supportsVmapStatements = family === 'inet'
  const supportsRawActions = props.hasSupport('nftrace') || props.hasSupport('notrack')
  const dynamicSetEnabled = !!props.form.set_stmt_name
  const vmapEnabled = !!props.form.vmap_stmt_name
  const selectedDynamicSet = props.dynamicSetOptions.find((item) => item.name === props.form.set_stmt_name) || null
  const dynamicSetExpressions = selectedDynamicSet?.expressions || props.dynamicSetOptions[0]?.expressions || []
  const selectedVmap = props.vmapStatementOptions.find((item) => item.name === props.form.vmap_stmt_name) || null
  const vmapExpressions = selectedVmap?.expressions || props.vmapStatementOptions[0]?.expressions || []
  const setDynamicTarget = (name: string | null) => {
    const target = props.dynamicSetOptions.find((item) => item.name === name) || props.dynamicSetOptions[0] || null
    props.setForm((p) => ({
      ...p,
      vmap_stmt_expr: null,
      vmap_stmt_name: null,
      set_stmt_name: target?.name || null,
      set_stmt_expr: target?.expressions[0] || null,
      set_stmt_op: target ? (p.set_stmt_op || 'add') : null,
      set_stmt_timeout: target ? (p.set_stmt_timeout || '10s') : null,
      set_stmt_comment: null,
    }))
  }
  const setVmapTarget = (name: string | null) => {
    const target = props.vmapStatementOptions.find((item) => item.name === name) || props.vmapStatementOptions[0] || null
    props.setForm((p) => ({
      ...p,
      action: target ? '' : (p.action || 'accept'),
      nat_type: null,
      target_chain: null,
      reject_type: null,
      set_stmt_op: null,
      set_stmt_name: null,
      set_stmt_expr: null,
      set_stmt_timeout: null,
      set_stmt_comment: null,
      vmap_stmt_name: target?.name || null,
      vmap_stmt_expr: target?.expressions[0] || null,
    }))
  }

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
              props.setForm((p) => ({ ...p, nat_type: v as any, action: 'accept', target_chain: null, vmap_stmt_expr: null, vmap_stmt_name: null }))
            } else {
              props.setForm((p) => ({ ...p, action: v as FirewallRule['action'], nat_type: null, vmap_stmt_expr: null, vmap_stmt_name: null }))
            }
          }}
        >
          {vmapEnabled ? <option value=''>vmap decides</option> : null}
          <option value='accept'>accept</option>
          <option value='drop'>drop</option>
          {family !== 'netdev' ? <option value='reject'>reject</option> : null}
          <option value='jump'>jump</option>
          <option value='goto'>goto</option>
          <option value='return'>return</option>
          <option value='queue'>queue</option>
          {supportsFwdAction ? <option value='fwd'>fwd</option> : null}
          {supportsNatActions && natActionOptions.has('dnat') ? <option value='dnat'>dnat</option> : null}
          {supportsNatActions && natActionOptions.has('snat') ? <option value='snat'>snat</option> : null}
          {supportsNatActions && natActionOptions.has('masquerade') ? <option value='masquerade'>masquerade</option> : null}
          {supportsNatActions && natActionOptions.has('redirect') ? <option value='redirect'>redirect</option> : null}
        </select>
      </div>
      {props.hasSupport('nat_type') && (family === 'inet' || family === 'ip' || family === 'ip6') ? (
        <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
          {supportsNatActions
            ? (chain === 'postrouting'
              ? 'NAT chain hint: postrouting uses snat or masquerade.'
              : 'NAT chain hint: prerouting/output use dnat or redirect.')
            : 'NAT chain hint: switch to prerouting/output for dnat or redirect; switch to postrouting for snat or masquerade.'}
        </div>
      ) : null}
      {!supportsNatActions ? (
        <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
          {family === 'bridge' || family === 'netdev'
            ? 'NAT actions are not available for bridge/netdev rules.'
            : 'NAT actions are shown only when the selected family/table/chain supports NAT.'}
        </div>
      ) : null}
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

      <ToggleLine
        label='ct event set'
        enabled={!!props.form.ct_event}
        inactiveHint='new / related / destroy'
        onToggle={() => props.setForm((p) => ({ ...p, ct_event: p.ct_event ? null : 'new' }))}
      >
        <CtEventPicker
          value={props.form.ct_event || null}
          onChange={(value) => props.setForm((p) => ({ ...p, ct_event: value }))}
        />
      </ToggleLine>

      <ToggleLine
        label='set packet priority (QoS)'
        enabled={!!props.form.meta_priority}
        inactiveHint='1:10 / 0x10 / 10'
        onToggle={() => props.setForm((p) => ({ ...p, meta_priority: p.meta_priority ? null : '1:10' }))}
      >
        <PacketPriorityInput
          value={props.form.meta_priority || null}
          onChange={(value) => props.setForm((p) => ({ ...p, meta_priority: value }))}
        />
      </ToggleLine>

      <div className='rounded-md border p-2'>
        <div className='mb-1 text-[11px] font-semibold text-muted-foreground'>Raw actions</div>
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
              notrack
            </label>
          ) : (
            <label className='flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground'>
              <input type='checkbox' disabled className='h-4 w-4' />
              notrack (raw table only)
            </label>
          )}
        </div>
        {supportsRawActions ? (
          <div className='mt-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-900'>
            `notrack` is usually meaningful only in raw prerouting/output contexts.
          </div>
        ) : null}
      </div>

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

      {props.form.action === 'queue' ? (
        <div className='grid grid-cols-2 gap-2 rounded-md border p-2'>
          <ToggleLine
            label='queue num'
            enabled={!!props.form.queue_num}
            inactiveHint='0 or 0-3'
            onToggle={() => props.setForm((p) => ({ ...p, queue_num: p.queue_num ? null : '0' }))}
          >
            <Input
              className='h-7'
              placeholder='0 or 0-3'
              value={props.form.queue_num || ''}
              onChange={(e) => props.setForm((p) => ({ ...p, queue_num: e.target.value || null }))}
            />
          </ToggleLine>
          <ToggleLine
            label='queue flags'
            enabled={Array.isArray(props.form.queue_flags) && props.form.queue_flags.length > 0}
            inactiveHint='bypass, fanout'
            onToggle={() => props.setForm((p) => ({
              ...p,
              queue_flags: Array.isArray(p.queue_flags) && p.queue_flags.length ? null : ['bypass'],
            }))}
          >
            <Input
              className='h-7'
              placeholder='bypass, fanout'
              value={Array.isArray(props.form.queue_flags) ? props.form.queue_flags.join(', ') : ''}
              onChange={(e) => {
                const next = e.target.value
                  .split(',')
                  .map((x) => x.trim().toLowerCase())
                  .filter(Boolean)
                props.setForm((p) => ({ ...p, queue_flags: next.length ? (next as any) : null }))
              }}
            />
          </ToggleLine>
        </div>
      ) : null}

      {props.form.action === 'fwd' && supportsFwdAction ? (
        <div className='grid grid-cols-3 gap-2 rounded-md border p-2'>
          <ToggleLine
            label='fwd family'
            enabled={!!props.form.fwd_family}
            inactiveHint='auto'
            onToggle={() => props.setForm((p) => ({ ...p, fwd_family: p.fwd_family ? null : 'ip' }))}
          >
            <select
              className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
              value={props.form.fwd_family || 'ip'}
              onChange={(e) => props.setForm((p) => ({ ...p, fwd_family: e.target.value as 'ip' | 'ip6' }))}
            >
              <option value='ip'>ip</option>
              <option value='ip6'>ip6</option>
            </select>
          </ToggleLine>
          <ToggleLine
            label='fwd to'
            enabled={!!props.form.fwd_to}
            inactiveHint='192.0.2.1'
            onToggle={() => props.setForm((p) => ({ ...p, fwd_to: p.fwd_to ? null : '192.0.2.1' }))}
          >
            <Input className='h-7' placeholder='192.0.2.1' value={props.form.fwd_to || ''} onChange={(e) => props.setForm((p) => ({ ...p, fwd_to: e.target.value || null }))} />
          </ToggleLine>
          <ToggleLine
            label='fwd dev'
            enabled={!!props.form.fwd_dev}
            inactiveHint='eth1'
            onToggle={() => props.setForm((p) => ({ ...p, fwd_dev: p.fwd_dev ? null : 'eth1' }))}
          >
            <Input className='h-7' placeholder='eth1' value={props.form.fwd_dev || ''} onChange={(e) => props.setForm((p) => ({ ...p, fwd_dev: e.target.value || null }))} />
          </ToggleLine>
        </div>
      ) : null}

      {supportsDynamicSetStatements ? (
        <div className='space-y-2 rounded-md border p-2'>
          <div className='flex items-center justify-between gap-2'>
            <div>
              <div className='text-[11px] font-semibold text-muted-foreground'>Dynamic set update</div>
              <div className='text-[10px] text-muted-foreground'>Runtime-safe: inet addr/port sets, timeout required, comment disabled</div>
            </div>
            <button
              type='button'
              aria-label={dynamicSetEnabled ? 'Disable dynamic set update' : 'Enable dynamic set update'}
              className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50'
              disabled={!dynamicSetEnabled && props.dynamicSetOptions.length === 0}
              onClick={() => {
                if (dynamicSetEnabled) {
                  props.setForm((p) => ({
                    ...p,
                    set_stmt_op: null,
                    set_stmt_name: null,
                    set_stmt_expr: null,
                    set_stmt_timeout: null,
                    set_stmt_comment: null,
                  }))
                } else {
                  setDynamicTarget(props.dynamicSetOptions[0]?.name || null)
                }
              }}
            >
              {dynamicSetEnabled ? '-' : '+'}
            </button>
          </div>
          {dynamicSetEnabled ? (
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'>
                <Label>target set</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={props.form.set_stmt_name || ''}
                  onChange={(e) => setDynamicTarget(e.target.value || null)}
                >
                  {props.dynamicSetOptions.map((item) => (
                    <option key={`${item.kind}:${item.name}`} value={item.name}>{item.kind} / {item.name}</option>
                  ))}
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label>set op</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={props.form.set_stmt_op || 'add'}
                  onChange={(e) => props.setForm((p) => ({ ...p, set_stmt_op: e.target.value as FirewallRule['set_stmt_op'] }))}
                >
                  <option value='add'>add</option>
                  <option value='update'>update</option>
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label>set expression</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={props.form.set_stmt_expr || dynamicSetExpressions[0] || ''}
                  onChange={(e) => props.setForm((p) => ({ ...p, set_stmt_expr: e.target.value as FirewallRule['set_stmt_expr'] }))}
                >
                  {dynamicSetExpressions.map((expr) => <option key={expr} value={expr}>{expr}</option>)}
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label>set timeout</Label>
                <Input
                  className='h-7'
                  placeholder='10s'
                  value={props.form.set_stmt_timeout || ''}
                  onChange={(e) => props.setForm((p) => ({ ...p, set_stmt_timeout: e.target.value || null, set_stmt_comment: null }))}
                />
              </div>
            </div>
          ) : (
            <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
              {props.dynamicSetOptions.length ? 'Enable to add/update a dynamic collection from this rule.' : 'No dynamic addr/port sets yet. Create a dynamic collection before enabling this statement.'}
            </div>
          )}
        </div>
      ) : (
        <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
          Dynamic set update is available only for inet rules.
        </div>
      )}

      {supportsVmapStatements ? (
        <div className='space-y-2 rounded-md border p-2'>
          <div className='flex items-center justify-between gap-2'>
            <div>
              <div className='text-[11px] font-semibold text-muted-foreground'>Verdict map</div>
              <div className='text-[10px] text-muted-foreground'>Runtime-safe: inet protocol vmap, named vmap collection only</div>
            </div>
            <button
              type='button'
              aria-label={vmapEnabled ? 'Disable verdict map' : 'Enable verdict map'}
              className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50'
              disabled={!vmapEnabled && props.vmapStatementOptions.length === 0}
              onClick={() => {
                if (vmapEnabled) {
                  props.setForm((p) => ({
                    ...p,
                    action: 'accept',
                    vmap_stmt_expr: null,
                    vmap_stmt_name: null,
                  }))
                } else {
                  setVmapTarget(props.vmapStatementOptions[0]?.name || null)
                }
              }}
            >
              {vmapEnabled ? '-' : '+'}
            </button>
          </div>
          {vmapEnabled ? (
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'>
                <Label>target vmap</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={props.form.vmap_stmt_name || ''}
                  onChange={(e) => setVmapTarget(e.target.value || null)}
                >
                  {props.vmapStatementOptions.map((item) => (
                    <option key={`${item.kind}:${item.name}`} value={item.name}>{item.kind} / {item.name}</option>
                  ))}
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label>vmap expression</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={props.form.vmap_stmt_expr || vmapExpressions[0] || ''}
                  onChange={(e) => props.setForm((p) => ({ ...p, vmap_stmt_expr: e.target.value as FirewallRule['vmap_stmt_expr'] }))}
                >
                  {vmapExpressions.map((expr) => <option key={expr} value={expr}>{expr}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
              {props.vmapStatementOptions.length ? 'Enable to let a verdict map choose accept/drop/return by protocol.' : 'No protocol vmap collections yet. Create a vmap like tcp:accept, udp:drop first.'}
            </div>
          )}
        </div>
      ) : (
        <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
          Verdict map is available only for inet rules.
        </div>
      )}

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
      {supportsObjectBindings ? (
        <div className='grid grid-cols-2 gap-2'>
          <ToggleLine label='ct helper object' enabled={!!props.form.ct_helper_set} inactiveHint='pick from table' disabled={!props.form.ct_helper_set && props.objectCtHelperNames.length === 0} onToggle={() => props.setForm((p) => ({ ...p, ct_helper_set: p.ct_helper_set ? null : (props.objectCtHelperNames[0] || null) }))}>
            <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.ct_helper_set || '__none__'} onChange={(e) => props.setForm((p) => ({ ...p, ct_helper_set: e.target.value === '__none__' ? null : e.target.value }))}>
              <option value='__none__'>{props.objectCtHelperNames.length ? 'Select ct helper object' : 'No ct helper objects in table'}</option>
              {props.form.ct_helper_set && !props.objectCtHelperNames.includes(props.form.ct_helper_set) ? <option value={props.form.ct_helper_set}>{props.form.ct_helper_set} (missing)</option> : null}
              {props.objectCtHelperNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </ToggleLine>
          <ToggleLine label='ct timeout object' enabled={!!props.form.ct_timeout_set} inactiveHint='pick from table' disabled={!props.form.ct_timeout_set && props.objectCtTimeoutNames.length === 0} onToggle={() => props.setForm((p) => ({ ...p, ct_timeout_set: p.ct_timeout_set ? null : (props.objectCtTimeoutNames[0] || null) }))}>
            <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.ct_timeout_set || '__none__'} onChange={(e) => props.setForm((p) => ({ ...p, ct_timeout_set: e.target.value === '__none__' ? null : e.target.value }))}>
              <option value='__none__'>{props.objectCtTimeoutNames.length ? 'Select ct timeout object' : 'No ct timeout objects in table'}</option>
              {props.form.ct_timeout_set && !props.objectCtTimeoutNames.includes(props.form.ct_timeout_set) ? <option value={props.form.ct_timeout_set}>{props.form.ct_timeout_set} (missing)</option> : null}
              {props.objectCtTimeoutNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </ToggleLine>
          {family === 'inet' || family === 'ip' || family === 'ip6' ? (
            <ToggleLine label='ct expectation object' enabled={!!props.form.ct_expectation_set} inactiveHint='pick from table' disabled={!props.form.ct_expectation_set && props.objectCtExpectationNames.length === 0} onToggle={() => props.setForm((p) => ({ ...p, ct_expectation_set: p.ct_expectation_set ? null : (props.objectCtExpectationNames[0] || null) }))}>
              <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.ct_expectation_set || '__none__'} onChange={(e) => props.setForm((p) => ({ ...p, ct_expectation_set: e.target.value === '__none__' ? null : e.target.value }))}>
                <option value='__none__'>{props.objectCtExpectationNames.length ? 'Select ct expectation object' : 'No ct expectation objects in table'}</option>
                {props.form.ct_expectation_set && !props.objectCtExpectationNames.includes(props.form.ct_expectation_set) ? <option value={props.form.ct_expectation_set}>{props.form.ct_expectation_set} (missing)</option> : null}
                {props.objectCtExpectationNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </ToggleLine>
          ) : (
            <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
              ct expectation object is available only for inet/ip/ip6 rules.
            </div>
          )}
        </div>
      ) : (
        <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
          Named object bindings are not available for netdev rules.
        </div>
      )}

      {supportsObjectBindings ? (
        <div className='space-y-2 rounded-md border p-2'>
          <div className='text-[11px] font-semibold text-muted-foreground'>Named objects</div>
          <div className='grid grid-cols-2 gap-2'>
            <ToggleLine label='limit object' enabled={!!props.form.limit_name} inactiveHint='pick from table' disabled={!props.form.limit_name && props.objectLimitNames.length === 0} onToggle={() => props.setForm((p) => ({ ...p, limit_name: p.limit_name ? null : (props.objectLimitNames[0] || null), limit_rate: p.limit_name ? p.limit_rate : null }))}>
              <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.limit_name || '__none__'} onChange={(e) => props.setForm((p) => ({ ...p, limit_name: e.target.value === '__none__' ? null : e.target.value, limit_rate: e.target.value === '__none__' ? p.limit_rate : null }))}>
                <option value='__none__'>{props.objectLimitNames.length ? 'Select limit object' : 'No limit objects in table'}</option>
                {props.form.limit_name && !props.objectLimitNames.includes(props.form.limit_name) ? <option value={props.form.limit_name}>{props.form.limit_name} (missing)</option> : null}
                {props.objectLimitNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </ToggleLine>
            <ToggleLine label='quota object' enabled={!!props.form.quota_name} inactiveHint='pick from table' disabled={!props.form.quota_name && props.objectQuotaNames.length === 0} onToggle={() => props.setForm((p) => ({ ...p, quota_name: p.quota_name ? null : (props.objectQuotaNames[0] || null) }))}>
              <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.quota_name || '__none__'} onChange={(e) => props.setForm((p) => ({ ...p, quota_name: e.target.value === '__none__' ? null : e.target.value }))}>
                <option value='__none__'>{props.objectQuotaNames.length ? 'Select quota object' : 'No quota objects in table'}</option>
                {props.form.quota_name && !props.objectQuotaNames.includes(props.form.quota_name) ? <option value={props.form.quota_name}>{props.form.quota_name} (missing)</option> : null}
                {props.objectQuotaNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </ToggleLine>
          </div>
          {!props.objectLimitNames.length && !props.objectQuotaNames.length && !props.objectCtHelperNames.length && !props.objectCtTimeoutNames.length && !props.objectCtExpectationNames.length ? (
            <div className='rounded-md border border-amber-300/60 bg-amber-50/70 px-2.5 py-1.5 text-[10px] text-amber-900'>
              No named objects in this table yet. Create them from the Objects section.
            </div>
          ) : null}
        </div>
      ) : null}

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
