import * as React from 'react'
import type { AuthState, FirewallMapsState, FirewallNamedObjects, FirewallRule, FirewallSchema, FirewallSetsState, FirewallState, FirewallTablesState } from '../api'
import { getFirewallMaps, getFirewallObjects, getFirewallRules, getFirewallSchema, getFirewallSets, getFirewallState, getFirewallTables } from '../api'
import { isPolicyAdvancedSection } from './sections'

type PolicyV2Family = 'bridge' | 'netdev'
type FirewallSectionTab = 'policy' | 'policy_v2' | 'policy_v3' | 'collections' | 'table_builder'

type Params = {
  auth: AuthState
  refreshNonce: number
  activeSection: FirewallSectionTab
  activePolicyV2Family: PolicyV2Family
  activePolicyV2TableName: string
  setState: React.Dispatch<React.SetStateAction<FirewallState | null>>
  setSetsState: React.Dispatch<React.SetStateAction<FirewallSetsState>>
  setMapsState: React.Dispatch<React.SetStateAction<FirewallMapsState>>
  setTablesState: React.Dispatch<React.SetStateAction<FirewallTablesState>>
  setPolicyV2Rules: React.Dispatch<React.SetStateAction<FirewallRule[]>>
  setPolicyV2Objects: React.Dispatch<React.SetStateAction<FirewallNamedObjects | null>>
  setSchema: React.Dispatch<React.SetStateAction<FirewallSchema | null>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setCollectionsNowSec: React.Dispatch<React.SetStateAction<number>>
}

export function useFirewallDataSync(params: Params) {
  const {
    auth,
    refreshNonce,
    activeSection,
    activePolicyV2Family,
    activePolicyV2TableName,
    setState,
    setSetsState,
    setMapsState,
    setTablesState,
    setPolicyV2Rules,
    setPolicyV2Objects,
    setSchema,
    setError,
    setCollectionsNowSec,
  } = params

  const refresh = React.useCallback(async () => {
    setError(null)
    try {
      const [fwState, fwSets, fwMaps, fwTables] = await Promise.all([
        getFirewallState(auth),
        getFirewallSets(auth),
        getFirewallMaps(auth),
        getFirewallTables(auth),
      ])
      setState(fwState)
      setSetsState(fwSets)
      setMapsState(fwMaps)
      setTablesState(fwTables)

      if (isPolicyAdvancedSection(activeSection) && activePolicyV2TableName) {
        const [items, objects] = await Promise.all([
          getFirewallRules(auth, { family: activePolicyV2Family, table: activePolicyV2TableName }),
          activePolicyV2Family === 'bridge'
            ? getFirewallObjects(auth, { family: activePolicyV2Family, table: activePolicyV2TableName })
            : Promise.resolve(null),
        ])
        setPolicyV2Rules(items)
        setPolicyV2Objects(objects)
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }, [
    auth,
    activeSection,
    activePolicyV2Family,
    activePolicyV2TableName,
    setError,
    setMapsState,
    setPolicyV2Objects,
    setPolicyV2Rules,
    setSetsState,
    setState,
    setTablesState,
  ])

  const refreshCollections = React.useCallback(async () => {
    setError(null)
    try {
      const [fwSets, fwMaps] = await Promise.all([
        getFirewallSets(auth),
        getFirewallMaps(auth),
      ])
      setSetsState(fwSets)
      setMapsState(fwMaps)
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }, [auth, setError, setMapsState, setSetsState])

  React.useEffect(() => {
    void refresh()
  }, [refresh, refreshNonce])

  React.useEffect(() => {
    void (async () => {
      try {
        setSchema(await getFirewallSchema(auth))
      } catch {
        // keep defaults if schema endpoint is unavailable
      }
    })()
  }, [auth, refreshNonce, setSchema])

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh()
    }, 3000)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  React.useEffect(() => {
    const timer = window.setInterval(() => setCollectionsNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [setCollectionsNowSec])

  return { refresh, refreshCollections }
}
