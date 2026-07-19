const CT_EVENT_PRESETS = [
  { value: 'new', hint: 'new conntrack entry' },
  { value: 'related', hint: 'related flow' },
  { value: 'destroy', hint: 'entry removed' },
  { value: 'reply', hint: 'reply seen' },
  { value: 'assured', hint: 'assured flow' },
  { value: 'protoinfo', hint: 'protocol info changed' },
  { value: 'helper', hint: 'helper changed' },
  { value: 'mark', hint: 'mark changed' },
  { value: 'seqadj', hint: 'sequence adjustment' },
  { value: 'secmark', hint: 'security mark changed' },
  { value: 'label', hint: 'label changed' },
] as const

export function CtEventPicker(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  const selected = new Set((props.value || '').split(',').map((token) => token.trim()).filter(Boolean))
  const selectedValue = CT_EVENT_PRESETS
    .map((preset) => preset.value)
    .filter((value) => selected.has(value))
    .join(',')

  function toggle(value: string, enabled: boolean) {
    const next = new Set(selected)
    if (enabled) next.add(value)
    else next.delete(value)
    const normalized = CT_EVENT_PRESETS
      .map((preset) => preset.value)
      .filter((presetValue) => next.has(presetValue))
      .join(',')
    props.onChange(normalized || null)
  }

  return (
    <div className='rounded-md border p-2'>
      <div className='grid grid-cols-2 gap-x-2 gap-y-1'>
        {CT_EVENT_PRESETS.map((preset) => (
          <label key={preset.value} className='flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[10px] hover:bg-muted'>
            <input
              type='checkbox'
              className='h-3.5 w-3.5'
              checked={selected.has(preset.value)}
              onChange={(e) => toggle(preset.value, e.target.checked)}
            />
            <span className='w-16 font-semibold leading-4'>{preset.value}</span>
            <span className='truncate text-[9px] leading-4 text-muted-foreground'>{preset.hint}</span>
          </label>
        ))}
      </div>
      <div className='mt-1.5 text-[9px] leading-3 text-muted-foreground'>
        Sets conntrack event mask, not a packet match.
      </div>
      {selectedValue ? (
        <div className='mt-1 rounded-sm bg-muted px-1.5 py-0.5 text-[9px] leading-3 text-muted-foreground'>
          {selectedValue}
        </div>
      ) : null}
    </div>
  )
}
