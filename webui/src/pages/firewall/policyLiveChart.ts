export const LIVE_CHART_WINDOW = 90

export type LiveChartPoint = {
  slot: number
  pps: number
  bps: number
  ts: number
}

export function buildEmptyLiveChart(windowSize = LIVE_CHART_WINDOW): LiveChartPoint[] {
  const now = Date.now()
  return Array.from({ length: windowSize }, (_, idx) => ({
    slot: idx,
    pps: 0,
    bps: 0,
    ts: now - (windowSize - idx) * 1000,
  }))
}
