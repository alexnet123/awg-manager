import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ToggleLine } from './RuleFieldControls'
import type { FirewallRule, FirewallSchema } from '../api'

type Props = {
  form: Partial<FirewallRule>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  hasSupport: (key: string) => boolean
  generalFieldState: (field: 'in_interface' | 'out_interface' | 'ct_state') => 'V' | 'H' | 'D' | 'W'
  schema: FirewallSchema | null
  builtinRuleTables: Set<string>
  chainOptionsByTable: Record<string, string[]>
  customChainRowsByTable: Record<string, { chain_name: string }[]>
}

function parseCtState(value?: FirewallRule['ct_state'] | null) {
  return {
    established: value === 'established' || value === 'established,related',
    related: value === 'related' || value === 'established,related',
    newState: value === 'new',
    invalid: value === 'invalid',
    untracked: value === 'untracked',
  }
}

function buildCtState(flags: { established: boolean; related: boolean; newState: boolean; invalid: boolean; untracked: boolean }): FirewallRule['ct_state'] | null {
  if (flags.established && flags.related) return 'established,related'
  if (flags.established) return 'established'
  if (flags.related) return 'related'
  if (flags.newState) return 'new'
  if (flags.invalid) return 'invalid'
  if (flags.untracked) return 'untracked'
  return null
}

const POPULAR_PROTOCOL_OPTIONS = [
  { label: 'tcp', value: 'tcp', hint: '6' },
  { label: 'udp', value: 'udp', hint: '17' },
  { label: 'icmp', value: 'icmp', hint: '1' },
  { label: 'icmpv6', value: 'icmpv6', hint: '58' },
  { label: 'gre', value: '47', hint: '47' },
  { label: 'esp', value: '50', hint: '50' },
]

