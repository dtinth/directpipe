import SimplePeer from 'simple-peer/simplepeer.min.js'
import { SyncExternalStore } from 'sync-external-store'

export const peerStore = new SyncExternalStore<SimplePeer.Instance | null>(null)
