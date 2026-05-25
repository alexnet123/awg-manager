export type FieldState = 'V' | 'H' | 'D' | 'W'

type GeneralField = 'in_interface' | 'out_interface' | 'ct_state'

const GENERAL_FIELD_STATES: Record<string, Record<GeneralField, FieldState>> = {
  'filter:input': { in_interface: 'V', out_interface: 'H', ct_state: 'V' },
  'filter:forward': { in_interface: 'V', out_interface: 'V', ct_state: 'V' },
  'filter:output': { in_interface: 'H', out_interface: 'V', ct_state: 'V' },
  'nat:prerouting': { in_interface: 'V', out_interface: 'H', ct_state: 'H' },
  'nat:input': { in_interface: 'V', out_interface: 'H', ct_state: 'H' },
  'nat:output': { in_interface: 'H', out_interface: 'V', ct_state: 'H' },
  'nat:postrouting': { in_interface: 'H', out_interface: 'V', ct_state: 'H' },
  'raw:prerouting': { in_interface: 'V', out_interface: 'H', ct_state: 'H' },
  'raw:output': { in_interface: 'H', out_interface: 'V', ct_state: 'H' },
  'mangle:prerouting': { in_interface: 'V', out_interface: 'H', ct_state: 'V' },
  'mangle:input': { in_interface: 'V', out_interface: 'H', ct_state: 'V' },
  'mangle:forward': { in_interface: 'V', out_interface: 'V', ct_state: 'V' },
  'mangle:output': { in_interface: 'H', out_interface: 'V', ct_state: 'V' },
  'mangle:postrouting': { in_interface: 'H', out_interface: 'V', ct_state: 'V' },
}

export function getGeneralFieldState(contextKey: string, field: GeneralField): FieldState {
  return GENERAL_FIELD_STATES[contextKey]?.[field] || 'V'
}
