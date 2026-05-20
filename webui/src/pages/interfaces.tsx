import * as React from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { AuthState, InterfaceItem } from './api'
import { createInterface, deleteInterface, generateAwgParams, getInterfaceConfig, getInterfaces, updateInterface } from './api'

const I1_PRESETS: Record<string, string> = {
  quic: '<b 0xc30000000108><rc 8><t><r 40>',
  dns: '<b 0x123401000001000000000000><rc 12><t><r 24>',
  sip: '<b 0x4f5054494f4e53207369703a><rc 10><b 0x205349502f322e300d0a><t><r 18>',
}

function tryParseJson(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return JSON.parse(trimmed)
}

export function InterfacesPage(props: { auth: AuthState; refreshNonce: number }) {
  const [items, setItems] = React.useState<InterfaceItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [selected, setSelected] = React.useState<InterfaceItem | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [editForm, setEditForm] = React.useState({
    wg_interface: '',
    awg_version: '2',
    port_number: '51820',
    wg_ip_addr: '',
    wg_ip_cidr: '24',
    srv_ip: '',
    srv_dns: '',
    awg_params_json: '',
  })
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)
  const [isGeneratingEditParams, setIsGeneratingEditParams] = React.useState(false)
  const [editPreset, setEditPreset] = React.useState<'none' | 'quic' | 'dns' | 'sip'>('none')
  const [showEditRawParams, setShowEditRawParams] = React.useState(false)
  const [interfaceConfigPreview, setInterfaceConfigPreview] = React.useState('')

  const [form, setForm] = React.useState({
    wg_interface: '',
    awg_version: '2',
    port_number: '51820',
    wg_ip_addr: '',
    wg_ip_cidr: '24',
    srv_ip: '',
    srv_dns: '',
    awg_params_json: '',
  })
  const [isGeneratingParams, setIsGeneratingParams] = React.useState(false)
  const [preset, setPreset] = React.useState<'none' | 'quic' | 'dns' | 'sip'>('none')
  const [showRawParams, setShowRawParams] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 10

  const filteredItems = (() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) =>
      [it.wg_interface, it.awg_version, it.wg_ip_addr, String(it.port_number), it.srv_ip, it.srv_dns]
        .some((v) => v.toLowerCase().includes(q))
    )
  })()

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const pagedItems = (() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  })()

  async function refresh() {
    setError(null)
    setIsLoading(true)
    try {
      const next = await getInterfaces(props.auth)
      setItems(next)
      setPage(1)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.refreshNonce])

  async function onCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setIsCreating(true)
    try {
      const payload: any = {
        wg_interface: form.wg_interface.trim(),
        awg_version: form.awg_version,
        port_number: Number(form.port_number),
        wg_ip_addr: form.wg_ip_addr.trim(),
        wg_ip_cidr: Number(form.wg_ip_cidr),
        srv_ip: form.srv_ip.trim(),
        srv_dns: form.srv_dns.trim(),
      }
      if (form.awg_params_json.trim()) {
        payload.awg_params = tryParseJson(form.awg_params_json)
      }
      await createInterface(props.auth, payload)
      setForm((prev) => ({ ...prev, wg_interface: '', wg_ip_addr: '', srv_ip: '', awg_params_json: '' }))
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsCreating(false)
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Delete this interface?')) return
    setError(null)
    try {
      await deleteInterface(props.auth, id)
      setDrawerOpen(false)
      setSelected(null)
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  async function onGenerateParams() {
    setError(null)
    setIsGeneratingParams(true)
    try {
      const awgVersion = form.awg_version === '1' ? '1' : '2'
      const generated = await generateAwgParams(props.auth, awgVersion)
      const current = form.awg_params_json.trim() ? tryParseJson(form.awg_params_json) || {} : {}
      const merged = {
        ...generated,
        I1: current.I1 ?? generated.I1,
        I2: current.I2 ?? generated.I2,
        I3: current.I3 ?? generated.I3,
        I4: current.I4 ?? generated.I4,
        I5: current.I5 ?? generated.I5,
      }
      setForm((prev) => ({ ...prev, awg_params_json: JSON.stringify(merged, null, 2) }))
      setShowRawParams(true)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setIsGeneratingParams(false)
    }
  }

  function onApplyPreset(nextPreset: 'none' | 'quic' | 'dns' | 'sip') {
    setPreset(nextPreset)
    if (nextPreset === 'none') return
    try {
      const current = form.awg_params_json.trim() ? JSON.parse(form.awg_params_json) : {}
      const updated = {
        ...current,
        I1: I1_PRESETS[nextPreset],
      }
      setForm((prev) => ({ ...prev, awg_params_json: JSON.stringify(updated, null, 2) }))
    } catch {
      const updated = {
        I1: I1_PRESETS[nextPreset],
      }
      setForm((prev) => ({ ...prev, awg_params_json: JSON.stringify(updated, null, 2) }))
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h2 className='text-lg font-semibold tracking-tight'>Interfaces</h2>
          <p className='text-sm text-muted-foreground'>Create, inspect, and delete AmneziaWG interfaces.</p>
        </div>
      </div>

      {error ? (
        <div className='rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive'>
          {error}
        </div>
      ) : null}

      <div className='grid gap-3 lg:grid-cols-5 text-xs'>
        <Card className='lg:col-span-2'>
          <CardHeader className='px-4 pb-1'>
            <CardTitle>Create Interface</CardTitle>
            <CardDescription>Version defaults to 2. Keys and params can be auto-generated by backend.</CardDescription>
          </CardHeader>
          <CardContent className='px-4'>
            <form className='space-y-2.5' onSubmit={onCreate}>
              <div className='space-y-1.5'>
                <Label>Interface name</Label>
                <Input className='h-7' value={form.wg_interface} onChange={(e) => setForm((p) => ({ ...p, wg_interface: e.target.value }))} placeholder='awg0' required />
              </div>
              <div className='grid gap-2.5 md:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Version</Label>
                  <select
                    className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                    value={form.awg_version}
                    onChange={(e) => setForm((p) => ({ ...p, awg_version: e.target.value }))}
                  >
                    <option value='2'>2</option>
                    <option value='1'>1</option>
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>Listen port</Label>
                  <Input className='h-7' value={form.port_number} onChange={(e) => setForm((p) => ({ ...p, port_number: e.target.value }))} type='number' min={1} max={65535} />
                </div>
              </div>
              <div className='grid gap-2.5 md:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Interface IP</Label>
                  <Input className='h-7' value={form.wg_ip_addr} onChange={(e) => setForm((p) => ({ ...p, wg_ip_addr: e.target.value }))} placeholder='10.8.0.1' required />
                </div>
                <div className='space-y-1.5'>
                  <Label>CIDR</Label>
                  <Input className='h-7' value={form.wg_ip_cidr} onChange={(e) => setForm((p) => ({ ...p, wg_ip_cidr: e.target.value }))} type='number' min={1} max={32} />
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label>Server public IP</Label>
                <Input className='h-7' value={form.srv_ip} onChange={(e) => setForm((p) => ({ ...p, srv_ip: e.target.value }))} placeholder='203.0.113.10' required />
              </div>
              <div className='space-y-1.5'>
                <Label>DNS</Label>
                <Input className='h-7' value={form.srv_dns} onChange={(e) => setForm((p) => ({ ...p, srv_dns: e.target.value }))} placeholder='1.1.1.1' required />
              </div>
              <div className='space-y-1.5'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <Label>AWG params</Label>
                  <div className='flex flex-wrap items-center gap-2'>
                    <select
                      className='h-7 rounded-md border bg-background px-2 text-xs'
                      value={preset}
                      onChange={(e) => onApplyPreset(e.target.value as 'none' | 'quic' | 'dns' | 'sip')}
                      disabled={form.awg_version !== '2'}
                    >
                      <option value='none'>Protocol preset</option>
                      <option value='quic'>QUIC-like</option>
                      <option value='dns'>DNS-like</option>
                      <option value='sip'>SIP-like</option>
                    </select>
                    <Button type='button' variant='outline' size='sm' onClick={() => void onGenerateParams()} disabled={isGeneratingParams}>
                      <Sparkles className='size-4' />
                      {isGeneratingParams ? 'Generating...' : 'Generate params'}
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setShowRawParams((prev) => !prev)}
                    >
                      {showRawParams ? 'Hide JSON' : 'Show JSON'}
                    </Button>
                  </div>
                </div>
                {showRawParams ? (
                  <Textarea
                    value={form.awg_params_json}
                    onChange={(e) => setForm((p) => ({ ...p, awg_params_json: e.target.value }))}
                    placeholder='{"S3": 20, "S4": 10, "I1": "..."}'
                  />
                ) : null}
                <p className='text-[11px] text-muted-foreground'>
                  Use presets and generator for normal setup. Raw JSON is optional and hidden by default.
                </p>
              </div>
              <Button type='submit' className='w-full' disabled={isCreating}>
                <Plus />
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader className='px-4 pb-2'>
            <CardTitle>Saved Interfaces</CardTitle>
            <CardDescription>Click a row to view details and actions.</CardDescription>
          </CardHeader>
          <CardContent className='px-4'>
            <div className='mb-2 flex flex-wrap items-center justify-between gap-1.5'>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder='Search interface (name, ip, port, server, dns, version)'
                className='h-7 max-w-md'
              />
              <div className='flex items-center gap-2 text-xs'>
                <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <span>
                  {page}/{totalPages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
            <div className='max-h-[440px] overflow-auto rounded-xl border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Server</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map((it) => (
                    <TableRow
                      key={it.id}
                      className={`h-7 cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${selected?.id === it.id ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''}`}
                      onClick={() => {
                        setSelected(it)
                        setEditForm({
                          wg_interface: it.wg_interface,
                          awg_version: it.awg_version,
                          port_number: String(it.port_number),
                          wg_ip_addr: it.wg_ip_addr,
                          wg_ip_cidr: String(it.wg_ip_cidr),
                          srv_ip: it.srv_ip,
                          srv_dns: it.srv_dns,
                          awg_params_json: JSON.stringify(it.awg_params || {}, null, 2),
                        })
                        void getInterfaceConfig(props.auth, it.id)
                          .then((config) => setInterfaceConfigPreview(config))
                          .catch(() => setInterfaceConfigPreview('Failed to load config preview'))
                        setDrawerOpen(true)
                      }}
                    >
                      <TableCell className='font-medium'>{it.wg_interface}</TableCell>
                      <TableCell>
                        <Badge variant='secondary'>v{it.awg_version}</Badge>
                      </TableCell>
                      <TableCell>
                        {it.wg_ip_addr}/{it.wg_ip_cidr}
                      </TableCell>
                      <TableCell>{it.port_number}</TableCell>
                      <TableCell>{it.srv_ip}</TableCell>
                    </TableRow>
                  ))}
                  {!filteredItems.length && !isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className='py-6 text-center text-xs text-muted-foreground'>
                        No interfaces found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side='right' className='w-full p-2.5 sm:max-w-2xl'>
          <SheetHeader>
            <SheetTitle>Interface Details</SheetTitle>
            <SheetDescription>{selected ? selected.wg_interface : '—'}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className='mt-3 space-y-2 pb-16'>
              <div className='grid gap-2 rounded-xl border p-2.5 text-xs'>
                <div className='space-y-1.5'>
                  <Label>Interface name</Label>
                  <Input className='h-7' value={editForm.wg_interface} onChange={(e) => setEditForm((p) => ({ ...p, wg_interface: e.target.value }))} />
                </div>
                <div className='grid gap-2.5 md:grid-cols-2'>
                  <div className='space-y-1.5'>
                    <Label>Version</Label>
                    <select
                      className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                      value={editForm.awg_version}
                      onChange={(e) => setEditForm((p) => ({ ...p, awg_version: e.target.value }))}
                    >
                      <option value='2'>2</option>
                      <option value='1'>1</option>
                    </select>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Port</Label>
                  <Input className='h-7' value={editForm.port_number} type='number' onChange={(e) => setEditForm((p) => ({ ...p, port_number: e.target.value }))} />
                  </div>
                </div>
                <div className='grid gap-2.5 md:grid-cols-2'>
                  <div className='space-y-1.5'>
                    <Label>Interface IP</Label>
                    <Input className='h-7' value={editForm.wg_ip_addr} onChange={(e) => setEditForm((p) => ({ ...p, wg_ip_addr: e.target.value }))} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>CIDR</Label>
                    <Input className='h-7' value={editForm.wg_ip_cidr} type='number' onChange={(e) => setEditForm((p) => ({ ...p, wg_ip_cidr: e.target.value }))} />
                  </div>
                </div>
                <div className='space-y-1.5'>
                  <Label>Server IP</Label>
                  <Input className='h-7' value={editForm.srv_ip} onChange={(e) => setEditForm((p) => ({ ...p, srv_ip: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>DNS</Label>
                  <Input className='h-7' value={editForm.srv_dns} onChange={(e) => setEditForm((p) => ({ ...p, srv_dns: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <div className='text-muted-foreground'>Public Key</div>
                  <div className='break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs'>{selected.public_key}</div>
                </div>
              </div>

              <div className='space-y-1.5'>
                <div className='text-xs font-medium'>AWG Params</div>
                <div className='flex flex-wrap items-center gap-2'>
                  <select
                    className='h-7 rounded-md border bg-background px-2 text-xs'
                    value={editPreset}
                    onChange={(e) => {
                      const nextPreset = e.target.value as 'none' | 'quic' | 'dns' | 'sip'
                      setEditPreset(nextPreset)
                      if (nextPreset === 'none') return
                      try {
                        const current = editForm.awg_params_json.trim() ? JSON.parse(editForm.awg_params_json) : {}
                        const updated = {
                          ...current,
                          I1: I1_PRESETS[nextPreset],
                        }
                        setEditForm((prev) => ({ ...prev, awg_params_json: JSON.stringify(updated, null, 2) }))
                      } catch {
                        setEditForm((prev) => ({ ...prev, awg_params_json: JSON.stringify({ I1: I1_PRESETS[nextPreset] }, null, 2) }))
                      }
                    }}
                    disabled={editForm.awg_version !== '2'}
                  >
                    <option value='none'>Protocol preset</option>
                    <option value='quic'>QUIC-like</option>
                    <option value='dns'>DNS-like</option>
                    <option value='sip'>SIP-like</option>
                  </select>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={async () => {
                      setError(null)
                      setIsGeneratingEditParams(true)
                      try {
                        const awgVersion = editForm.awg_version === '1' ? '1' : '2'
                        const generated = await generateAwgParams(props.auth, awgVersion)
                        const current = editForm.awg_params_json.trim() ? tryParseJson(editForm.awg_params_json) || {} : {}
                        const merged = {
                          ...generated,
                          I1: current.I1 ?? generated.I1,
                          I2: current.I2 ?? generated.I2,
                          I3: current.I3 ?? generated.I3,
                          I4: current.I4 ?? generated.I4,
                          I5: current.I5 ?? generated.I5,
                        }
                        setEditForm((prev) => ({ ...prev, awg_params_json: JSON.stringify(merged, null, 2) }))
                      } catch (exc) {
                        setError(exc instanceof Error ? exc.message : String(exc))
                      } finally {
                        setIsGeneratingEditParams(false)
                      }
                    }}
                    disabled={isGeneratingEditParams}
                  >
                    <Sparkles className='size-4' />
                    {isGeneratingEditParams ? 'Generating...' : 'Generate params'}
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => setShowEditRawParams((prev) => !prev)}
                  >
                    {showEditRawParams ? 'Hide JSON' : 'Show JSON'}
                  </Button>
                </div>
                {!showEditRawParams ? (
                  <pre className='max-h-[260px] overflow-auto rounded-xl border bg-muted p-3 text-xs'>
                    {interfaceConfigPreview || 'Loading...'}
                  </pre>
                ) : (
                  <Textarea
                    value={editForm.awg_params_json}
                    onChange={(e) => setEditForm((p) => ({ ...p, awg_params_json: e.target.value }))}
                    className='min-h-[130px] text-xs'
                  />
                )}
              </div>

              <div className='sticky bottom-0 z-10 flex gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur'>
                <Button
                  variant='default'
                  disabled={isSavingEdit}
                  onClick={async () => {
                    setError(null)
                    setIsSavingEdit(true)
                    try {
                      const payload: any = {
                        wg_interface: editForm.wg_interface.trim(),
                        awg_version: editForm.awg_version,
                        port_number: Number(editForm.port_number),
                        wg_ip_addr: editForm.wg_ip_addr.trim(),
                        wg_ip_cidr: Number(editForm.wg_ip_cidr),
                        srv_ip: editForm.srv_ip.trim(),
                        srv_dns: editForm.srv_dns.trim(),
                      }
                      if (editForm.awg_params_json.trim()) {
                        payload.awg_params = tryParseJson(editForm.awg_params_json)
                      }
                      const updated = await updateInterface(props.auth, selected.id, payload)
                      setSelected(updated)
                      setEditForm({
                        wg_interface: updated.wg_interface,
                        awg_version: updated.awg_version,
                        port_number: String(updated.port_number),
                        wg_ip_addr: updated.wg_ip_addr,
                        wg_ip_cidr: String(updated.wg_ip_cidr),
                        srv_ip: updated.srv_ip,
                        srv_dns: updated.srv_dns,
                        awg_params_json: JSON.stringify(updated.awg_params || {}, null, 2),
                      })
                      setInterfaceConfigPreview(await getInterfaceConfig(props.auth, updated.id))
                      await refresh()
                    } catch (exc) {
                      setError(exc instanceof Error ? exc.message : String(exc))
                    } finally {
                      setIsSavingEdit(false)
                    }
                  }}
                >
                  {isSavingEdit ? 'Saving...' : 'Save'}
                </Button>
                <Button variant='destructive' onClick={() => void onDelete(selected.id)}>
                  <Trash2 />
                  Delete
                </Button>
                <Button variant='secondary' onClick={() => void refresh()}>
                  Refresh
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
