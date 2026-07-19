import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { MarkMatchInput, ToggleLine } from './RuleFieldControls'
import type { FirewallRule } from '../api'

type Props = {
  form: Partial<FirewallRule>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  advOpen: Record<string, boolean>
  setAdvOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  hasSupport: (key: string) => boolean
}

const TCP_FLAG_PRESETS = [
  { value: 'syn', label: 'SYN', hint: 'new connection' },
  { value: 'syn,ack', label: 'SYN + ACK', hint: 'server reply' },
  { value: 'rst', label: 'RST', hint: 'reset' },
  { value: 'fin', label: 'FIN', hint: 'close' },
  { value: 'ack', label: 'ACK', hint: 'acknowledge' },
  { value: 'psh,ack', label: 'PSH + ACK', hint: 'data push' },
  { value: 'fin,ack', label: 'FIN + ACK', hint: 'close reply' },
  { value: 'rst,ack', label: 'RST + ACK', hint: 'reset reply' },
] as const

const META_PKTTYPE_PRESETS = ['host', 'broadcast', 'multicast', 'other'] as const
const CT_DIRECTION_PRESETS = ['original', 'reply'] as const
const CT_STATUS_PRESETS = [
  { value: 'expected', label: 'expected', hint: 'helper-expected flow' },
  { value: 'seen-reply', label: 'seen-reply', hint: 'reply side seen' },
  { value: 'assured', label: 'assured', hint: 'stable tracked flow' },
  { value: 'confirmed', label: 'confirmed', hint: 'confirmed by kernel' },
  { value: 'snat', label: 'snat', hint: 'source NAT applied' },
  { value: 'dnat', label: 'dnat', hint: 'destination NAT applied' },
  { value: 'dying', label: 'dying', hint: 'being removed' },
] as const

const CT_HELPER_PRESETS = [
  { value: 'ftp', hint: 'FTP control/data helper' },
  { value: 'sip', hint: 'SIP signaling helper' },
  { value: 'tftp', hint: 'TFTP helper' },
  { value: 'irc', hint: 'IRC DCC helper' },
  { value: 'h323', hint: 'H.323 helper' },
  { value: 'pptp', hint: 'PPTP helper' },
] as const

const FIB_EXPR_PRESETS = [
  {
    value: 'fib saddr . iif oif missing',
    label: 'Block spoofed source',
    short: 'Source has no return route',
    hint: 'Use this for anti-spoofing: match packets when Linux cannot route traffic back to the source through the input interface.',
  },
  {
    value: 'fib saddr . iif oif exists',
    label: 'Require source return route',
    short: 'Source has a valid return route',
    hint: 'Match packets only when Linux can route traffic back to the source through the input interface.',
  },
  {
    value: 'fib daddr . iif oif exists',
    label: 'Require destination route',
    short: 'Destination is reachable',
    hint: 'Match only packets whose destination has a valid route in the Linux routing table.',
  },
  {
    value: 'fib daddr . iif type local',
    label: 'Match local destination',
    short: 'Destination belongs to this server',
    hint: 'Match packets whose destination address is configured locally on this machine.',
  },
  {
    value: 'fib daddr . iif type != local',
    label: 'Match non-local destination',
    short: 'Destination is not this server',
    hint: 'Match packets whose destination is routed through this machine instead of terminating on it.',
  },
  {
    value: 'fib daddr . iif oif missing',
    label: 'Drop unroutable destination',
    short: 'Destination has no route',
    hint: 'Match packets when Linux has no route for the destination address.',
  },
] as const

const IPV6_EXTENSION_HEADER_OPTIONS = [
  { value: 'frag', label: 'Fragment' },
  { value: 'hbh', label: 'Hop-by-Hop' },
  { value: 'rt', label: 'Routing' },
  { value: 'dst', label: 'Destination Options' },
  { value: 'mh', label: 'Mobility' },
] as const

const ARPHRD_TYPE_OPTIONS = [
  { label: 'Ethernet', value: '1' },
  { label: 'Loopback', value: '772' },
  { label: 'PPP', value: '512' },
  { label: 'Tunnel', value: '768' },
  { label: 'IPv6 tunnel', value: '769' },
  { label: 'None', value: '65534' },
] as const

const ICMP_TYPE_PRESETS = [
  { value: 'echo-request', hint: 'ping request' },
  { value: 'echo-reply', hint: 'ping reply' },
  { value: 'destination-unreachable', hint: 'network/host/port error' },
  { value: 'time-exceeded', hint: 'traceroute TTL expired' },
  { value: 'parameter-problem', hint: 'bad IP header' },
  { value: 'redirect', hint: 'route redirect' },
  { value: 'timestamp-request', hint: 'legacy timestamp request' },
  { value: 'timestamp-reply', hint: 'legacy timestamp reply' },
] as const

