import * as React from 'react'
import type { AuthState, FirewallMapsState, FirewallNamedObjects, FirewallRule, FirewallSchema, FirewallSetsState, FirewallState, FirewallTablesState } from '../api'
import { getFirewallMaps, getFirewallObjects, getFirewallRules, getFirewallSchema, getFirewallSets, getFirewallState, getFirewallTables } from '../api'

type FirewallSectionTab = 'policy' | 'collections' | 'objects' | 'table_builder'
type TableFamily = 'inet' | 'ip' | 'ip6' | 'bridge' | 'netdev'

type Params = {
  auth: AuthState
  refreshNonce: number
  activeSection: FirewallSectionTab
  activeRuleTableFamily: TableFamily
  activeRuleTableName: string
  activeObjectTableFamily: TableFamily
  activeObjectTableName: string
  setState: React.Dispatch<React.SetStateAction<FirewallState | null>>
  setSetsState: React.Dispatch<React.SetStateAction<FirewallSetsState>>
  setMapsState: React.Dispatch<React.SetStateAction<FirewallMapsState>>
  setTablesState: React.Dispatch<React.SetStateAction<FirewallTablesState>>
  setObjectRules: React.Dispatch<React.SetStateAction<FirewallRule[]>>
  setFirewallObjects: React.Dispatch<React.SetStateAction<FirewallNamedObjects | null>>
  setSchema: React.Dispatch<React.SetStateAction<FirewallSchema | null>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setCollectionsNowSec: React.Dispatch<React.SetStateAction<number>>
}

export function useFirewallDataSync(params: Params) {
  const {
    auth,
    refreshNonce,
    activeSection,
    activeRuleTableFamily,
    activeRuleTableName,
    activeObjectTableFamily,
    activeObjectTableName,
    setState,
    setSetsState,
    setMapsState,
    setTablesState,
    setObjectRules,
    setFirewallObjects,
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

      if (activeSection === 'objects' && activeObjectTableName) {
        const [items, objects] = await Promise.all([
          activeObjectTableFamily !== 'netdev' ? getFirewallRules(auth, { family: activeObjectTableFamily, table: activeObjectTableName }) : Promise.resolve([]),
          getFirewallObjects(auth, { family: activeObjectTableFamily, table: activeObjectTableName }),
        ])
        setObjectRules(items)
        setFirewallObjects(objects)
      } else if (activeSection === 'policy' && activeRuleTableFamily !== 'netdev' && activeRuleTableName) {
        const [items, objects] = await Promise.all([
          getFirewallRules(auth, { family: activeRuleTableFamily, table: activeRuleTableName }),
          getFirewallObjects(auth, { family: activeRuleTableFamily, table: activeRuleTableName }),
        ])
        setObjectRules(items)
        setFirewallObjects(objects)
      } else if (activeSection === 'policy' && activeRuleTableFamily === 'netdev') {
        setObjectRules([])
        setFirewallObjects(null)
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc))
    }
  }, [
    auth,
    activeSection,
    activeObjectTableFamily,
    activeObjectTableName,
    activeRuleTableFamily,
    activeRuleTableName,
    setError,
    setMapsState,
    setFirewallObjects,
    setObjectRules,
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
