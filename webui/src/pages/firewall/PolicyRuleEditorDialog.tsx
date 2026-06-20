import * as React from 'react'
import type { FirewallRule, FirewallSchema, FirewallTableItem } from '../api'
import { getFirewallRuleObjectBindings } from './firewallObjectBindings'
import { PolicyRuleEditorActionTab, type DynamicSetStatementOption, type VmapStatementOption } from './PolicyRuleEditorActionTab'
import { PolicyRuleEditorAdvancedTab } from './PolicyRuleEditorAdvancedTab'
import { PolicyRuleEditorBaseTab } from './PolicyRuleEditorBaseTab'
import { PolicyRuleEditorModal } from './PolicyRuleEditorModal'
import { PolicyRuleEditorStatsTab } from './PolicyRuleEditorStatsTab'

type EditorTab = 'base' | 'advanced' | 'action' | 'stats'
type FieldState = 'V' | 'H' | 'D' | 'W'
type StatsPoint = {
  slot: number
  pps: number
  bps: number
  ts: number
}

type Props = {
  open: boolean
  winPos: { x: number; y: number }
  onDragStart: (event: React.MouseEvent<HTMLDivElement>) => void
  editingRuleId: string | null
  ruleEditorTab: EditorTab
  setRuleEditorTab: React.Dispatch<React.SetStateAction<EditorTab>>
  onClose: () => void
  onSubmit: (event: React.FormEvent) => Promise<void>
  isBusy: boolean
  form: Partial<FirewallRule>
  setForm: React.Dispatch<React.SetStateAction<Partial<FirewallRule>>>
  hasSupport: (key: string) => boolean
  natActionOptions: string[]
  generalFieldState: (field: 'in_interface' | 'out_interface' | 'ct_state') => FieldState
  schema: FirewallSchema | null
  builtinRuleTables: Set<string>
  chainOptionsByTable: Record<string, string[]>
  customChainRowsByTable: Record<string, FirewallTableItem[]>
  advOpen: Record<string, boolean>
  setAdvOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  selectedAction: string
  isNatActionSelected: boolean
  formatCounter: (value?: number) => string
  formatBytesIEC: (value?: number) => string
  formatBitrate: (bytesPerSec?: number) => string
  formatPacketRate: (packetsPerSec?: number) => string
  currentRulePackets: number
  currentRuleBytes: number
  currentRuleBitrate: number
  currentRulePps: number
  statsChart: {
    points: StatsPoint[]
    maxPps: number
    maxBitsPerSec: number
  }
  statsSeries: 'packets' | 'bytes'
  setStatsSeries: React.Dispatch<React.SetStateAction<'packets' | 'bytes'>>
  objectCounterNames: string[]
  objectLimitNames: string[]
  objectQuotaNames: string[]
  objectCtHelperNames: string[]
  objectCtTimeoutNames: string[]
  objectCtExpectationNames: string[]
  dynamicSetOptions: DynamicSetStatementOption[]
  vmapStatementOptions: VmapStatementOption[]
}

export function PolicyRuleEditorDialog(props: Props) {
  const firewallObjectBindings = React.useMemo(
    () => String(props.form.family || 'inet').toLowerCase() !== 'netdev' ? getFirewallRuleObjectBindings(props.form) : [],
    [props.form.family, props.form.counter_name, props.form.limit_name, props.form.quota_name, props.form.ct_helper_set, props.form.ct_timeout_set, props.form.ct_expectation_set],
  )

  const unlinkObjectBinding = React.useCallback((kind: string) => {
    props.setForm((prev) => {
      const next = { ...prev }
      if (kind === 'counter') next.counter_name = null
      else if (kind === 'limit') next.limit_name = null
      else if (kind === 'quota') next.quota_name = null
      else if (kind === 'ct_helper') next.ct_helper_set = null
      else if (kind === 'ct_timeout') next.ct_timeout_set = null
      else if (kind === 'ct_expectation') next.ct_expectation_set = null
      return next
    })
  }, [props.setForm])

  return (
    <PolicyRuleEditorModal
      open={props.open}
      winPos={props.winPos}
      onDragStart={props.onDragStart}
      editingRuleId={props.editingRuleId}
      ruleEditorTab={props.ruleEditorTab}
      setRuleEditorTab={props.setRuleEditorTab}
      onClose={props.onClose}
      onSubmit={props.onSubmit}
      isBusy={props.isBusy}
    >
      {firewallObjectBindings.length ? (
        <div className='mb-2 rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-900'>
          <div className='mb-1 font-medium'>Object bindings</div>
          <div className='flex flex-wrap gap-1.5'>
            {firewallObjectBindings.map((binding) => (
              <span key={`${binding.kind}:${binding.name}`} className='inline-flex items-center gap-1 rounded border border-blue-300 bg-background px-1.5 py-0.5'>
                {binding.label}
                <button
                  type='button'
                  className='rounded border border-blue-300 px-1 text-[10px] hover:bg-muted'
                  onClick={() => unlinkObjectBinding(binding.kind)}
                >
                  unlink
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <PolicyRuleEditorBaseTab
        form={props.form}
        setForm={props.setForm}
        hasSupport={props.hasSupport}
        generalFieldState={props.generalFieldState}
        schema={props.schema}
        builtinRuleTables={props.builtinRuleTables}
        chainOptionsByTable={props.chainOptionsByTable}
        customChainRowsByTable={props.customChainRowsByTable}
      />

      <PolicyRuleEditorAdvancedTab
        form={props.form}
        setForm={props.setForm}
        advOpen={props.advOpen}
        setAdvOpen={props.setAdvOpen}
        hasSupport={props.hasSupport}
      />

      <PolicyRuleEditorActionTab
        selectedAction={props.selectedAction}
        isNatActionSelected={props.isNatActionSelected}
        form={props.form}
        setForm={props.setForm}
        hasSupport={props.hasSupport}
        natActionOptions={props.natActionOptions}
        objectLimitNames={props.objectLimitNames}
        objectQuotaNames={props.objectQuotaNames}
        objectCtHelperNames={props.objectCtHelperNames}
        objectCtTimeoutNames={props.objectCtTimeoutNames}
        objectCtExpectationNames={props.objectCtExpectationNames}
        dynamicSetOptions={props.dynamicSetOptions}
        vmapStatementOptions={props.vmapStatementOptions}
      />

      <PolicyRuleEditorStatsTab
        hasSupport={props.hasSupport}
        form={props.form}
        setForm={props.setForm}
        formatCounter={props.formatCounter}
        formatBytesIEC={props.formatBytesIEC}
        formatBitrate={props.formatBitrate}
        formatPacketRate={props.formatPacketRate}
        currentRulePackets={props.currentRulePackets}
        currentRuleBytes={props.currentRuleBytes}
        currentRuleBitrate={props.currentRuleBitrate}
        currentRulePps={props.currentRulePps}
        statsChart={props.statsChart}
        statsSeries={props.statsSeries}
        setStatsSeries={props.setStatsSeries}
        objectCounterNames={props.objectCounterNames}
      />
    </PolicyRuleEditorModal>
  )
}