const ICMPV6_TYPE_PRESETS = [
  { value: 'echo-request', hint: 'ping request' },
  { value: 'echo-reply', hint: 'ping reply' },
  { value: 'destination-unreachable', hint: 'network/host/port error' },
  { value: 'packet-too-big', hint: 'PMTU discovery' },
  { value: 'time-exceeded', hint: 'hop limit expired' },
  { value: 'parameter-problem', hint: 'bad IPv6 header' },
  { value: 'nd-router-solicit', hint: 'neighbor discovery' },
  { value: 'nd-router-advert', hint: 'neighbor discovery' },
  { value: 'nd-neighbor-solicit', hint: 'neighbor discovery' },
  { value: 'nd-neighbor-advert', hint: 'neighbor discovery' },
] as const

const ICMP_CODE_PRESETS: Record<string, readonly { value: string; hint: string }[]> = {
  'echo-request': [{ value: '0', hint: 'only valid code' }],
  'echo-reply': [{ value: '0', hint: 'only valid code' }],
  'timestamp-request': [{ value: '0', hint: 'only valid code' }],
  'timestamp-reply': [{ value: '0', hint: 'only valid code' }],
  'destination-unreachable': [
    { value: '0', hint: 'network unreachable' },
    { value: '1', hint: 'host unreachable' },
    { value: '2', hint: 'protocol unreachable' },
    { value: '3', hint: 'port unreachable' },
    { value: '4', hint: 'fragmentation needed' },
    { value: '13', hint: 'administratively prohibited' },
  ],
  'time-exceeded': [
    { value: '0', hint: 'TTL expired in transit' },
    { value: '1', hint: 'fragment reassembly timeout' },
  ],
  'parameter-problem': [
    { value: '0', hint: 'bad header pointer' },
    { value: '1', hint: 'required option missing' },
    { value: '2', hint: 'bad length' },
  ],
  redirect: [
    { value: '0', hint: 'redirect network' },
    { value: '1', hint: 'redirect host' },
    { value: '2', hint: 'redirect network TOS' },
    { value: '3', hint: 'redirect host TOS' },
  ],
}

const ICMPV6_CODE_PRESETS: Record<string, readonly { value: string; hint: string }[]> = {
  'echo-request': [{ value: '0', hint: 'only valid code' }],
  'echo-reply': [{ value: '0', hint: 'only valid code' }],
  'packet-too-big': [{ value: '0', hint: 'only valid code' }],
  'nd-router-solicit': [{ value: '0', hint: 'only valid code' }],
  'nd-router-advert': [{ value: '0', hint: 'only valid code' }],
  'nd-neighbor-solicit': [{ value: '0', hint: 'only valid code' }],
  'nd-neighbor-advert': [{ value: '0', hint: 'only valid code' }],
  'destination-unreachable': [
    { value: '0', hint: 'no route' },
    { value: '1', hint: 'admin prohibited' },
    { value: '2', hint: 'beyond scope' },
    { value: '3', hint: 'address unreachable' },
    { value: '4', hint: 'port unreachable' },
  ],
  'time-exceeded': [
    { value: '0', hint: 'hop limit exceeded' },
    { value: '1', hint: 'fragment reassembly timeout' },
  ],
  'parameter-problem': [
    { value: '0', hint: 'erroneous header field' },
    { value: '1', hint: 'unknown next header' },
    { value: '2', hint: 'unknown IPv6 option' },
  ],
}

function TcpFlagsPicker(props: {
  value?: FirewallRule['tcp_flags'] | null
  onChange: (value: FirewallRule['tcp_flags'] | null) => void
}) {
  return (
    <div className='rounded-md border p-2'>
      <div className='space-y-0.5'>
        {TCP_FLAG_PRESETS.map((preset) => (
          <label key={preset.value} className='flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[10px] hover:bg-muted'>
            <input
              type='radio'
              name='tcp-flags-preset'
              className='h-3.5 w-3.5'
              checked={props.value === preset.value}
              onChange={() => props.onChange(preset.value)}
            />
            <span className='w-16 font-semibold leading-4'>{preset.label}</span>
            <span className='text-[9px] leading-4 text-muted-foreground'>{preset.hint}</span>
          </label>
        ))}
      </div>
      <div className='mt-1.5 text-[9px] leading-3 text-muted-foreground'>
        Choose one preset. Requires Protocol=tcp.
      </div>
    </div>
  )
}

