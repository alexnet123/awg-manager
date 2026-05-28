import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type EditorTab = 'base' | 'advanced' | 'action' | 'stats'

type Props = {
  open: boolean
  winPos: { x: number; y: number }
  onDragStart: (event: React.MouseEvent<HTMLDivElement>) => void
  editingRuleId: string | null
  ruleEditorTab: EditorTab
  setRuleEditorTab: React.Dispatch<React.SetStateAction<EditorTab>>
  onClose: () => void
  onSubmit: (event: React.FormEvent) => Promise<void> | void
  isBusy: boolean
  children: React.ReactNode
}

export function PolicyRuleEditorModal(props: Props) {
  if (!props.open) return null

  return (
    <div className='fixed inset-0 z-40'>
      <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: props.winPos.x, top: props.winPos.y }}>
        <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={props.onDragStart}>
          <div className='flex items-center justify-between'>
            <span>{props.editingRuleId ? 'Edit Firewall Rule' : 'Add Firewall Rule'}</span>
            <button type='button' className='rounded p-1 hover:bg-background/70' onClick={props.onClose}><X className='size-3.5' /></button>
          </div>
        </div>
        <form className='flex max-h-[78vh] flex-col overflow-hidden rounded-b-xl bg-background text-xs' onSubmit={props.onSubmit}>
          <Tabs value={props.ruleEditorTab} onValueChange={(v) => props.setRuleEditorTab(v as EditorTab)} className='flex min-h-0 flex-1 flex-col'>
            <div className='z-20 border-b bg-background px-3 py-2'>
              <TabsList className='h-9'>
                <TabsTrigger className='px-3 text-xs' value='base'>Base match</TabsTrigger>
                <TabsTrigger className='px-3 text-xs' value='advanced'>Advanced match</TabsTrigger>
                <TabsTrigger className='px-3 text-xs' value='action'>Action</TabsTrigger>
                <TabsTrigger className='px-3 text-xs' value='stats'>Statistics</TabsTrigger>
              </TabsList>
            </div>
            <div className='min-h-0 flex-1 overflow-y-auto p-3'>
              {props.children}
            </div>
          </Tabs>

          <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
            <Button type='button' variant='outline' onClick={props.onClose}>Cancel</Button>
            <Button type='submit' disabled={props.isBusy}><Plus />{props.editingRuleId ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