function ProtocolCombobox({
  value,
  onChange,
  onClear,
}: {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const query = value.trim().toLowerCase()
  const visibleOptions = query
    ? POPULAR_PROTOCOL_OPTIONS.filter((option) => option.value.includes(query) || option.label.includes(query) || option.hint.includes(query))
    : POPULAR_PROTOCOL_OPTIONS

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
        placeholder='any'
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
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
        aria-controls='firewall-protocol-options'
        aria-autocomplete='list'
      />
      {value ? (
        <button
          type='button'
          className='absolute right-7 top-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
          aria-label='Clear protocol'
          onClick={() => {
            onClear()
            setOpen(false)
          }}
        >
          <X className='h-3.5 w-3.5' />
        </button>
      ) : null}
      <button
        type='button'
        className='absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
        aria-label='Show popular protocols'
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div
          id='firewall-protocol-options'
          role='listbox'
          aria-multiselectable='false'
          className='absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-xs shadow-lg'
        >
          {visibleOptions.length ? visibleOptions.map((option) => {
            const selected = value.trim().toLowerCase() === option.value
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
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className='flex h-4 w-4 items-center justify-center text-primary'>
                  {selected ? <Check className='h-3.5 w-3.5' /> : null}
                </span>
                <span>{option.label}</span>
                <span className='ml-auto text-[11px] font-normal tabular-nums text-muted-foreground'>{option.hint}</span>
              </button>
            )
          }) : (
            <div className='px-2 py-2 text-muted-foreground'>Type a protocol name or numeric ID</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function PolicyRuleEditorBaseTab(props: Props) {
  const family = String(props.form.family || 'inet').toLowerCase()
  const showInputInterface = props.hasSupport('in_interface') && props.generalFieldState('in_interface') !== 'H'
  const showOutputInterface = family !== 'netdev' && props.hasSupport('out_interface') && props.generalFieldState('out_interface') !== 'H'

  return (
    <TabsContent value='base' className='mt-2 space-y-2.5'>
      <div className='text-[11px] font-semibold text-muted-foreground'>Rule state</div>
      <label className='flex items-center gap-2 text-xs rounded-md border p-2'><input type='checkbox' className='h-4 w-4' checked={!!props.form.enabled} onChange={(e) => props.setForm((p) => ({ ...p, enabled: e.target.checked }))} />enabled</label>
      <div className='space-y-1.5'>
        <Label>Comment</Label>
        <Input className='h-7' placeholder='Rule comment (optional)' value={props.form.comment || ''} onChange={(e) => props.setForm((p) => ({ ...p, comment: e.target.value || null }))} />
      </div>

      <div className='text-[11px] font-semibold text-muted-foreground'>Base rule placement</div>
      <div className='space-y-1.5'>
        <Label>Chain</Label>
        <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={props.form.chain || 'input'} onChange={(e) => props.setForm((p) => ({ ...p, chain: e.target.value }))}>
          {(
            props.builtinRuleTables.has(String(props.form.table || '').toLowerCase())
              ? (props.chainOptionsByTable[String(props.form.table || 'filter').toLowerCase()] || [])
              : ((props.customChainRowsByTable[String(props.form.table || '').toLowerCase()] || []).map((row) => row.chain_name).filter(Boolean))
          ).map((ch) => (<option key={ch} value={ch}>{ch}</option>))}
        </select>
      </div>

      <div className='text-[11px] font-semibold text-muted-foreground'>L3 address match</div>
      {props.hasSupport('src') || props.hasSupport('dst') ? <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('src') ? <ToggleLine label='Source address' enabled={!!props.form.src} inactiveHint='192.168.1.0/24 or @trusted_hosts' onToggle={() => props.setForm((p) => ({ ...p, src: p.src ? null : '0.0.0.0/0' }))}>
          <Input className='h-7' placeholder='192.168.1.0/24 or @trusted_hosts' value={props.form.src || ''} onChange={(e) => props.setForm((p) => ({ ...p, src: e.target.value || null }))} />
        </ToggleLine> : <div />}
        {props.hasSupport('dst') ? <ToggleLine label='Destination address' enabled={!!props.form.dst} inactiveHint='10.0.0.10 or @servers' onToggle={() => props.setForm((p) => ({ ...p, dst: p.dst ? null : '10.8.0.0/24' }))}>
          <Input className='h-7' placeholder='10.0.0.10 or @servers' value={props.form.dst || ''} onChange={(e) => props.setForm((p) => ({ ...p, dst: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div> : null}

      <div className='text-[11px] font-semibold text-muted-foreground'>L4 protocol and port match</div>
      {props.hasSupport('proto') ? <div className='space-y-1.5'>
        <Label>Protocol</Label>
        <ProtocolCombobox
          value={props.form.proto || ''}
          onChange={(value) => props.setForm((p) => ({ ...p, proto: value || null }))}
          onClear={() => props.setForm((p) => ({ ...p, proto: null, sport: null, dport: null }))}
        />
      </div> : null}
      {props.hasSupport('sport') || props.hasSupport('dport') ? <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('sport') ? <ToggleLine label='Source port' enabled={!!props.form.sport} inactiveHint='1024-65535 or @admin_ports' onToggle={() => props.setForm((p) => ({ ...p, sport: p.sport ? null : '1024:65535', proto: p.sport ? p.proto : (p.proto || 'tcp') }))}>
          <Input className='h-7' placeholder='1024-65535 or @admin_ports' value={props.form.sport || ''} onChange={(e) => props.setForm((p) => ({ ...p, sport: e.target.value || null }))} />
        </ToggleLine> : <div />}
        {props.hasSupport('dport') ? <ToggleLine label='Destination port' enabled={!!props.form.dport} inactiveHint='22,80,443 or @admin_ports' onToggle={() => props.setForm((p) => ({ ...p, dport: p.dport ? null : '22', proto: p.dport ? p.proto : (p.proto || 'tcp') }))}>
          <Input className='h-7' placeholder='22, 80,443 or @admin_ports' value={props.form.dport || ''} onChange={(e) => props.setForm((p) => ({ ...p, dport: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div> : null}

      <div className='text-[11px] font-semibold text-muted-foreground'>Interface match</div>
      {family === 'bridge' ? (
        <div className='grid grid-cols-2 gap-2'>
          <ToggleLine label='Bridge input' enabled={!!props.form.ibrname} inactiveHint='br0 / eth0' onToggle={() => props.setForm((p) => ({ ...p, ibrname: p.ibrname ? null : 'br0' }))}>
            <Input className='h-7' placeholder='br0 / eth0' value={props.form.ibrname || ''} onChange={(e) => props.setForm((p) => ({ ...p, ibrname: e.target.value || null }))} />
          </ToggleLine>
          <ToggleLine label='Bridge output' enabled={!!props.form.obrname} inactiveHint='br1 / eth1' onToggle={() => props.setForm((p) => ({ ...p, obrname: p.obrname ? null : 'br1' }))}>
            <Input className='h-7' placeholder='br1 / eth1' value={props.form.obrname || ''} onChange={(e) => props.setForm((p) => ({ ...p, obrname: e.target.value || null }))} />
          </ToggleLine>
        </div>
      ) : showInputInterface || showOutputInterface ? <div className='grid grid-cols-2 gap-2'>
        {showInputInterface ? <ToggleLine label='Input interface' enabled={!!props.form.in_interface} inactiveHint='eth0 / lo / @lan_ifaces' onToggle={() => props.setForm((p) => ({ ...p, in_interface: p.in_interface ? null : 'eth0' }))}>
          <Input className='h-7' placeholder='eth0 / lo / @lan_ifaces' value={props.form.in_interface || ''} onChange={(e) => props.setForm((p) => ({ ...p, in_interface: e.target.value || null }))} />
        </ToggleLine> : <div />}
        {showOutputInterface ? <ToggleLine label='Output interface' enabled={!!props.form.out_interface} inactiveHint='eth0 / awg1 / @wan_ifaces' onToggle={() => props.setForm((p) => ({ ...p, out_interface: p.out_interface ? null : 'awg1' }))}>
          <Input className='h-7' placeholder='eth0 / awg1 / @wan_ifaces' value={props.form.out_interface || ''} onChange={(e) => props.setForm((p) => ({ ...p, out_interface: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div> : null}

      <div className='text-[11px] font-semibold text-muted-foreground'>Connection tracking match</div>
      {props.hasSupport('ct_state') && props.generalFieldState('ct_state') !== 'H' ? <ToggleLine label='Connection state' enabled={!!props.form.ct_state} inactiveHint='established,related / new / invalid' onToggle={() => props.setForm((p) => ({ ...p, ct_state: p.ct_state ? null : 'new' }))}>
        <div className='grid grid-cols-2 gap-2 rounded-md border p-2'>
          {(() => {
            const flags = parseCtState(props.form.ct_state)
            const setFlags = (patch: Partial<typeof flags>) => {
              const next = { ...flags, ...patch }
              if (patch.newState || patch.invalid || patch.untracked) {
                if (patch.newState) {
                  next.invalid = false
                  next.untracked = false
                  next.established = false
                  next.related = false
                }
                if (patch.invalid) {
                  next.newState = false
                  next.untracked = false
                  next.established = false
                  next.related = false
                }
                if (patch.untracked) {
                  next.newState = false
                  next.invalid = false
                  next.established = false
                  next.related = false
                }
              }
              if (patch.established || patch.related) {
                next.newState = false
                next.invalid = false
                next.untracked = false
              }
              props.setForm((p) => ({ ...p, ct_state: buildCtState(next) }))
            }
            return (
              <>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.established} onChange={(e) => setFlags({ established: e.target.checked })} />established</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.related} onChange={(e) => setFlags({ related: e.target.checked })} />related</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.newState} onChange={(e) => setFlags({ newState: e.target.checked })} />new</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.invalid} onChange={(e) => setFlags({ invalid: e.target.checked })} />invalid</label>
                <label className='flex items-center gap-1.5 text-[11px]'><input type='checkbox' className='h-3.5 w-3.5' checked={flags.untracked} onChange={(e) => setFlags({ untracked: e.target.checked })} />untracked</label>
              </>
            )
          })()}
        </div>
      </ToggleLine> : null}
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='Connection mark' enabled={!!props.form.ct_mark_match} inactiveHint='0x1 / 10' onToggle={() => props.setForm((p) => ({ ...p, ct_mark_match: p.ct_mark_match ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 / 10' value={props.form.ct_mark_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, ct_mark_match: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='Packet mark' enabled={!!props.form.mark_match} inactiveHint='0x1 / 10' onToggle={() => props.setForm((p) => ({ ...p, mark_match: p.mark_match ? null : '0x1' }))}>
          <Input className='h-7' placeholder='0x1 / 10' value={props.form.mark_match || ''} onChange={(e) => props.setForm((p) => ({ ...p, mark_match: e.target.value || null }))} />
        </ToggleLine>
      </div>

      <div className='text-[11px] font-semibold text-muted-foreground'>Meta match</div>
      <div className='grid grid-cols-2 gap-2'>
        {props.hasSupport('limit_rate') ? <ToggleLine label='Rate limit' enabled={!!props.form.limit_rate} inactiveHint='10/second or 200/minute' onToggle={() => props.setForm((p) => ({ ...p, limit_rate: p.limit_rate ? null : '10/second' }))}>
          <Input className='h-7' placeholder='10/second or 200/minute' value={props.form.limit_rate || ''} onChange={(e) => props.setForm((p) => ({ ...p, limit_rate: e.target.value || null }))} />
        </ToggleLine> : <div />}
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <ToggleLine label='Hour' enabled={!!props.form.hour} inactiveHint='08:00-18:00' onToggle={() => props.setForm((p) => ({ ...p, hour: p.hour ? null : '08:00-18:00' }))}>
          <Input className='h-7' placeholder='08:00-18:00' value={props.form.hour || ''} onChange={(e) => props.setForm((p) => ({ ...p, hour: e.target.value || null }))} />
        </ToggleLine>
        <ToggleLine label='DSCP' enabled={!!props.form.dscp} inactiveHint='cs5 or 46' onToggle={() => props.setForm((p) => ({ ...p, dscp: p.dscp ? null : 'cs5' }))}>
          <Input className='h-7' placeholder='cs5 or 46' value={props.form.dscp || ''} onChange={(e) => props.setForm((p) => ({ ...p, dscp: e.target.value || null }))} />
        </ToggleLine>
      </div>
    </TabsContent>
  )
}
