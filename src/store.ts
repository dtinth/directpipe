import { SyncExternalStore } from 'sync-external-store'

function getInitialRoom() {
  const m = location.hash.match(/^#room=([^&]+)/)
  if (m) {
    history.replaceState(null, '', '#')
    return m[1]
  }
  if (sessionStorage['room']) {
    return sessionStorage['room']
  }
  return (crypto.randomUUID() + crypto.randomUUID()).split('-').join('')
}

export const roomStore = new SyncExternalStore<string>(getInitialRoom())
sessionStorage['room'] = roomStore.state
