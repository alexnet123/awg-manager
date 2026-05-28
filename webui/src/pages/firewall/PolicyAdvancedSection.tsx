import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FirewallNamedObjectItem, FirewallRule } from '../api'
import type { PolicyAdvancedCapabilities } from './capabilities'
import { PolicyAdvancedRulesTable } from './PolicyAdvancedRulesTable'
import { PolicyBridgeObjectsTable } from './PolicyBridgeObjectsTable'

type PolicyV2DataTab = 'rules' | 'objects'
type PolicyV2RulesFilter = 'all' | 'with_objects' | 'without_objects'
type PolicyV2ObjectsFilter = 'all' | 'used' | 'unused'

type Props = {
  policyAdvancedFamily: string
  activePolicyV2TableName: string
  setActivePolicyV2TableName: (name: string) => void
  policyAdvancedTableHint: string
  policyV2TableNames: string[]
  policyAdvancedCaps: PolicyAdvancedCapabilities
  policyV2DataTab: PolicyV2DataTab
  setPolicyV2DataTab: (tab: PolicyV2DataTab) => void
  isBusy: boolean
  selectedPolicyV2RuleIdsCount: number
  selectedPolicyV2ObjectIdsCount: number

  openCreatePolicyV2Window: () => void
  onDeleteSelectedPolicyV2Rules: () => Promise<void>
  onSetEnabledSelectedPolicyV2Rules: (enabled: boolean) => Promise<void>

  policyV2RulesFilter: PolicyV2RulesFilter
  setPolicyV2RulesFilter: (filter: PolicyV2RulesFilter) => void
  policyV2RulesWithObjectsCount: number
  policyV2RulesWithoutObjectsCount: number
  policyV2RuleObjectFilterKey: string | null
  setPolicyV2RuleObjectFilterKey: (key: string | null) => void

  policyV2FilteredRules: FirewallRule[]
  policyV2RulesCount: number
  activePolicyV2Family: string
  policyAdvancedRulesColSpan: number
  formatCounter: (value?: number) => string
  buildPolicyV2BridgeExprSummary: (rule: Partial<FirewallRule>) => string
  onRuleRowMouseDown: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onRuleRowClick: (row: FirewallRule, e: React.MouseEvent<HTMLTableRowElement>) => void
  onRuleRowDoubleClick: (row: FirewallRule) => void
  onFilterObjectsByRuleBinding: (kind: string, name: string) => void

  openCreatePolicyV2ObjectWindow: () => void
  onCreateRuleFromSelectedObjects: () => void
  onDeleteSelectedPolicyV2Objects: () => Promise<void>
  policyV2ObjectsFilter: PolicyV2ObjectsFilter
  setPolicyV2ObjectsFilter: (filter: PolicyV2ObjectsFilter) => void
  policyV2ObjectsUsedCount: number
  policyV2ObjectsFreeCount: number
  policyV2ObjectFocusKey: string | null
  setPolicyV2ObjectFocusKey: (key: string | null) => void
  onCreateObjectWithPreset: (preset: 'counter_ssh' | 'limit_dns' | 'quota_bridge' | 'helper_ftp' | 'timeout_tcp') => void

  policyV2FilteredObjects: FirewallNamedObjectItem[]
  policyV2ManagedObjectsCount: number
  selectedPolicyV2ObjectIds: string[]
  policyV2ObjectUsageByKey: Record<string, { count: number; samples: string[] }>
  formatPolicyV2ObjectSummary: (item: FirewallNamedObjectItem) => string
  onObjectRowMouseDown: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onObjectRowClick: (row: FirewallNamedObjectItem, e: React.MouseEvent<HTMLTableRowElement>) => void
  onObjectRowDoubleClick: (row: FirewallNamedObjectItem) => void
  onFilterRulesByObject: (kind: string, name: string) => void
  onCreateRuleWithObject: (kind: string, name: string) => void

  selectedPolicyV2RuleIds: string[]
}

