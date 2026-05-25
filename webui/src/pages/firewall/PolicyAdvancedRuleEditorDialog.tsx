import * as React from 'react'
import type { FirewallRule } from '../api'
import type { PolicyAdvancedCapabilities, PolicyAdvancedFamily } from './capabilities'
import type { PolicyV2ObjectBinding } from './objectBindings'
import { PolicyAdvancedRuleEditorActionSection } from './PolicyAdvancedRuleEditorActionSection'
import { PolicyAdvancedRuleEditorBaseSection } from './PolicyAdvancedRuleEditorBaseSection'
import { PolicyAdvancedRuleEditorMatchSection } from './PolicyAdvancedRuleEditorMatchSection'
import { PolicyAdvancedRuleEditorModal } from './PolicyAdvancedRuleEditorModal'

type Props = {
  open: boolean
  winPos: { x: number; y: number }
  onDragStart: (event: React.MouseEvent<HTMLDivElement>) => void
  editingPolicyV2RuleId: string | null
  policyAdvancedRuleLabel: string
  isBusy: boolean
  activePolicyV2TableName: string
  onClose: () => void
  onSubmit: (event: React.FormEvent) => Promise<void>
  policyV2Form: Partial<FirewallRule>
  setPolicyV2Form: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  policyV2ChainOptions: string[]
  policyAdvancedCaps: PolicyAdvancedCapabilities
  policyV2FormObjectBindings: PolicyV2ObjectBinding[]
  onOpenBindingObjectFromEditor: (binding: PolicyV2ObjectBinding) => void
  onUnbindObjectInEditor: (binding: PolicyV2ObjectBinding) => void
  family: PolicyAdvancedFamily
  policyV2CounterNames: string[]
  policyV2LimitNames: string[]
  policyV2QuotaNames: string[]
  policyV2CtHelperNames: string[]
  policyV2CtTimeoutNames: string[]
}

export function PolicyAdvancedRuleEditorDialog(props: Props) {
  return (
    <PolicyAdvancedRuleEditorModal
      open={props.open}
      winPos={props.winPos}
      title={props.editingPolicyV2RuleId ? `Edit ${props.policyAdvancedRuleLabel}` : `Add ${props.policyAdvancedRuleLabel}`}
      saveLabel={props.editingPolicyV2RuleId ? 'Save' : 'Add'}
      saveDisabled={props.isBusy || !props.activePolicyV2TableName}
      onDragStart={props.onDragStart}
      onClose={props.onClose}
      onSubmit={props.onSubmit}
    >
      <PolicyAdvancedRuleEditorBaseSection
        activePolicyV2TableName={props.activePolicyV2TableName}
        policyV2Form={props.policyV2Form}
        setPolicyV2Form={props.setPolicyV2Form}
        policyV2ChainOptions={props.policyV2ChainOptions}
        policyAdvancedCaps={props.policyAdvancedCaps}
        editingPolicyV2RuleId={props.editingPolicyV2RuleId}
        policyV2FormObjectBindings={props.policyV2FormObjectBindings}
        onOpenBindingObjectFromEditor={props.onOpenBindingObjectFromEditor}
        onUnbindObjectInEditor={props.onUnbindObjectInEditor}
      />
      <PolicyAdvancedRuleEditorMatchSection
        family={props.family}
        policyV2Form={props.policyV2Form}
        setPolicyV2Form={props.setPolicyV2Form}
      />
      <PolicyAdvancedRuleEditorActionSection
        family={props.family}
        policyV2Form={props.policyV2Form}
        setPolicyV2Form={props.setPolicyV2Form}
        policyV2CounterNames={props.policyV2CounterNames}
        policyV2LimitNames={props.policyV2LimitNames}
        policyV2QuotaNames={props.policyV2QuotaNames}
        policyV2CtHelperNames={props.policyV2CtHelperNames}
        policyV2CtTimeoutNames={props.policyV2CtTimeoutNames}
        policyAdvancedCaps={props.policyAdvancedCaps}
      />
    </PolicyAdvancedRuleEditorModal>
  )
}
