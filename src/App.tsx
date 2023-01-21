import 'bootstrap/dist/css/bootstrap.min.css'
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import SimplePeer from 'simple-peer/simplepeer.min.js'
import QRCode from 'react-qr-code'
import { useStore } from './useStore'
import { peerStore } from './store'
import { PeerExchange } from './PeerExchange'
import { useLog, writeLog } from './log'

function App() {
  const peer = useStore(peerStore)
  let contents: ReactNode
  if (peer) {
    contents = <div>Connected</div>
  } else {
    contents = <Connect />
  }
  return (
    <div className="p-3">
      {contents}
      <div className="mt-4 text-muted">
        <LogViewer />
      </div>
    </div>
  )
}

let consumedConnectKey: string | null = null
function consumeConnectKey() {
  if (consumedConnectKey) {
    return consumedConnectKey
  }
  const m = location.hash.match(/^#connect=([^&]+)/)
  if (m) {
    consumedConnectKey = m[1]
    history.replaceState(null, '', '#')
  }
  return consumedConnectKey
}

function Connect() {
  const [connectKey, setConnectKey] = useState<string | null>(
    consumeConnectKey(),
  )
  const navItem = (
    contents: ReactNode,
    active: boolean,
    onClick: () => void,
  ) => (
    <li className="nav-item">
      <button
        className={`nav-link ${active ? 'active' : ''}`}
        onClick={onClick}
      >
        {contents}
      </button>
    </li>
  )
  const handleConnectKey = (text: string) => {
    const m = text.match(/#connect=([^&]+)/)
    if (m) {
      setConnectKey(m[1])
    } else {
      writeLog('Invalid connect key received')
    }
  }
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
    handleConnectKey(raw)
  }
  document.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text')
    if (text) {
      handleConnectKey(text)
    }
  })
  const onConnect = (peer: SimplePeer.Instance) => {
    peerStore.state = peer
  }
  return (
    <div className="card">
      <div className="card-header">
        <ul className="nav nav-tabs card-header-tabs">
          {navItem('My QR code', !connectKey, () => setConnectKey(null))}
          {navItem('Scan', !!connectKey, () => scan())}
        </ul>
      </div>
      <div className="card-body">
        {connectKey ? (
          <ConnectMode connectKey={connectKey} onConnect={onConnect} />
        ) : (
          <ListenMode onConnect={onConnect} />
        )}
      </div>
    </div>
  )
}

function LogViewer() {
  const data = useLog()
  return <pre className="small mb-0">{data}</pre>
}

function useLatest<T>(value: T): () => T {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return useCallback(() => ref.current, [])
}

function ListenMode(props: { onConnect: (peer: SimplePeer.Instance) => void }) {
  const [connectKey, setConnectKey] = useState<string | null>(null)
  const getOnConnect = useLatest(props.onConnect)
  const connectUrl = useMemo(() => {
    if (!connectKey) {
      return null
    }
    const url = new URL(location.href)
    url.hash = `#connect=${connectKey}`
    return url.toString()
  }, [connectKey])
  useEffect(() => {
    const exchange = new PeerExchange({
      log: writeLog.child('PeerExchange'),
    })
    setConnectKey(exchange.connectKey)
    exchange.peerPromise.then((peer) => getOnConnect()(peer))
    return () => {
      exchange.dispose()
    }
  }, [getOnConnect])
  const copyConnectKey = () => {
    navigator.clipboard.writeText(connectUrl!)
  }
  const connectInNewWindow = () => {
    window.open(connectUrl!, '_blank')
  }
  return (
    <div className="text-center">
      {connectUrl ? (
        <div className="d-flex flex-column gap-2 align-items-center">
          <div className="bg-white p-2 rounded">
            <QRCode value={connectUrl} />
          </div>
          <div className="d-flex gap-2 align-items-center">
            <button
              onClick={copyConnectKey}
              className="btn btn-outline-secondary"
            >
              Copy connection key
            </button>
            <button
              onClick={connectInNewWindow}
              className="btn btn-outline-secondary"
            >
              Test connection
            </button>
          </div>
        </div>
      ) : (
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      )}
    </div>
  )
}

function ConnectMode(props: {
  connectKey: string
  onConnect: (peer: SimplePeer.Instance) => void
}) {
  const getOnConnect = useLatest(props.onConnect)
  useEffect(() => {
    const exchange = new PeerExchange({
      connectKey: props.connectKey,
      log: writeLog.child('PeerExchange'),
    })
    exchange.peerPromise.then((peer) => getOnConnect()(peer))
    return () => {
      exchange.dispose()
    }
  }, [props.connectKey, getOnConnect])
  return <>{props.connectKey}</>
}

export default App
