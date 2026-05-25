import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleLine } from './RuleFieldControls'

type CollectionKind = 'addr' | 'port' | 'iface' | 'map' | 'vmap'

type Props = {
  open: boolean
  winPos: { x: number; y: number }
  onDragStart: (event: React.MouseEvent<HTMLDivElement>) => void
  editingSetId: string | null
  collectionKind: CollectionKind
  setCollectionKind: React.Dispatch<React.SetStateAction<CollectionKind>>
  newSetReadOnly: boolean
  collectionFieldClass: string
  newSetName: string
  setNewSetName: React.Dispatch<React.SetStateAction<string>>
  newSetElements: string
  setNewSetElements: React.Dispatch<React.SetStateAction<string>>
  newSetTimeoutEnabled: boolean
  setNewSetTimeoutEnabled: React.Dispatch<React.SetStateAction<boolean>>
  newSetTimeout: string
  setNewSetTimeout: React.Dispatch<React.SetStateAction<string>>
  newSetComment: string
  setNewSetComment: React.Dispatch<React.SetStateAction<string>>
  isBusy: boolean
  setSetOpen: React.Dispatch<React.SetStateAction<boolean>>
  onSaveSet: () => Promise<boolean>
}

export function CollectionsModal(props: Props) {
  if (!props.open) return null

  return (
    <div className='fixed inset-0 z-40'>
      <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: props.winPos.x, top: props.winPos.y }}>
        <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={props.onDragStart}>
          <div className='flex items-center justify-between'>
            <span>{props.editingSetId ? `Edit ${props.collectionKind}` : 'Add collection'}{props.newSetReadOnly ? ' (read-only)' : ''}</span>
            <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => props.setSetOpen(false)}><X className='size-3.5' /></button>
          </div>
        </div>
        <div className='flex max-h-[78vh] flex-col overflow-hidden rounded-b-xl bg-background text-xs'>
          <div className='flex-1 overflow-y-auto p-3 space-y-3'>
            <div className='space-y-1.5'>
              <Label>Type</Label>
              <select className={`${props.collectionFieldClass} w-full rounded-md border bg-background px-2.5`} value={props.collectionKind} onChange={(e) => props.setCollectionKind(e.target.value as CollectionKind)} disabled={props.newSetReadOnly}>
                <option value='addr'>addr</option>
                <option value='port'>port</option>
                <option value='iface'>iface</option>
                <option value='map'>map</option>
                <option value='vmap'>vmap</option>
              </select>
            </div>
            <div className='space-y-1.5'>
              <Label>Name</Label>
              <Input className={props.collectionFieldClass} placeholder={props.collectionKind === 'map' || props.collectionKind === 'vmap' ? 'map_name' : 'set_name'} value={props.newSetName} onChange={(e) => props.setNewSetName(e.target.value)} disabled={props.newSetReadOnly} />
            </div>
            <div className='space-y-1.5'>
              <Label>{props.collectionKind === 'map' || props.collectionKind === 'vmap' ? 'Entries (comma-separated, key:value)' : 'Elements (comma-separated)'}</Label>
              <Input
                className={props.collectionFieldClass}
                placeholder={
                  props.collectionKind === 'iface'
                    ? 'eth0, awg1'
                    : props.collectionKind === 'port'
                      ? '22, 443, 51820'
                      : props.collectionKind === 'map' || props.collectionKind === 'vmap'
                        ? 'tcp:accept, udp:drop'
                        : '10.0.0.0/24, 192.168.1.0/24'
                }
                value={props.newSetElements}
                onChange={(e) => props.setNewSetElements(e.target.value)}
                disabled={props.newSetReadOnly}
              />
            </div>
            <ToggleLine
              label='Timeout'
              enabled={props.newSetTimeoutEnabled}
              inactiveHint='Finite only; e.g. 10m or 1d 15:00:00'
              disabled={props.newSetReadOnly}
              onToggle={() => {
                if (props.newSetTimeoutEnabled) {
                  props.setNewSetTimeoutEnabled(false)
                  props.setNewSetTimeout('')
                } else {
                  props.setNewSetTimeoutEnabled(true)
                  if (!props.newSetTimeout.trim()) props.setNewSetTimeout('1h')
                }
              }}
            >
              <Input className={props.collectionFieldClass} placeholder='10m, 2h30m, 1d 15:00:00' value={props.newSetTimeout} onChange={(e) => props.setNewSetTimeout(e.target.value)} disabled={props.newSetReadOnly} />
            </ToggleLine>
            <div className='space-y-1.5'>
              <Label>Comment</Label>
              <Input className={props.collectionFieldClass} placeholder='Optional comment' value={props.newSetComment} onChange={(e) => props.setNewSetComment(e.target.value)} disabled={props.newSetReadOnly} />
            </div>
          </div>
          <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
            <Button type='button' variant='outline' onClick={() => props.setSetOpen(false)}>Cancel</Button>
            <Button type='button' disabled={props.isBusy || !props.newSetName.trim() || props.newSetReadOnly} onClick={async () => { const ok = await props.onSaveSet(); if (ok) props.setSetOpen(false) }}><Plus />{props.editingSetId ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
