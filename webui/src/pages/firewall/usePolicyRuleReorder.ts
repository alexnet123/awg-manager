import * as React from 'react'
import type { AuthState, FirewallRule } from '../api'
import { reorderFirewallRules } from '../api'

type Params = {
  auth: AuthState
  activeRuleTable: string
  visibleRules: FirewallRule[]
  dragRuleId: string | null
  dragRuleTableName: string | null
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedRuleIds: React.Dispatch<React.SetStateAction<string[]>>
  setRuleAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  setDragRuleId: React.Dispatch<React.SetStateAction<string | null>>
  setDragOverRuleId: React.Dispatch<React.SetStateAction<string | null>>
  setDragRuleTableName: React.Dispatch<React.SetStateAction<string | null>>
  refresh: () => Promise<void>
}

export function usePolicyRuleReorder(params: Params) {
  const onReorderDrop = React.useCallback(async (targetRuleId: string, targetTableName: string, droppedRuleId?: string, droppedRuleTableName?: string) => {
    const fromRuleId = droppedRuleId || params.dragRuleId
    const fromTableName = (droppedRuleTableName || params.dragRuleTableName || params.activeRuleTable).toLowerCase()
    if (!fromRuleId || fromRuleId === targetRuleId) return
    if (fromTableName !== String(targetTableName || '').toLowerCase()) return

    const ids = params.visibleRules.map((r) => r.id)
    const from = ids.indexOf(fromRuleId)
    const to = ids.indexOf(targetRuleId)
    if (from < 0 || to < 0 || from === to) return

    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    params.setError(null)
    params.setIsBusy(true)
    try {
      await reorderFirewallRules(params.auth, params.activeRuleTable, next)
      await params.refresh()
      params.setSelectedRuleIds([fromRuleId])
      params.setRuleAnchorId(fromRuleId)
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setDragRuleId(null)
      params.setDragOverRuleId(null)
      params.setDragRuleTableName(null)
      params.setIsBusy(false)
    }
  }, [params])

  const onReorderDropToEnd = React.useCallback(async (targetTableName: string, droppedRuleId?: string, droppedRuleTableName?: string) => {
    const fromRuleId = droppedRuleId || params.dragRuleId
    const fromTableName = (droppedRuleTableName || params.dragRuleTableName || params.activeRuleTable).toLowerCase()
    if (!fromRuleId) return
    if (fromTableName !== String(targetTableName || '').toLowerCase()) return

    const ids = params.visibleRules.map((r) => r.id)
    const from = ids.indexOf(fromRuleId)
    if (from < 0 || from === ids.length - 1) return

    const next = [...ids]
    const [moved] = next.splice(from, 1)
    next.push(moved)

    params.setError(null)
    params.setIsBusy(true)
    try {
      await reorderFirewallRules(params.auth, params.activeRuleTable, next)
      await params.refresh()
      params.setSelectedRuleIds([fromRuleId])
      params.setRuleAnchorId(fromRuleId)
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setDragRuleId(null)
      params.setDragOverRuleId(null)
      params.setDragRuleTableName(null)
      params.setIsBusy(false)
    }
  }, [params])

  return { onReorderDrop, onReorderDropToEnd }
}
