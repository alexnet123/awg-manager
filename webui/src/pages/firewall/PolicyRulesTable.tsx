import * as React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { FirewallRule } from '../api'
import { formatFirewallRuleAction } from './policyUtils'

type SortDirection = 'asc' | 'desc'
type PolicySortKey = 'chain' | 'action' | 'proto' | 'src' | 'dst' | 'sport' | 'dport' | 'in_interface' | 'out_interface' | 'ct_state' | 'packets' | 'bytes'

type Props = {
  visibleColumns: Record<PolicySortKey, boolean>
  policySort: { key: PolicySortKey | null; dir: SortDirection }
  togglePolicySort: (key: PolicySortKey) => void
  policyColumnLabels: Record<PolicySortKey, string>
  sortIndicator: (active: boolean, dir: SortDirection) => string
  sortedVisibleRules: FirewallRule[]
  visibleRules: FirewallRule[]
  selectedRuleIds: string[]
  setSelectedRuleIds: React.Dispatch<React.SetStateAction<string[]>>
  ruleAnchorId: string | null
  setRuleAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  computeSelection: (
    orderedIds: string[],
    prevSelected: string[],
    anchorId: string | null,
    clickedId: string,
    event: React.MouseEvent
  ) => { selected: string[]; anchor: string }
  openEditWindow: (rule: FirewallRule) => void
  dragRuleId: string | null
  setDragRuleId: React.Dispatch<React.SetStateAction<string | null>>
  dragOverRuleId: string | null
  setDragOverRuleId: React.Dispatch<React.SetStateAction<string | null>>
  activeRuleTable: string
  dragRuleTableName: string | null
  setDragRuleTableName: React.Dispatch<React.SetStateAction<string | null>>
  onReorderDrop: (targetRuleId: string, targetTableName: string, droppedRuleId?: string, droppedRuleTableName?: string) => Promise<void>
  onReorderDropToEnd: (targetTableName: string, droppedRuleId?: string, droppedRuleTableName?: string) => Promise<void>
  visiblePolicyColSpan: number
  firstVisiblePolicyColumn: PolicySortKey
  formatCounter: (value?: number) => string
}