export function PolicyAdvancedSection(props: Props) {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-2'>
      <div className='grid grid-cols-2 gap-2'>
        <div className='space-y-1'>
          <Label className='text-[11px] text-muted-foreground'>Family</Label>
          <div className='flex h-9 items-center rounded-md border bg-muted px-2.5 text-sm font-medium'>{props.policyAdvancedFamily}</div>
        </div>
        <div className='space-y-1'>
          <Label className='text-[11px] text-muted-foreground'>Table</Label>
          <select
            className='h-9 w-full rounded-md border border-amber-300 bg-amber-50 px-2.5 text-sm'
            value={props.activePolicyV2TableName || '__none__'}
            onChange={(e) => props.setActivePolicyV2TableName(e.target.value === '__none__' ? '' : e.target.value)}
          >
            <option value='__none__'>{props.policyAdvancedTableHint}</option>
            {props.policyV2TableNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>
      <div className='rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900'>
        {props.policyAdvancedCaps.introText}
      </div>
      {props.policyAdvancedCaps.supportsObjectsTab ? (
        <Tabs value={props.policyV2DataTab} onValueChange={(v) => props.setPolicyV2DataTab(v as PolicyV2DataTab)}>
          <TabsList className='h-9'>
            <TabsTrigger className='px-4 text-sm' value='rules'>rules</TabsTrigger>
            <TabsTrigger className='px-4 text-sm' value='objects'>objects</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}
      {!props.policyAdvancedCaps.supportsObjectsTab || props.policyV2DataTab === 'rules' ? (
        <>
          <div className='flex items-center gap-2'>
            <Button size='sm' onClick={props.openCreatePolicyV2Window} disabled={props.isBusy || !props.activePolicyV2TableName}><Plus />Add</Button>
            <Button size='sm' variant='destructive' disabled={props.isBusy || !props.selectedPolicyV2RuleIdsCount} onClick={() => void props.onDeleteSelectedPolicyV2Rules()}>Del</Button>
            <Button size='sm' variant='outline' disabled={props.isBusy || !props.selectedPolicyV2RuleIdsCount} onClick={() => void props.onSetEnabledSelectedPolicyV2Rules(false)}>Disable</Button>
            <Button size='sm' disabled={props.isBusy || !props.selectedPolicyV2RuleIdsCount} onClick={() => void props.onSetEnabledSelectedPolicyV2Rules(true)}>Enable</Button>
            <div className='ml-1 inline-flex h-9 items-center rounded-md border bg-muted p-1'>
              <button
                type='button'
                className={`rounded px-2 py-1 text-xs ${props.policyV2RulesFilter === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => props.setPolicyV2RulesFilter('all')}
              >
                all
              </button>
              {props.policyAdvancedCaps.supportsObjectFilters ? (
                <>
                  <button
                    type='button'
                    className={`rounded px-2 py-1 text-xs ${props.policyV2RulesFilter === 'with_objects' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                    onClick={() => props.setPolicyV2RulesFilter('with_objects')}
                  >
                    with objects ({props.policyV2RulesWithObjectsCount})
                  </button>
                  <button
                    type='button'
                    className={`rounded px-2 py-1 text-xs ${props.policyV2RulesFilter === 'without_objects' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                    onClick={() => props.setPolicyV2RulesFilter('without_objects')}
                  >
                    no objects ({props.policyV2RulesWithoutObjectsCount})
                  </button>
                </>
              ) : null}
            </div>
            {props.policyV2RuleObjectFilterKey ? (
              <div className='ml-1 inline-flex h-9 items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 text-xs text-blue-900'>
                <span className='truncate max-w-[220px]'>object: {props.policyV2RuleObjectFilterKey}</span>
                <button
                  type='button'
                  className='rounded border border-blue-300 bg-background px-1.5 py-0.5 text-[11px] hover:bg-muted'
                  onClick={() => props.setPolicyV2RuleObjectFilterKey(null)}
                >
                  clear
                </button>
              </div>
            ) : null}
          </div>
          <PolicyAdvancedRulesTable
            rows={props.policyV2FilteredRules}
            allRulesCount={props.policyV2RulesCount}
            family={props.activePolicyV2Family}
            selectedRuleIds={props.selectedPolicyV2RuleIds}
            caps={props.policyAdvancedCaps}
            showObjectColumn={props.policyAdvancedCaps.supportsObjectFilters}
            emptyColSpan={props.policyAdvancedRulesColSpan}
            formatCounter={props.formatCounter}
            buildExprSummary={props.buildPolicyV2BridgeExprSummary}
            onRowMouseDown={props.onRuleRowMouseDown}
            onRowClick={props.onRuleRowClick}
            onRowDoubleClick={props.onRuleRowDoubleClick}
            onOpenBindingObject={(kind, name) => props.onFilterObjectsByRuleBinding(kind, name)}
          />
        </>
      ) : (
        <>
          <div className='flex items-center gap-2'>
            <Button size='sm' onClick={props.openCreatePolicyV2ObjectWindow} disabled={props.isBusy || !props.activePolicyV2TableName}><Plus />Add</Button>
            <Button size='sm' variant='outline' disabled={props.isBusy || !props.selectedPolicyV2ObjectIdsCount || !props.activePolicyV2TableName} onClick={props.onCreateRuleFromSelectedObjects}>Use in rule</Button>
            <Button size='sm' variant='destructive' disabled={props.isBusy || !props.selectedPolicyV2ObjectIdsCount} onClick={() => void props.onDeleteSelectedPolicyV2Objects()}>Del</Button>
            <div className='ml-1 inline-flex h-9 items-center rounded-md border bg-muted p-1'>
              <button
                type='button'
                className={`rounded px-2 py-1 text-xs ${props.policyV2ObjectsFilter === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => props.setPolicyV2ObjectsFilter('all')}
              >
                all
              </button>
              <button
                type='button'
                className={`rounded px-2 py-1 text-xs ${props.policyV2ObjectsFilter === 'used' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => props.setPolicyV2ObjectsFilter('used')}
              >
                in use ({props.policyV2ObjectsUsedCount})
              </button>
              <button
                type='button'
                className={`rounded px-2 py-1 text-xs ${props.policyV2ObjectsFilter === 'unused' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => props.setPolicyV2ObjectsFilter('unused')}
              >
                free ({props.policyV2ObjectsFreeCount})
              </button>
            </div>
            {props.policyV2ObjectFocusKey ? (
              <div className='ml-1 inline-flex h-9 items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 text-xs text-blue-900'>
                <span className='truncate max-w-[220px]'>object: {props.policyV2ObjectFocusKey}</span>
                <button
                  type='button'
                  className='rounded border border-blue-300 bg-background px-1.5 py-0.5 text-[11px] hover:bg-muted'
                  onClick={() => props.setPolicyV2ObjectFocusKey(null)}
                >
                  clear
                </button>
              </div>
            ) : null}
          </div>
          <div className='rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900'>
            Objects are bound to selected bridge table and can be referenced from bridge rules.
          </div>
          <div className='rounded-md border px-3 py-2 text-[11px]'>
            <div className='mb-1 font-medium'>Examples</div>
            <div className='flex flex-wrap gap-1.5'>
              <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activePolicyV2TableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('counter_ssh')}>SSH counter</button>
              <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activePolicyV2TableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('limit_dns')}>DNS limit</button>
              <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activePolicyV2TableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('quota_bridge')}>Bridge quota</button>
              <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activePolicyV2TableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('helper_ftp')}>FTP helper</button>
              <button type='button' className='rounded border px-1.5 py-0.5 hover:bg-muted' disabled={!props.activePolicyV2TableName || props.isBusy} onClick={() => props.onCreateObjectWithPreset('timeout_tcp')}>TCP timeout</button>
            </div>
          </div>
          <PolicyBridgeObjectsTable
            rows={props.policyV2FilteredObjects}
            managedObjectsCount={props.policyV2ManagedObjectsCount}
            selectedIds={props.selectedPolicyV2ObjectIds}
            usageByKey={props.policyV2ObjectUsageByKey}
            formatSummary={props.formatPolicyV2ObjectSummary}
            onRowMouseDown={props.onObjectRowMouseDown}
            onRowClick={props.onObjectRowClick}
            onRowDoubleClick={props.onObjectRowDoubleClick}
            onFilterRulesByObject={props.onFilterRulesByObject}
            onCreateRuleWithObject={props.onCreateRuleWithObject}
          />
        </>
      )}
    </div>
  )
}