function ArphrdTypeCombobox(props: {
  value?: string | null
  onChange: (value: string | null) => void
  optionsId: string
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const value = props.value || ''
  const knownOption = ARPHRD_TYPE_OPTIONS.find((option) => option.value === value.trim())
  const displayValue = knownOption ? knownOption.label : value
  const query = displayValue.trim().toLowerCase()
  const queryMatchesKnownOption = !!knownOption || ARPHRD_TYPE_OPTIONS.some((option) => option.label.toLowerCase() === query)
  const visibleOptions = query && !queryMatchesKnownOption
    ? ARPHRD_TYPE_OPTIONS.filter((option) => option.value.includes(query) || option.label.toLowerCase().includes(query))
    : ARPHRD_TYPE_OPTIONS

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className='relative'>
      <Input
        className='h-7 pr-16'
        placeholder='Ethernet'
        value={displayValue}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const nextValue = e.target.value
          const optionByLabel = ARPHRD_TYPE_OPTIONS.find((option) => option.label.toLowerCase() === nextValue.trim().toLowerCase())
          props.onChange(optionByLabel?.value || nextValue || null)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        role='combobox'
        aria-expanded={open}
        aria-controls={props.optionsId}
        aria-autocomplete='list'
      />
      {props.value ? (
        <button
          type='button'
          className='absolute right-7 top-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
          aria-label='Clear interface type'
          onClick={() => {
            props.onChange(null)
            setOpen(false)
          }}
        >
          <X className='h-3.5 w-3.5' />
        </button>
      ) : null}
      <button
        type='button'
        className='absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
        aria-label='Show interface hardware types'
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div
          id={props.optionsId}
          role='listbox'
          aria-multiselectable='false'
          className='absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-xs shadow-lg'
        >
          {visibleOptions.length ? visibleOptions.map((option) => {
            const selected = props.value?.trim() === option.value
            return (
              <button
                key={option.value}
                type='button'
                role='option'
                aria-selected={selected}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-normal hover:bg-accent hover:text-accent-foreground',
                  selected && 'bg-accent text-accent-foreground'
                )}
                onClick={() => {
                  props.onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className='flex h-4 w-4 items-center justify-center text-primary'>
                  {selected ? <Check className='h-3.5 w-3.5' /> : null}
                </span>
                <span>{option.label}</span>
                <span className='ml-auto text-[11px] font-normal tabular-nums text-muted-foreground'>{option.value}</span>
              </button>
            )
          }) : (
            <div className='px-2 py-2 text-muted-foreground'>Type an ARPHRD numeric ID</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function LinuxDevGroupInput(props: {
  value?: string | null
  placeholder?: string
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <Input
        className='h-7'
        inputMode='numeric'
        placeholder={props.placeholder || '10'}
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value || null)}
      />
      <div className='text-[9px] leading-3 text-muted-foreground'>
        Expert: Linux dev group id from ip link group. Usually leave empty.
      </div>
    </div>
  )
}

function FibRouteLookupInput(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  const value = props.value || ''
  const selectedPreset = FIB_EXPR_PRESETS.find((option) => option.value === value)
  const activeValue = selectedPreset ? selectedPreset.value : FIB_EXPR_PRESETS[0].value
  const activePreset = selectedPreset || FIB_EXPR_PRESETS[0]
  const [showTechnical, setShowTechnical] = React.useState(false)

  return (
    <div className='space-y-2 rounded-md border bg-background p-2.5'>
      <div className='space-y-0.5'>
        <div className='text-xs font-semibold text-foreground'>Route lookup check</div>
        <div className='text-[10px] leading-4 text-muted-foreground'>
          Usually leave empty. This only checks the Linux routing table; it does not create or change routes.
        </div>
      </div>

      <div className='grid gap-1.5'>
        {FIB_EXPR_PRESETS.map((preset) => (
          <label
            key={preset.value}
            className={cn(
              'flex cursor-pointer gap-2 rounded-md border px-2 py-1.5 transition-colors',
              activeValue === preset.value ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40',
            )}
          >
            <input
              type='radio'
              className='mt-0.5 h-3.5 w-3.5'
              checked={activeValue === preset.value}
              onChange={() => {
                setShowTechnical(false)
                props.onChange(preset.value)
              }}
            />
            <span className='min-w-0 space-y-0.5'>
              <span className='block text-xs font-semibold text-foreground'>{preset.label}</span>
              <span className='block text-[10px] leading-4 text-muted-foreground'>{preset.short}</span>
            </span>
          </label>
        ))}
      </div>

      <div className='rounded-md border border-dashed bg-muted/20 px-2 py-1.5'>
        <div className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>What this selected check does</div>
        <div className='text-[10px] leading-4 text-muted-foreground'>
          {activePreset.hint}
        </div>
      </div>

      <button
        type='button'
        className='text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline'
        onClick={() => setShowTechnical((open) => !open)}
      >
        {showTechnical ? 'Hide nft expression' : 'Show nft expression'}
      </button>
      {showTechnical ? (
        <div className='rounded bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground'>
          <span className='font-mono text-foreground'>{activeValue}</span>
        </div>
      ) : null}
    </div>
  )
}

function PacketLengthInput(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <Input
        className='h-7'
        placeholder='64-1500'
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value || null)}
      />
      <div className='text-[9px] leading-3 text-muted-foreground'>
        Matches packet size in bytes. This does not change the packet.
      </div>
    </div>
  )
}

function RouteNextHopInput(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <Input
        className='h-7'
        placeholder='192.0.2.1'
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value || null)}
      />
      <div className='text-[10px] leading-4 text-muted-foreground'>
        Matches packets whose selected Linux route uses this next-hop. Does not create routes.
      </div>
    </div>
  )
}

