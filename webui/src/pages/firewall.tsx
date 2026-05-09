import * as React from 'react'
import { Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AuthState, FirewallRule, FirewallState } from './api'
import { applyFirewallRules, createFirewallRule, deleteFirewallRule, getFirewallState, updateFirewallRule } from './api'

const defaultRule: Partial<FirewallRule> = {
  table: 'filter',
  family: 'inet',
  chain: 'input',
  action: 'accept',
  proto: 'tcp',
  dport: '22',
  enabled: true,
  comment: '',
}

export function FirewallPage(props: { auth: AuthState; refreshNonce: number }) {
  const [state, setState] = React.useState<FirewallState | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Partial<FirewallRule>>(defaultRule)
  const [isBusy, setIsBusy] = React.useState(false)
  const [activeTable, setActiveTable] = React.useState<'filter' | 'nat' | 'raw' | 'mangle'>('filter')
  const [addOpen, setAddOpen] = React.useState(false)
  const [winPos, setWinPos] = React.useState({ x: 120, y: 120 })
  const dragRef = React.useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

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

  async function onCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)
    try {
      await createFirewallRule(props.auth, form)
      setForm(defaultRule)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsBusy(false)
    }
  }

  async function onToggle(rule: FirewallRule) {
    setError(null)
    setIsBusy(true)
    try {
      await updateFirewallRule(props.auth, rule.id, { enabled: !rule.enabled })
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

  const chainOptionsByTable: Record<string, FirewallRule['chain'][]> = {
    filter: ['input', 'forward', 'output'],
    nat: ['prerouting', 'input', 'output', 'postrouting'],
    raw: ['prerouting', 'output'],
    mangle: ['prerouting', 'input', 'forward', 'output', 'postrouting'],
  }
  const visibleRules = (state?.rules || []).filter((r) => r.table === activeTable)

  function onDragStart(event: React.MouseEvent<HTMLDivElement>) {
    dragRef.current = {
      sx: event.clientX,
      sy: event.clientY,
      ox: winPos.x,
      oy: winPos.y,
    }
    const onMove = (ev: MouseEvent) => {
      const s = dragRef.current
      if (!s) return
      setWinPos({
        x: Math.max(8, s.ox + ev.clientX - s.sx),
        y: Math.max(8, s.oy + ev.clientY - s.sy),
      })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className='space-y-3'>
      <div>
        <h2 className='text-lg font-semibold tracking-tight'>Firewall</h2>
        <p className='text-sm text-muted-foreground'>nftables rule manager (router-style table workflow).</p>
      </div>
      {error ? <div className='rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'>{error}</div> : null}
      <Card className='text-xs'>
        <CardHeader className='px-4 pb-1'>
          <CardTitle>Rule Table</CardTitle>
          <CardDescription>Status: {state?.active ? 'applied' : 'not applied'}</CardDescription>
        </CardHeader>
        <CardContent className='px-4 space-y-2'>
          <div className='flex flex-wrap gap-2'>
            {(['filter', 'nat', 'raw', 'mangle'] as const).map((t) => (
              <Button
                key={t}
                size='sm'
                variant={activeTable === t ? 'default' : 'outline'}
                onClick={() => setActiveTable(t)}
              >
                {t}
              </Button>
            ))}
          </div>
          <div className='flex gap-2'>
            <Button size='sm' onClick={() => setAddOpen(true)} disabled={isBusy}>
              <Plus />
              Add rule
            </Button>
            <Button size='sm' variant='secondary' onClick={() => void refresh()} disabled={isBusy}>
              <RefreshCcw />
              Refresh
            </Button>
            <Button
              size='sm'
              onClick={async () => {
                setIsBusy(true)
                try {
                  await applyFirewallRules(props.auth)
                  await refresh()
                } catch (exc) {
                  setError(exc instanceof Error ? exc.message : String(exc))
                } finally {
                  setIsBusy(false)
                }
              }}
              disabled={isBusy}
            >
              Apply now
            </Button>
          </div>
          <div className='h-[calc(100vh-280px)] min-h-[460px] overflow-auto rounded-xl border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>On</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Proto</TableHead>
                  <TableHead>DPort</TableHead>
                  <TableHead>Src</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <input type='checkbox' checked={r.enabled} onChange={() => void onToggle(r)} />
                    </TableCell>
                    <TableCell>{r.chain}</TableCell>
                    <TableCell>{r.action}</TableCell>
                    <TableCell>{r.proto || 'any'}</TableCell>
                    <TableCell>{r.dport || '—'}</TableCell>
                    <TableCell>{r.src || '—'}</TableCell>
                    <TableCell className='max-w-[320px] truncate'>{r.comment || '—'}</TableCell>
                    <TableCell>
                      <Button size='icon' variant='ghost' onClick={() => void onDelete(r)} disabled={isBusy}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!visibleRules.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className='py-6 text-center text-xs text-muted-foreground'>
                      No rules in {activeTable} table.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {addOpen ? (
        <div className='fixed inset-0 z-40'>
          <div
            className='absolute z-50 w-[460px] max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl'
            style={{ left: winPos.x, top: winPos.y }}
          >
            <div
              className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none'
              onMouseDown={onDragStart}
            >
              Add Firewall Rule
            </div>
            <form className='space-y-2.5 p-3 text-xs' onSubmit={async (event) => {
              await onCreate(event)
              if (!error) setAddOpen(false)
            }}>
              <div className='space-y-1.5'>
                <Label>Table</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={form.table || 'filter'}
                  onChange={(e) => {
                    const nextTable = e.target.value as 'filter' | 'nat' | 'raw' | 'mangle'
                    const nextChains = chainOptionsByTable[nextTable]
                    setForm((p) => ({
                      ...p,
                      table: nextTable,
                      chain: nextChains[0],
                    }))
                  }}
                >
                  <option value='filter'>filter</option>
                  <option value='nat'>nat</option>
                  <option value='raw'>raw</option>
                  <option value='mangle'>mangle</option>
                </select>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div className='space-y-1.5'>
                  <Label>Chain</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.chain || 'input'} onChange={(e) => setForm((p) => ({ ...p, chain: e.target.value as FirewallRule['chain'] }))}>
                    {(chainOptionsByTable[form.table || 'filter'] || []).map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>Action</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.action || 'accept'} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value as FirewallRule['action'] }))}>
                    <option value='accept'>accept</option>
                    <option value='drop'>drop</option>
                    <option value='reject'>reject</option>
                  </select>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div className='space-y-1.5'>
                  <Label>Proto</Label>
                  <select className='h-7 w-full rounded-md border bg-background px-2.5 text-xs' value={form.proto || ''} onChange={(e) => setForm((p) => ({ ...p, proto: (e.target.value || null) as any }))}>
                    <option value=''>any</option>
                    <option value='tcp'>tcp</option>
                    <option value='udp'>udp</option>
                    <option value='icmp'>icmp</option>
                    <option value='icmpv6'>icmpv6</option>
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>DPort</Label>
                  <Input className='h-7' placeholder='22' value={form.dport || ''} onChange={(e) => setForm((p) => ({ ...p, dport: e.target.value || null }))} />
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label>Src CIDR</Label>
                <Input className='h-7' placeholder='0.0.0.0/0' value={form.src || ''} onChange={(e) => setForm((p) => ({ ...p, src: e.target.value || null }))} />
              </div>
              <div className='space-y-1.5'>
                <Label>Comment</Label>
                <Input className='h-7' placeholder='Allow SSH' value={form.comment || ''} onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value || null }))} />
              </div>
              <div className='flex justify-end gap-2 pt-1'>
                <Button type='button' variant='outline' onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type='submit' disabled={isBusy}>
                  <Plus />
                  Add
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
