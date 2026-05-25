import * as React from 'react'
import type { FirewallNamedObjects, FirewallRule } from '../api'
import { getPolicyAdvancedCapabilities } from './capabilities'
import { getPolicyAdvancedSection, isPolicyAdvancedSection } from './sections'

type Params = {
  activeSection: string
  activePolicyV2Family: 'bridge' | 'netdev'
  activePolicyV2TableName: string
  policyV2DataTab: 'rules' | 'objects'
  policyV2TableNames: string[]
  policyV2RulesFilter: 'all' | 'with_objects' | 'without_objects'

  setActivePolicyV2Family: React.Dispatch<React.SetStateAction<'bridge' | 'netdev'>>
  setPolicyV2DataTab: React.Dispatch<React.SetStateAction<'rules' | 'objects'>>
  setPolicyV2Objects: React.Dispatch<React.SetStateAction<FirewallNamedObjects | null>>
  setSelectedPolicyV2ObjectIds: React.Dispatch<React.SetStateAction<string[]>>
  setPolicyV2ObjectFocusKey: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2RuleObjectFilterKey: React.Dispatch<React.SetStateAction<string | null>>
  setPolicyV2RulesFilter: React.Dispatch<React.SetStateAction<'all' | 'with_objects' | 'without_objects'>>
  setActivePolicyV2TableName: React.Dispatch<React.SetStateAction<string>>
  setPolicyV2Rules: React.Dispatch<React.SetStateAction<FirewallRule[]>>
  setSelectedPolicyV2RuleIds: React.Dispatch<React.SetStateAction<string[]>>
}

export function usePolicyAdvancedContextSync(params: Params) {
  React.useEffect(() => {
    if (!isPolicyAdvancedSection(params.activeSection)) return
    const caps = getPolicyAdvancedCapabilities(getPolicyAdvancedSection(params.activeSection))

    if (params.activePolicyV2Family !== caps.family) {
      params.setActivePolicyV2Family(caps.family)
      if (!caps.supportsObjectsTab) params.setPolicyV2DataTab('rules')
      params.setPolicyV2Objects(null)
      params.setSelectedPolicyV2ObjectIds([])
      params.setPolicyV2ObjectFocusKey(null)
      params.setPolicyV2RuleObjectFilterKey(null)
      return
    }

    if (!caps.supportsObjectsTab && params.policyV2DataTab !== 'rules') {
      params.setPolicyV2DataTab('rules')
    }
    if (!caps.supportsObjectFilters && params.policyV2RulesFilter !== 'all') {
      params.setPolicyV2RulesFilter('all')
      params.setPolicyV2RuleObjectFilterKey(null)
    }
    if (!params.policyV2TableNames.length) {
      params.setActivePolicyV2TableName('')
      params.setPolicyV2Rules([])
      params.setPolicyV2Objects(null)
      params.setPolicyV2RuleObjectFilterKey(null)
      params.setPolicyV2ObjectFocusKey(null)
      params.setSelectedPolicyV2RuleIds([])
      return
    }
    if (!params.activePolicyV2TableName || !params.policyV2TableNames.includes(params.activePolicyV2TableName)) {
      params.setActivePolicyV2TableName(params.policyV2TableNames[0])
      params.setPolicyV2RuleObjectFilterKey(null)
      params.setPolicyV2ObjectFocusKey(null)
      params.setSelectedPolicyV2RuleIds([])
    }
  }, [
    params.activeSection,
    params.activePolicyV2Family,
    params.activePolicyV2TableName,
    params.policyV2DataTab,
    params.policyV2RulesFilter,
    params.policyV2TableNames,
    params.setActivePolicyV2Family,
    params.setPolicyV2DataTab,
    params.setPolicyV2Objects,
    params.setSelectedPolicyV2ObjectIds,
    params.setPolicyV2ObjectFocusKey,
    params.setPolicyV2RuleObjectFilterKey,
    params.setActivePolicyV2TableName,
    params.setPolicyV2Rules,
    params.setSelectedPolicyV2RuleIds,
    params.setPolicyV2RulesFilter,
  ])
}