function Ipv6ExtensionHeaderInput(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  const parts = (props.value || 'frag missing').trim().split(/\s+/)
  const header = IPV6_EXTENSION_HEADER_OPTIONS.some((option) => option.value === parts[0]) ? parts[0] : 'frag'
  const condition = parts[1] === 'missing' ? 'missing' : 'exists'
  const explanation = header === 'frag' && condition === 'missing'
    ? 'Matches non-fragmented IPv6 packets.'
    : `Matches IPv6 packets where the selected header ${condition === 'missing' ? 'is absent' : 'is present'}.`

  const update = (nextHeader: string, nextCondition: string) => {
    props.onChange(`${nextHeader} ${nextCondition}`)
  }

  return (
    <div className='space-y-1.5'>
      <div className='grid grid-cols-2 gap-2'>
        <label className='space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground'>Header</span>
          <select
            className='h-7 w-full rounded-md border bg-background px-2 text-xs'
            value={header}
            onChange={(event) => update(event.target.value, condition)}
          >
            {IPV6_EXTENSION_HEADER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className='space-y-1'>
          <span className='text-[10px] font-semibold text-muted-foreground'>Condition</span>
          <select
            className='h-7 w-full rounded-md border bg-background px-2 text-xs'
            value={condition}
            onChange={(event) => update(header, event.target.value)}
          >
            <option value='exists'>is present</option>
            <option value='missing'>is missing</option>
          </select>
        </label>
      </div>
      <div className='text-[10px] leading-4 text-muted-foreground'>{explanation}</div>
    </div>
  )
}

function CtDirectionSelect(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <select
        className='h-7 w-full rounded-md border bg-background px-2 text-xs'
        value={props.value || 'original'}
        onChange={(e) => props.onChange(e.target.value || null)}
      >
        {CT_DIRECTION_PRESETS.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      <div className='text-[9px] leading-3 text-muted-foreground'>
        original = direction that started the connection; reply = return traffic.
      </div>
    </div>
  )
}

function CtStatusPicker(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <select
        className='h-7 w-full rounded-md border bg-background px-2 text-xs'
        value={props.value || 'dnat'}
        onChange={(e) => props.onChange(e.target.value || null)}
      >
        {CT_STATUS_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>{preset.label}</option>
        ))}
      </select>
      <div className='text-[9px] leading-3 text-muted-foreground'>
        Choose one conntrack status flag. Backend/API can still accept comma-separated flags.
      </div>
    </div>
  )
}

function CtLabelInput(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <Input
        className='h-7'
        placeholder='0x1 or label_name'
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value || null)}
      />
      <div className='text-[9px] leading-3 text-muted-foreground'>
        Matches existing conntrack label. Names depend on server connlabel config; hex mask is always explicit.
      </div>
    </div>
  )
}

function CtTupleAddressInput(props: {
  value?: string | null
  placeholder: string
  helper: string
  onChange: (value: string | null) => void
}) {
  return (
    <div className='space-y-1'>
      <Input
        className='h-7'
        placeholder={props.placeholder}
        value={props.value || ''}
        onChange={(e) => props.onChange(e.target.value || null)}
      />
      <div className='text-[9px] leading-3 text-muted-foreground'>
        {props.helper}
      </div>
    </div>
  )
}