export function PolicyRulesTable(props: Props) {
  const renderHeader = (key: PolicySortKey) => (
    <TableHead>
      <button type='button' className='flex w-full select-none items-center gap-1 text-left' onClick={() => props.togglePolicySort(key)}>
        {props.policyColumnLabels[key]}
        <span className='text-[10px] text-muted-foreground/70'>{props.sortIndicator(props.policySort.key === key, props.policySort.dir)}</span>
      </button>
    </TableHead>
  )

  return (
    <div className='min-h-0 min-w-0 w-full flex-1 overflow-auto rounded-xl border'>
      <Table>
        <TableHeader>
          <TableRow>
            {props.visibleColumns.chain ? renderHeader('chain') : null}
            {props.visibleColumns.action ? renderHeader('action') : null}
            {props.visibleColumns.proto ? renderHeader('proto') : null}
            {props.visibleColumns.src ? renderHeader('src') : null}
            {props.visibleColumns.dst ? renderHeader('dst') : null}
            {props.visibleColumns.sport ? renderHeader('sport') : null}
            {props.visibleColumns.dport ? renderHeader('dport') : null}
            {props.visibleColumns.in_interface ? renderHeader('in_interface') : null}
            {props.visibleColumns.out_interface ? renderHeader('out_interface') : null}
            {props.visibleColumns.ct_state ? renderHeader('ct_state') : null}
            {props.visibleColumns.packets ? renderHeader('packets') : null}
            {props.visibleColumns.bytes ? renderHeader('bytes') : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.sortedVisibleRules.map((r) => {
            const renderPolicyCell = (key: PolicySortKey, value: React.ReactNode, nowrap = false) => {
              if (!props.visibleColumns[key]) return null
              const commentHost = !!r.comment && props.firstVisiblePolicyColumn === key
              return (
                <TableCell className={`${r.comment ? 'relative align-bottom pb-0.5 pt-2' : ''} ${nowrap ? 'whitespace-nowrap' : ''}`}>
                  {commentHost ? (
                    <div className='pointer-events-none absolute left-2 top-0.5 z-10 whitespace-nowrap text-[10px] font-bold leading-none text-black'>
                      # {r.comment}
                    </div>
                  ) : null}
                  <span className={r.comment ? 'block pt-1' : ''}>{value}</span>
                </TableCell>
              )
            }
            return (
              <TableRow
                key={r.id}
                draggable={!props.policySort.key}
                onDragStart={(e) => {
                  if (props.policySort.key) return
                  props.setDragRuleId(r.id)
                  props.setDragRuleTableName(String(r.table || props.activeRuleTable))
                  try {
                    e.dataTransfer.setData('text/plain', r.id)
                    e.dataTransfer.setData('application/x-awg-rule-table', String(r.table || props.activeRuleTable))
                    e.dataTransfer.effectAllowed = 'move'
                  } catch {
                    // Ignore dataTransfer write issues; local state still supports DnD.
                  }
                }}
                onDragEnd={() => {
                  props.setDragRuleId(null)
                  props.setDragOverRuleId(null)
                  props.setDragRuleTableName(null)
                }}
                onDragOver={(e) => {
                  if (props.policySort.key) return
                  e.preventDefault()
                  if (props.dragRuleId !== r.id) props.setDragOverRuleId(r.id)
                }}
                onDragLeave={() => {
                  if (props.dragOverRuleId === r.id) props.setDragOverRuleId(null)
                }}
                onDrop={(e) => {
                  if (props.policySort.key) return
                  e.preventDefault()
                  let droppedId = ''
                  let droppedTable = ''
                  try {
                    droppedId = e.dataTransfer.getData('text/plain') || ''
                    droppedTable = e.dataTransfer.getData('application/x-awg-rule-table') || ''
                  } catch {
                    // fall back to state-managed drag data
                  }
                  props.setDragOverRuleId(null)
                  void props.onReorderDrop(r.id, String(r.table || props.activeRuleTable), droppedId || undefined, droppedTable || undefined)
                }}
                className={`${r.comment ? 'h-9' : 'h-7'} cursor-default select-none border-b hover:bg-blue-100/80 dark:hover:bg-blue-900/35 ${props.selectedRuleIds.includes(r.id) ? 'bg-blue-100/80 dark:bg-blue-900/35' : ''} ${props.dragRuleId === r.id ? 'opacity-60' : ''} ${props.dragOverRuleId === r.id && props.dragRuleId !== r.id ? 'border-t-2 border-t-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : ''} ${!r.enabled ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200' : ''}`}
                onMouseDown={(e) => {
                  if (e.shiftKey) e.preventDefault()
                }}
                onClick={(e) => {
                  const ordered = props.sortedVisibleRules.map((x) => x.id)
                  const next = props.computeSelection(ordered, props.selectedRuleIds, props.ruleAnchorId, r.id, e)
                  props.setSelectedRuleIds(next.selected)
                  props.setRuleAnchorId(next.anchor)
                }}
                onDoubleClick={() => props.openEditWindow(r)}
              >
                {renderPolicyCell('chain', r.chain)}
                {renderPolicyCell('action', formatFirewallRuleAction(r))}
                {renderPolicyCell('proto', r.proto || 'any')}
                {renderPolicyCell('src', r.src || '—')}
                {renderPolicyCell('dst', r.dst || '—')}
                {renderPolicyCell('sport', r.sport || '—')}
                {renderPolicyCell('dport', r.dport || '—')}
                {renderPolicyCell('in_interface', r.in_interface || '—')}
                {renderPolicyCell('out_interface', r.out_interface || '—')}
                {renderPolicyCell('ct_state', r.ct_state || '—')}
                {renderPolicyCell('packets', props.formatCounter(r.runtime_packets), true)}
                {renderPolicyCell('bytes', props.formatCounter(r.runtime_bytes), true)}
              </TableRow>
            )
          })}
          {props.visibleRules.length && !props.policySort.key && !!props.dragRuleId ? (
            <TableRow
              className={`h-5 border-b ${props.dragOverRuleId === '__end__' ? 'bg-blue-50/50 dark:bg-blue-950/20 border-t-2 border-t-blue-500' : 'bg-muted/10'}`}
              onDragOver={(e) => {
                e.preventDefault()
                props.setDragOverRuleId('__end__')
              }}
              onDragLeave={() => {
                if (props.dragOverRuleId === '__end__') props.setDragOverRuleId(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                let droppedId = ''
                let droppedTable = ''
                try {
                  droppedId = e.dataTransfer.getData('text/plain') || ''
                  droppedTable = e.dataTransfer.getData('application/x-awg-rule-table') || ''
                } catch {
                  // fall back to state-managed drag data
                }
                props.setDragOverRuleId(null)
                void props.onReorderDropToEnd(String(props.activeRuleTable), droppedId || undefined, droppedTable || undefined)
              }}
            >
              <TableCell colSpan={props.visiblePolicyColSpan} className='py-0 text-[1px] leading-none text-transparent select-none'>
                .
              </TableCell>
            </TableRow>
          ) : null}
          {!props.visibleRules.length ? <TableRow><TableCell colSpan={props.visiblePolicyColSpan} className='py-6 text-center text-xs text-muted-foreground'>No rules in {props.activeRuleTable} table.</TableCell></TableRow> : null}
        </TableBody>
      </Table>
    </div>
  )
}
