import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PolicyV2ObjectForm } from './policyV2ObjectForm'
import type { PolicyV2ObjectPreset } from './usePolicyAdvancedObjectEditor'

type Props = {
  open: boolean
  isBusy: boolean
  activePolicyV2TableName: string
  editingPolicyV2ObjectId: string | null
  policyV2ObjectForm: PolicyV2ObjectForm
  setPolicyV2ObjectForm: React.Dispatch<React.SetStateAction<PolicyV2ObjectForm>>
  setPolicyV2ObjectOpen: React.Dispatch<React.SetStateAction<boolean>>
  onSavePolicyV2Object: () => Promise<boolean>
  applyPolicyV2ObjectPreset: (preset: PolicyV2ObjectPreset) => void
}

export function PolicyBridgeObjectModal(props: Props) {
  if (!props.open) return null

  return (
    <div className='fixed inset-0 z-40'>
      <div className='absolute inset-0 bg-black/20' onClick={() => props.setPolicyV2ObjectOpen(false)} />
      <div className='absolute left-1/2 top-1/2 z-50 w-[680px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl'>
        <form
          className='flex max-h-[86vh] flex-col overflow-hidden rounded-xl text-xs'
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await props.onSavePolicyV2Object()
            if (ok) props.setPolicyV2ObjectOpen(false)
          }}
        >
          <div className='border-b px-3 py-2 text-xs font-medium'>
            <div className='flex items-center justify-between'>
              <span>{props.editingPolicyV2ObjectId ? 'Edit Bridge Object (Policy v2)' : 'Add Bridge Object (Policy v2)'}</span>
              <button type='button' className='rounded p-1 hover:bg-muted' onClick={() => props.setPolicyV2ObjectOpen(false)}><X className='size-3.5' /></button>
            </div>
            {!props.editingPolicyV2ObjectId ? (
              <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                <span className='text-[10px] text-muted-foreground'>Examples:</span>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyPolicyV2ObjectPreset('counter_ssh')}>SSH counter</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyPolicyV2ObjectPreset('limit_dns')}>DNS limit</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyPolicyV2ObjectPreset('quota_bridge')}>Bridge quota</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyPolicyV2ObjectPreset('helper_ftp')}>FTP helper</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyPolicyV2ObjectPreset('timeout_tcp')}>TCP timeout</button>
              </div>
            ) : null}
          </div>
          <div className='flex-1 space-y-3 overflow-y-auto p-3'>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'>
                <Label>Kind</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5'
                  value={props.policyV2ObjectForm.kind}
                  onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, kind: e.target.value as PolicyV2ObjectForm['kind'] }))}
                >
                  <option value='counter'>counter</option>
                  <option value='limit'>limit</option>
                  <option value='quota'>quota</option>
                  <option value='ct_helper'>ct_helper</option>
                  <option value='ct_timeout'>ct_timeout</option>
                  <option value='ct_expectation' disabled>ct_expectation (planned for bridge)</option>
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label>Enabled</Label>
                <label className='flex h-7 items-center gap-2 rounded-md border px-2.5'>
                  <input
                    type='checkbox'
                    className='h-4 w-4'
                    checked={!!props.policyV2ObjectForm.enabled}
                    onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                  enabled
                </label>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'>
                <Label>Name</Label>
                <Input className='h-7' placeholder='object_name' value={props.policyV2ObjectForm.name} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className='space-y-1.5'>
                <Label>Comment</Label>
                <Input className='h-7' placeholder='Optional comment' value={props.policyV2ObjectForm.comment} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, comment: e.target.value }))} />
              </div>
            </div>

            {props.policyV2ObjectForm.kind === 'counter' ? (
              <div className='grid grid-cols-2 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>packets</Label>
                  <Input className='h-7' placeholder='0 (optional)' value={props.policyV2ObjectForm.packets} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, packets: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>bytes</Label>
                  <Input className='h-7' placeholder='0 (optional)' value={props.policyV2ObjectForm.bytes} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, bytes: e.target.value }))} />
                </div>
              </div>
            ) : null}

            {props.policyV2ObjectForm.kind === 'limit' ? (
              <div className='space-y-2 rounded-md border p-2.5'>
                <div className='grid grid-cols-2 gap-2'>
                  <div className='space-y-1.5'>
                    <Label>rate</Label>
                    <Input className='h-7' placeholder='10/second or 1024 bytes/second' value={props.policyV2ObjectForm.rate} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, rate: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>burst</Label>
                    <Input className='h-7' placeholder='20 packets (optional)' value={props.policyV2ObjectForm.burst} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, burst: e.target.value }))} />
                  </div>
                </div>
                <label className='flex h-7 items-center gap-2 rounded-md border px-2.5'>
                  <input type='checkbox' className='h-4 w-4' checked={!!props.policyV2ObjectForm.over} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, over: e.target.checked }))} />
                  over
                </label>
              </div>
            ) : null}

            {props.policyV2ObjectForm.kind === 'quota' ? (
              <div className='grid grid-cols-3 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>mode</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.policyV2ObjectForm.quota_mode} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, quota_mode: e.target.value as 'over' | 'until' }))}>
                    <option value='over'>over</option>
                    <option value='until'>until</option>
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>bytes</Label>
                  <Input className='h-7' placeholder='20 mbytes' value={props.policyV2ObjectForm.quota_bytes} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, quota_bytes: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>used</Label>
                  <Input className='h-7' placeholder='1 mbytes (optional)' value={props.policyV2ObjectForm.quota_used} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, quota_used: e.target.value }))} />
                </div>
              </div>
            ) : null}

            {props.policyV2ObjectForm.kind === 'ct_helper' ? (
              <div className='grid grid-cols-3 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>helper type</Label>
                  <Input className='h-7' placeholder='ftp' value={props.policyV2ObjectForm.helper_type} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, helper_type: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>l4proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.policyV2ObjectForm.l4proto} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, l4proto: e.target.value as 'tcp' | 'udp' }))}>
                    <option value='tcp'>tcp</option>
                    <option value='udp'>udp</option>
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>l3proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.policyV2ObjectForm.l3proto || '__auto__'} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, l3proto: e.target.value === '__auto__' ? '' : (e.target.value as 'ip' | 'ip6') }))}>
                    <option value='__auto__'>auto</option>
                    <option value='ip'>ip</option>
                    <option value='ip6'>ip6</option>
                  </select>
                </div>
              </div>
            ) : null}

            {props.policyV2ObjectForm.kind === 'ct_timeout' ? (
              <div className='grid grid-cols-3 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>l4proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.policyV2ObjectForm.l4proto} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, l4proto: e.target.value as 'tcp' | 'udp' }))}>
                    <option value='tcp'>tcp</option>
                    <option value='udp'>udp</option>
                  </select>
                </div>
                <div className='space-y-1.5 col-span-2'>
                  <Label>timeout policy</Label>
                  <Input className='h-7' placeholder='established:120, close:20' value={props.policyV2ObjectForm.timeout_policy} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, timeout_policy: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>l3proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.policyV2ObjectForm.l3proto || '__auto__'} onChange={(e) => props.setPolicyV2ObjectForm((p) => ({ ...p, l3proto: e.target.value === '__auto__' ? '' : (e.target.value as 'ip' | 'ip6') }))}>
                    <option value='__auto__'>auto</option>
                    <option value='ip'>ip</option>
                    <option value='ip6'>ip6</option>
                  </select>
                </div>
              </div>
            ) : null}

            {props.policyV2ObjectForm.kind === 'ct_expectation' ? (
              <div className='rounded-md border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900'>
                `ct expectation` is planned for bridge and temporarily disabled.
              </div>
            ) : null}
          </div>
          <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
            <Button type='button' variant='outline' onClick={() => props.setPolicyV2ObjectOpen(false)}>Cancel</Button>
            <Button type='submit' disabled={props.isBusy || !props.activePolicyV2TableName || !props.policyV2ObjectForm.name.trim()}><Plus />{props.editingPolicyV2ObjectId ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
