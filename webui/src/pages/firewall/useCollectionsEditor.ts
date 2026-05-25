import * as React from 'react'
import type { AuthState, FirewallMapItem, FirewallSetItem } from '../api'
import { upsertFirewallMap, upsertFirewallSet } from '../api'

type CollectionKind = 'addr' | 'port' | 'iface' | 'map' | 'vmap'

type Params = {
  auth: AuthState
  editingSetId: string | null
  newSetReadOnly: boolean
  newSetName: string
  newSetElements: string
  newSetComment: string
  newSetTimeoutEnabled: boolean
  newSetTimeout: string
  collectionKind: CollectionKind
  setEditingSetId: React.Dispatch<React.SetStateAction<string | null>>
  setNewSetReadOnly: React.Dispatch<React.SetStateAction<boolean>>
  setNewSetName: React.Dispatch<React.SetStateAction<string>>
  setNewSetElements: React.Dispatch<React.SetStateAction<string>>
  setNewSetComment: React.Dispatch<React.SetStateAction<string>>
  setNewSetTimeoutEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setNewSetTimeout: React.Dispatch<React.SetStateAction<string>>
  setCollectionKind: React.Dispatch<React.SetStateAction<CollectionKind>>
  setWinPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  setSetOpen: React.Dispatch<React.SetStateAction<boolean>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsBusy: React.Dispatch<React.SetStateAction<boolean>>
  normalizeCollectionTimeoutInput: (value: string) => string | null
  refreshCollections: () => Promise<void>
}

export function useCollectionsEditor(params: Params) {
  const openCreateSetWindow = React.useCallback(() => {
    params.setEditingSetId(null)
    params.setNewSetReadOnly(false)
    params.setNewSetName('')
    params.setNewSetElements('')
    params.setNewSetComment('')
    params.setNewSetTimeoutEnabled(false)
    params.setNewSetTimeout('')
    params.setCollectionKind('addr')
    params.setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 360) / 2) - 40) })
    params.setSetOpen(true)
  }, [params])

  const openEditSetWindow = React.useCallback((item: FirewallSetItem & { kind: 'addr' | 'port' | 'iface' }) => {
    const isTemporary = !!item.timeout
    params.setEditingSetId(item.id)
    params.setNewSetReadOnly(isTemporary)
    params.setNewSetName(item.name || '')
    params.setNewSetElements((item.elements || []).join(', '))
    params.setNewSetComment(item.comment || '')
    params.setNewSetTimeoutEnabled(!!item.timeout)
    params.setNewSetTimeout(item.timeout || '')
    params.setCollectionKind(item.kind)
    params.setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 360) / 2) - 40) })
    params.setSetOpen(true)
  }, [params])

  const openEditMapWindow = React.useCallback((item: FirewallMapItem & { kind: 'map' | 'vmap' }) => {
    const isTemporary = !!item.timeout
    params.setCollectionKind(item.kind)
    params.setEditingSetId(item.id)
    params.setNewSetReadOnly(isTemporary)
    params.setNewSetName(item.name || '')
    params.setNewSetElements((item.entries || []).join(', '))
    params.setNewSetComment(item.comment || '')
    params.setNewSetTimeoutEnabled(!!item.timeout)
    params.setNewSetTimeout(item.timeout || '')
    params.setWinPos({ x: Math.max(8, Math.floor((window.innerWidth - 560) / 2)), y: Math.max(8, Math.floor((window.innerHeight - 360) / 2) - 40) })
    params.setSetOpen(true)
  }, [params])

  const onSaveSet = React.useCallback(async (): Promise<boolean> => {
    if (params.newSetReadOnly) {
      params.setError('Temporary collections are read-only. Delete and recreate if needed.')
      return false
    }
    params.setError(null)
    params.setIsBusy(true)
    try {
      const elements = params.newSetElements.split(',').map((x) => x.trim()).filter(Boolean)
      const timeout = params.newSetTimeoutEnabled ? params.normalizeCollectionTimeoutInput(params.newSetTimeout) : null
      if (params.collectionKind === 'map' || params.collectionKind === 'vmap') {
        await upsertFirewallMap(params.auth, params.collectionKind, { id: params.editingSetId || undefined, name: params.newSetName.trim(), entries: elements, comment: params.newSetComment.trim() || null, timeout })
      } else {
        await upsertFirewallSet(params.auth, params.collectionKind, { id: params.editingSetId || undefined, name: params.newSetName.trim(), elements, comment: params.newSetComment.trim() || null, timeout })
      }
      params.setEditingSetId(null)
      params.setNewSetName('')
      params.setNewSetElements('')
      params.setNewSetComment('')
      params.setNewSetTimeoutEnabled(false)
      params.setNewSetTimeout('')
      await params.refreshCollections()
      return true
    } catch (exc) {
      params.setError(exc instanceof Error ? exc.message : String(exc))
      return false
    } finally {
      params.setIsBusy(false)
    }
  }, [params])

  return {
    openCreateSetWindow,
    openEditSetWindow,
    openEditMapWindow,
    onSaveSet,
  }
}
