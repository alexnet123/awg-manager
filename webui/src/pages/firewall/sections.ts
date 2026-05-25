import type { PolicyAdvancedSection } from './capabilities'

export function isPolicyAdvancedSection(section: string): section is PolicyAdvancedSection {
  return section === 'policy_v2' || section === 'policy_v3'
}

export function getPolicyAdvancedSection(section: string): PolicyAdvancedSection {
  return section === 'policy_v3' ? 'policy_v3' : 'policy_v2'
}

