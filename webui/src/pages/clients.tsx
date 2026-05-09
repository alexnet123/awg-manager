import * as React from 'react'
import { Download, QrCode, Trash2, FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AuthState, ClientItem, InterfaceItem } from './api'
import {
  createClient,
  deleteClient,
  downloadWithAuth,
  getClientConfig,
  getClientQrSvg,
  getClients,
  getInterfaces,
  updateClient,
} from './api'

export function ClientsPage(props: { auth: AuthState; refreshNonce: number }) {
  const [clients, setClients] = React.useState<ClientItem[]>([])
  const [interfaces, setInterfaces] = React.useState<InterfaceItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [selected, setSelected] = React.useState<ClientItem | null>(null)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'config' | 'qr'>('config')
  const [configText, setConfigText] = React.useState<string>('')
  const [qrSvg, setQrSvg] = React.useState<string>('')
  const [editForm, setEditForm] = React.useState({
    name: '',
    wg_interface: '',
    ip: '',
    allowed_ips: '0.0.0.0/0',
  })
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)

  const [form, setForm] = React.useState({
    name: '',
    wg_interface: '',
    ip: '',
    allowed_ips: '0.0.0.0/0',
  })
  const [query, setQuery] = React.useState('')
  const [page, setPage] = React.useState(1)
  const pageSize = 100

  const filteredClients = (() => {
    const q = query.trim().toLowerCase()
    const base = !q
      ? clients
      : clients.filter((it) =>
      [it.name, it.ip, it.wg_interface, it.pubkey].some((v) => v.toLowerCase().includes(q))
      )
    // Show newest entries first so just-created items are visible immediately.
    return [...base].sort((a, b) => b.id - a.id)
  })()

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize))
  const pagedClients = (() => {
    const start = (page - 1) * pageSize
    return filteredClients.slice(start, start + pageSize)
  })()

  async function refresh() {
    setError(null)
    setIsLoading(true)
    try {
      const [ifs, cls] = await Promise.all([getInterfaces(props.auth), getClients(props.auth)])
      setInterfaces(ifs)
      setClients(cls)
      setPage(1)
      setForm((prev) => ({ ...prev, wg_interface: prev.wg_interface || (ifs[0]?.wg_interface ?? '') }))
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
    try {
      const payload: any = { name: form.name.trim(), wg_interface: form.wg_interface.trim() }
      if (form.ip.trim()) payload.ip = form.ip.trim()
      payload.allowed_ips = form.allowed_ips.trim() || '0.0.0.0/0'
      await createClient(props.auth, payload)
      setForm((p) => ({ ...p, name: '', ip: '', allowed_ips: '0.0.0.0/0' }))
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  async function onDelete(id: number) {
    if (!confirm('Delete this client?')) return
    setError(null)
    try {
      await deleteClient(props.auth, id)
      setDrawerOpen(false)
      setSelected(null)
      setConfigText('')
      setQrSvg('')
      await refresh()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  async function loadConfig(clientId: number) {
    setError(null)
    try {
      const cfg = await getClientConfig(props.auth, clientId)
      setConfigText(cfg)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  async function loadQr(clientId: number) {
    setError(null)
    try {
      const svg = await getClientQrSvg(props.auth, clientId)
      setQrSvg(svg)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h2 className='text-lg font-semibold tracking-tight'>Clients</h2>
          <p className='text-sm text-muted-foreground'>Manage peers, configs, and QR codes.</p>
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
            <CardTitle>Create Client</CardTitle>
            <CardDescription>IP can be empty for automatic assignment.</CardDescription>
          </CardHeader>
          <CardContent className='px-4'>
            <form className='space-y-2.5' onSubmit={onCreate}>
              <div className='space-y-1.5'>
                <Label>Name</Label>
                <Input className='h-7' value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder='phone' required />
              </div>
              <div className='space-y-1.5'>
                <Label>Interface</Label>
                <select
                  className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                  value={form.wg_interface}
                  onChange={(e) => setForm((p) => ({ ...p, wg_interface: e.target.value }))}
                  disabled={!interfaces.length}
                  required
                >
                  {interfaces.map((it) => (
                    <option key={it.id} value={it.wg_interface}>
                      {it.wg_interface} (v{it.awg_version})
                    </option>
                  ))}
                </select>
              </div>
              <div className='space-y-1.5'>
                <Label>Client IP</Label>
                <Input className='h-7' value={form.ip} onChange={(e) => setForm((p) => ({ ...p, ip: e.target.value }))} placeholder='10.8.0.2' />
              </div>
              <div className='space-y-1.5'>
                <Label>AllowedIPs</Label>
                <Input
                  className='h-7'
                  value={form.allowed_ips}
                  onChange={(e) => setForm((p) => ({ ...p, allowed_ips: e.target.value }))}
                  placeholder='0.0.0.0/0'
                />
              </div>
              <Button type='submit' className='w-full' disabled={!interfaces.length}>
                <Plus />
                Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className='lg:col-span-3'>
          <CardHeader className='px-4 pb-1'>
            <CardTitle>Saved Clients</CardTitle>
            <CardDescription>Click a row to view config/QR and actions.</CardDescription>
          </CardHeader>
          <CardContent className='px-4'>
            <div className='mb-2 flex flex-wrap items-center justify-between gap-1.5'>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder='Search client (name, IP, interface, pubkey)'
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
                    <TableHead>IP</TableHead>
                    <TableHead>Interface</TableHead>
                    <TableHead>Public Key</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedClients.map((it) => (
                    <TableRow
                      key={it.id}
                      className='cursor-pointer'
                      onClick={() => {
                        setSelected(it)
                        setEditForm({
                          name: it.name,
                          wg_interface: it.wg_interface,
                          ip: it.ip,
                          allowed_ips: it.allowed_ips || '0.0.0.0/0',
                        })
                        setDrawerOpen(true)
                        setActiveTab('config')
                        void loadConfig(it.id)
                        setQrSvg('')
                      }}
                    >
                      <TableCell className='font-medium'>{it.name}</TableCell>
                      <TableCell>{it.ip}</TableCell>
                      <TableCell>{it.wg_interface}</TableCell>
                      <TableCell className='max-w-[260px] truncate font-mono text-xs'>{it.pubkey}</TableCell>
                    </TableRow>
                  ))}
                  {!filteredClients.length && !isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className='py-6 text-center text-xs text-muted-foreground'>
                        No clients found.
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
            <SheetTitle>Client Details</SheetTitle>
            <SheetDescription>{selected ? `${selected.name} (${selected.ip})` : '—'}</SheetDescription>
          </SheetHeader>
          {selected ? (
            <div className='mt-3 space-y-2 pb-16'>
              <div className='grid gap-2 rounded-xl border p-2.5 text-xs'>
                <div className='space-y-1.5'>
                  <Label>Name</Label>
                  <Input
                    className='h-7'
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>Interface</Label>
                  <select
                    className='h-7 w-full rounded-md border bg-background px-2.5 text-xs'
                    value={editForm.wg_interface}
                    onChange={(e) => setEditForm((p) => ({ ...p, wg_interface: e.target.value }))}
                  >
                    {interfaces.map((it) => (
                      <option key={it.id} value={it.wg_interface}>
                        {it.wg_interface} (v{it.awg_version})
                      </option>
                    ))}
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <Label>Client IP</Label>
                  <Input
                    className='h-7'
                    placeholder='10.8.0.2 (optional)'
                    value={editForm.ip}
                    onChange={(e) => setEditForm((p) => ({ ...p, ip: e.target.value }))}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>AllowedIPs</Label>
                  <Input
                    className='h-7'
                    placeholder='0.0.0.0/0'
                    value={editForm.allowed_ips}
                    onChange={(e) => setEditForm((p) => ({ ...p, allowed_ips: e.target.value }))}
                  />
                </div>
                <div className='space-y-2'>
                  <div className='text-muted-foreground'>Public Key</div>
                  <div className='break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs'>{selected.pubkey}</div>
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList>
                  <TabsTrigger value='config' onClick={() => void loadConfig(selected.id)}>
                    Config
                  </TabsTrigger>
                  <TabsTrigger
                    value='qr'
                    onClick={() => {
                      void loadQr(selected.id)
                    }}
                  >
                    QR
                  </TabsTrigger>
                </TabsList>

                <TabsContent value='config' className='mt-3 space-y-3'>
                  <div className='flex flex-wrap gap-2'>
                    <Button variant='secondary' onClick={() => void loadConfig(selected.id)}>
                      <FileText />
                      Reload
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => void downloadWithAuth(props.auth, `/clients/${selected.id}/config/download`, `client-${selected.id}.conf`)}
                    >
                      <Download />
                      Download .conf
                    </Button>
                  </div>
                  <pre className='max-h-[420px] overflow-auto rounded-xl border bg-muted p-4 text-xs'>{configText || '—'}</pre>
                </TabsContent>

                <TabsContent value='qr' className='mt-3 space-y-3'>
                  <div className='flex flex-wrap gap-2'>
                    <Button variant='secondary' onClick={() => void loadQr(selected.id)}>
                      <QrCode />
                      Reload
                    </Button>
                    <Button
                      variant='outline'
                      onClick={() => void downloadWithAuth(props.auth, `/clients/${selected.id}/qr/download?format=svg`, `client-${selected.id}.svg`)}
                    >
                      <Download />
                      Download SVG
                    </Button>
                  </div>
                  <div className='rounded-xl border bg-background p-4'>
                    {qrSvg ? <div className='max-w-full overflow-auto' dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <div className='text-sm text-muted-foreground'>—</div>}
                  </div>
                </TabsContent>
              </Tabs>

              <div className='sticky bottom-0 z-10 flex gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur'>
                <Button
                  variant='default'
                  disabled={isSavingEdit}
                  onClick={async () => {
                    setError(null)
                    setIsSavingEdit(true)
                    try {
                      const payload: any = {
                        name: editForm.name.trim(),
                        wg_interface: editForm.wg_interface.trim(),
                      }
                      if (editForm.ip.trim()) payload.ip = editForm.ip.trim()
                      payload.allowed_ips = editForm.allowed_ips.trim() || '0.0.0.0/0'
                      const updated = await updateClient(props.auth, selected.id, payload)
                      setSelected(updated)
                      setEditForm({
                        name: updated.name,
                        wg_interface: updated.wg_interface,
                        ip: updated.ip,
                        allowed_ips: updated.allowed_ips || '0.0.0.0/0',
                      })
                      await Promise.all([
                        loadConfig(updated.id),
                        loadQr(updated.id),
                      ])
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
