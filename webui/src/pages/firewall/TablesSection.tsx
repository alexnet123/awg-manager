import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FirewallTableItem } from '../api'

type SortDirection = 'asc' | 'desc'
type TableSortKey = 'family' | 'table_name' | 'chain_name' | 'chain_type' | 'hook' | 'device' | 'priority' | 'policy' | 'origin' | 'status'

type Props = {
  isBusy: boolean
  selectedCustomTablesLength: number
  openCreateTableWindow: () => void
  onDeleteSelectedTables: () => Promise<void>
  onSetEnabledSelectedTables: (enabled: boolean) => Promise<void>
  tableSort: { key: TableSortKey | null; dir: SortDirection }
  toggleTableSort: (key: TableSortKey) => void
  sortIndicator: (active: boolean, dir: SortDirection) => string
  sortedTableRows: FirewallTableItem[]
  selectedTableIds: string[]
  computeSelection: (
    orderedIds: string[],
    prevSelected: string[],
    anchorId: string | null,
    clickedId: string,
    event: React.MouseEvent
  ) => { selected: string[]; anchor: string }
  tableAnchorId: string | null
  setSelectedTableIds: React.Dispatch<React.SetStateAction<string[]>>
  setTableAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  openEditTableWindow: (row: FirewallTableItem) => void
  hasAnyTables: boolean
}

export function TablesSection(props: Props) {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-2'>
      <div className='flex gap-2'>
        <Button size='sm' onClick={props.openCreateTableWindow} disabled={props.isBusy}><Plus />Add</Button>
        <Button size='sm' variant='destructive' disabled={props.isBusy || !props.selectedCustomTablesLength} onClick={() => void props.onDeleteSelectedTables()}>Del</Button>
        <Button
          size='sm'
          variant='outline'
          disabled={props.isBusy || !props.selectedCustomTablesLength}
          onClick={() => void props.onSetEnabledSelectedTables(false)}
        >
          Disable
        </Button>
        <Button
          size='sm'
          disabled={props.isBusy || !props.selectedCustomTablesLength}
          onClick={() => void props.onSetEnabledSelectedTables(true)}
        >
          Enable
        </Button>
      </div>
      <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('family')}>Family <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'family', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('table_name')}>Table name <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'table_name', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('chain_name')}>Chain name <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'chain_name', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('chain_type')}>Chain type <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'chain_type', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('hook')}>Hook <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'hook', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('device')}>Device <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'device', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('priority')}>Priority <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'priority', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('policy')}>Policy <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'policy', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('origin')}>Origin <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'origin', props.tableSort.dir)}</span></button></TableHead>
              <TableHead><button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.toggleTableSort('status')}>Status <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.tableSort.key === 'status', props.tableSort.dir)}</span></button></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.sortedTableRows.map((row) => (
              <TableRow
                key={row.id}
                className={`h-7 cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${props.selectedTableIds.includes(row.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${row.enabled === false ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
                onMouseDown={(e) => {
                  if (e.shiftKey) e.preventDefault()
                }}
                onClick={(e) => {
                  const ordered = props.sortedTableRows.map((x) => x.id)
                  const next = props.computeSelection(ordered, props.selectedTableIds, props.tableAnchorId, row.id, e)
                  props.setSelectedTableIds(next.selected)
                  props.setTableAnchorId(next.anchor)
                }}
                onDoubleClick={() => {
                  if (row.builtin) return
                  props.openEditTableWindow(row)
                }}
              >
                <TableCell>{row.family}</TableCell>
                <TableCell>{row.table_name}</TableCell>
                <TableCell>{row.chain_name}</TableCell>
                <TableCell>{row.chain_type}</TableCell>
                <TableCell>{row.hook}</TableCell>
                <TableCell>{row.device || '—'}</TableCell>
                <TableCell>{row.priority}</TableCell>
                <TableCell>{row.policy}</TableCell>
                <TableCell>{row.builtin ? 'built-in' : 'custom'}</TableCell>
                <TableCell>{row.enabled === false ? 'disabled' : 'enabled'}</TableCell>
              </TableRow>
            ))}
            {!props.hasAnyTables ? <TableRow><TableCell colSpan={10} className='py-6 text-center text-xs text-muted-foreground'>No table chains yet.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
