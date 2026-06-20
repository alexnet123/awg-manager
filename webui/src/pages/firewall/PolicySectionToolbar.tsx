import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FirewallTableItem } from '../api'

type FirewallPolicyTab = 'filter' | 'nat' | 'raw' | 'mangle'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
type CustomTableOption = {
  key: string
  family: TableFamily
  tableName: string
  label: string
}

type Props = {
  isCustomRuleTableActive: boolean
  activePolicyTab: FirewallPolicyTab
  setActivePolicyTab: React.Dispatch<React.SetStateAction<FirewallPolicyTab>>
  setActiveRuleTableName: React.Dispatch<React.SetStateAction<string>>
  activeRuleTableFamily: TableFamily
  setActiveRuleTableFamily: React.Dispatch<React.SetStateAction<TableFamily>>
  customTableOptions: CustomTableOption[]
  activeRuleTableName: string
  customTables: FirewallTableItem[]
  setSelectedTableIds: React.Dispatch<React.SetStateAction<string[]>>
  setTableAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setActiveSection: React.Dispatch<React.SetStateAction<'policy' | 'collections' | 'objects' | 'table_builder'>>
  isBusy: boolean
  selectedRuleIdsLength: number
  openCreateWindow: () => void
  onDeleteSelectedRules: () => Promise<void>
  onSetEnabledSelectedRules: (enabled: boolean) => Promise<void>
  onResetCounters: () => Promise<void>
  columnsOpen: boolean
  setColumnsOpen: React.Dispatch<React.SetStateAction<boolean>>
  policyColumnOrder: string[]
  policyColumnLabels: Record<string, string>
  visibleColumns: Record<string, boolean>
  setVisibleColumns: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

export function PolicySectionToolbar(props: Props) {
  return (
    <>
      <div className='flex min-w-0 w-full items-center gap-2 overflow-hidden'>
        <div className='shrink-0'>
          <Tabs
            value={props.isCustomRuleTableActive ? '__custom__' : props.activePolicyTab}
            onValueChange={(v) => {
              const next = v as FirewallPolicyTab
              props.setActivePolicyTab(next)
              props.setActiveRuleTableName(next)
              props.setActiveRuleTableFamily('inet')
            }}
          >
            <TabsList className='h-9'>
              <TabsTrigger className='px-4 text-sm' value='filter'>filter</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='nat'>nat</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='raw'>raw</TabsTrigger>
              <TabsTrigger className='px-4 text-sm' value='mangle'>mangle</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {props.customTableOptions.length ? (
          <div className='min-w-0 max-w-full shrink-0'>
            <Select
              value={props.isCustomRuleTableActive ? `${props.activeRuleTableFamily}:${props.activeRuleTableName}` : '__none__'}
              onValueChange={(v) => {
                if (v === '__none__') {
                  props.setActiveRuleTableName(props.activePolicyTab)
                  props.setActiveRuleTableFamily('inet')
                  return
                }
                const option = props.customTableOptions.find((x) => x.key === v)
                if (!option) return
                const row = props.customTables.find((x) => (
                  String(x.family || 'inet').toLowerCase() === option.family && x.table_name === option.tableName
                ))
                if (row) {
                  props.setSelectedTableIds([row.id])
                  props.setTableAnchorId(row.id)
                }
                props.setActiveRuleTableName(option.tableName)
                props.setActiveRuleTableFamily(option.family)
                props.setActiveSection('policy')
              }}
            >
              <SelectTrigger className='h-9 w-[220px] max-w-full border-amber-300 bg-amber-50 text-sm'>
                <SelectValue placeholder='Custom table (optional)' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>System table only</SelectItem>
                {props.customTableOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className='flex gap-2'>
        <Button size='sm' onClick={props.openCreateWindow} disabled={props.isBusy}><Plus />Add</Button>
        <Button size='sm' variant='destructive' disabled={props.isBusy || !props.selectedRuleIdsLength} onClick={() => void props.onDeleteSelectedRules()}>Del</Button>
        <Button size='sm' variant='outline' disabled={props.isBusy || !props.selectedRuleIdsLength} onClick={() => void props.onSetEnabledSelectedRules(false)}>Disable</Button>
        <Button size='sm' disabled={props.isBusy || !props.selectedRuleIdsLength} onClick={() => void props.onSetEnabledSelectedRules(true)}>Enable</Button>
        <Button
          size='sm'
          variant='outline'
          disabled={props.isBusy}
          onClick={() => {
            void props.onResetCounters()
          }}
        >
          Reset counters
        </Button>
        <DropdownMenu open={props.columnsOpen} onOpenChange={props.setColumnsOpen}>
          <DropdownMenuTrigger asChild>
            <Button size='sm' variant='outline'>Columns</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='start'
            side='bottom'
            sideOffset={6}
            className='z-[120] min-w-56 p-1.5'
          >
            {props.policyColumnOrder.map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                className='text-xs'
                checked={!!props.visibleColumns[key]}
                onCheckedChange={(checked) => {
                  props.setVisibleColumns((prev) => ({ ...prev, [key]: !!checked }))
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {props.policyColumnLabels[key]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )
}
