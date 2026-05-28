export type PolicyAdvancedSection = 'policy_v2' | 'policy_v3'
export type PolicyAdvancedFamily = 'bridge' | 'netdev'

export type PolicyAdvancedCapabilities = {
  section: PolicyAdvancedSection
  family: PolicyAdvancedFamily
  policyLabel: 'Policy2' | 'Policy3'
  ruleLabel: string
  tableHint: string
  introText: string
  logPrefixDefault: string
  supportsObjectsTab: boolean
  supportsObjectFilters: boolean
  showFwdColumns: boolean
  showDupColumns: boolean
  supportsRejectAction: boolean
  sourceInterfaceColumnLabel: string
  showDestinationBridgeColumn: boolean
}

const BRIDGE_CAPS: PolicyAdvancedCapabilities = {
  section: 'policy_v2',
  family: 'bridge',
  policyLabel: 'Policy2',
  ruleLabel: 'Bridge Rule (Policy v2)',
  tableHint: 'Select enabled bridge table',
  introText: 'Policy2 manages bridge tables only. Use Policy3 for netdev ingress rules.',
  logPrefixDefault: 'BRIDGE:',
  supportsObjectsTab: true,
  supportsObjectFilters: true,
  showFwdColumns: false,
  showDupColumns: true,
  supportsRejectAction: true,
  sourceInterfaceColumnLabel: 'ibrname',
  showDestinationBridgeColumn: true,
}

const NETDEV_CAPS: PolicyAdvancedCapabilities = {
  section: 'policy_v3',
  family: 'netdev',
  policyLabel: 'Policy3',
  ruleLabel: 'Netdev Rule (Policy3)',
  tableHint: 'Select enabled netdev table',
  introText: 'Policy3 manages netdev ingress chains only. Create netdev tables in Table Builder with hook ingress and a device first.',
  logPrefixDefault: 'NETDEV:',
  supportsObjectsTab: false,
  supportsObjectFilters: false,
  showFwdColumns: true,
  showDupColumns: false,
  supportsRejectAction: false,
  sourceInterfaceColumnLabel: 'iifname',
  showDestinationBridgeColumn: false,
}

export function getPolicyAdvancedCapabilities(section: PolicyAdvancedSection): PolicyAdvancedCapabilities {
  return section === 'policy_v3' ? NETDEV_CAPS : BRIDGE_CAPS
}
