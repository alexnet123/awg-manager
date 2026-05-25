import * as React from 'react'

export type SortDirection = 'asc' | 'desc'

export function nextSortState<K extends string>(
  prev: { key: K | null; dir: SortDirection },
  key: K,
): { key: K | null; dir: SortDirection } {
  if (prev.key !== key) return { key, dir: 'asc' }
  if (prev.dir === 'asc') return { key, dir: 'desc' }
  return { key: null, dir: 'asc' }
}

export function computeSelection(
  orderedIds: string[],
  prevSelected: string[],
  anchorId: string | null,
  clickedId: string,
  event: React.MouseEvent,
): { selected: string[]; anchor: string } {
  const prev = Array.from(new Set(prevSelected))
  const isToggle = event.metaKey || event.ctrlKey
  const isRange = event.shiftKey
  const fallbackAnchor = prev.length ? prev[prev.length - 1] : clickedId
  const nextAnchor = clickedId

  if (isRange) {
    const startId = anchorId || fallbackAnchor
    const a = orderedIds.indexOf(startId)
    const b = orderedIds.indexOf(clickedId)
    if (a >= 0 && b >= 0) {
      const [start, end] = a < b ? [a, b] : [b, a]
      const range = orderedIds.slice(start, end + 1)
      if (isToggle) return { selected: Array.from(new Set([...prev, ...range])), anchor: nextAnchor }
      return { selected: range, anchor: nextAnchor }
    }
  }

  if (isToggle) {
    const selected = prev.includes(clickedId) ? prev.filter((id) => id !== clickedId) : [...prev, clickedId]
    return { selected, anchor: nextAnchor }
  }

  return { selected: [clickedId], anchor: nextAnchor }
}

export function sortIndicator(active: boolean, dir: SortDirection): string {
  if (!active) return '↕'
  return dir === 'asc' ? '▲' : '▼'
}

export function compareStr(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
}
