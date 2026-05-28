import * as React from 'react'
import type { FirewallRule } from '../api'

type LiveChartPoint = {
  slot: number
  pps: number
  bps: number
  ts: number
}

type EditorTab = 'base' | 'advanced' | 'action' | 'stats'

type Params = {
  form: Partial<FirewallRule>
  addOpen: boolean
  editingRuleId: string | null
  ruleEditorTab: EditorTab
  buildEmptyLiveChart: () => LiveChartPoint[]
  liveChartWindow: number
}

export function usePolicyRuleLiveStats(params: Params) {
  const [liveChartPoints, setLiveChartPoints] = React.useState<LiveChartPoint[]>(params.buildEmptyLiveChart)
  const liveRateRef = React.useRef<{ pps: number; bps: number }>({ pps: 0, bps: 0 })

  const currentRulePackets = Number(params.form.runtime_packets || 0)
  const currentRuleBytes = Number(params.form.runtime_bytes || 0)
  const currentRulePps = Math.max(0, Number(params.form.runtime_pps || 0))
  const currentRuleBytesPerSec = Math.max(0, Number(params.form.runtime_bps || 0))
  const currentRuleBitrate = currentRuleBytesPerSec * 8

  React.useEffect(() => {
    liveRateRef.current = {
      pps: currentRulePps,
      bps: currentRuleBytesPerSec,
    }
  }, [currentRulePps, currentRuleBytesPerSec])

  React.useEffect(() => {
    if (!params.addOpen || !params.editingRuleId) {
      setLiveChartPoints(params.buildEmptyLiveChart())
      return
    }
    const history = Array.isArray(params.form.runtime_history) ? params.form.runtime_history : []
    const normalized = history
      .slice(-params.liveChartWindow)
      .map((item) => ({
        pps: Math.max(0, Number(item?.pps || 0)),
        bps: Math.max(0, Number(item?.bps || 0)),
        ts: Number(item?.t || 0) * 1000,
      }))
    const padded = [
      ...Array.from({ length: Math.max(0, params.liveChartWindow - normalized.length) }, () => ({ pps: 0, bps: 0, ts: Date.now() })),
      ...normalized,
    ].slice(-params.liveChartWindow)
    setLiveChartPoints(padded.map((point, idx) => ({ slot: idx, ...point })))
  }, [params.addOpen, params.buildEmptyLiveChart, params.editingRuleId, params.form.runtime_history, params.liveChartWindow])

  React.useEffect(() => {
    if (!params.addOpen || !params.editingRuleId || params.ruleEditorTab !== 'stats') return
    const timer = window.setInterval(() => {
      const samplePps = Math.max(0, Number(liveRateRef.current.pps || 0))
      const sampleBps = Math.max(0, Number(liveRateRef.current.bps || 0))
      setLiveChartPoints((prev) => {
        const base = prev.length ? prev : params.buildEmptyLiveChart()
        const shifted = base.slice(1).map((point, idx) => ({ ...point, slot: idx }))
        shifted.push({ slot: params.liveChartWindow - 1, pps: samplePps, bps: sampleBps, ts: Date.now() })
        return shifted
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [params.addOpen, params.buildEmptyLiveChart, params.editingRuleId, params.liveChartWindow, params.ruleEditorTab])

  const statsChart = React.useMemo(() => {
    const points = liveChartPoints.length ? liveChartPoints : params.buildEmptyLiveChart()
    const maxPps = Math.max(1, ...points.map((p) => p.pps))
    const maxBitsPerSec = Math.max(1, ...points.map((p) => p.bps * 8))
    return { points, maxPps, maxBitsPerSec }
  }, [liveChartPoints, params.buildEmptyLiveChart])

  return {
    currentRulePackets,
    currentRuleBytes,
    currentRulePps,
    currentRuleBytesPerSec,
    currentRuleBitrate,
    statsChart,
    setLiveChartPoints,
  }
}
