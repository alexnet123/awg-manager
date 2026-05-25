import * as React from 'react'
import type { FirewallNamedObjectItem, FirewallRule } from '../api'
import type { PolicyAdvancedCapabilities } from './capabilities'
import { PolicyAdvancedSection } from './PolicyAdvancedSection'
import type { PolicyV2ObjectPreset } from './usePolicyAdvancedObjectEditor'

type SelectionResult = { selected: string[]; anchor: string }

type Props = {
  policyAdvancedFamily: string
  activePolicyV2TableName: string
  setActivePolicyV2TableName: (name: string) => void
  policyAdvancedTableHint: string
  policyV2TableNames: string[]
  policyAdvancedCaps: PolicyAdvancedCapabilities
  policyV2DataTab: 'rules' | 'objects'
  setPolicyV2DataTab: (tab: 'rules' | 'objects') => void
  isBusy: boolean

  openCreatePolicyV2Window: () => void
  onDeleteSelectedPolicyV2Rules: () => Promise<void>
  onSetEnabledSelectedPolicyV2Rules: (enabled: boolean) => Promise<void>

  policyV2RulesFilter: 'all' | 'with_objects' | 'without_objects'
  setPolicyV2RulesFilter: (filter: 'all' | 'with_objects' | 'without_objects') => void
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
  onRuleRowDoubleClick: (row: FirewallRule) => void
  onFilterObjectsByRuleBinding: (kind: string, name: string) => void

  openCreatePolicyV2ObjectWindow: () => void
  onCreateRuleFromSelectedObjects: () => void
  onDeleteSelectedPolicyV2Objects: () => Promise<void>
  policyV2ObjectsFilter: 'all' | 'used' | 'unused'
  setPolicyV2ObjectsFilter: (filter: 'all' | 'used' | 'unused') => void
  policyV2ObjectsUsedCount: number
  policyV2ObjectsFreeCount: number
  policyV2ObjectFocusKey: string | null
  setPolicyV2ObjectFocusKey: (key: string | null) => void
  applyPolicyV2ObjectPreset: (preset: PolicyV2ObjectPreset) => void

  policyV2FilteredObjects: FirewallNamedObjectItem[]
  policyV2ManagedObjectsCount: number
  selectedPolicyV2ObjectIds: string[]
  policyV2ObjectUsageByKey: Record<string, { count: number; samples: string[] }>
  formatPolicyV2ObjectSummary: (item: FirewallNamedObjectItem) => string
  onObjectRowDoubleClick: (row: FirewallNamedObjectItem) => void
  onFilterRulesByObject: (kind: string, name: string) => void
  onCreateRuleWithObject: (kind: string, name: string) => void

  selectedPolicyV2RuleIds: string[]
  policyV2RuleAnchorId: string | null
  setSelectedPolicyV2RuleIds: React.Dispatch<React.SetStateAction<string[]>>
  setPolicyV2RuleAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  policyV2ObjectAnchorId: string | null
  setSelectedPolicyV2ObjectIds: React.Dispatch<React.SetStateAction<string[]>>
  setPolicyV2ObjectAnchorId: React.Dispatch<React.SetStateAction<string | null>>

  computeSelection: (
    ordered: string[],
    selected: string[],
    anchor: string | null,
    rowId: string,
    e: React.MouseEvent,
  ) => SelectionResult
}

