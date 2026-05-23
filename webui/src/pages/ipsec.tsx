import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  AuthState,
  IpsecIdentity,
  IpsecPeer,
  IpsecPhase1Profile,
  IpsecPhase2Proposal,
  IpsecPolicy,
} from './api'
import {
  applyIpsec,
  deleteIpsecPeer,
  deleteIpsecPolicy,
  getIpsecActivePeers,
  getIpsecIdentities,
  getIpsecInstalledSas,
  getIpsecPeers,
  getIpsecPhase1Profiles,
  getIpsecPhase2Proposals,
  getIpsecPolicies,
  initiateIpsecPolicy,
  terminateIpsecPeer,
  upsertIpsecIdentity,
  upsertIpsecPeer,
  upsertIpsecPhase1Profile,
  upsertIpsecPhase2Proposal,
  upsertIpsecPolicy,
} from './api'

function splitCsv(v: string): string[] {
  return v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function IpsecPage(props: { auth: AuthState; refreshNonce: number }) {
  const [peers, setPeers] = React.useState<IpsecPeer[]>([])
  const [identities, setIdentities] = React.useState<IpsecIdentity[]>([])
  const [phase1, setPhase1] = React.useState<IpsecPhase1Profile[]>([])
  const [phase2, setPhase2] = React.useState<IpsecPhase2Proposal[]>([])
  const [policies, setPolicies] = React.useState<IpsecPolicy[]>([])
  const [active, setActive] = React.useState<any[]>([])
  const [installed, setInstalled] = React.useState<any[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const [peerForm, setPeerForm] = React.useState({ name: '', local_addrs: '', remote_addrs: '', phase1_profile: '' })
  const [idForm, setIdForm] = React.useState({ peer: '', local_id: '', remote_id: '', psk: '' })
  const [p1Form, setP1Form] = React.useState({ name: '', encryption: 'aes256', hash: 'sha256', dh_group: 'modp2048', lifetime: '1d' })
  const [p2Form, setP2Form] = React.useState({ name: '', encryption: 'aes256', auth: 'sha256', pfs_group: 'modp2048', lifetime: '1h' })
  const [polForm, setPolForm] = React.useState({ name: '', peer: '', local_ts: '', remote_ts: '', proposal: '', start_action: 'start' })

  async function loadAll() {
    setError(null)
    try {
      const [p, i, p1, p2, pol, a, ins] = await Promise.all([
        getIpsecPeers(props.auth),
        getIpsecIdentities(props.auth),
        getIpsecPhase1Profiles(props.auth),
        getIpsecPhase2Proposals(props.auth),
        getIpsecPolicies(props.auth),
        getIpsecActivePeers(props.auth),
        getIpsecInstalledSas(props.auth),
      ])
      setPeers(p)
      setIdentities(i)
      setPhase1(p1)
      setPhase2(p2)
      setPolicies(pol)
      setActive(a)
      setInstalled(ins.items || [])
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }

  React.useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.refreshNonce])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await loadAll()
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='min-h-0 w-full overflow-auto'>
      <div className='space-y-3'>
        {error ? <div className='rounded border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive'>{error}</div> : null}
        <div className='flex gap-2'>
          <Button disabled={busy} onClick={() => void run(async () => { await applyIpsec(props.auth) })}>Apply</Button>
          <Button variant='outline' disabled={busy} onClick={() => void loadAll()}>Refresh</Button>
        </div>

        <Tabs defaultValue='policies'>
          <TabsList className='flex flex-wrap'>
            <TabsTrigger value='policies'>Policies</TabsTrigger>
            <TabsTrigger value='peers'>Peers</TabsTrigger>
            <TabsTrigger value='identities'>Identities</TabsTrigger>
            <TabsTrigger value='phase1'>Profiles (Phase 1)</TabsTrigger>
            <TabsTrigger value='phase2'>Proposals (Phase 2)</TabsTrigger>
            <TabsTrigger value='active'>Active Peers</TabsTrigger>
            <TabsTrigger value='installed'>Installed SAs</TabsTrigger>
          </TabsList>

          <TabsContent value='peers'>
            <Card>
              <CardHeader><CardTitle>Peers</CardTitle></CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-2 md:grid-cols-4'>
                  <Input placeholder='Name' value={peerForm.name} onChange={(e) => setPeerForm((s) => ({ ...s, name: e.target.value }))} />
                  <Input placeholder='Local Address(es), CSV' value={peerForm.local_addrs} onChange={(e) => setPeerForm((s) => ({ ...s, local_addrs: e.target.value }))} />
                  <Input placeholder='Remote Address(es), CSV' value={peerForm.remote_addrs} onChange={(e) => setPeerForm((s) => ({ ...s, remote_addrs: e.target.value }))} />
                  <Input placeholder='Phase1 Profile' value={peerForm.phase1_profile} onChange={(e) => setPeerForm((s) => ({ ...s, phase1_profile: e.target.value }))} />
                </div>
                <Button disabled={busy} onClick={() => void run(async () => {
                  await upsertIpsecPeer(props.auth, {
                    name: peerForm.name,
                    local_addrs: splitCsv(peerForm.local_addrs),
                    remote_addrs: splitCsv(peerForm.remote_addrs),
                    phase1_profile: peerForm.phase1_profile,
                    ike_version: 2,
                    enabled: true,
                    dpd: true,
                    nat_t: true,
                    send_initial_contact: true,
                  })
                })}>Save Peer</Button>
                <div className='space-y-2'>
                  {peers.map((p) => (
                    <div key={p.name} className='flex items-center justify-between rounded border p-2 text-sm'>
                      <div>{p.name} | {p.local_addrs.join(', ')} → {p.remote_addrs.join(', ')} | profile={p.phase1_profile}</div>
                      <Button variant='destructive' size='sm' disabled={busy} onClick={() => void run(async () => {
                        if (!confirm('Remove peer?')) return
                        await deleteIpsecPeer(props.auth, p.name)
                      })}>Remove</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='identities'>
            <Card>
              <CardHeader><CardTitle>Identities (PSK)</CardTitle></CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-2 md:grid-cols-4'>
                  <Input placeholder='Peer' value={idForm.peer} onChange={(e) => setIdForm((s) => ({ ...s, peer: e.target.value }))} />
                  <Input placeholder='Local ID' value={idForm.local_id} onChange={(e) => setIdForm((s) => ({ ...s, local_id: e.target.value }))} />
                  <Input placeholder='Remote ID' value={idForm.remote_id} onChange={(e) => setIdForm((s) => ({ ...s, remote_id: e.target.value }))} />
                  <Input type='password' placeholder='PSK' value={idForm.psk} onChange={(e) => setIdForm((s) => ({ ...s, psk: e.target.value }))} />
                </div>
                <Button disabled={busy} onClick={() => void run(async () => {
                  await upsertIpsecIdentity(props.auth, {
                    peer: idForm.peer,
                    auth_method: 'psk',
                    local_id: idForm.local_id,
                    remote_id: idForm.remote_id,
                    psk: idForm.psk,
                  })
                  setIdForm((s) => ({ ...s, psk: '' }))
                })}>Save Identity</Button>
                <div className='space-y-2'>
                  {identities.map((x) => <div key={x.peer} className='rounded border p-2 text-sm'>{x.peer} | {x.local_id} ↔ {x.remote_id} | has_psk={x.has_psk ? 'yes' : 'no'}</div>)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='phase1'>
            <Card>
              <CardHeader><CardTitle>Profiles / Phase 1</CardTitle></CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-2 md:grid-cols-5'>
                  <Input placeholder='Name' value={p1Form.name} onChange={(e) => setP1Form((s) => ({ ...s, name: e.target.value }))} />
                  <Input placeholder='Encryption' value={p1Form.encryption} onChange={(e) => setP1Form((s) => ({ ...s, encryption: e.target.value }))} />
                  <Input placeholder='Hash' value={p1Form.hash} onChange={(e) => setP1Form((s) => ({ ...s, hash: e.target.value }))} />
                  <Input placeholder='DH Group' value={p1Form.dh_group} onChange={(e) => setP1Form((s) => ({ ...s, dh_group: e.target.value }))} />
                  <Input placeholder='Lifetime' value={p1Form.lifetime} onChange={(e) => setP1Form((s) => ({ ...s, lifetime: e.target.value }))} />
                </div>
                <Button disabled={busy} onClick={() => void run(async () => {
                  await upsertIpsecPhase1Profile(props.auth, { ...p1Form, proposal_check: 'obey' })
                })}>Save Phase1 Profile</Button>
                <div className='space-y-2'>
                  {phase1.map((x) => <div key={x.name} className='rounded border p-2 text-sm'>{x.name} | {x.proposal_string || `${x.encryption}-${x.hash}-${x.dh_group}`}</div>)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='phase2'>
            <Card>
              <CardHeader><CardTitle>Proposals / Phase 2</CardTitle></CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-2 md:grid-cols-5'>
                  <Input placeholder='Name' value={p2Form.name} onChange={(e) => setP2Form((s) => ({ ...s, name: e.target.value }))} />
                  <Input placeholder='Encryption' value={p2Form.encryption} onChange={(e) => setP2Form((s) => ({ ...s, encryption: e.target.value }))} />
                  <Input placeholder='Auth' value={p2Form.auth} onChange={(e) => setP2Form((s) => ({ ...s, auth: e.target.value }))} />
                  <Input placeholder='PFS Group (optional)' value={p2Form.pfs_group} onChange={(e) => setP2Form((s) => ({ ...s, pfs_group: e.target.value }))} />
                  <Input placeholder='Lifetime' value={p2Form.lifetime} onChange={(e) => setP2Form((s) => ({ ...s, lifetime: e.target.value }))} />
                </div>
                <Button disabled={busy} onClick={() => void run(async () => {
                  await upsertIpsecPhase2Proposal(props.auth, { ...p2Form })
                })}>Save Phase2 Proposal</Button>
                <div className='space-y-2'>
                  {phase2.map((x) => <div key={x.name} className='rounded border p-2 text-sm'>{x.name} | {x.proposal_string || `${x.encryption}-${x.auth}`}</div>)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='policies'>
            <Card>
              <CardHeader><CardTitle>Policies</CardTitle></CardHeader>
              <CardContent className='space-y-3'>
                <div className='grid gap-2 md:grid-cols-6'>
                  <Input placeholder='Name' value={polForm.name} onChange={(e) => setPolForm((s) => ({ ...s, name: e.target.value }))} />
                  <Input placeholder='Peer' value={polForm.peer} onChange={(e) => setPolForm((s) => ({ ...s, peer: e.target.value }))} />
                  <Input placeholder='Local TS, CSV' value={polForm.local_ts} onChange={(e) => setPolForm((s) => ({ ...s, local_ts: e.target.value }))} />
                  <Input placeholder='Remote TS, CSV' value={polForm.remote_ts} onChange={(e) => setPolForm((s) => ({ ...s, remote_ts: e.target.value }))} />
                  <Input placeholder='Phase2 Proposal' value={polForm.proposal} onChange={(e) => setPolForm((s) => ({ ...s, proposal: e.target.value }))} />
                  <Input placeholder='Start Action' value={polForm.start_action} onChange={(e) => setPolForm((s) => ({ ...s, start_action: e.target.value }))} />
                </div>
                <Button disabled={busy} onClick={() => void run(async () => {
                  await upsertIpsecPolicy(props.auth, {
                    name: polForm.name,
                    peer: polForm.peer,
                    local_ts: splitCsv(polForm.local_ts),
                    remote_ts: splitCsv(polForm.remote_ts),
                    proposal: polForm.proposal,
                    action: 'encrypt',
                    level: 'require',
                    mode: 'tunnel',
                    start_action: (polForm.start_action as any) || 'start',
                    enabled: true,
                  })
                })}>Save Policy</Button>
                <div className='space-y-2'>
                  {policies.map((p) => (
                    <div key={p.name} className='flex items-center justify-between rounded border p-2 text-sm'>
                      <div>{p.name} | {p.peer} | {p.local_ts.join(', ')} → {p.remote_ts.join(', ')} | proposal={p.proposal}</div>
                      <div className='flex gap-2'>
                        <Button size='sm' variant='outline' disabled={busy} onClick={() => void run(async () => { await initiateIpsecPolicy(props.auth, p.name) })}>Initiate</Button>
                        <Button size='sm' variant='destructive' disabled={busy} onClick={() => void run(async () => {
                          if (!confirm('Remove policy?')) return
                          await deleteIpsecPolicy(props.auth, p.name)
                        })}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='active'>
            <Card>
              <CardHeader><CardTitle>Active Peers</CardTitle></CardHeader>
              <CardContent className='space-y-2'>
                {active.map((x, idx) => (
                  <div key={`${x.peer || 'peer'}-${idx}`} className='flex items-center justify-between rounded border p-2 text-sm'>
                    <div>{x.peer} | {x.remote_address} | {x.state}</div>
                    <Button size='sm' variant='destructive' disabled={busy} onClick={() => void run(async () => {
                      if (!confirm(`Terminate peer ${x.peer}?`)) return
                      await terminateIpsecPeer(props.auth, x.peer)
                    })}>Terminate</Button>
                  </div>
                ))}
                {!active.length ? <div className='text-sm text-muted-foreground'>No active peers.</div> : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='installed'>
            <Card>
              <CardHeader><CardTitle>Installed SAs</CardTitle></CardHeader>
              <CardContent className='space-y-2'>
                {installed.map((x, idx) => (
                  <div key={`${x.child_sa || 'sa'}-${idx}`} className='rounded border p-2 text-sm'>
                    {x.child_sa} | {x.state} | SPI in/out: {x.spi_in}/{x.spi_out} | {x.local_ts?.join(', ')} -> {x.remote_ts?.join(', ')} | {x.esp_proposal}
                  </div>
                ))}
                {!installed.length ? <div className='text-sm text-muted-foreground'>No installed SAs.</div> : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className='hidden'>
          <Label>ipsec-debug</Label>
        </div>
      </div>
    </div>
  )
}
