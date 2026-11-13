// Which problems are finished, per module. Saved on the device (AsyncStorage on iOS and Android,
// local storage on the web), so it is there the next time the app opens.
//
// One shared list per module: the home screen stays mounted while a module is open, so when the
// module records a finished problem the home screen's card has to hear about it too.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useSyncExternalStore } from 'react'

const key = (moduleId: string) => `chem-review:progress:${moduleId}`
const EMPTY: string[] = []

const lists = new Map<string, string[]>()
const loading = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function publish(moduleId: string, ids: string[]) {
  lists.set(moduleId, ids)
  for (const fn of listeners) fn()
}

function load(moduleId: string): Promise<void> {
  let job = loading.get(moduleId)
  if (!job) {
    job = AsyncStorage.getItem(key(moduleId))
      .then((raw) => {
        const list: unknown = raw ? JSON.parse(raw) : []
        const saved = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
        // anything recorded while the saved list was loading is kept
        publish(moduleId, [...new Set([...saved, ...(lists.get(moduleId) ?? [])])])
      })
      .catch(() => publish(moduleId, lists.get(moduleId) ?? []))
    loading.set(moduleId, job)
  }
  return job
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Finished problem ids for one module, and a way to record more. `ready` is false until the saved list has loaded. */
export function useProgress(moduleId: string): { ids: string[]; ready: boolean; record: (ids: string[]) => void } {
  const ids = useSyncExternalStore(
    subscribe,
    () => lists.get(moduleId),
    () => undefined,
  )

  useEffect(() => {
    void load(moduleId)
  }, [moduleId])

  const record = useCallback(
    (more: string[]) => {
      const have = lists.get(moduleId) ?? []
      const merged = [...new Set([...have, ...more])]
      if (merged.length === have.length) return
      publish(moduleId, merged)
      void AsyncStorage.setItem(key(moduleId), JSON.stringify(merged)).catch(() => {})
    },
    [moduleId],
  )

  return { ids: ids ?? EMPTY, ready: ids !== undefined, record }
}
