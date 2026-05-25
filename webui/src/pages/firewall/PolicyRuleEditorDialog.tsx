import * as React from 'react'
import type { FirewallRule, FirewallSchema, FirewallTableItem } from '../api'
import { PolicyRuleEditorActionTab } from './PolicyRuleEditorActionTab'
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
}

export function PolicyRuleEditorDialog(props: Props) {
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
      />
    </PolicyRuleEditorModal>
  )
}