function CtHelperCombobox(props: {
  value?: string | null
  onChange: (value: string | null) => void
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const value = props.value || ''
  const query = value.trim().toLowerCase()
  const queryMatchesPreset = CT_HELPER_PRESETS.some((option) => option.value === query)
  const visibleOptions = query && !queryMatchesPreset
    ? CT_HELPER_PRESETS.filter((option) => option.value.includes(query) || option.hint.toLowerCase().includes(query))
    : CT_HELPER_PRESETS

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div className='space-y-1'>
      <div ref={rootRef} className='relative'>
        <Input
          className='h-7 pr-16'
          placeholder='ftp'
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            props.onChange(e.target.value || null)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          role='combobox'
          aria-expanded={open}
          aria-controls='ct-helper-options'
          aria-autocomplete='list'
        />
        {props.value ? (
          <button
            type='button'
            className='absolute right-7 top-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
            aria-label='Clear ct helper'
            onClick={() => {
              props.onChange(null)
              setOpen(false)
            }}
          >
            <X className='h-3.5 w-3.5' />
          </button>
        ) : null}
        <button
          type='button'
          className='absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
          aria-label='Show ct helper presets'
          onClick={() => setOpen((prev) => !prev)}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </button>
        {open ? (
          <div
            id='ct-helper-options'
            role='listbox'
            aria-multiselectable='false'
            className='absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-xs shadow-lg'
          >
            {visibleOptions.length ? visibleOptions.map((option) => {
              const selected = props.value === option.value
              return (
                <button
                  key={option.value}
                  type='button'
                  role='option'
                  aria-selected={selected}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-normal hover:bg-accent hover:text-accent-foreground',
                    selected && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => {
                    props.onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span className='flex h-4 w-4 items-center justify-center text-primary'>
                    {selected ? <Check className='h-3.5 w-3.5' /> : null}
                  </span>
                  <span className='font-semibold'>{option.value}</span>
                  <span className='ml-auto text-[10px] font-normal text-muted-foreground'>{option.hint}</span>
                </button>
              )
            }) : (
              <div className='px-2 py-2 text-muted-foreground'>Type a helper name, for example ftp-custom</div>
            )}
          </div>
        ) : null}
      </div>
      <div className='text-[9px] leading-3 text-muted-foreground'>
        Matches an already assigned conntrack helper. To assign one, use Action -&gt; ct helper object.
      </div>
    </div>
  )
}

function IcmpMatchEditor(props: {
  typeValue?: string | null
  codeValue?: string | null
  typePlaceholder: string
  presets: readonly { value: string; hint: string }[]
  codePresetsByType: Record<string, readonly { value: string; hint: string }[]>
  onTypeChange: (value: string | null) => void
  onCodeChange: (value: string | null) => void
}) {
  const codePresets = props.typeValue ? props.codePresetsByType[props.typeValue] || [] : []
  const codeHint = (() => {
    switch (props.typeValue) {
      case 'destination-unreachable':
        return 'Code narrows reason. Empty = match all destination-unreachable reasons.'
      case 'time-exceeded':
        return 'Code narrows reason. Empty = match all time-exceeded reasons.'
      case 'parameter-problem':
        return 'Code narrows reason. Usually leave empty unless you need a specific parser error.'
      default:
        return 'Code is usually empty. Fill it only when you need a specific ICMP reason.'
    }
  })()

  return (
    <div className='rounded-md border p-2'>
      <div className='grid grid-cols-[minmax(0,1fr)_6.75rem] gap-2'>
        <div className='space-y-1'>
          <div className='text-[10px] font-semibold text-muted-foreground'>Type</div>
          <Input
            className='h-7 text-xs'
            placeholder={props.typePlaceholder}
            value={props.typeValue || ''}
            onChange={(event) => props.onTypeChange(event.target.value || null)}
          />
        </div>
        <div className='space-y-1'>
          <div className='text-[10px] font-semibold text-muted-foreground'>Code</div>
          <Input
            className='h-7 text-xs'
            inputMode='numeric'
            placeholder='optional'
            value={props.codeValue || ''}
            onChange={(event) => props.onCodeChange(event.target.value || null)}
          />
        </div>
      </div>
      <div className='mt-2 space-y-1'>
        <div className='text-[9px] font-semibold uppercase tracking-wide text-muted-foreground'>Common type options</div>
        <div className='grid grid-cols-2 gap-1'>
          {props.presets.map((preset) => {
            const selected = props.typeValue === preset.value
            return (
              <button
                key={preset.value}
                type='button'
                className={[
                  'rounded border px-2 py-1 text-left text-[10px] leading-3 transition-colors',
                  selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-muted',
                ].join(' ')}
                onClick={() => props.onTypeChange(preset.value)}
              >
                <span className='block font-semibold'>{preset.value}</span>
                <span className='block text-[9px] text-muted-foreground'>{preset.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      {props.typeValue ? (
        <div className='mt-2 space-y-1'>
          <div className='text-[9px] font-semibold uppercase tracking-wide text-muted-foreground'>
            Code options for {props.typeValue}
          </div>
          <div className='grid grid-cols-2 gap-1'>
            <button
              type='button'
              className={[
                'rounded border px-2 py-1 text-left text-[10px] leading-3 transition-colors',
                !props.codeValue ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-muted',
              ].join(' ')}
              onClick={() => props.onCodeChange(null)}
            >
              <span className='block font-semibold'>empty</span>
              <span className='block text-[9px] text-muted-foreground'>all codes for this type</span>
            </button>
            {codePresets.map((preset) => {
              const selected = props.codeValue === preset.value
              return (
                <button
                  key={preset.value}
                  type='button'
                  className={[
                    'rounded border px-2 py-1 text-left text-[10px] leading-3 transition-colors',
                    selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-background hover:bg-muted',
                  ].join(' ')}
                  onClick={() => props.onCodeChange(preset.value)}
                >
                  <span className='block font-semibold'>{preset.value}</span>
                  <span className='block text-[9px] text-muted-foreground'>{preset.hint}</span>
                </button>
              )
            })}
            {!codePresets.length ? (
              <div className='rounded border border-dashed px-2 py-1 text-[10px] leading-3 text-muted-foreground'>
                No common code presets. Type a code only if you know the exact reason.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className='mt-1.5 text-[9px] leading-3 text-muted-foreground'>
        {codeHint}
      </div>
    </div>
  )
}

export function PolicyRuleEditorAdvancedTab(props: Props) {
  return (
<TabsContent value='advanced' className='mt-2 space-y-2.5'>
                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, l4: !p.l4 }))}>Network & L4 extras {props.advOpen.l4 ? '−' : '+'}</button>
                    {props.advOpen.l4 ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='tcp flags' enabled={!!props.form.tcp_flags} inactiveHint='syn / syn+ack' onToggle={() => props.setForm((p) => ({ ...p, tcp_flags: p.tcp_flags ? null : 'syn', proto: p.tcp_flags ? p.proto : (p.proto || 'tcp') }))}>
                        <TcpFlagsPicker
                          value={props.form.tcp_flags || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, tcp_flags: value, proto: value ? (p.proto || 'tcp') : p.proto }))}
                        />
                      </ToggleLine>
                      <div />
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <div className='col-span-2'>
                      <ToggleLine label='ICMP IPv4' enabled={!!(props.form.icmp_type || props.form.icmp_code)} inactiveHint='type + optional code' onToggle={() => props.setForm((p) => ({ ...p, icmp_type: (p.icmp_type || p.icmp_code) ? null : 'echo-request', icmp_code: (p.icmp_type || p.icmp_code) ? null : p.icmp_code, proto: (p.icmp_type || p.icmp_code) ? p.proto : (p.proto || 'icmp') }))}>
                        <IcmpMatchEditor
                          typeValue={props.form.icmp_type || null}
                          codeValue={props.form.icmp_code || null}
                          typePlaceholder='echo-request'
                          presets={ICMP_TYPE_PRESETS}
                          codePresetsByType={ICMP_CODE_PRESETS}
                          onTypeChange={(value) => props.setForm((p) => ({ ...p, icmp_type: value, proto: value ? (p.proto || 'icmp') : p.proto }))}
                          onCodeChange={(value) => props.setForm((p) => ({ ...p, icmp_code: value, proto: value ? (p.proto || 'icmp') : p.proto }))}
                        />
                      </ToggleLine>
                      </div>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <div className='col-span-2'>
                      <ToggleLine label='ICMP IPv6' enabled={!!(props.form.icmpv6_type || props.form.icmpv6_code)} inactiveHint='type + optional code' onToggle={() => props.setForm((p) => ({ ...p, icmpv6_type: (p.icmpv6_type || p.icmpv6_code) ? null : 'echo-request', icmpv6_code: (p.icmpv6_type || p.icmpv6_code) ? null : p.icmpv6_code, proto: (p.icmpv6_type || p.icmpv6_code) ? p.proto : (p.proto || 'icmpv6') }))}>
                        <IcmpMatchEditor
                          typeValue={props.form.icmpv6_type || null}
                          codeValue={props.form.icmpv6_code || null}
                          typePlaceholder='echo-request'
                          presets={ICMPV6_TYPE_PRESETS}
                          codePresetsByType={ICMPV6_CODE_PRESETS}
                          onTypeChange={(value) => props.setForm((p) => ({ ...p, icmpv6_type: value, proto: value ? (p.proto || 'icmpv6') : p.proto }))}
                          onCodeChange={(value) => props.setForm((p) => ({ ...p, icmpv6_code: value, proto: value ? (p.proto || 'icmpv6') : p.proto }))}
                        />
                      </ToggleLine>
                      </div>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, meta: !p.meta }))}>Meta match {props.advOpen.meta ? '−' : '+'}</button>
                    {props.advOpen.meta ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='packet length' enabled={!!props.form.meta_length} inactiveHint='match packet size' onToggle={() => props.setForm((p) => ({ ...p, meta_length: p.meta_length ? null : '64-1500' }))}>
                        <PacketLengthInput
                          value={props.form.meta_length || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, meta_length: value }))}
                        />
                      </ToggleLine>
                      <div />
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta pkttype' enabled={!!props.form.meta_pkttype} inactiveHint='host / broadcast / multicast / other' onToggle={() => props.setForm((p) => ({ ...p, meta_pkttype: p.meta_pkttype ? null : 'host' }))}>
                        <select
                          className='flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                          value={props.form.meta_pkttype || 'host'}
                          onChange={(e) => props.setForm((p) => ({ ...p, meta_pkttype: e.target.value || null }))}
                        >
                          {META_PKTTYPE_PRESETS.map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </ToggleLine>
                      <ToggleLine label='meta cpu' enabled={!!props.form.meta_cpu} inactiveHint='CPU id, expert/debug' onToggle={() => props.setForm((p) => ({ ...p, meta_cpu: p.meta_cpu ? null : '0' }))}>
                        <Input className='h-7' placeholder='0 / 1 / 2' value={props.form.meta_cpu || ''} onChange={(e) => props.setForm((p) => ({ ...p, meta_cpu: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='meta iiftype' enabled={!!props.form.meta_iiftype} inactiveHint='interface type, expert' onToggle={() => props.setForm((p) => ({ ...p, meta_iiftype: p.meta_iiftype ? null : '1' }))}>
                        <ArphrdTypeCombobox
                          value={props.form.meta_iiftype || null}
                          optionsId='firewall-meta-iiftype-options'
                          onChange={(value) => props.setForm((p) => ({ ...p, meta_iiftype: value }))}
                        />
                      </ToggleLine>
                      <ToggleLine label='meta oiftype' enabled={!!props.form.meta_oiftype} inactiveHint='interface type, expert' onToggle={() => props.setForm((p) => ({ ...p, meta_oiftype: p.meta_oiftype ? null : '1' }))}>
                        <ArphrdTypeCombobox
                          value={props.form.meta_oiftype || null}
                          optionsId='firewall-meta-oiftype-options'
                          onChange={(value) => props.setForm((p) => ({ ...p, meta_oiftype: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='input interface group' enabled={!!props.form.meta_iifgroup} inactiveHint='Linux dev group id' onToggle={() => props.setForm((p) => ({ ...p, meta_iifgroup: p.meta_iifgroup ? null : '10' }))}>
                        <LinuxDevGroupInput
                          value={props.form.meta_iifgroup || null}
                          placeholder='Linux dev group id'
                          onChange={(value) => props.setForm((p) => ({ ...p, meta_iifgroup: value }))}
                        />
                      </ToggleLine>
                      <ToggleLine label='output interface group' enabled={!!props.form.meta_oifgroup} inactiveHint='Linux dev group id' onToggle={() => props.setForm((p) => ({ ...p, meta_oifgroup: p.meta_oifgroup ? null : '10' }))}>
                        <LinuxDevGroupInput
                          value={props.form.meta_oifgroup || null}
                          placeholder='Linux dev group id'
                          onChange={(value) => props.setForm((p) => ({ ...p, meta_oifgroup: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='packet mark' enabled={!!props.form.mark_match} inactiveHint='match existing mark' onToggle={() => props.setForm((p) => ({ ...p, mark_match: p.mark_match ? null : '0x1' }))}>
                        <MarkMatchInput
                          kind='packet'
                          value={props.form.mark_match || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, mark_match: value }))}
                        />
                      </ToggleLine>
                      <ToggleLine label='connection mark' enabled={!!props.form.ct_mark_match} inactiveHint='match existing mark' onToggle={() => props.setForm((p) => ({ ...p, ct_mark_match: p.ct_mark_match ? null : '0x1' }))}>
                        <MarkMatchInput
                          kind='connection'
                          value={props.form.ct_mark_match || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_mark_match: value }))}
                        />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, ct: !p.ct }))}>Conntrack match {props.advOpen.ct ? '−' : '+'}</button>
                    {props.advOpen.ct ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct direction' enabled={!!props.form.ct_direction} inactiveHint='original / reply' onToggle={() => props.setForm((p) => ({ ...p, ct_direction: p.ct_direction ? null : 'original' }))}>
                        <CtDirectionSelect
                          value={props.form.ct_direction || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_direction: value }))}
                        />
                      </ToggleLine>
                      <ToggleLine label='ct status' enabled={!!props.form.ct_status} inactiveHint='expected / seen-reply / assured / snat' onToggle={() => props.setForm((p) => ({ ...p, ct_status: p.ct_status ? null : 'dnat' }))}>
                        <CtStatusPicker
                          value={props.form.ct_status || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_status: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='original source address' enabled={!!props.form.ct_original_saddr} inactiveHint='initiator address' onToggle={() => props.setForm((p) => ({ ...p, ct_original_saddr: p.ct_original_saddr ? null : '192.168.1.10' }))}>
                        <CtTupleAddressInput
                          value={props.form.ct_original_saddr || null}
                          placeholder='192.168.1.10'
                          helper='Conntrack original direction: source that started the flow.'
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_original_saddr: value }))}
                        />
                      </ToggleLine>
                      <ToggleLine label='original destination address' enabled={!!props.form.ct_original_daddr} inactiveHint='target address' onToggle={() => props.setForm((p) => ({ ...p, ct_original_daddr: p.ct_original_daddr ? null : '203.0.113.10' }))}>
                        <CtTupleAddressInput
                          value={props.form.ct_original_daddr || null}
                          placeholder='203.0.113.10'
                          helper='Conntrack original direction: destination the flow was started to.'
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_original_daddr: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='reply source address' enabled={!!props.form.ct_reply_saddr} inactiveHint='return source' onToggle={() => props.setForm((p) => ({ ...p, ct_reply_saddr: p.ct_reply_saddr ? null : '203.0.113.10' }))}>
                        <CtTupleAddressInput
                          value={props.form.ct_reply_saddr || null}
                          placeholder='203.0.113.10'
                          helper='Conntrack reply direction: source of return traffic.'
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_reply_saddr: value }))}
                        />
                      </ToggleLine>
                      <ToggleLine label='reply destination address' enabled={!!props.form.ct_reply_daddr} inactiveHint='return destination' onToggle={() => props.setForm((p) => ({ ...p, ct_reply_daddr: p.ct_reply_daddr ? null : '192.168.1.10' }))}>
                        <CtTupleAddressInput
                          value={props.form.ct_reply_daddr || null}
                          placeholder='192.168.1.10'
                          helper='Conntrack reply direction: destination of return traffic.'
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_reply_daddr: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct expiration' enabled={!!props.form.ct_expiration} inactiveHint='30s / 1m' onToggle={() => props.setForm((p) => ({ ...p, ct_expiration: p.ct_expiration ? null : '30s' }))}>
                        <Input className='h-7' placeholder='30s / 1m' value={props.form.ct_expiration || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_expiration: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ct helper' enabled={!!props.form.ct_helper_match} inactiveHint='ftp / sip' onToggle={() => props.setForm((p) => ({ ...p, ct_helper_match: p.ct_helper_match ? null : 'ftp' }))}>
                        <CtHelperCombobox
                          value={props.form.ct_helper_match || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_helper_match: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ct label' enabled={!!props.form.ct_label} inactiveHint='label_name / 0x1' onToggle={() => props.setForm((p) => ({ ...p, ct_label: p.ct_label ? null : '0x1' }))}>
                        <CtLabelInput
                          value={props.form.ct_label || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, ct_label: value }))}
                        />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, fib: !p.fib }))}>FIB / socket / routing {props.advOpen.fib ? '−' : '+'}</button>
                    {props.advOpen.fib ? <>
                    <div className='grid grid-cols-1 gap-2'>
                      <ToggleLine label='Route lookup checks (expert)' enabled={!!props.form.fib_expr} inactiveHint='Usually leave empty. Checks Linux routing table.' onToggle={() => props.setForm((p) => ({ ...p, fib_expr: p.fib_expr ? null : 'fib saddr . iif oif missing' }))}>
                        <FibRouteLookupInput
                          value={props.form.fib_expr || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, fib_expr: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='IPv6 extension header' enabled={!!props.form.ipv6_exthdrs} inactiveHint='Usually leave empty. Checks whether an IPv6 extension header is present or missing.' onToggle={() => props.setForm((p) => ({ ...p, ipv6_exthdrs: p.ipv6_exthdrs ? null : 'frag missing' }))}>
                        <Ipv6ExtensionHeaderInput
                          value={props.form.ipv6_exthdrs || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, ipv6_exthdrs: value }))}
                        />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='Route next hop' enabled={!!props.form.rt_nexthop} inactiveHint='192.0.2.1' onToggle={() => props.setForm((p) => ({ ...p, rt_nexthop: p.rt_nexthop ? null : '192.0.2.1' }))}>
                        <RouteNextHopInput
                          value={props.form.rt_nexthop || null}
                          onChange={(value) => props.setForm((p) => ({ ...p, rt_nexthop: value }))}
                        />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                  <div className='rounded-md border p-2.5 space-y-2'>
                    <button type='button' className='w-full text-left text-[11px] font-semibold text-muted-foreground' onClick={() => props.setAdvOpen((p) => ({ ...p, l2: !p.l2 }))}>Ethernet / VLAN (L2) {props.advOpen.l2 ? '−' : '+'}</button>
                    {props.advOpen.l2 ? <>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='vlan id' enabled={!!props.form.vlan_id} inactiveHint='10' onToggle={() => props.setForm((p) => ({ ...p, vlan_id: p.vlan_id ? null : '10' }))}>
                        <Input className='h-7' placeholder='10' value={props.form.vlan_id || ''} onChange={(e) => props.setForm((p) => ({ ...p, vlan_id: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ether src' enabled={!!props.form.ether_src} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => props.setForm((p) => ({ ...p, ether_src: p.ether_src ? null : 'aa:bb:cc:dd:ee:ff' }))}>
                        <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={props.form.ether_src || ''} onChange={(e) => props.setForm((p) => ({ ...p, ether_src: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <ToggleLine label='ether dst' enabled={!!props.form.ether_dst} inactiveHint='aa:bb:cc:dd:ee:ff' onToggle={() => props.setForm((p) => ({ ...p, ether_dst: p.ether_dst ? null : 'aa:bb:cc:dd:ee:ff' }))}>
                        <Input className='h-7' placeholder='aa:bb:cc:dd:ee:ff' value={props.form.ether_dst || ''} onChange={(e) => props.setForm((p) => ({ ...p, ether_dst: e.target.value || null }))} />
                      </ToggleLine>
                      <ToggleLine label='ether type' enabled={!!props.form.ether_type} inactiveHint='0x0800' onToggle={() => props.setForm((p) => ({ ...p, ether_type: p.ether_type ? null : '0x0800' }))}>
                        <Input className='h-7' placeholder='0x0800' value={props.form.ether_type || ''} onChange={(e) => props.setForm((p) => ({ ...p, ether_type: e.target.value || null }))} />
                      </ToggleLine>
                    </div>
                    </> : null}
                  </div>

                </TabsContent>
  )
}
