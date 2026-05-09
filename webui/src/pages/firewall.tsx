import * as React from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AuthState, FirewallRule, FirewallState } from './api'
import { createFirewallRule, deleteFirewallRule, getFirewallState, updateFirewallRule } from './api'

const defaultRule: Partial<FirewallRule> = {
  table: 'filter',
  family: 'inet',
  chain: 'input',
  action: 'accept',
  proto: null,
  enabled: true,
  comment: '',
  ct_state: null,
  nat_type: null,
  to_addr: null,
  to_port: null,
  notrack: false,
  mark_set: null,
  ct_mark_set: null,
  log_prefix: null,
  log_level: null,
  limit_rate: null,
  counter: false,
}

type EditorTab = 'general' | 'advanced' | 'extra' | 'action' | 'stats'

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

function ToggleLine(props: { label: string; enabled: boolean; onToggle: () => void; children: React.ReactNode }) {
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
              className='absolute right-1 top-1 h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground'
              onClick={props.onToggle}
            >
              -
            </button>
          </div>
        )
        : (
          <div className='flex h-7 items-center justify-between rounded-md border border-dashed px-2.5 text-[11px] text-muted-foreground'>
            <span>Disabled</span>
            <button type='button' className='h-5 min-w-5 rounded border px-1 text-[11px] leading-4 text-foreground' onClick={props.onToggle}>+</button>
          </div>
        )}
    </div>
  )
}

