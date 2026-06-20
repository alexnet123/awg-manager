import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TableChainType = 'filter' | 'nat' | 'route'
type TableHook = 'prerouting' | 'input' | 'forward' | 'output' | 'postrouting' | 'ingress'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'

type Props = {
  open: boolean
  winPos: { x: number; y: number }
  onDragStart: (event: React.MouseEvent<HTMLDivElement>) => void
  editingTableId: string | null
  newTableFamily: TableFamily
  setNewTableFamily: React.Dispatch<React.SetStateAction<TableFamily>>
  newTableName: string
  setNewTableName: React.Dispatch<React.SetStateAction<string>>
  newChainName: string
  setNewChainName: React.Dispatch<React.SetStateAction<string>>
  newChainType: TableChainType
  setNewChainType: React.Dispatch<React.SetStateAction<TableChainType>>
  newHook: TableHook
  setNewHook: React.Dispatch<React.SetStateAction<TableHook>>
  allowedHooksForChainType: TableHook[]
  deviceRequiredForHook: boolean
  newDevice: string
  setNewDevice: React.Dispatch<React.SetStateAction<string>>
  newPriority: string
  setNewPriority: React.Dispatch<React.SetStateAction<string>>
  newPolicy: 'accept' | 'drop'
  setNewPolicy: React.Dispatch<React.SetStateAction<'accept' | 'drop'>>
  isBusy: boolean
  setTableOpen: React.Dispatch<React.SetStateAction<boolean>>
  onSaveTable: () => Promise<boolean>
}

export function TableBuilderModal(props: Props) {
  if (!props.open) return null

  return (
    <div className='fixed inset-0 z-40'>
      <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: props.winPos.x, top: props.winPos.y }}>
        <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={props.onDragStart}>
          <div className='flex items-center justify-between'>
            <span>{props.editingTableId ? 'Edit Table Chain' : 'Add Table Chain'}</span>
            <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => props.setTableOpen(false)}><X className='size-3.5' /></button>
          </div>
        </div>
        <div className='flex max-h-[78vh] flex-col overflow-hidden rounded-b-xl bg-background text-xs'>
          <div className='flex-1 overflow-y-auto p-3 space-y-3'>
            <div className='space-y-1.5'><Label>Family</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.newTableFamily} onChange={(e) => props.setNewTableFamily(e.target.value as TableFamily)}><option value='inet'>inet</option><option value='ip'>ip</option><option value='ip6'>ip6</option><option value='bridge'>bridge</option><option value='netdev'>netdev</option></select></div>
            <div className='space-y-1.5'><Label>Table name</Label><Input className='h-7' placeholder='custom_table' value={props.newTableName} onChange={(e) => props.setNewTableName(e.target.value)} /></div>
            <div className='space-y-1.5'><Label>Chain name</Label><Input className='h-7' placeholder='input_custom' value={props.newChainName} onChange={(e) => props.setNewChainName(e.target.value)} /></div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'><Label>Chain type</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.newChainType} onChange={(e) => props.setNewChainType(e.target.value as TableChainType)}><option value='filter'>filter</option><option value='nat'>nat</option><option value='route'>route</option></select></div>
              <div className='space-y-1.5'><Label>Hook</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.newHook} onChange={(e) => props.setNewHook(e.target.value as TableHook)}>{props.allowedHooksForChainType.map((hookName) => <option key={hookName} value={hookName}>{hookName}</option>)}</select></div>
            </div>
            <div className='space-y-1.5'>
              <Label>Device</Label>
              <Input className='h-7' placeholder={props.deviceRequiredForHook ? 'eth0 (required for ingress)' : 'Only for ingress hook'} value={props.newDevice} onChange={(e) => props.setNewDevice(e.target.value)} disabled={!props.deviceRequiredForHook} />
              {props.newTableFamily === 'netdev' ? (
                <div className='rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground'>
                  <div>netdev tables use filter/ingress on one device.</div>
                  <div>Device is required for netdev ingress, for example eth0.</div>
                  <div>netdev egress is not enabled on the current runtime profile.</div>
                </div>
              ) : null}
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='space-y-1.5'><Label>Priority</Label><Input className='h-7' value={props.newPriority} onChange={(e) => props.setNewPriority(e.target.value)} /></div>
              <div className='space-y-1.5'><Label>Policy</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.newPolicy} onChange={(e) => props.setNewPolicy(e.target.value as 'accept' | 'drop')}><option value='accept'>accept</option><option value='drop'>drop</option></select></div>
            </div>
            <div className='rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900'>
              Built-in priorities are reserved: -300, -150, -100, 0, 100.
            </div>
          </div>
          <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
            <Button type='button' variant='outline' onClick={() => props.setTableOpen(false)}>Cancel</Button>
            <Button type='button' disabled={props.isBusy || !props.newTableName.trim() || !props.newChainName.trim()} onClick={async () => { const ok = await props.onSaveTable(); if (ok) props.setTableOpen(false) }}><Plus />{props.editingTableId ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
