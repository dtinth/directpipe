import { SyncExternalStore } from 'sync-external-store'
import { useStore } from './useStore'

const logStore = new SyncExternalStore<string[]>([
  '...',
  '...',
  '...',
  '...',
  '...',
])

export function writeLog(text: string) {
  const hms = new Date(Date.now() + new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(11, 19)
  logStore.state = [...logStore.state.slice(-4), `[${hms}] ${text}`]
}

export namespace writeLog {
  export function child(name: string) {
    return (text: string) => writeLog(`[${name}] ${text}`)
  }
}

export function useLog() {
  return useStore(logStore).join('\n')
}
