import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ToggleLine(props: { label: string; enabled: boolean; onToggle: () => void; children: React.ReactNode; inactiveHint?: string; disabled?: boolean }) {
  return (
    <div className='space-y-1.5'>
      <div className='flex items-center justify-between gap-2'>
        <Label>{props.label}</Label>
      </div>
      {props.enabled
        ? (
          <div className='relative'>
            <div className='pr-8'>
              {props.children}
            </div>
            <button
              type='button'
              className='absolute right-1 top-1 h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50'
              onClick={props.onToggle}
              disabled={props.disabled}
            >
              -
            </button>
          </div>
        )
        : (
          <div className='flex h-7 items-center justify-between rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground'>
            <span className='truncate pr-2'>{props.inactiveHint || ''}</span>
            <button type='button' className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground disabled:pointer-events-none disabled:opacity-50' onClick={props.onToggle} disabled={props.disabled}>+</button>
          </div>
        )}
    </div>
  )
}

export function PlannedField(props: { label: string; placeholder: string }) {
  return (
    <ToggleLine label={props.label} enabled={false} onToggle={() => {}} inactiveHint={props.placeholder}>
      <Input className='h-7' disabled placeholder={`${props.placeholder} (planned)`} />
    </ToggleLine>
  )
}

export function MarkMatchInput(props: {
  value?: string | null
  kind: 'packet' | 'connection'
  onChange: (value: string | null) => void
}) {
  const helper = props.kind === 'packet'
    ? 'Matches existing packet mark. To set it, use Action -> meta mark set.'
    : 'Matches existing connection mark. To set it, use Action -> ct mark set.'

  return (
    <div className='space-y-1'>
      <Input
        className='h-7'
        placeholder='0x1 / 10'
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value || null)}
      />
      <div className='text-[9px] leading-3 text-muted-foreground'>
        {helper}
      </div>
    </div>
  )
}
