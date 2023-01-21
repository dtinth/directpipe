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
import { getRandomName } from 'docker-names'

const supabasePublicAnonApiKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cnFoanJtbXFycWFjY2NoeW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTkxOTk3NDIsImV4cCI6MTk3NDc3NTc0Mn0.VEdURpInV9dowpoMkHopAzpiBtNnRXDgO6hRfy1ZSHY'
const supabaseProjectUrl = 'https://htrqhjrmmqrqaccchyne.supabase.co'

interface SupabasePresenceData {
  peerId: string
}

export interface PeerExchangeOptions {
  log?: (text: string) => void
  connectKey?: string
}

export class PeerExchange {
  private peer?: SimplePeer.Instance
  private client: SupabaseClient
  private signalPromise: Promise<string>
  private channelId: string
  private nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  private key: Uint8Array
  public peerPromise: Promise<SimplePeer.Instance>
  public connectKey: string
  private channel: RealtimeChannel
  private log: (text: string) => void

  constructor(options: PeerExchangeOptions = {}) {
    this.log = options.log || (() => {})
    const initiator = !options.connectKey
    let waitingFor: 'offer' | 'answer' | null = initiator ? 'answer' : 'offer'
    this.connectKey =
      options.connectKey ||
      hex.encode(nacl.randomBytes(nacl.secretbox.keyLength))
    this.key = hex.decode(this.connectKey)
    this.channelId = hex.encode(
      sha256.hash(new TextEncoder().encode(this.connectKey)),
    )

    this.peer = new SimplePeer({
      initiator,
      trickle: false,
    })
    this.client = createClient(supabaseProjectUrl, supabasePublicAnonApiKey)
    this.signalPromise = new Promise((resolve) => {
      this.peer!.on('signal', (data) => {
        this.log(`Peer signaled type "${data.type}"`)
        console.log('[WebRTC] [>>]', data)
        resolve(JSON.stringify(data))
      })
    })
    this.peerPromise = new Promise((resolve) => {
      this.peer!.on('connect', () => {
        if (this.peer) {
          this.log(`Peer connected`)
          resolve(this.peer)
          this.peer = undefined
          this.dispose()
        }
      })
    })
    this.peer.on('error', (error) => {
      if (this.peer) {
        this.log(`Peer error "${error}"`)
      }
    })

    const channel = this.client.channel(this.channelId)
    channel.subscribe(async (status) => {
      this.log(`Supabase subscription status "${status}"`)
      if (status === 'SUBSCRIBED') {
        const signal = await this.signalPromise
        const encryptedSignal = base64.encodeURLSafe(
          nacl.secretbox(
            new TextEncoder().encode(signal),
            this.nonce,
            this.key,
          ),
        )
        const status = await channel.track({
          nonce: base64.encodeURLSafe(this.nonce),
          encryptedSignal,
        })
        this.log(`Supabase presence status "${status}"`)
      }
    })
    const handleSignal = (signal: any) => {
      this.log(`Supabase received signal "${signal.type}"`)
      if (signal.type !== waitingFor) return
      console.log('[WebRTC] [<<]', signal)
      waitingFor = null
      this.peer?.signal(signal)
    }
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      for (const value of Object.values(state)) {
        try {
          for (const item of value) {
            try {
              const data = item as unknown as SupabasePresenceData
              const nonce = base64.decodeURLSafe(data.nonce)
              const encryptedSignal = base64.decodeURLSafe(data.encryptedSignal)
              const signal = nacl.secretbox.open(
                encryptedSignal,
                nonce,
                this.key,
              )
              if (signal) {
                handleSignal(JSON.parse(new TextDecoder().decode(signal)))
              }
            } catch (e) {
              console.error(e)
            }
          }
        } catch (e) {
          console.error(e)
        }
      }
    })
    this.channel = channel
  }

  dispose() {
    this.peer?.destroy()
    this.peer = undefined
    this.channel.socket.disconnect()
  }
}
