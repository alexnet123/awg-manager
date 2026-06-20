import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FirewallObjectForm } from './firewallObjectForm'
import type { FirewallObjectPreset } from './useFirewallObjectEditor'

type Props = {
  open: boolean
  isBusy: boolean
  activeObjectFamily: 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
  activeObjectTableName: string
  editingFirewallObjectId: string | null
  firewallObjectForm: FirewallObjectForm
  setFirewallObjectForm: React.Dispatch<React.SetStateAction<FirewallObjectForm>>
  setFirewallObjectOpen: React.Dispatch<React.SetStateAction<boolean>>
  onSaveFirewallObject: () => Promise<boolean>
  applyFirewallObjectPreset: (preset: FirewallObjectPreset) => void
}

export function FirewallObjectModal(props: Props) {
  if (!props.open) return null
  const ctObjectSupported = props.activeObjectFamily !== 'netdev'
  const ctExpectationSupported = props.activeObjectFamily === 'inet' || props.activeObjectFamily === 'ip' || props.activeObjectFamily === 'ip6'

  return (
    <div className='fixed inset-0 z-40'>
      <div className='absolute inset-0 bg-black/20' onClick={() => props.setFirewallObjectOpen(false)} />
      <div className='absolute left-1/2 top-1/2 z-50 w-[680px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl'>
        <form
          className='flex max-h-[86vh] flex-col overflow-hidden rounded-xl text-xs'
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await props.onSaveFirewallObject()
            if (ok) props.setFirewallObjectOpen(false)
          }}
        >
          <div className='border-b px-3 py-2 text-xs font-medium'>
            <div className='flex items-center justify-between'>
              <span>{props.editingFirewallObjectId ? 'Edit Firewall Object' : 'Add Firewall Object'}</span>
              <button type='button' className='rounded p-1 hover:bg-muted' onClick={() => props.setFirewallObjectOpen(false)}><X className='size-3.5' /></button>
            </div>
            {!props.editingFirewallObjectId ? (
              <div className='mt-2 flex flex-wrap items-center gap-1.5'>
                <span className='text-[10px] text-muted-foreground'>Examples:</span>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyFirewallObjectPreset('counter_ssh')}>SSH counter</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyFirewallObjectPreset('limit_dns')}>DNS limit</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyFirewallObjectPreset('quota_bridge')}>Traffic quota</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyFirewallObjectPreset('helper_ftp')}>FTP helper</button>
                <button type='button' className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted' onClick={() => props.applyFirewallObjectPreset('timeout_tcp')}>TCP timeout</button>
                <button
                  type='button'
                  className='rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
                  disabled={!ctExpectationSupported}
                  title={ctExpectationSupported ? 'Create a ct_expectation object' : 'ct_expectation is supported for inet/ip/ip6 only'}
                  onClick={() => props.applyFirewallObjectPreset('expectation_ftp')}
                >
                  FTP expectation
                </button>
              </div>
            ) : null}
          </div>
          <div className='flex-1 space-y-3 overflow-y-auto p-3'>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'>
                <Label>Kind</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5'
                  value={props.firewallObjectForm.kind}
                  onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, kind: e.target.value as FirewallObjectForm['kind'] }))}
                >
                  <option value='counter'>counter</option>
                  <option value='limit'>limit</option>
                  <option value='quota'>quota</option>
                  <option value='ct_helper' disabled={!ctObjectSupported}>ct_helper{ctObjectSupported ? '' : ' (not netdev)'}</option>
                  <option value='ct_timeout' disabled={!ctObjectSupported}>ct_timeout{ctObjectSupported ? '' : ' (not netdev)'}</option>
                  <option value='ct_expectation' disabled={!ctExpectationSupported}>ct_expectation{ctExpectationSupported ? '' : ' (inet/ip/ip6 only)'}</option>
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label>Enabled</Label>
                <label className='flex h-7 items-center gap-2 rounded-md border px-2.5'>
                  <input
                    type='checkbox'
                    className='h-4 w-4'
                    checked={!!props.firewallObjectForm.enabled}
                    onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, enabled: e.target.checked }))}
                  />
                  enabled
                </label>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'>
                <Label>Name</Label>
                <Input className='h-7' placeholder='object_name' value={props.firewallObjectForm.name} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className='space-y-1.5'>
                <Label>Comment</Label>
                <Input className='h-7' placeholder='Optional comment' value={props.firewallObjectForm.comment} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, comment: e.target.value }))} />
              </div>
            </div>

            {props.firewallObjectForm.kind === 'counter' ? (
              <div className='grid grid-cols-2 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>packets</Label>
                  <Input className='h-7' placeholder='0 (optional)' value={props.firewallObjectForm.packets} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, packets: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>bytes</Label>
                  <Input className='h-7' placeholder='0 (optional)' value={props.firewallObjectForm.bytes} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, bytes: e.target.value }))} />
                </div>
              </div>
            ) : null}

            {props.firewallObjectForm.kind === 'limit' ? (
              <div className='space-y-2 rounded-md border p-2.5'>
                <div className='grid grid-cols-2 gap-2'>
                  <div className='space-y-1.5'>
                    <Label>rate</Label>
                    <Input className='h-7' placeholder='10/second or 1024 bytes/second' value={props.firewallObjectForm.rate} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, rate: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>burst</Label>
                    <Input className='h-7' placeholder='20 packets (optional)' value={props.firewallObjectForm.burst} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, burst: e.target.value }))} />
                  </div>
                </div>
                <label className='flex h-7 items-center gap-2 rounded-md border px-2.5'>
                  <input type='checkbox' className='h-4 w-4' checked={!!props.firewallObjectForm.over} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, over: e.target.checked }))} />
                  over
                </label>
              </div>
            ) : null}

            {props.firewallObjectForm.kind === 'quota' ? (
              <div className='grid grid-cols-3 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>mode</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.firewallObjectForm.quota_mode} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, quota_mode: e.target.value as 'over' | 'until' }))}>
                    <option value='over'>over</option>
                    <option value='until'>until</option>
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>bytes</Label>
                  <Input className='h-7' placeholder='20 mbytes' value={props.firewallObjectForm.quota_bytes} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, quota_bytes: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>used</Label>
                  <Input className='h-7' placeholder='1 mbytes (optional)' value={props.firewallObjectForm.quota_used} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, quota_used: e.target.value }))} />
                </div>
              </div>
            ) : null}

            {props.firewallObjectForm.kind === 'ct_helper' ? (
              ctObjectSupported ? (
                <div className='grid grid-cols-3 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>helper type</Label>
                  <Input className='h-7' placeholder='ftp' value={props.firewallObjectForm.helper_type} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, helper_type: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>l4proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.firewallObjectForm.l4proto} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, l4proto: e.target.value as 'tcp' | 'udp' }))}>
                    <option value='tcp'>tcp</option>
                    <option value='udp'>udp</option>
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>l3proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.firewallObjectForm.l3proto || '__auto__'} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, l3proto: e.target.value === '__auto__' ? '' : (e.target.value as 'ip' | 'ip6') }))}>
                    <option value='__auto__'>auto</option>
                    <option value='ip'>ip</option>
                    <option value='ip6'>ip6</option>
                  </select>
                </div>
              </div>
              ) : (
                <div className='rounded-md border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900'>
                  `ct helper` objects are not supported for netdev object tables.
                </div>
              )
            ) : null}

            {props.firewallObjectForm.kind === 'ct_timeout' ? (
              ctObjectSupported ? (
                <div className='grid grid-cols-3 gap-2 rounded-md border p-2.5'>
                <div className='space-y-1.5'>
                  <Label>l4proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.firewallObjectForm.l4proto} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, l4proto: e.target.value as 'tcp' | 'udp' }))}>
                    <option value='tcp'>tcp</option>
                    <option value='udp'>udp</option>
                  </select>
                </div>
                <div className='space-y-1.5 col-span-2'>
                  <Label>timeout policy</Label>
                  <Input className='h-7' placeholder='established:120, close:20' value={props.firewallObjectForm.timeout_policy} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, timeout_policy: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>l3proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.firewallObjectForm.l3proto || '__auto__'} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, l3proto: e.target.value === '__auto__' ? '' : (e.target.value as 'ip' | 'ip6') }))}>
                    <option value='__auto__'>auto</option>
                    <option value='ip'>ip</option>
                    <option value='ip6'>ip6</option>
                  </select>
                </div>
              </div>
              ) : (
                <div className='rounded-md border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900'>
                  `ct timeout` objects are not supported for netdev object tables.
                </div>
              )
            ) : null}

            {props.firewallObjectForm.kind === 'ct_expectation' ? (
              ctExpectationSupported ? (
                <div className='grid grid-cols-4 gap-2 rounded-md border p-2.5'>
                  <div className='space-y-1.5'>
                    <Label>l4proto</Label>
                    <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.firewallObjectForm.l4proto} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, l4proto: e.target.value as 'tcp' | 'udp' }))}>
                      <option value='tcp'>tcp</option>
                      <option value='udp'>udp</option>
                    </select>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>dport</Label>
                    <Input className='h-7' placeholder='21' value={props.firewallObjectForm.dport} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, dport: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>timeout</Label>
                    <Input className='h-7' placeholder='2m' value={props.firewallObjectForm.timeout} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, timeout: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>size</Label>
                    <Input className='h-7' placeholder='8' value={props.firewallObjectForm.size} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, size: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>l3proto</Label>
                    <select className='h-7 w-full rounded-md border bg-background px-2.5' value={props.firewallObjectForm.l3proto || '__auto__'} onChange={(e) => props.setFirewallObjectForm((p) => ({ ...p, l3proto: e.target.value === '__auto__' ? '' : (e.target.value as 'ip' | 'ip6') }))}>
                      <option value='__auto__'>auto</option>
                      <option value='ip'>ip</option>
                      <option value='ip6'>ip6</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className='rounded-md border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900'>
                  `ct expectation` is supported for inet/ip/ip6 object tables only.
                </div>
              )
            ) : null}
          </div>
          <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
            <Button type='button' variant='outline' onClick={() => props.setFirewallObjectOpen(false)}>Cancel</Button>
            <Button type='submit' disabled={props.isBusy || !props.activeObjectTableName || !props.firewallObjectForm.name.trim()}><Plus />{props.editingFirewallObjectId ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
