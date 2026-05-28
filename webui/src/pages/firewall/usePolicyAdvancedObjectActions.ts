import * as React from 'react'
import type { AuthState, FirewallNamedObjectItem } from '../api'
import { deleteFirewallObject, upsertFirewallObject } from '../api'
import type { PolicyV2ObjectForm } from './policyV2ObjectForm'

type Params = {
  auth: AuthState
  activePolicyV2TableName: string
  policyV2ObjectForm: PolicyV2ObjectForm
  editingPolicyV2ObjectId: string | null
  selectedPolicyV2Objects: FirewallNamedObjectItem[]
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  setPolicyV2ObjectOpen: React.Dispatch<React.SetStateAction<boolean>>
  setEditingPolicyV2ObjectId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedPolicyV2ObjectIds: React.Dispatch<React.SetStateAction<string[]>>
  setPolicyV2ObjectAnchorId: React.Dispatch<React.SetStateAction<string | null>>
  refreshPolicyV2Objects: () => Promise<void>
}

export function usePolicyAdvancedObjectActions(params: Params) {
  const onSavePolicyV2Object = React.useCallback(async () => {
    if (!params.activePolicyV2TableName) {
      params.setError('Select bridge table first in Policy v2.')
      return false
    }
    const objectName = params.policyV2ObjectForm.name.trim()
    if (!objectName) {
      params.setError('Object name is required.')
      return false
    }
    params.setError(null)
    params.setIsBusy(true)
    try {
      if (params.policyV2ObjectForm.kind === 'ct_expectation') {
        throw new Error('ct_expectation is planned for bridge and temporarily disabled.')
      }
      const payload: Record<string, any> = {
        id: params.editingPolicyV2ObjectId || undefined,
        family: 'bridge',
        table: params.activePolicyV2TableName,
        kind: params.policyV2ObjectForm.kind,
        name: objectName,
        enabled: !!params.policyV2ObjectForm.enabled,
        comment: params.policyV2ObjectForm.comment.trim() || null,
      }
      if (params.policyV2ObjectForm.kind === 'counter') {
        payload.packets = params.policyV2ObjectForm.packets.trim() || undefined
        payload.bytes = params.policyV2ObjectForm.bytes.trim() || undefined
      } else if (params.policyV2ObjectForm.kind === 'limit') {
        payload.rate = params.policyV2ObjectForm.rate.trim()
        payload.burst = params.policyV2ObjectForm.burst.trim() || undefined
        payload.over = !!params.policyV2ObjectForm.over
      } else if (params.policyV2ObjectForm.kind === 'quota') {
        payload.mode = params.policyV2ObjectForm.quota_mode
        payload.bytes = params.policyV2ObjectForm.quota_bytes.trim()
        payload.used = params.policyV2ObjectForm.quota_used.trim() || undefined
      } else if (params.policyV2ObjectForm.kind === 'ct_helper') {
        payload.helper_type = params.policyV2ObjectForm.helper_type.trim()
        payload.l4proto = params.policyV2ObjectForm.l4proto
        payload.l3proto = params.policyV2ObjectForm.l3proto || undefined
      } else if (params.policyV2ObjectForm.kind === 'ct_timeout') {
        payload.l4proto = params.policyV2ObjectForm.l4proto
        payload.timeout_policy = params.policyV2ObjectForm.timeout_policy.trim()
        payload.l3proto = params.policyV2ObjectForm.l3proto || undefined
      } else if (params.policyV2ObjectForm.kind === 'ct_expectation') {
        payload.l4proto = params.policyV2ObjectForm.l4proto
        payload.dport = params.policyV2ObjectForm.dport.trim()
        payload.timeout = params.policyV2ObjectForm.timeout.trim()
        payload.size = params.policyV2ObjectForm.size.trim()
        payload.l3proto = params.policyV2ObjectForm.l3proto || undefined
      }
      await upsertFirewallObject(params.auth, payload)
      await params.refreshPolicyV2Objects()
      params.setPolicyV2ObjectOpen(false)
      params.setEditingPolicyV2ObjectId(null)
      return true
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
      return false
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  const onDeleteSelectedPolicyV2Objects = React.useCallback(async () => {
    if (!params.selectedPolicyV2Objects.length) return
    if (!confirm(`Delete ${params.selectedPolicyV2Objects.length} selected object(s)?`)) return
    params.setError(null)
    params.setIsBusy(true)
    try {
      for (const row of params.selectedPolicyV2Objects) {
        await deleteFirewallObject(params.auth, row.id)
      }
      params.setSelectedPolicyV2ObjectIds([])
      params.setPolicyV2ObjectAnchorId(null)
      await params.refreshPolicyV2Objects()
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  return {
    onSavePolicyV2Object,
    onDeleteSelectedPolicyV2Objects,
  }
}
