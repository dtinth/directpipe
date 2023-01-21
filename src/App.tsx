import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './App.css'
import { useLog } from './log'
import { roomStore } from './store'
import { useStore } from './useStore'
import dockerNames from 'docker-names'
import * as hex from '@stablelib/hex'
import * as sha256 from '@stablelib/sha256'
import { useMemo } from 'react'
import QRCode from 'react-qr-code'

function App() {
  const roomId = useStore(roomStore)
  return (
    <div className="p-3">
      <Room roomId={roomId} key={roomId} />
      <RoomOptions
        roomId={roomId}
        onChangeRoom={(id) => (roomStore.state = id)}
      />
      <div className="mt-4 text-muted">
        <LogViewer />
      </div>
    </div>
  )
}

function roomNickname(id: string, withHash = false) {
  const hash = hex.encode(sha256.hash(new TextEncoder().encode(id)), true)
  const first = parseInt(hash.slice(0, 8), 16)
  const second = parseInt(hash.slice(8, 16), 16)
  return [
    dockerNames.left[first % dockerNames.left.length],
    dockerNames.right[second % dockerNames.right.length],
    ...(withHash ? [hash.slice(-8)] : []),
  ].join(' ')
}

function Room(props: { roomId: string }) {
  return (
    <>
      <div className="card">
        <button
          type="button"
          className="border-top-0 border-start-0 border-end-0 card-header"
          data-bs-toggle="modal"
          data-bs-target="#roomModal"
        >
          <strong>{roomNickname(props.roomId)}</strong>
        </button>
        <div className="card-body">whee</div>
      </div>
    </>
  )
}

function RoomOptions(props: {
  roomId: string
  onChangeRoom: (roomId: string) => void
}) {
  const scan = async () => {
    const raw = await new Promise<string>((resolve) => {
      const w = window.open(
        'https://qr.spacet.me/?action=scan&fit=cover&delay=100&post=opener',
        '_blank',
        'width=320,height=320,toolbar=no',
      )
      const onMessage = (e: MessageEvent) => {
        if (e.source === w && e.data.text) {
          resolve(e.data.text)
          w!.close()
          removeEventListener('message', onMessage)
        }
      }
      addEventListener('message', onMessage)
    })
    const m = raw.match(/#room=([a-f0-9]+)/)
    if (m) {
      props.onChangeRoom(m[1])
      document.querySelector<HTMLButtonElement>('#closeRoomModal')?.click()
    } else {
      alert('Invalid QR code')
    }
  }
  return (
    <div
      className="modal fade"
      id="roomModal"
      tabIndex={-1}
      aria-labelledby="roomModalLabel"
      aria-hidden="true"
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h1 className="modal-title fs-5" id="roomModalLabel">
              Room options
            </h1>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <p>
              Your current room is{' '}
              <strong>{roomNickname(props.roomId, true)}</strong>. Other peers
              can join your room by scanning this QR code
            </p>
            <RoomQRCode roomId={props.roomId} />
          </div>
          <div className="modal-footer d-flex">
            <div className="d-flex flex-fill">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={scan}
              >
                Scan QR code
              </button>
            </div>
            <div className="d-flex flex-fill justify-content-end">
              <button
                type="button"
                className="btn btn-primary"
                data-bs-dismiss="modal"
                id="closeRoomModal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoomQRCode(props: { roomId: string }) {
  const { roomId } = props
  const connectUrl = useMemo(() => {
    const url = new URL(location.href)
    url.hash = `#room=${roomId}`
    return url.toString()
  }, [roomId])
  const copy = () => {
    navigator.clipboard.writeText(connectUrl!)
  }
  const connectInNewWindow = () => {
    window.open(connectUrl!, '_blank')
  }
  return (
    <div className="text-center">
      <div className="d-flex flex-column gap-2 align-items-center">
        <div className="bg-white p-2 rounded">
          <QRCode value={connectUrl} />
        </div>
        <div className="d-flex gap-2 align-items-center">
          <button onClick={copy} className="btn btn-sm btn-outline-secondary">
            Copy URL
          </button>
          <button
            onClick={connectInNewWindow}
            className="btn btn-sm btn-outline-secondary"
          >
            Open in new window
          </button>
        </div>
      </div>
    </div>
  )
}

// function Connect() {
//   const [connectKey, setConnectKey] = useState<string | null>(
//     consumeConnectKey(),
//   )
//   const navItem = (
//     contents: ReactNode,
//     active: boolean,
//     onClick: () => void,
//   ) => (
//     <li className="nav-item">
//       <button
//         className={`nav-link ${active ? 'active' : ''}`}
//         onClick={onClick}
//       >
//         {contents}
//       </button>
//     </li>
//   )
//   const handleConnectKey = (text: string) => {
//     const m = text.match(/#connect=([^&]+)/)
//     if (m) {
//       setConnectKey(m[1])
//     } else {
//       writeLog('Invalid connect key received')
//     }
//   }
//   document.addEventListener('paste', (e) => {
//     const text = e.clipboardData?.getData('text')
//     if (text) {
//       handleConnectKey(text)
//     }
//   })
//   const onConnect = (peer: SimplePeer.Instance) => {
//     peerStore.state = peer
//   }
//   return (
//     <div className="card">
//       <div className="card-header">
//         <ul className="nav nav-tabs card-header-tabs">
//           {navItem('My QR code', !connectKey, () => setConnectKey(null))}
//           {navItem('Scan', !!connectKey, () => scan())}
//         </ul>
//       </div>
//       <div className="card-body">
//         {connectKey ? (
//           <ConnectMode connectKey={connectKey} onConnect={onConnect} />
//         ) : (
//           <ListenMode onConnect={onConnect} />
//         )}
//       </div>
//     </div>
//   )
// }

function LogViewer() {
  const data = useLog()
  return <pre className="small mb-0">{data}</pre>
}

// function useLatest<T>(value: T): () => T {
//   const ref = useRef(value)
//   useEffect(() => {
//     ref.current = value
//   }, [value])
//   return useCallback(() => ref.current, [])
// }

// function ListenMode(props: { onConnect: (peer: SimplePeer.Instance) => void }) {
// }

// function ConnectMode(props: {
//   connectKey: string
//   onConnect: (peer: SimplePeer.Instance) => void
// }) {
//   const getOnConnect = useLatest(props.onConnect)
//   useEffect(() => {
//     const exchange = new PeerExchange({
//       connectKey: props.connectKey,
//       log: writeLog.child('PeerExchange'),
//     })
//     exchange.peerPromise.then((peer) => getOnConnect()(peer))
//     return () => {
//       exchange.dispose()
//     }
//   }, [props.connectKey, getOnConnect])
//   return <>{props.connectKey}</>
// }

export default App
