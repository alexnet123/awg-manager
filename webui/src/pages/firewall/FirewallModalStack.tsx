import * as React from 'react'
import { CollectionsModal } from './CollectionsModal'
import { FirewallObjectModal } from './FirewallObjectModal'
import { PolicyRuleEditorDialog } from './PolicyRuleEditorDialog'
import { TableBuilderModal } from './TableBuilderModal'

type Props = {
  policyRuleEditor: React.ComponentProps<typeof PolicyRuleEditorDialog>
  firewallObject: React.ComponentProps<typeof FirewallObjectModal>
  collections: React.ComponentProps<typeof CollectionsModal>
  tableBuilder: React.ComponentProps<typeof TableBuilderModal>
}

export function FirewallModalStack(props: Props) {
  return (
    <>
      <PolicyRuleEditorDialog {...props.policyRuleEditor} />
      <FirewallObjectModal {...props.firewallObject} />
      <CollectionsModal {...props.collections} />
      <TableBuilderModal {...props.tableBuilder} />
    </>
  )
}
