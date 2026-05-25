import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FirewallRule } from '../api'
import type { PolicyAdvancedCapabilities } from './capabilities'
import { getPolicyV2RuleObjectBindings, type PolicyV2ObjectBinding } from './objectBindings'

type Props = {
  rows: FirewallRule[]
  allRulesCount: number
  family: string
  selectedRuleIds: string[]
  caps: PolicyAdvancedCapabilities
  showObjectColumn: boolean
  emptyColSpan: number
  formatCounter: (value?: number) => string
  buildExprSummary: (rule: Partial<FirewallRule>) => string
  onRowMouseDown: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onRowClick: (row: FirewallRule, e: React.MouseEvent<HTMLTableRowElement>) => void
  onRowDoubleClick: (row: FirewallRule) => void
  onOpenBindingObject: (kind: PolicyV2ObjectBinding['kind'], name: string) => void
}

export function PolicyAdvancedRulesTable(props: Props) {
  return (
    <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chain</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Proto</TableHead>
            <TableHead>SPort</TableHead>
            <TableHead>DPort</TableHead>
            <TableHead>Ct state</TableHead>
            {props.showObjectColumn ? <TableHead>Object</TableHead> : null}
            <TableHead>Expr</TableHead>
            <TableHead>Queue</TableHead>
            {props.caps.showFwdColumns ? <TableHead>Fwd</TableHead> : null}
            {props.caps.showDupColumns ? <TableHead>Dup</TableHead> : null}
            <TableHead>{props.caps.sourceInterfaceColumnLabel}</TableHead>
            {props.caps.showDestinationBridgeColumn ? <TableHead>obrname</TableHead> : null}
            <TableHead>ether src</TableHead>
            <TableHead>ether dst</TableHead>
            <TableHead>ether type</TableHead>
            <TableHead>vlan id</TableHead>
            <TableHead>Packets</TableHead>
            <TableHead>Bytes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow
              key={row.id}
              className={`${row.comment ? 'h-9' : 'h-7'} cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${props.selectedRuleIds.includes(row.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${!row.enabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
              onMouseDown={props.onRowMouseDown}
              onClick={(e) => props.onRowClick(row, e)}
              onDoubleClick={() => props.onRowDoubleClick(row)}
            >
              <TableCell className={row.comment ? 'relative align-bottom pb-0.5 pt-2' : undefined}>
                {row.comment ? (
                  <div className='pointer-events-none absolute left-2 top-0.5 z-10 whitespace-nowrap text-[10px] font-bold leading-none text-black'>
                    # {row.comment}
                  </div>
                ) : null}
                <span className={row.comment ? 'block pt-1' : ''}>{row.chain}</span>
              </TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.action}</span></TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.proto || 'any'}</span></TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.sport || '—'}</span></TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.dport || '—'}</span></TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.ct_state || '—'}</span></TableCell>
              {props.showObjectColumn ? (
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}>
                  <span className={row.comment ? 'block pt-1' : ''}>
                    {(() => {
                      const bindings = getPolicyV2RuleObjectBindings(row)
                      if (!bindings.length) {
                        return <Badge variant='outline' className='h-4 px-1.5 text-[10px] text-muted-foreground'>free</Badge>
                      }
                      return (
                        <span className='inline-flex flex-wrap items-center gap-1'>
                          <Badge variant='secondary' className='h-4 px-1.5 text-[10px]'>linked:{bindings.length}</Badge>
                          {bindings.map((binding) => (
                            <button
                              key={`${row.id}:${binding.kind}:${binding.name}`}
                              type='button'
                              className='rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] leading-none text-blue-900 hover:bg-blue-100'
                              title='Open object in Policy v2 → objects'
                              onClick={(e) => {
                                e.stopPropagation()
                                props.onOpenBindingObject(binding.kind, binding.name)
                              }}
                            >
                              {binding.label}
                            </button>
                          ))}
                        </span>
                      )
                    })()}
                  </span>
                </TableCell>
              ) : null}
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}>
                <span className={row.comment ? 'block pt-1' : ''}>
                  {props.buildExprSummary(row)}
                </span>
              </TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}>
                <span className={row.comment ? 'block pt-1' : ''}>
                  {row.action === 'queue'
                    ? `to ${row.queue_num || '0'}${Array.isArray(row.queue_flags) && row.queue_flags.length ? ` (${row.queue_flags.join(',')})` : ''}`
                    : '—'}
                </span>
              </TableCell>
              {props.caps.showFwdColumns ? (
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}>
                  <span className={row.comment ? 'block pt-1' : ''}>
                    {row.action === 'fwd' ? `${row.fwd_family || ''} ${row.fwd_to || '—'} via ${row.fwd_dev || '—'}`.trim() : '—'}
                  </span>
                </TableCell>
              ) : null}
              {props.caps.showDupColumns ? (
                <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}>
                  <span className={row.comment ? 'block pt-1' : ''}>
                    {row.dup_to
                      ? `${row.dup_to}${row.dup_dev ? ` via ${row.dup_dev}` : ''}`
                      : '—'}
                  </span>
                </TableCell>
              ) : null}
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{props.caps.showDestinationBridgeColumn ? (row.ibrname || '—') : (row.in_interface || 'device')}</span></TableCell>
              {props.caps.showDestinationBridgeColumn ? <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.obrname || '—'}</span></TableCell> : null}
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.ether_src || '—'}</span></TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.ether_dst || '—'}</span></TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.ether_type || '—'}</span></TableCell>
              <TableCell className={row.comment ? 'align-bottom pb-0.5 pt-2' : undefined}><span className={row.comment ? 'block pt-1' : ''}>{row.vlan_id || '—'}</span></TableCell>
              <TableCell className={`${row.comment ? 'align-bottom pb-0.5 pt-2' : ''} whitespace-nowrap`}><span className={row.comment ? 'block pt-1' : ''}>{props.formatCounter(row.runtime_packets)}</span></TableCell>
              <TableCell className={`${row.comment ? 'align-bottom pb-0.5 pt-2' : ''} whitespace-nowrap`}><span className={row.comment ? 'block pt-1' : ''}>{props.formatCounter(row.runtime_bytes)}</span></TableCell>
            </TableRow>
          ))}
          {!props.rows.length ? (
            <TableRow>
              <TableCell colSpan={props.emptyColSpan} className='py-6 text-center text-xs text-muted-foreground'>
                {props.allRulesCount ? 'No rules match current filter.' : `No ${props.family} rules in selected table.`}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  )
}

