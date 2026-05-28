import * as React from 'react'
import { CollectionsModal } from './CollectionsModal'
import { PolicyAdvancedRuleEditorDialog } from './PolicyAdvancedRuleEditorDialog'
import { PolicyBridgeObjectModal } from './PolicyBridgeObjectModal'
import { PolicyRuleEditorDialog } from './PolicyRuleEditorDialog'
import { TableBuilderModal } from './TableBuilderModal'

type Props = {
  policyRuleEditor: React.ComponentProps<typeof PolicyRuleEditorDialog>
  policyAdvancedRuleEditor: React.ComponentProps<typeof PolicyAdvancedRuleEditorDialog>
  policyBridgeObject: React.ComponentProps<typeof PolicyBridgeObjectModal>
  collections: React.ComponentProps<typeof CollectionsModal>
  tableBuilder: React.ComponentProps<typeof TableBuilderModal>
}

export function FirewallModalStack(props: Props) {
  return (
    <>
      <PolicyRuleEditorDialog {...props.policyRuleEditor} />
      <PolicyAdvancedRuleEditorDialog {...props.policyAdvancedRuleEditor} />
      <PolicyBridgeObjectModal {...props.policyBridgeObject} />
      <CollectionsModal {...props.collections} />
      <TableBuilderModal {...props.tableBuilder} />
    </>
  )
}
