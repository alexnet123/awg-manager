import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FirewallRule } from '../api'
import type { PolicyAdvancedCapabilities } from './capabilities'
import type { PolicyV2ObjectBinding } from './objectBindings'

type Props = {
  activePolicyV2TableName: string
  policyV2Form: Partial<FirewallRule>
  setPolicyV2Form: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  policyV2ChainOptions: string[]
  policyAdvancedCaps: PolicyAdvancedCapabilities
  editingPolicyV2RuleId: string | null
  policyV2FormObjectBindings: PolicyV2ObjectBinding[]
  onOpenBindingObjectFromEditor: (binding: PolicyV2ObjectBinding) => void
  onUnbindObjectInEditor: (binding: PolicyV2ObjectBinding) => void
}

export function PolicyAdvancedRuleEditorBaseSection(props: Props) {
  return (
    <div className='rounded-md border p-2.5'>
      <div className='mb-2 text-[11px] font-semibold text-muted-foreground'>Base</div>
      <div className='grid grid-cols-2 gap-2'>
        <div className='space-y-1.5'>
          <Label>Table</Label>
          <Input className='h-7' disabled value={props.activePolicyV2TableName || '—'} />
        </div>
        <div className='space-y-1.5'>
          <Label>Chain</Label>
          <select
            className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
            value={String(props.policyV2Form.chain || '').toLowerCase() || '__none__'}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, chain: e.target.value === '__none__' ? '' : e.target.value }))}
          >
            <option value='__none__'>Select chain</option>
            {props.policyV2ChainOptions.map((chainName) => (
              <option key={chainName} value={chainName}>{chainName}</option>
            ))}
          </select>
        </div>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <div className='space-y-1.5'>
          <Label>Action</Label>
          <select
            className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
            value={props.policyV2Form.action || 'accept'}
            onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, action: e.target.value as FirewallRule['action'] }))}
          >
            <option value='accept'>accept</option>
            <option value='drop'>drop</option>
            {props.policyAdvancedCaps.supportsRejectAction ? <option value='reject'>reject</option> : null}
            <option value='jump'>jump</option>
            <option value='goto'>goto</option>
            <option value='return'>return</option>
            <option value='queue'>queue</option>
            {props.policyAdvancedCaps.showFwdColumns ? <option value='fwd'>fwd</option> : null}
          </select>
        </div>
        <div className='space-y-1.5'>
          <Label>Enabled</Label>
          <label className='flex h-7 items-center gap-2 rounded-md border px-2.5'>
            <input type='checkbox' className='h-4 w-4' checked={!!props.policyV2Form.enabled} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, enabled: e.target.checked }))} />
            <span>enabled</span>
          </label>
        </div>
      </div>
      {(props.policyV2Form.action === 'jump' || props.policyV2Form.action === 'goto') ? (
        <div className='space-y-1.5'>
          <Label>Target chain</Label>
          <Input className='h-7' placeholder='user_chain' value={props.policyV2Form.target_chain || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, target_chain: e.target.value || null }))} />
        </div>
      ) : null}
      {props.policyV2Form.action === 'reject' ? (
        <div className='space-y-1.5'>
          <Label>Reject type</Label>
          <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.policyV2Form.reject_type || 'default'} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, reject_type: e.target.value === 'default' ? null : e.target.value }))}>
            <option value='default'>default</option>
            <option value='icmpx port-unreachable'>icmpx port-unreachable</option>
            <option value='icmpx admin-prohibited'>icmpx admin-prohibited</option>
            <option value='icmp type host-unreachable'>icmp type host-unreachable</option>
            <option value='tcp reset'>tcp reset</option>
          </select>
        </div>
      ) : null}
      <div className='space-y-1.5'>
        <Label>Comment</Label>
        <Input className='h-7' placeholder='Optional comment' value={props.policyV2Form.comment || ''} onChange={(e) => props.setPolicyV2Form((p) => ({ ...p, comment: e.target.value || null }))} />
      </div>
      {props.policyAdvancedCaps.supportsObjectsTab && (props.editingPolicyV2RuleId || props.policyV2FormObjectBindings.length) ? (
        <div className='space-y-1.5 rounded-md border border-blue-200 bg-blue-50/50 p-2'>
          <div className='text-[11px] font-semibold text-blue-900'>Linked objects (quick actions)</div>
          {props.policyV2FormObjectBindings.length ? (
            <div className='flex flex-wrap gap-1.5'>
              {props.policyV2FormObjectBindings.map((binding) => (
                <div key={`editor-binding-${binding.kind}-${binding.name}`} className='inline-flex items-center gap-1 rounded border border-blue-300 bg-background px-1.5 py-0.5'>
                  <span className='text-[10px] text-blue-900'>{binding.label}</span>
                  <button
                    type='button'
                    className='rounded border border-blue-300 bg-blue-50 px-1 text-[10px] leading-none text-blue-900 hover:bg-blue-100'
                    title='Open object in Policy v2 → objects'
                    onClick={() => props.onOpenBindingObjectFromEditor(binding)}
                  >
                    open
                  </button>
                  <button
                    type='button'
                    className='rounded border border-amber-300 bg-amber-50 px-1 text-[10px] leading-none text-amber-900 hover:bg-amber-100'
                    title='Unlink object from this rule'
                    onClick={() => props.onUnbindObjectInEditor(binding)}
                  >
                    unlink
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-[10px] text-muted-foreground'>No named objects linked yet.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
