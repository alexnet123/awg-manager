import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FirewallNamedObjectItem } from '../api'
import { buildPolicyV2ObjectUsageKey } from './objectBindings'

type UsageInfo = { count: number; samples: string[] }

type Props = {
  rows: FirewallNamedObjectItem[]
  managedObjectsCount: number
  selectedIds: string[]
  usageByKey: Record<string, UsageInfo>
  formatSummary: (item: FirewallNamedObjectItem) => string
  onRowMouseDown: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onRowClick: (row: FirewallNamedObjectItem, e: React.MouseEvent<HTMLTableRowElement>) => void
  onRowDoubleClick: (row: FirewallNamedObjectItem) => void
  onFilterRulesByObject: (kind: string, name: string) => void
  onCreateRuleWithObject: (kind: string, name: string) => void
}

export function PolicyBridgeObjectsTable(props: Props) {
  return (
    <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kind</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Used by</TableHead>
            <TableHead>Config</TableHead>
            <TableHead>Comment</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => {
            const usageKey = buildPolicyV2ObjectUsageKey(row.kind, row.name)
            const usage = props.usageByKey[usageKey]
            const usageSummary = usage?.count ? `${usage.count} rule(s)${usage.samples.length ? ` (${usage.samples.join(', ')})` : ''}` : null
            return (
              <TableRow
                key={row.id}
                className={`h-7 cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${props.selectedIds.includes(row.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${!row.enabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
                onMouseDown={props.onRowMouseDown}
                onClick={(e) => props.onRowClick(row, e)}
                onDoubleClick={() => props.onRowDoubleClick(row)}
              >
                <TableCell>{row.kind}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell className='max-w-[360px]'>
                  <div className='flex items-center gap-2'>
                    <Badge
                      variant={usageSummary ? 'secondary' : 'outline'}
                      className={`h-4 px-1.5 text-[10px] ${usageSummary ? '' : 'text-muted-foreground'}`}
                    >
                      {usageSummary ? `used:${usage?.count || 0}` : 'free'}
                    </Badge>
                    <div className='min-w-0 flex-1 truncate'>
                      {usageSummary ? (
                        <button
                          type='button'
                          className='max-w-full truncate text-left text-blue-700 underline-offset-2 hover:underline'
                          title='Filter rules by this object'
                          onClick={(e) => {
                            e.stopPropagation()
                            props.onFilterRulesByObject(row.kind, row.name)
                          }}
                        >
                          {usageSummary}
                        </button>
                      ) : '—'}
                    </div>
                    <button
                      type='button'
                      className='shrink-0 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-900 hover:bg-blue-100'
                      title='Create bridge rule and prefill this object'
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onCreateRuleWithObject(row.kind, row.name)
                      }}
                    >
                      use
                    </button>
                  </div>
                </TableCell>
                <TableCell className='max-w-[520px] truncate'>{props.formatSummary(row)}</TableCell>
                <TableCell>{row.comment || '—'}</TableCell>
                <TableCell>
                  <div className='inline-flex flex-wrap items-center gap-1'>
                    <Badge variant={row.enabled ? 'secondary' : 'outline'} className='h-4 px-1.5 text-[10px]'>
                      {row.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {!props.rows.length ? (
            <TableRow>
              <TableCell colSpan={6} className='py-6 text-center text-xs text-muted-foreground'>
                {props.managedObjectsCount ? 'No objects match current filter.' : 'No managed objects in selected bridge table.'}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