export function PolicyAdvancedPage(props: Props) {
  return (
    <PolicyAdvancedSection
      policyAdvancedFamily={props.policyAdvancedFamily}
      activePolicyV2TableName={props.activePolicyV2TableName}
      setActivePolicyV2TableName={props.setActivePolicyV2TableName}
      policyAdvancedTableHint={props.policyAdvancedTableHint}
      policyV2TableNames={props.policyV2TableNames}
      policyAdvancedCaps={props.policyAdvancedCaps}
      policyV2DataTab={props.policyV2DataTab}
      setPolicyV2DataTab={props.setPolicyV2DataTab}
      isBusy={props.isBusy}
      selectedPolicyV2RuleIdsCount={props.selectedPolicyV2RuleIds.length}
      selectedPolicyV2ObjectIdsCount={props.selectedPolicyV2ObjectIds.length}
      openCreatePolicyV2Window={props.openCreatePolicyV2Window}
      onDeleteSelectedPolicyV2Rules={props.onDeleteSelectedPolicyV2Rules}
      onSetEnabledSelectedPolicyV2Rules={props.onSetEnabledSelectedPolicyV2Rules}
      policyV2RulesFilter={props.policyV2RulesFilter}
      setPolicyV2RulesFilter={props.setPolicyV2RulesFilter}
      policyV2RulesWithObjectsCount={props.policyV2RulesWithObjectsCount}
      policyV2RulesWithoutObjectsCount={props.policyV2RulesWithoutObjectsCount}
      policyV2RuleObjectFilterKey={props.policyV2RuleObjectFilterKey}
      setPolicyV2RuleObjectFilterKey={props.setPolicyV2RuleObjectFilterKey}
      policyV2FilteredRules={props.policyV2FilteredRules}
      policyV2RulesCount={props.policyV2RulesCount}
      activePolicyV2Family={props.activePolicyV2Family}
      policyAdvancedRulesColSpan={props.policyAdvancedRulesColSpan}
      formatCounter={props.formatCounter}
      buildPolicyV2BridgeExprSummary={props.buildPolicyV2BridgeExprSummary}
      onRuleRowMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault()
      }}
      onRuleRowClick={(row, e) => {
        const ordered = props.policyV2FilteredRules.map((x) => x.id)
        const next = props.computeSelection(ordered, props.selectedPolicyV2RuleIds, props.policyV2RuleAnchorId, row.id, e)
        props.setSelectedPolicyV2RuleIds(next.selected)
        props.setPolicyV2RuleAnchorId(next.anchor)
      }}
      onRuleRowDoubleClick={props.onRuleRowDoubleClick}
      onFilterObjectsByRuleBinding={props.onFilterObjectsByRuleBinding}
      openCreatePolicyV2ObjectWindow={props.openCreatePolicyV2ObjectWindow}
      onCreateRuleFromSelectedObjects={props.onCreateRuleFromSelectedObjects}
      onDeleteSelectedPolicyV2Objects={props.onDeleteSelectedPolicyV2Objects}
      policyV2ObjectsFilter={props.policyV2ObjectsFilter}
      setPolicyV2ObjectsFilter={props.setPolicyV2ObjectsFilter}
      policyV2ObjectsUsedCount={props.policyV2ObjectsUsedCount}
      policyV2ObjectsFreeCount={props.policyV2ObjectsFreeCount}
      policyV2ObjectFocusKey={props.policyV2ObjectFocusKey}
      setPolicyV2ObjectFocusKey={props.setPolicyV2ObjectFocusKey}
      onCreateObjectWithPreset={(preset) => {
        props.openCreatePolicyV2ObjectWindow()
        props.applyPolicyV2ObjectPreset(preset)
      }}
      policyV2FilteredObjects={props.policyV2FilteredObjects}
      policyV2ManagedObjectsCount={props.policyV2ManagedObjectsCount}
      selectedPolicyV2ObjectIds={props.selectedPolicyV2ObjectIds}
      policyV2ObjectUsageByKey={props.policyV2ObjectUsageByKey}
      formatPolicyV2ObjectSummary={props.formatPolicyV2ObjectSummary}
      onObjectRowMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault()
      }}
      onObjectRowClick={(row, e) => {
        const ordered = props.policyV2FilteredObjects.map((x) => x.id)
        const next = props.computeSelection(ordered, props.selectedPolicyV2ObjectIds, props.policyV2ObjectAnchorId, row.id, e)
        props.setSelectedPolicyV2ObjectIds(next.selected)
        props.setPolicyV2ObjectAnchorId(next.anchor)
      }}
      onObjectRowDoubleClick={props.onObjectRowDoubleClick}
      onFilterRulesByObject={props.onFilterRulesByObject}
      onCreateRuleWithObject={props.onCreateRuleWithObject}
      selectedPolicyV2RuleIds={props.selectedPolicyV2RuleIds}
    />
  )
}
