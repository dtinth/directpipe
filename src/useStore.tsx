import { useSyncExternalStore } from 'react'
import { SyncExternalStore } from 'sync-external-store'

export function useStore<T>(s: SyncExternalStore<T>) {
  return useSyncExternalStore(s.subscribe, s.getSnapshot)
}
