import * as React from 'react'
import { Input } from '@/components/ui/input'
import type { FirewallRule } from '../api'
import type { PolicyAdvancedCapabilities } from './capabilities'
import { PlannedField, ToggleLine } from './RuleFieldControls'

type Props = {
  family: 'bridge' | 'netdev'
  policyV2Form: Partial<FirewallRule>
  setPolicyV2Form: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  policyV2CounterNames: string[]
  policyV2LimitNames: string[]
  policyV2QuotaNames: string[]
  policyV2CtHelperNames: string[]
  policyV2CtTimeoutNames: string[]
  policyAdvancedCaps: PolicyAdvancedCapabilities
}

export function PolicyAdvancedRuleEditorActionSection(props: Props) {
  return (
    <div className='rounded-md border p-2.5'>
      <div className='mb-2 text-[11px] font-semibold text-muted-foreground'>Action / Logging / Statistics</div>
      {props.family === 'bridge' ? (
        <>
          <div className='mb-2 text-[10px] text-muted-foreground'>
            Named objects from selected table: counters {props.policyV2CounterNames.length}, limits {props.policyV2LimitNames.length}, quotas {props.policyV2QuotaNames.length}, ct-helper {props.policyV2CtHelperNames.length}, ct-timeout {props.policyV2CtTimeoutNames.length}
          </div>
          {!props.policyV2CounterNames.length && !props.policyV2LimitNames.length && !props.policyV2QuotaNames.length && !props.policyV2CtHelperNames.length && !props.policyV2CtTimeoutNames.length ? (
            <div className='mb-2 rounded-md border border-amber-300/60 bg-amber-50/70 px-2.5 py-1.5 text-[10px] text-amber-900'>
              No named objects in this bridge table yet. Create them in Policy2 → objects.
            </div>
          ) : null}
          <div className='mb-2 rounded-md border border-amber-300/60 bg-amber-50/70 px-2.5 py-1.5 text-[10px] text-amber-900'>
            `ct expectation` is planned for bridge and temporarily disabled.
          </div>
        </>
      ) : (
        <div className='mb-2 rounded-md border border-blue-300/60 bg-blue-50/60 px-2.5 py-1.5 text-[10px] text-blue-900'>
          Policy3 uses anonymous statements only: counter, limit, log, queue and fwd. Bridge named objects are intentionally hidden.
        </div>
      )}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine
          label='queue num'
          enabled={props.policyV2Form.action === 'queue' && !!props.policyV2Form.queue_num}
          inactiveHint='0 or 0-3'
          disabled={props.policyV2Form.action !== 'queue'}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, queue_num: p.queue_num ? null : '0' }))}
        >
          <Input className='h-7' placeholder='0 or 0-3' value={props.policyV2Form.queue_num || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, queue_num: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine
          label='queue flags'
          enabled={props.policyV2Form.action === 'queue' && Array.isArray(props.policyV2Form.queue_flags) && props.policyV2Form.queue_flags.length > 0}
          inactiveHint='bypass, fanout'
          disabled={props.policyV2Form.action !== 'queue'}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, queue_flags: Array.isArray(p.queue_flags) && p.queue_flags.length ? null : ['bypass'] }))}
        >
          <Input
            className='h-7'
            placeholder='bypass, fanout'
            value={Array.isArray(props.policyV2Form.queue_flags) ? props.policyV2Form.queue_flags.join(', ') : ''}
            onChange={(e) => {
              const next = e.target.value
                .split(',')
                .map((x) => x.trim().toLowerCase())
                .filter(Boolean)
              props.setPolicyV2Form((p) => ({ ...p, queue_flags: next.length ? (next as any) : null }))
            }}
          />
        </ToggleLine>
      </div>
      {props.policyV2Form.action !== 'queue' ? (
        <div className='text-[10px] text-muted-foreground'>Set action `queue` to enable queue fields.</div>
      ) : null}
      {props.family === 'bridge' ? (
        <>
          <div className='rounded-md border border-blue-300/60 bg-blue-50/60 px-2.5 py-1.5 text-[10px] text-blue-900'>
            `dup` is kept planned for bridge on current runtime and is rejected by backend validation.
            <br />
            `fwd` is netdev-only and will stay outside bridge policy v2; use Policy3 for netdev forwarding.
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <PlannedField label='dup to' placeholder='planned for bridge runtime' />
            <PlannedField label='dup dev' placeholder='planned for bridge runtime' />
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <PlannedField label='fwd to' placeholder='netdev-only (planned)' />
            <PlannedField label='fwd dev' placeholder='netdev-only (planned)' />
          </div>
        </>
      ) : (
        <div className='grid grid-cols-3 gap-2'>
          <ToggleLine label='fwd family' enabled={props.policyV2Form.action === 'fwd' && !!props.policyV2Form.fwd_family} inactiveHint='auto' disabled={props.policyV2Form.action !== 'fwd'} onToggle={() => props.setPolicyV2Form((p) => ({ ...p, fwd_family: p.fwd_family ? null : 'ip' }))}>
            <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.policyV2Form.fwd_family || 'ip'} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, fwd_family: e.target.value as 'ip' | 'ip6' }))}>
              <option value='ip'>ip</option>
              <option value='ip6'>ip6</option>
            </select>
          </ToggleLine>
          <ToggleLine label='fwd to' enabled={props.policyV2Form.action === 'fwd' && !!props.policyV2Form.fwd_to} inactiveHint='192.0.2.1' disabled={props.policyV2Form.action !== 'fwd'} onToggle={() => props.setPolicyV2Form((p) => ({ ...p, fwd_to: p.fwd_to ? null : '192.0.2.1' }))}>
            <Input className='h-7' placeholder='192.0.2.1' value={props.policyV2Form.fwd_to || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, fwd_to: e.target.value || null }))} />
          </ToggleLine>
          <ToggleLine label='fwd dev' enabled={props.policyV2Form.action === 'fwd' && !!props.policyV2Form.fwd_dev} inactiveHint='eth1' disabled={props.policyV2Form.action !== 'fwd'} onToggle={() => props.setPolicyV2Form((p) => ({ ...p, fwd_dev: p.fwd_dev ? null : 'eth1' }))}>
            <Input className='h-7' placeholder='eth1' value={props.policyV2Form.fwd_dev || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, fwd_dev: e.target.value || null }))} />
          </ToggleLine>
        </div>
      )}
      <div className='grid grid-cols-2 gap-2'>
        <label className='flex items-center gap-2 rounded-md border p-2 text-xs'>
          <input
            type='checkbox'
            className='h-4 w-4'
            checked={!!props.policyV2Form.counter}
            disabled={props.family === 'bridge' && !!props.policyV2Form.counter_name}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, counter: e.target.checked }))}
          />
          counter
        </label>
        {props.family === 'bridge' ? (
          <ToggleLine
            label='counter name'
            enabled={!!props.policyV2Form.counter_name}
            inactiveHint='pick from table'
            disabled={!!props.policyV2Form.counter || (!props.policyV2Form.counter_name && props.policyV2CounterNames.length === 0)}
            onToggle={() => props.setPolicyV2Form((p) => ({ ...p, counter_name: p.counter_name ? null : (props.policyV2CounterNames[0] || null) }))}
          >
            <select
              className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
              value={props.policyV2Form.counter_name || '__none__'}
              onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, counter_name: e.target.value === '__none__' ? null : e.target.value }))}
            >
              <option value='__none__' disabled>{props.policyV2CounterNames.length ? 'Select counter object' : 'No counter objects in table'}</option>
              {props.policyV2Form.counter_name && !props.policyV2CounterNames.includes(props.policyV2Form.counter_name) ? <option value={props.policyV2Form.counter_name}>{props.policyV2Form.counter_name} (missing)</option> : null}
              {props.policyV2CounterNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </ToggleLine>
        ) : <div />}
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine
          label='limit rate'
          enabled={!!props.policyV2Form.limit_rate}
          inactiveHint='10/second'
          disabled={props.family === 'bridge' && !!props.policyV2Form.limit_name}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, limit_rate: p.limit_rate ? null : '10/second' }))}
        >
          <Input className='h-7' placeholder='10/second' value={props.policyV2Form.limit_rate || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, limit_rate: e.target.value || null }))} />
        </ToggleLine>
        {props.family === 'bridge' ? (
          <ToggleLine
            label='limit name'
            enabled={!!props.policyV2Form.limit_name}
            inactiveHint='pick from table'
            disabled={!!props.policyV2Form.limit_rate || (!props.policyV2Form.limit_name && props.policyV2LimitNames.length === 0)}
            onToggle={() => props.setPolicyV2Form((p) => ({ ...p, limit_name: p.limit_name ? null : (props.policyV2LimitNames[0] || null) }))}
          >
            <select
              className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
              value={props.policyV2Form.limit_name || '__none__'}
              onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, limit_name: e.target.value === '__none__' ? null : e.target.value }))}
            >
              <option value='__none__' disabled>{props.policyV2LimitNames.length ? 'Select limit object' : 'No limit objects in table'}</option>
              {props.policyV2Form.limit_name && !props.policyV2LimitNames.includes(props.policyV2Form.limit_name) ? <option value={props.policyV2Form.limit_name}>{props.policyV2Form.limit_name} (missing)</option> : null}
              {props.policyV2LimitNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </ToggleLine>
        ) : <div />}
      </div>
      <div className='grid grid-cols-2 gap-2'>
        {props.family === 'bridge' ? (
          <ToggleLine
            label='quota name'
            enabled={!!props.policyV2Form.quota_name}
            inactiveHint='pick from table'
            disabled={!props.policyV2Form.quota_name && props.policyV2QuotaNames.length === 0}
            onToggle={() => props.setPolicyV2Form((p) => ({ ...p, quota_name: p.quota_name ? null : (props.policyV2QuotaNames[0] || null) }))}
          >
            <select
              className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
              value={props.policyV2Form.quota_name || '__none__'}
              onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, quota_name: e.target.value === '__none__' ? null : e.target.value }))}
            >
              <option value='__none__' disabled>{props.policyV2QuotaNames.length ? 'Select quota object' : 'No quota objects in table'}</option>
              {props.policyV2Form.quota_name && !props.policyV2QuotaNames.includes(props.policyV2Form.quota_name) ? <option value={props.policyV2Form.quota_name}>{props.policyV2Form.quota_name} (missing)</option> : null}
              {props.policyV2QuotaNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </ToggleLine>
        ) : <div />}
        <ToggleLine
          label='log level'
          enabled={!!props.policyV2Form.log_level}
          inactiveHint='info'
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, log_level: p.log_level ? null : 'info' }))}
        >
          <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.policyV2Form.log_level || 'info'} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, log_level: (e.target.value || null) as any }))}>
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
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='log prefix' enabled={!!props.policyV2Form.log_prefix} inactiveHint={props.policyAdvancedCaps.logPrefixDefault} onToggle={() => props.setPolicyV2Form((p) => ({ ...p, log_prefix: p.log_prefix ? null : props.policyAdvancedCaps.logPrefixDefault }))}>
          <Input className='h-7' placeholder={props.policyAdvancedCaps.logPrefixDefault} value={props.policyV2Form.log_prefix || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, log_prefix: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine
          label='log flags'
          enabled={Array.isArray(props.policyV2Form.log_flags) && props.policyV2Form.log_flags.length > 0}
          inactiveHint='tcp sequence, ip options'
          disabled={props.policyV2Form.log_group !== null && props.policyV2Form.log_group !== undefined}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, log_flags: Array.isArray(p.log_flags) && p.log_flags.length ? null : ['tcp sequence'] }))}
        >
          <Input
            className='h-7'
            placeholder='tcp sequence, tcp options, ip options, skuid, ether, all'
            value={Array.isArray(props.policyV2Form.log_flags) ? props.policyV2Form.log_flags.join(', ') : ''}
            onChange={(e) => {
              const next = e.target.value
                .split(',')
                .map((x) => x.trim().toLowerCase())
                .filter(Boolean)
              props.setPolicyV2Form((p) => ({ ...p, log_flags: next.length ? (next as any) : null }))
            }}
          />
        </ToggleLine>
      </div>
      {props.family === 'bridge' ? (
        <>
          <div className='grid grid-cols-2 gap-2'>
            <ToggleLine label='ct helper set' enabled={!!props.policyV2Form.ct_helper_set} inactiveHint='pick from table' disabled={!props.policyV2Form.ct_helper_set && props.policyV2CtHelperNames.length === 0} onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ct_helper_set: p.ct_helper_set ? null : (props.policyV2CtHelperNames[0] || null) }))}>
              <select
                className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                value={props.policyV2Form.ct_helper_set || '__none__'}
                onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ct_helper_set: e.target.value === '__none__' ? null : e.target.value }))}
              >
                <option value='__none__' disabled>{props.policyV2CtHelperNames.length ? 'Select ct helper object' : 'No ct helper objects in table'}</option>
                {props.policyV2Form.ct_helper_set && !props.policyV2CtHelperNames.includes(props.policyV2Form.ct_helper_set) ? <option value={props.policyV2Form.ct_helper_set}>{props.policyV2Form.ct_helper_set} (missing)</option> : null}
                {props.policyV2CtHelperNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </ToggleLine>
            <ToggleLine label='ct timeout set' enabled={!!props.policyV2Form.ct_timeout_set} inactiveHint='pick from table' disabled={!props.policyV2Form.ct_timeout_set && props.policyV2CtTimeoutNames.length === 0} onToggle={() => props.setPolicyV2Form((p) => ({ ...p, ct_timeout_set: p.ct_timeout_set ? null : (props.policyV2CtTimeoutNames[0] || null) }))}>
              <select
                className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                value={props.policyV2Form.ct_timeout_set || '__none__'}
                onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, ct_timeout_set: e.target.value === '__none__' ? null : e.target.value }))}
              >
                <option value='__none__' disabled>{props.policyV2CtTimeoutNames.length ? 'Select ct timeout object' : 'No ct timeout objects in table'}</option>
                {props.policyV2Form.ct_timeout_set && !props.policyV2CtTimeoutNames.includes(props.policyV2Form.ct_timeout_set) ? <option value={props.policyV2Form.ct_timeout_set}>{props.policyV2Form.ct_timeout_set} (missing)</option> : null}
                {props.policyV2CtTimeoutNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </ToggleLine>
          </div>
          <div className='grid grid-cols-2 gap-2'>
            <ToggleLine label='ct expectation set' enabled={false} onToggle={() => {}} inactiveHint='planned for bridge' disabled>
              <Input className='h-7' placeholder='planned for bridge' value='' disabled />
            </ToggleLine>
            <div />
          </div>
        </>
      ) : null}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine
          label='log group'
          enabled={props.policyV2Form.log_group !== null && props.policyV2Form.log_group !== undefined}
          inactiveHint='0..65535'
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, log_group: (p.log_group === null || p.log_group === undefined) ? 0 : null, log_snaplen: (p.log_group === null || p.log_group === undefined) ? p.log_snaplen : null, log_queue_threshold: (p.log_group === null || p.log_group === undefined) ? p.log_queue_threshold : null }))}
        >
          <Input
            className='h-7'
            placeholder='0..65535'
            value={props.policyV2Form.log_group === null || props.policyV2Form.log_group === undefined ? '' : String(props.policyV2Form.log_group)}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, log_group: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </ToggleLine>
        <ToggleLine
          label='log snaplen'
          enabled={props.policyV2Form.log_snaplen !== null && props.policyV2Form.log_snaplen !== undefined}
          inactiveHint='1..4294967295'
          disabled={props.policyV2Form.log_group === null || props.policyV2Form.log_group === undefined}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, log_snaplen: (p.log_snaplen === null || p.log_snaplen === undefined) ? 256 : null }))}
        >
          <Input
            className='h-7'
            placeholder='1..4294967295'
            value={props.policyV2Form.log_snaplen === null || props.policyV2Form.log_snaplen === undefined ? '' : String(props.policyV2Form.log_snaplen)}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, log_snaplen: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </ToggleLine>
      </div>
      {(props.policyV2Form.log_group === null || props.policyV2Form.log_group === undefined) ? (
        <div className='text-[10px] text-muted-foreground'>`log snaplen` and `log queue-threshold` require `log group` enabled.</div>
      ) : null}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine
          label='log queue-threshold'
          enabled={props.policyV2Form.log_queue_threshold !== null && props.policyV2Form.log_queue_threshold !== undefined}
          inactiveHint='1..4294967295'
          disabled={props.policyV2Form.log_group === null || props.policyV2Form.log_group === undefined}
          onToggle={() => props.setPolicyV2Form((p) => ({ ...p, log_queue_threshold: (p.log_queue_threshold === null || p.log_queue_threshold === undefined) ? 1 : null }))}
        >
          <Input
            className='h-7'
            placeholder='1..4294967295'
            value={props.policyV2Form.log_queue_threshold === null || props.policyV2Form.log_queue_threshold === undefined ? '' : String(props.policyV2Form.log_queue_threshold)}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, log_queue_threshold: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </ToggleLine>
      </div>
    </div>
  )
}
