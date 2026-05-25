import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FirewallMapItem, FirewallSetItem } from '../api'

type SortDirection = 'asc' | 'desc'
type CollectionSortKey = 'kind' | 'name' | 'values' | 'timeout' | 'created_at'
type CollectionRow = (FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }) | (FirewallMapItem & { kind: 'map' | 'vmap' })

type Props = {
  isBusy: boolean
  selectedCollectionIds: string[]
  selectedTimedCollectionsLength: number
  openCreateSetWindow: () => void
  onDeleteSelectedCollections: () => Promise<void>
  onSetEnabledSelectedCollections: (enabled: boolean) => Promise<void>
  sortedCollectionItems: CollectionRow[]
  collectionSort: { key: CollectionSortKey | null; dir: SortDirection }
  toggleCollectionSort: (key: CollectionSortKey) => void
  sortIndicator: (active: boolean, dir: SortDirection) => string
  computeSelection: (
    orderedIds: string[],
    prevSelected: string[],
    anchorId: string | null,
    clickedId: string,
    event: React.MouseEvent
  ) => { selected: string[]; anchor: string }
  collectionAnchorId: string | null
  setSelectedCollectionIds: React.Dispatch<React.SetStateAction<string[]>>
  setCollectionAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  openEditMapWindow: (item: FirewallMapItem & { kind: 'map' | 'vmap' }) => void
  openEditSetWindow: (item: FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }) => void
  formatDurationClock: (seconds?: number | null) => string
  getCollectionRemainingSeconds: (row: CollectionRow, nowSec: number) => number | null
  collectionsNowSec: number
  formatDateTime: (sec?: number | null) => string
  allCollectionItemsLength: number
}

export function CollectionsSection(props: Props) {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-2'>
      <div className='flex gap-2'>
        <Button size='sm' onClick={props.openCreateSetWindow} disabled={props.isBusy}><Plus />Add</Button>
        <Button
          size='sm'
          variant='destructive'
          disabled={props.isBusy || !props.selectedCollectionIds.length}
          onClick={() => {
            void props.onDeleteSelectedCollections()
          }}
        >
          Del
        </Button>
        <Button
          size='sm'
          variant='outline'
          disabled={props.isBusy || !props.selectedCollectionIds.length || !!props.selectedTimedCollectionsLength}
          onClick={() => {
            void props.onSetEnabledSelectedCollections(false)
          }}
        >
          Disable
        </Button>
        <Button
          size='sm'
          disabled={props.isBusy || !props.selectedCollectionIds.length || !!props.selectedTimedCollectionsLength}
          onClick={() => {
            void props.onSetEnabledSelectedCollections(true)
          }}
        >
          Enable
        </Button>
      </div>
      <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleCollectionSort('kind')}>Type <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.collectionSort.key === 'kind', props.collectionSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleCollectionSort('name')}>Name <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.collectionSort.key === 'name', props.collectionSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleCollectionSort('values')}>Values <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.collectionSort.key === 'values', props.collectionSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleCollectionSort('timeout')}>Timeout <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.collectionSort.key === 'timeout', props.collectionSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleCollectionSort('created_at')}>Creation time <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.collectionSort.key === 'created_at', props.collectionSort.dir)}</span></button></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.sortedCollectionItems.map((row) => (
              <TableRow
                key={row.id}
                className={`${row.comment || row.timeout ? 'h-9' : 'h-7'} cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${props.selectedCollectionIds.includes(row.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${row.enabled === false ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
                onMouseDown={(e) => {
                  if (e.shiftKey) e.preventDefault()
                }}
                onClick={(e) => {
                  const ordered = props.sortedCollectionItems.map((x) => x.id)
                  const next = props.computeSelection(ordered, props.selectedCollectionIds, props.collectionAnchorId, row.id, e)
                  props.setSelectedCollectionIds(next.selected)
                  props.setCollectionAnchorId(next.anchor)
                }}
                onDoubleClick={() => {
                  if (row.kind === 'map' || row.kind === 'vmap') props.openEditMapWindow(row as FirewallMapItem & { kind: 'map' | 'vmap' })
                  else props.openEditSetWindow(row as FirewallSetItem & { kind: 'addr' | 'port' | 'iface' })
                }}
              >
                <TableCell className={row.comment ? 'relative align-bottom pb-0.5 pt-2' : undefined}>
                  {row.comment ? (
                    <div className='pointer-events-none absolute left-2 top-0.5 z-10 whitespace-nowrap text-[10px] font-bold leading-none text-black'>
                      # {row.comment}
                    </div>
                  ) : null}
                  <span className={row.comment ? 'block pt-1' : ''}>{(row as { kind: string }).kind}</span>
                </TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.name}</span></TableCell>
                <TableCell className={`max-w-[700px] truncate ${row.comment ? 'align-bottom pb-0.5 pt-2' : ''}`}>
                  <span className={row.comment ? 'block pt-1' : ''}>{(row.kind === 'map' || row.kind === 'vmap') ? (((row as FirewallMapItem).entries || []).join(', ') || '—') : (((row as FirewallSetItem).elements || []).join(', ') || '—')}</span>
                </TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{props.formatDurationClock(props.getCollectionRemainingSeconds(row, props.collectionsNowSec))}</span></TableCell>
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{props.formatDateTime(row.created_at || null)}</span></TableCell>
              </TableRow>
            ))}
            {!props.allCollectionItemsLength
              ? <TableRow><TableCell colSpan={5} className='py-6 text-center text-xs text-muted-foreground'>No collections yet.</TableCell></TableRow>
              : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
