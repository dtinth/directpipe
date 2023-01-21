import SimplePeer from 'simple-peer/simplepeer.min.js'
import {
  createClient,
  RealtimeChannel,
  SupabaseClient,
} from '@supabase/supabase-js'
import nacl from 'tweetnacl'
import * as hex from '@stablelib/hex'
import * as sha256 from '@stablelib/sha256'
import * as base64 from '@stablelib/base64'
import dockerNames from 'docker-names'
import pDefer from 'p-defer'

const supabasePublicAnonApiKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cnFoanJtbXFycWFjY2NoeW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTkxOTk3NDIsImV4cCI6MTk3NDc3NTc0Mn0.VEdURpInV9dowpoMkHopAzpiBtNnRXDgO6hRfy1ZSHY'
const supabaseProjectUrl = 'https://htrqhjrmmqrqaccchyne.supabase.co'

interface SupabasePresenceData {
  peerId: string
  peerNickname: string
}

export interface PeerExchangeOptions {
  log?: (text: string) => void
  connectKey?: string
}

export class PeerExchange {
  private client: SupabaseClient
  private channelId: string
  private key: Uint8Array
  private channel: RealtimeChannel
  public connectKey: string
  private log: (text: string) => void
  public peerNickname = dockerNames.getRandomName()
  public peerId = crypto.randomUUID()
  private peerDefer = pDefer<SimplePeer.Instance>()
  public peerPromise = this.peerDefer.promise
  private currentConnectionRequest?: {
    anotherPeerId: string
    peer: SimplePeer.Instance
  }

  constructor(options: PeerExchangeOptions = {}) {
    this.log = options.log || (() => {})
    const initiator = !!options.connectKey
    this.connectKey =
      options.connectKey ||
      hex.encode(nacl.randomBytes(nacl.secretbox.keyLength))
    this.key = hex.decode(this.connectKey)
    this.channelId = hex.encode(
      sha256.hash(new TextEncoder().encode(this.connectKey)),
    )
    this.client = createClient(supabaseProjectUrl, supabasePublicAnonApiKey)
    const channel = this.client.channel(this.channelId, {
      config: {
        presence: {
          key: this.peerId,
        },
      },
    })
    channel.subscribe(async (status) => {
      this.log(`Supabase subscription status "${status}"`)
      if (status === 'SUBSCRIBED') {
        const status = await channel.track({
          peerId: this.peerId,
          peerNickname: this.peerNickname,
        })
        this.log(`Supabase track status "${status}"`)
      }
    })
    // const handleSignal = (signal: any) => {
    //   this.log(`Supabase received signal "${signal.type}"`)
    //   console.log('[WebRTC] [<<]', signal)
    //   this.peer?.signal(signal)
    // }
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const peerIds = new Set<string>()
      for (const value of Object.values(state)) {
        for (const item of value) {
          const data = item as unknown as SupabasePresenceData
          peerIds.add(data.peerId)
        }
      }
      this.log(`Number of peers: ${peerIds.size}`)
      const anotherPeerId = [...peerIds].find((id) => id !== this.peerId)
      if (anotherPeerId && !this.currentConnectionRequest && initiator) {
        this.currentConnectionRequest = this.createConnectionRequest(
          anotherPeerId,
          true,
        )
        this.log(`Requesting connection...`)
      }
    })
    channel.on('broadcast', { event: 'signal' }, ({ payload: payloads }) => {
      console.log('!!!!', payloads)
      if (!Array.isArray(payloads)) return
      for (const payload of payloads) {
        if (!this.currentConnectionRequest && !initiator) {
          this.currentConnectionRequest = this.createConnectionRequest(
            payload.fromPeerId,
            false,
          )
        }
        if (this.currentConnectionRequest) {
          const { anotherPeerId, peer } = this.currentConnectionRequest
          if (anotherPeerId === payload.fromPeerId) {
            const encryptedSignal = base64.decodeURLSafe(
              payload.encryptedSignal,
            )
            const decryptedSignal = nacl.secretbox.open(
              encryptedSignal,
              base64.decodeURLSafe(payload.nonce),
              this.key,
            )
            if (!decryptedSignal) {
              this.log(`Failed to decrypt signal`)
              return
            }
            const signal = JSON.parse(new TextDecoder().decode(decryptedSignal))
            this.log(`Received signal "${signal.type}"`)
            console.log('[WebRTC] [<<]', signal)
            peer.signal(signal)
          }
        }
      }
    })
    this.channel = channel
  }

  private createConnectionRequest(anotherPeerId: string, initiator: boolean) {
    const peer = new SimplePeer({ initiator, trickle: true })
    peer.on('signal', (data) => {
      this.sendSignal(anotherPeerId, data)
    })
    peer.on('connect', () => {
      this.log(`Connected`)
      this.peerDefer.resolve(peer)
      this.currentConnectionRequest = undefined
    })
    peer.on('error', (e) => {
      this.log(`WebRTC failure: ${e}`)
    })
    return { anotherPeerId, peer }
  }

  private async sendSignal(toPeerId: string, signal: any) {
    console.log('[WebRTC] [>>]', signal)
    this.log(`Send signal "${signal.type}"`)
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
    const encryptedSignal = base64.encodeURLSafe(
      nacl.secretbox(
        new TextEncoder().encode(JSON.stringify(signal)),
        nonce,
        this.key,
      ),
    )
    await this.sendToChannel({
      fromPeerId: this.peerId,
      toPeerId: toPeerId,
      nonce: base64.encodeURLSafe(nonce),
      encryptedSignal,
    })
  }

  private sendBuffer?: {
    timeout: NodeJS.Timeout
    buffer: any[]
    promise: Promise<any>
  }
  private sendToChannel(payload: any) {
    if (this.sendBuffer) {
      this.sendBuffer.buffer.push(payload)
      return this.sendBuffer.promise
    } else {
      const defer = pDefer<any>()
      const sendBuffer = {
        timeout: setTimeout(() => {
          this.sendBuffer = undefined
          defer.resolve(
            this.channel
              .send({
                type: 'broadcast',
                event: 'signal',
                payload: sendBuffer.buffer,
              })
              .then((status) => {
                this.log(`Supabase send status "${status}"`)
                return status
              }),
          )
        }, 100),
        buffer: [payload],
        promise: defer.promise,
      }
      this.sendBuffer = sendBuffer
    }
  }

  dispose() {
    this.currentConnectionRequest?.peer.destroy()
    this.log = () => {}
    this.channel.socket.disconnect()
  }
}

// try {
//   // const nonce = base64.decodeURLSafe(data.nonce)
//   // const encryptedSignal = base64.decodeURLSafe(data.encryptedSignal)
//   // const signal = nacl.secretbox.open(
//   //   encryptedSignal,
//   //   nonce,
//   //   this.key,
//   // )
//   // if (signal) {
//   //   handleSignal(JSON.parse(new TextDecoder().decode(signal)))
//   // }
// } catch (e) {
//   console.error(e)
// }
// }
// } catch (e) {
// console.error(e)
// }
// }
