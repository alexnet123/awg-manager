import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  winPos: { x: number; y: number }
  title: string
  saveLabel: string
  saveDisabled: boolean
  onDragStart: (event: React.MouseEvent<HTMLDivElement>) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent) => void | Promise<void>
  children: React.ReactNode
}

export function PolicyAdvancedRuleEditorModal(props: Props) {
  if (!props.open) return null
  return (
    <div className='fixed inset-0 z-40'>
      <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: props.winPos.x, top: props.winPos.y }}>
        <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={props.onDragStart}>
          <div className='flex items-center justify-between'>
            <span>{props.title}</span>
            <button type='button' className='rounded p-1 hover:bg-background/70' onClick={props.onClose}><X className='size-3.5' /></button>
          </div>
        </div>
        <form className='flex max-h-[78vh] flex-col overflow-hidden rounded-b-xl bg-background text-xs' onSubmit={props.onSubmit}>
          <div className='flex-1 overflow-y-auto p-3 space-y-3'>
            {props.children}
          </div>
          <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
            <Button type='button' variant='outline' onClick={props.onClose}>Cancel</Button>
            <Button type='submit' disabled={props.saveDisabled}><Plus />{props.saveLabel}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