export function FirewallPage(props: { auth: AuthState; refreshNonce: number }) {
  const [state, setState] = React.useState<FirewallState | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Partial<FirewallRule>>(defaultRule)
  const [isBusy, setIsBusy] = React.useState(false)
  const [activeTable, setActiveTable] = React.useState<'filter' | 'nat' | 'raw' | 'mangle'>('filter')
  const [selectedRuleId, setSelectedRuleId] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null)
  const [ruleEditorTab, setRuleEditorTab] = React.useState<EditorTab>('general')
  const [winPos, setWinPos] = React.useState({ x: 120, y: 120 })
  const dragRef = React.useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const chainOptionsByTable: Record<string, FirewallRule['chain'][]> = {
    filter: ['input', 'forward', 'output'],
    nat: ['prerouting', 'input', 'output', 'postrouting'],
    raw: ['prerouting', 'output'],
    mangle: ['prerouting', 'input', 'forward', 'output', 'postrouting'],
  }

  async function refresh() {
    setError(null)
    try {
      setState(await getFirewallState(props.auth))
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  React.useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.refreshNonce])

  React.useEffect(() => {
    if (addOpen && !editingRuleId) {
      setForm((p) => ({ ...p, table: activeTable, chain: chainOptionsByTable[activeTable][0] }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable, addOpen, editingRuleId])

  async function onSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)
    try {
      if (editingRuleId) await updateFirewallRule(props.auth, editingRuleId, form)
      else await createFirewallRule(props.auth, form)
      setForm(defaultRule)
      setEditingRuleId(null)
      setAddOpen(false)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onDelete(rule: FirewallRule) {
    if (!confirm('Delete this firewall rule?')) return
    setError(null)
    setIsBusy(true)
    try {
      await deleteFirewallRule(props.auth, rule.id)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onSetEnabled(rule: FirewallRule, enabled: boolean) {
    setError(null)
    setIsBusy(true)
    try {
      await updateFirewallRule(props.auth, rule.id, { enabled })
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  function onDragStart(event: React.MouseEvent<HTMLDivElement>) {
    dragRef.current = { sx: event.clientX, sy: event.clientY, ox: winPos.x, oy: winPos.y }
    const onMove = (ev: MouseEvent) => {
      const s = dragRef.current
      if (!s) return
      setWinPos({ x: Math.max(8, s.ox + ev.clientX - s.sx), y: Math.max(8, s.oy + ev.clientY - s.sy) })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function openCreateWindow() {
    setEditingRuleId(null)
    setRuleEditorTab('general')
    setForm({ ...defaultRule, table: activeTable, chain: chainOptionsByTable[activeTable][0] })
    setAddOpen(true)
  }

  function openEditWindow(rule: FirewallRule) {
    setEditingRuleId(rule.id)
    setRuleEditorTab('general')
    setForm({
      table: rule.table,
      family: rule.family,
      chain: rule.chain,
      action: rule.action,
      proto: rule.proto || null,
      src: rule.src || null,
      dst: rule.dst || null,
      in_interface: rule.in_interface || null,
      out_interface: rule.out_interface || null,
      sport: rule.sport || null,
      dport: rule.dport || null,
      comment: rule.comment || null,
      ct_state: rule.ct_state || null,
      nat_type: rule.nat_type || null,
      to_addr: rule.to_addr || null,
      to_port: rule.to_port || null,
      notrack: !!rule.notrack,
      mark_set: rule.mark_set || null,
      ct_mark_set: rule.ct_mark_set || null,
      log_prefix: rule.log_prefix || null,
      log_level: rule.log_level || null,
      limit_rate: rule.limit_rate || null,
      counter: !!rule.counter,
      enabled: rule.enabled,
    })
    setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 760) / 2)) })
    setAddOpen(true)
  }

  const visibleRules = (state?.rules || []).filter((r) => r.table === activeTable)

  return (
    <div className='flex min-h-[640px] flex-col gap-2'>
      <div><h2 className='text-lg font-semibold tracking-tight'>Firewall</h2></div>
      {error ? <div className='rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'>{error}</div> : null}
      <Card className='flex min-h-0 flex-1 flex-col text-xs'>
        <CardContent className='flex min-h-0 flex-1 flex-col gap-2 px-4 pt-0'>
          <Tabs value={activeTable} onValueChange={(v) => setActiveTable(v as 'filter' | 'nat' | 'raw' | 'mangle')}>
            <TabsList className='h-9'>
              <TabsTrigger className='px-4 text-sm' value='filter'>filter</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='nat'>nat</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='raw'>raw</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='mangle'>mangle</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className='flex gap-2'>
            <Button size='sm' onClick={openCreateWindow} disabled={isBusy}><Plus />Add</Button>
            <Button size='sm' variant='destructive' disabled={isBusy || !selectedRuleId} onClick={() => { const rule = visibleRules.find((r) => r.id === selectedRuleId); if (!rule) return; void onDelete(rule) }}>Del</Button>
            <Button size='sm' variant='outline' disabled={isBusy || !selectedRuleId} onClick={() => { const rule = visibleRules.find((r) => r.id === selectedRuleId); if (!rule) return; void onSetEnabled(rule, false) }}>Disable</Button>
            <Button size='sm' disabled={isBusy || !selectedRuleId} onClick={() => { const rule = visibleRules.find((r) => r.id === selectedRuleId); if (!rule) return; void onSetEnabled(rule, true) }}>Enable</Button>
          </div>
          <div className='min-h-0 flex-1 overflow-y-scroll rounded-xl border'>
            <Table>
              <TableHeader><TableRow><TableHead>Chain</TableHead><TableHead>Action</TableHead><TableHead>Proto</TableHead><TableHead>DPort</TableHead><TableHead>Src</TableHead><TableHead>State</TableHead><TableHead>Expr</TableHead></TableRow></TableHeader>
              <TableBody>
                {visibleRules.map((r) => (
                  <TableRow key={r.id} className={`h-7 cursor-pointer ${selectedRuleId === r.id ? 'bg-muted/50' : ''} ${!r.enabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`} onClick={() => setSelectedRuleId(r.id)} onDoubleClick={() => openEditWindow(r)}>
                    <TableCell>{r.chain}</TableCell><TableCell>{r.action}</TableCell><TableCell>{r.proto || 'any'}</TableCell><TableCell>{r.dport || '—'}</TableCell><TableCell>{r.src || '—'}</TableCell><TableCell>{r.ct_state || '—'}</TableCell>
                    <TableCell className='max-w-[320px] truncate'>{r.table === 'nat' ? [r.nat_type, r.to_addr, r.to_port ? `:${r.to_port}` : null].filter(Boolean).join(' ') : [r.notrack ? 'notrack' : null, r.mark_set ? `mark=${r.mark_set}` : null, r.ct_mark_set ? `ctmark=${r.ct_mark_set}` : null, r.comment || null].filter(Boolean).join(' | ') || '—'}</TableCell>
                  </TableRow>
                ))}
                {!visibleRules.length ? <TableRow><TableCell colSpan={7} className='py-6 text-center text-xs text-muted-foreground'>No rules in {activeTable} table.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {addOpen ? (
        <div className='fixed inset-0 z-40'>
          <div className='absolute z-50 w-[560px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl' style={{ left: winPos.x, top: winPos.y }}>
            <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={onDragStart}>
              <div className='flex items-center justify-between'>
                <span>{editingRuleId ? 'Edit Firewall Rule' : 'Add Firewall Rule'}</span>
                <button type='button' className='rounded p-1 hover:bg-background/70' onClick={() => { setAddOpen(false); setEditingRuleId(null) }}><X className='size-3.5' /></button>
              </div>
            </div>
            <form className='space-y-2.5 p-3 text-xs' onSubmit={onSave}>
              <Tabs value={ruleEditorTab} onValueChange={(v) => setRuleEditorTab(v as EditorTab)}>
                <TabsList className='h-9'>
                  <TabsTrigger className='px-3 text-xs' value='general'>General</TabsTrigger>
                  <TabsTrigger className='px-3 text-xs' value='advanced'>Advanced</TabsTrigger>
                  <TabsTrigger className='px-3 text-xs' value='extra'>Extra</TabsTrigger>
                  <TabsTrigger className='px-3 text-xs' value='action'>Action</TabsTrigger>
                  <TabsTrigger className='px-3 text-xs' value='stats'>Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value='general' className='mt-2 space-y-2.5'>
                  <div className='rounded-md border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground'>Table: <span className='font-medium text-foreground'>{form.table || activeTable}</span></div>
                  <div className='space-y-1.5'>
                    <Label>Enabled</Label>
                    <label className='flex items-center gap-2 text-xs'><input type='checkbox' className='h-4 w-4' checked={!!form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />Rule is enabled</label>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Comment</Label>
                    <Input className='h-7' placeholder='Allow SSH' value={form.comment || ''} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value || null }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Chain</Label>
                    <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.chain || 'input'} onChange={(e) => setForm((p) => ({ ...p, chain: e.target.value as FirewallRule['chain'] }))}>
                      {(chainOptionsByTable[form.table || 'filter'] || []).map((ch) => (<option key={ch} value={ch}>{ch}</option>))}
                    </select>
                  </div>
                  <ToggleLine label='Protocol' enabled={!!form.proto} onToggle={() => setForm((p) => ({ ...p, proto: p.proto ? null : 'tcp', sport: p.proto ? null : p.sport, dport: p.proto ? null : p.dport }))}>
                    <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.proto || 'tcp'} onChange={(e) => setForm((p) => ({ ...p, proto: (e.target.value || null) as any }))}>
                      <option value='tcp'>tcp</option><option value='udp'>udp</option><option value='icmp'>icmp</option><option value='icmpv6'>icmpv6</option>
                    </select>
                  </ToggleLine>
                  <div className='grid grid-cols-2 gap-2'>
                    <ToggleLine label='Src Address' enabled={!!form.src} onToggle={() => setForm((p) => ({ ...p, src: p.src ? null : '0.0.0.0/0' }))}>
                      <Input className='h-7' placeholder='0.0.0.0/0' value={form.src || ''} onChange={(e) => setForm((p) => ({ ...p, src: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='Dst Address' enabled={!!form.dst} onToggle={() => setForm((p) => ({ ...p, dst: p.dst ? null : '10.8.0.0/24' }))}>
                      <Input className='h-7' placeholder='10.8.0.0/24' value={form.dst || ''} onChange={(e) => setForm((p) => ({ ...p, dst: e.target.value || null }))} />
                    </ToggleLine>
                  </div>
                </TabsContent>

                <TabsContent value='advanced' className='mt-2 space-y-2.5'>
                  <div className='grid grid-cols-2 gap-2'>
                    <ToggleLine label='In Interface' enabled={!!form.in_interface} onToggle={() => setForm((p) => ({ ...p, in_interface: p.in_interface ? null : 'eth0' }))}>
                      <Input className='h-7' placeholder='eth0' value={form.in_interface || ''} onChange={(e) => setForm((p) => ({ ...p, in_interface: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='Out Interface' enabled={!!form.out_interface} onToggle={() => setForm((p) => ({ ...p, out_interface: p.out_interface ? null : 'awg1' }))}>
                      <Input className='h-7' placeholder='awg1' value={form.out_interface || ''} onChange={(e) => setForm((p) => ({ ...p, out_interface: e.target.value || null }))} />
                    </ToggleLine>
                  </div>
                  <div className='grid grid-cols-2 gap-2'>
                    <ToggleLine label='Src Port' enabled={!!form.sport} onToggle={() => setForm((p) => ({ ...p, sport: p.sport ? null : '1024:65535', proto: p.sport ? p.proto : (p.proto || 'tcp') }))}>
                      <Input className='h-7' placeholder='1024:65535' value={form.sport || ''} onChange={(e) => setForm((p) => ({ ...p, sport: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='Dst Port' enabled={!!form.dport} onToggle={() => setForm((p) => ({ ...p, dport: p.dport ? null : '22', proto: p.dport ? p.proto : (p.proto || 'tcp') }))}>
                      <Input className='h-7' placeholder='22 or 1000:2000' value={form.dport || ''} onChange={(e) => setForm((p) => ({ ...p, dport: e.target.value || null }))} />
                    </ToggleLine>
                  </div>
                  <ToggleLine label='Connection State' enabled={!!form.ct_state} onToggle={() => setForm((p) => ({ ...p, ct_state: p.ct_state ? null : 'new' }))}>
                    <div className='grid grid-cols-2 gap-2 rounded-md border p-2'>
                      {(() => {
                        const flags = parseCtState(form.ct_state)
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
                          setForm((p) => ({ ...p, ct_state: buildCtState(next) }))
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
                  </ToggleLine>
                </TabsContent>

                <TabsContent value='extra' className='mt-2 space-y-2.5'>
                  {form.table === 'nat' ? (
                    <div className='space-y-2 rounded-lg border p-2'>
                      <div className='text-[11px] font-medium text-muted-foreground'>NAT</div>
                      <div className='grid grid-cols-2 gap-2'>
                        <div className='space-y-1.5'><Label>NAT Type</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.nat_type || ''} onChange={(e) => setForm((p) => ({ ...p, nat_type: (e.target.value || null) as any }))}><option value=''>none</option><option value='masquerade'>masquerade</option><option value='snat'>snat</option><option value='dnat'>dnat</option><option value='redirect'>redirect</option></select></div>
                        <div className='space-y-1.5'><Label>To IP</Label><Input className='h-7' placeholder='192.168.1.10' value={form.to_addr || ''} onChange={(e) => setForm((p) => ({ ...p, to_addr: e.target.value || null }))} /></div>
                      </div>
                      <div className='space-y-1.5'><Label>To Port</Label><Input className='h-7' placeholder='8080 or 1000-2000' value={form.to_port || ''} onChange={(e) => setForm((p) => ({ ...p, to_port: e.target.value || null }))} /></div>
                    </div>
                  ) : null}
                  {form.table === 'raw' ? <label className='flex items-center gap-2 text-xs'><input type='checkbox' className='h-4 w-4' checked={!!form.notrack} onChange={(e) => setForm((p) => ({ ...p, notrack: e.target.checked }))} />Enable notrack</label> : null}
                  {form.table === 'mangle' ? <div className='grid grid-cols-2 gap-2'><div className='space-y-1.5'><Label>Packet Mark</Label><Input className='h-7' placeholder='0x1' value={form.mark_set || ''} onChange={(e) => setForm((p) => ({ ...p, mark_set: e.target.value || null }))} /></div><div className='space-y-1.5'><Label>Connection Mark</Label><Input className='h-7' placeholder='0x10' value={form.ct_mark_set || ''} onChange={(e) => setForm((p) => ({ ...p, ct_mark_set: e.target.value || null }))} /></div></div> : null}
                  {!['nat', 'raw', 'mangle'].includes(form.table || 'filter') ? <div className='rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground'>For `filter` table, this section is intentionally minimal.</div> : null}
                </TabsContent>

                <TabsContent value='action' className='mt-2 space-y-2.5'>
                  <div className='space-y-1.5'><Label>Action</Label><select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.action || 'accept'} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value as FirewallRule['action'] }))}><option value='accept'>accept</option><option value='drop'>drop</option><option value='reject'>reject</option></select></div>
                  <div className='grid grid-cols-2 gap-2'>
                    <ToggleLine label='Limit Rate' enabled={!!form.limit_rate} onToggle={() => setForm((p) => ({ ...p, limit_rate: p.limit_rate ? null : '20/minute' }))}>
                      <Input className='h-7' placeholder='10/second or 200/minute' value={form.limit_rate || ''} onChange={(e) => setForm((p) => ({ ...p, limit_rate: e.target.value || null }))} />
                    </ToggleLine>
                    <ToggleLine label='Log Prefix' enabled={!!form.log_prefix} onToggle={() => setForm((p) => ({ ...p, log_prefix: p.log_prefix ? null : 'FW' }))}>
                      <Input className='h-7' placeholder='FW DROP' value={form.log_prefix || ''} onChange={(e) => setForm((p) => ({ ...p, log_prefix: e.target.value || null }))} />
                    </ToggleLine>
                  </div>
                  <ToggleLine label='Log Level' enabled={!!form.log_level} onToggle={() => setForm((p) => ({ ...p, log_level: p.log_level ? null : 'info' }))}>
                    <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.log_level || 'info'} onChange={(e) => setForm((p) => ({ ...p, log_level: (e.target.value || null) as any }))}>
                      <option value='emerg'>emerg</option><option value='alert'>alert</option><option value='crit'>crit</option><option value='err'>err</option><option value='warn'>warn</option><option value='notice'>notice</option><option value='info'>info</option><option value='debug'>debug</option>
                    </select>
                  </ToggleLine>
                </TabsContent>

                <TabsContent value='stats' className='mt-2 space-y-2.5'>
                  <label className='flex items-center gap-2 text-xs'><input type='checkbox' className='h-4 w-4' checked={!!form.counter} onChange={(e) => setForm((p) => ({ ...p, counter: e.target.checked }))} />Enable nft `counter` for this rule</label>
                </TabsContent>
              </Tabs>

              <div className='flex justify-end gap-2 pt-1'>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type='submit' disabled={isBusy}><Plus />{editingRuleId ? 'Save' : 'Add'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
