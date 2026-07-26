import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClientsPage } from '@/pages/clients'
import { InterfacesPage } from '@/pages/interfaces'
import type { AuthState } from './api'

type AwgTab = 'interfaces' | 'clients'

export function AwgPage(props: { auth: AuthState; refreshNonce: number }) {
  const [activeTab, setActiveTab] = React.useState<AwgTab>('interfaces')
  const [interfaceCreateOpen, setInterfaceCreateOpen] = React.useState(false)
  const [clientCreateOpen, setClientCreateOpen] = React.useState(false)
  const [localRefreshNonce, setLocalRefreshNonce] = React.useState(0)

  const refreshNonce = props.refreshNonce + localRefreshNonce
  return (
    <div
      className='flex h-full min-h-0 min-w-0 w-full flex-col gap-2 overflow-x-hidden'
      style={{ maxWidth: 'calc(100vw - var(--sidebar-width, 16rem) - 2rem)' }}
    >
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold tracking-tight'>AmneziaWG</h2>
        </div>
      </div>

      <Card className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden text-xs'>
        <CardContent className='flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-2 overflow-hidden px-4 pt-0'>
          <div className='flex min-w-0 flex-wrap items-center gap-2 pt-4'>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AwgTab)}>
              <TabsList className='h-9 flex-wrap'>
                <TabsTrigger className='px-4 text-sm' value='interfaces'>Interfaces</TabsTrigger>
                <TabsTrigger className='px-4 text-sm' value='clients'>Peers</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className='min-h-0 flex-1 overflow-hidden'>
            {activeTab === 'interfaces' ? (
              <InterfacesPage
                auth={props.auth}
                refreshNonce={refreshNonce}
                embedded
                createOpen={interfaceCreateOpen}
                createTitle='Add interface'
                onCreateOpenChange={setInterfaceCreateOpen}
                onCreateDone={() => setLocalRefreshNonce((value) => value + 1)}
              />
            ) : (
              <ClientsPage
                auth={props.auth}
                refreshNonce={refreshNonce}
                embedded
                createOpen={clientCreateOpen}
                createTitle='Add peer'
                onCreateOpenChange={setClientCreateOpen}
                onCreateDone={() => setLocalRefreshNonce((value) => value + 1)}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
