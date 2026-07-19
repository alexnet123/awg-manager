import { Input } from '@/components/ui/input'

export function PacketPriorityInput(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <Input
        className='h-7'
        placeholder='1:10 / 0x10 / 10'
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value || null)}
      />
      <div className='text-[9px] leading-3 text-muted-foreground'>
        Sets Linux packet priority for tc/QoS. This is not firewall rule order.
      </div>
    </div>
  )
}
