import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FirewallTableItem } from '../api'

type FirewallPolicyTab = 'filter' | 'nat' | 'raw' | 'mangle'

type Props = {
  isCustomRuleTableActive: boolean
  activePolicyTab: FirewallPolicyTab
  setActivePolicyTab: React.Dispatch<React.SetStateAction<FirewallPolicyTab>>
  setActiveRuleTableName: React.Dispatch<React.SetStateAction<string>>
  customTableNames: string[]
  activeRuleTableName: string
  customTables: FirewallTableItem[]
  setSelectedTableIds: React.Dispatch<React.SetStateAction<string[]>>
  setTableAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setActiveSection: React.Dispatch<React.SetStateAction<'policy' | 'policy_v2' | 'policy_v3' | 'collections' | 'table_builder'>>
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
        {props.customTableNames.length ? (
          <div className='min-w-0 max-w-full basis-0 flex-1'>
            <Select
              value={props.isCustomRuleTableActive ? props.activeRuleTableName : '__none__'}
              onValueChange={(v) => {
                if (v === '__none__') {
                  props.setActiveRuleTableName(props.activePolicyTab)
                  return
                }
                const row = props.customTables.find((x) => x.table_name === v)
                if (row) {
                  props.setSelectedTableIds([row.id])
                  props.setTableAnchorId(row.id)
                }
                props.setActiveRuleTableName(v)
                props.setActiveSection('policy')
              }}
            >
              <SelectTrigger className='h-9 w-full border-amber-300 bg-amber-50 text-sm'>
                <SelectValue placeholder='Custom table (optional)' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>System table only</SelectItem>
                {props.customTableNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900'>
        This view is inet-only; use Policy v2 for bridge/ip/ip6/netdev.
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
