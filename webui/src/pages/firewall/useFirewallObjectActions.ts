import * as React from 'react'
import type { AuthState, FirewallNamedObjectItem } from '../api'
import { deleteFirewallObject, upsertFirewallObject } from '../api'
import type { FirewallObjectForm } from './firewallObjectForm'

type Params = {
  auth: AuthState
  activeObjectFamily: 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'
  activeObjectTableName: string
  firewallObjectForm: FirewallObjectForm
  editingFirewallObjectId: string | null
  selectedFirewallObjects: FirewallNamedObjectItem[]
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  setFirewallObjectOpen: React.Dispatch<React.SetStateAction<boolean>>
  setEditingFirewallObjectId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedFirewallObjectIds: React.Dispatch<React.SetStateAction<string[]>>
  setFirewallObjectAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  refreshFirewallObjects: () => Promise<void>
}

export function useFirewallObjectActions(params: Params) {
  const onSaveFirewallObject = React.useCallback(async () => {
    if (!params.activeObjectTableName) {
      params.setError('Select object table first.')
      return false
    }
    const objectName = params.firewallObjectForm.name.trim()
    if (!objectName) {
      params.setError('Object name is required.')
      return false
    }
    params.setError(null)
    params.setIsBusy(true)
    try {
      if (params.firewallObjectForm.kind === 'ct_expectation' && (params.activeObjectFamily === 'bridge' || params.activeObjectFamily === 'netdev')) {
        throw new Error(`ct_expectation is not supported for family=${params.activeObjectFamily}.`)
      }
      if ((params.firewallObjectForm.kind === 'ct_helper' || params.firewallObjectForm.kind === 'ct_timeout') && params.activeObjectFamily === 'netdev') {
        throw new Error(`${params.firewallObjectForm.kind} is not supported for family=netdev.`)
      }
      const payload: Record<string, any> = {
        id: params.editingFirewallObjectId || undefined,
        family: params.activeObjectFamily,
        table: params.activeObjectTableName,
        kind: params.firewallObjectForm.kind,
        name: objectName,
        enabled: !!params.firewallObjectForm.enabled,
        comment: params.firewallObjectForm.comment.trim() || null,
      }
      if (params.firewallObjectForm.kind === 'counter') {
        payload.packets = params.firewallObjectForm.packets.trim() || undefined
        payload.bytes = params.firewallObjectForm.bytes.trim() || undefined
      } else if (params.firewallObjectForm.kind === 'limit') {
        payload.rate = params.firewallObjectForm.rate.trim()
        payload.burst = params.firewallObjectForm.burst.trim() || undefined
        payload.over = !!params.firewallObjectForm.over
      } else if (params.firewallObjectForm.kind === 'quota') {
        payload.mode = params.firewallObjectForm.quota_mode
        payload.bytes = params.firewallObjectForm.quota_bytes.trim()
        payload.used = params.firewallObjectForm.quota_used.trim() || undefined
      } else if (params.firewallObjectForm.kind === 'ct_helper') {
        payload.helper_type = params.firewallObjectForm.helper_type.trim()
        payload.l4proto = params.firewallObjectForm.l4proto
        payload.l3proto = params.firewallObjectForm.l3proto || undefined
      } else if (params.firewallObjectForm.kind === 'ct_timeout') {
        payload.l4proto = params.firewallObjectForm.l4proto
        payload.timeout_policy = params.firewallObjectForm.timeout_policy.trim()
        payload.l3proto = params.firewallObjectForm.l3proto || undefined
      } else if (params.firewallObjectForm.kind === 'ct_expectation') {
        payload.l4proto = params.firewallObjectForm.l4proto
        payload.dport = params.firewallObjectForm.dport.trim()
        payload.timeout = params.firewallObjectForm.timeout.trim()
        payload.size = params.firewallObjectForm.size.trim()
        payload.l3proto = params.firewallObjectForm.l3proto || undefined
      }
      await upsertFirewallObject(params.auth, payload)
      params.setFirewallObjectOpen(false)
      params.setEditingFirewallObjectId(null)
      void params.refreshFirewallObjects().catch((exc) => {
        params.setError(exc instanceof Error ? exc.message : String(exc))
      })
      return true
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
      return false
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onDeleteSelectedFirewallObjects = React.useCallback(async () => {
    if (!params.selectedFirewallObjects.length) return
    if (!confirm(`Delete ${params.selectedFirewallObjects.length} selected object(s)?`)) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const row of params.selectedFirewallObjects) {
        await deleteFirewallObject(params.auth, row.id)
      }
      params.setSelectedFirewallObjectIds([])
      params.setFirewallObjectAnchorId(null)
      await params.refreshFirewallObjects()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  return {
    onSaveFirewallObject,
    onDeleteSelectedFirewallObjects,
  }
}
