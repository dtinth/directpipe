import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import memoize from 'lodash-es/memoize'
import * as hex from '@stablelib/hex'
import * as sha256 from '@stablelib/sha256'
import { SyncExternalStore } from 'sync-external-store'

class Room {
  doc: Y.Doc
  onlineCount = new SyncExternalStore(0)
  constructor(public roomId: string) {
    this.doc = new Y.Doc()
  }
  sync() {
    const key = hex.encode(sha256.hash(new TextEncoder().encode(this.roomId)))
    const provider = new WebrtcProvider(key, this.doc, {
      password: this.roomId,
    })
    provider.awareness.on('change', () => {
      this.onlineCount.state = provider.awareness.getStates().size
    })
    return () => {
      provider.destroy()
    }
  }
}

export const getRoom = memoize((roomId) => new Room(roomId))
