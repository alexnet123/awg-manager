import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FirewallNamedObjectItem } from '../api'
import { FirewallObjectsTable } from './FirewallObjectsTable'
import type { FirewallObjectPreset } from './useFirewallObjectEditor'

type FirewallObjectsFilter = 'all' | 'used' | 'unused'

type Props = {
  isBusy: boolean
  activeFamily: string
  activeTableName: string
  selectedObjectIdsCount: number
  openCreateObjectWindow: () => void
  onCreateRuleFromSelectedObjects: () => void
  onDeleteSelectedObjects: () => Promise<void>
  objectsFilter: FirewallObjectsFilter
  setObjectsFilter: (filter: FirewallObjectsFilter) => void
  objectsUsedCount: number
  objectsFreeCount: number
  objectFocusKey: string | null
  setObjectFocusKey: (key: string | null) => void
  onCreateObjectWithPreset: (preset: FirewallObjectPreset) => void
  filteredObjects: FirewallNamedObjectItem[]
  managedObjectsCount: number
  selectedObjectIds: string[]
  objectUsageByKey: Record<string, { count: number; samples: string[] }>
  formatObjectSummary: (item: FirewallNamedObjectItem) => string
  onObjectRowMouseDown: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onObjectRowClick: (row: FirewallNamedObjectItem, e: React.MouseEvent<HTMLTableRowElement>) => void
  onObjectRowDoubleClick: (row: FirewallNamedObjectItem) => void
  onFilterRulesByObject: (kind: string, name: string) => void
  onCreateRuleWithObject: (kind: string, name: string) => void
}

export function FirewallObjectsPanel(props: Props) {
  const canUseInRule = props.activeFamily !== 'netdev'
  return (
    <div className='flex min-h-[220px] min-w-0 flex-col gap-2 rounded-xl border bg-muted/10 p-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' onClick={props.openCreateObjectWindow} disabled={props.isBusy || !props.activeTableName}><Plus />Add object</Button>
        <Button size='sm' variant='outline' disabled={props.isBusy || !canUseInRule || !props.selectedObjectIdsCount || !props.activeTableName} onClick={props.onCreateRuleFromSelectedObjects}>Use in rule</Button>
        <Button size='sm' variant='destructive' disabled={props.isBusy || !props.selectedObjectIdsCount} onClick={() => void props.onDeleteSelectedObjects()}>Del object</Button>
        <div className='ml-1 inline-flex h-9 items-center rounded-md border bg-background p-1'>
          <button
            type='button'
            className={`rounded px-2 py-1 text-xs ${props.objectsFilter === 'all' ? 'bg-muted shadow-sm' : 'text-muted-foreground'}`}
            onClick={() => props.setObjectsFilter('all')}
          >
            all
          </button>
          <button
            type='button'
            className={`rounded px-2 py-1 text-xs ${props.objectsFilter === 'used' ? 'bg-muted shadow-sm' : 'text-muted-foreground'}`}
            onClick={() => props.setObjectsFilter('used')}
          >
            in use ({props.objectsUsedCount})
          </button>
          <button
            type='button'
            className={`rounded px-2 py-1 text-xs ${props.objectsFilter === 'unused' ? 'bg-muted shadow-sm' : 'text-muted-foreground'}`}
            onClick={() => props.setObjectsFilter('unused')}
          >
            free ({props.objectsFreeCount})
          </button>
        </div>
        {props.objectFocusKey ? (
          <div className='ml-1 inline-flex h-9 items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 text-xs text-blue-900'>
            <span className='max-w-[220px] truncate'>object: {props.objectFocusKey}</span>
            <button
              type='button'
              className='rounded border border-blue-300 bg-background px-1.5 py-0.5 text-[11px] hover:bg-muted'
              onClick={() => props.setObjectFocusKey(null)}
            >
              clear
            </button>
          </div>
        ) : null}
      </div>
      <div className='rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900'>
        Objects are scoped to the selected nftables table. Rule prefill is enabled for inet/ip/ip6/bridge tables; netdev object bindings are not supported by backend validation.
      </div>
      <div className='rounded-md border px-3 py-2 text-[11px]'>
        <div className='mb-1 font-medium'>Examples</div>
        <div className='flex flex-wrap gap-1.5'>
          <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activeTableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('counter_ssh')}>SSH counter</button>
          <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activeTableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('limit_dns')}>DNS limit</button>
          <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activeTableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('quota_bridge')}>Traffic quota</button>
          <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activeTableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('helper_ftp')}>FTP helper</button>
          <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activeTableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('timeout_tcp')}>TCP timeout</button>
        </div>
      </div>
      <FirewallObjectsTable
        rows={props.filteredObjects}
        managedObjectsCount={props.managedObjectsCount}
        selectedIds={props.selectedObjectIds}
        usageByKey={props.objectUsageByKey}
        formatSummary={props.formatObjectSummary}
        onRowMouseDown={props.onObjectRowMouseDown}
        onRowClick={props.onObjectRowClick}
        onRowDoubleClick={props.onObjectRowDoubleClick}
        onFilterRulesByObject={canUseInRule ? props.onFilterRulesByObject : undefined}
        onCreateRuleWithObject={canUseInRule ? props.onCreateRuleWithObject : undefined}
      />
    </div>
  )
}
