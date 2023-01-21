import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './App.css'
import { randomRoom, roomStore } from './store'
import { useStore } from './useStore'
import dockerNames from 'docker-names'
import * as hex from '@stablelib/hex'
import * as sha256 from '@stablelib/sha256'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { getRoom } from './sync'
import { Icon } from '@iconify-icon/react'
import Door from '@iconify/icons-material-symbols/door-open-outline-sharp'
import Person from '@iconify/icons-material-symbols/person-outline'
import QR from '@iconify/icons-material-symbols/qr-code-2-rounded'
import Clipboard from '@iconify/icons-material-symbols/content-copy-outline-rounded'
import Paste from '@iconify/icons-mdi/content-paste'
import Exit from '@iconify/icons-material-symbols/exit-to-app-sharp'
import Hidden from '@iconify/icons-mdi/eye-off'
import Visible from '@iconify/icons-mdi/eye'
import Checkmark from '@iconify/icons-mdi/check'
import clsx from 'clsx'
import { myId } from './self'

function App() {
  const roomId = useStore(roomStore)
  return (
    <div className="p-3">
      <Room roomId={roomId} key={roomId} />
      <RoomOptions
        roomId={roomId}
        onChangeRoom={(id) => (roomStore.state = id)}
      />
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

interface State {
  text: string
  updatedBy: string
  updatedAt: string
}

function Room(props: { roomId: string }) {
  const room = getRoom(props.roomId)
  const onlineCount = useStore(room.onlineCount)
  const [state, setState] = useState(
    room.doc.getMap<State>('state').get('value'),
  )
  useEffect(() => {
    Object.assign(window, { room })
    return room.sync()
  }, [room])
  useEffect(() => {
    const onChange = () =>
      setState(room.doc.getMap<State>('state').get('value'))
    room.doc.on('update', onChange)
    return () => room.doc.off('update', onChange)
  }, [room.doc])

  const updateState = (text: string) => {
    room.doc.getMap<State>('state').set('value', {
      text,
      updatedBy: myId,
      updatedAt: new Date().toISOString(),
    })
  }
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      updateState(text)
    } catch (error) {
      console.error(error)
      alert(`Unable to paste: ${error}`)
    }
  }
  const scan = async () => {
    const raw = await scanQrCode()
    updateState(raw)
  }
  return (
    <>
      <div className="card">
        <button
          type="button"
          className="border-top-0 border-start-0 border-end-0 card-header d-flex gap-2 align-items-center justify-content-center"
          data-bs-toggle="modal"
          data-bs-target="#roomModal"
        >
          <div className="d-flex gap-1 align-items-center">
            <Icon icon={Door} />
            <strong>{roomNickname(props.roomId)}</strong>
          </div>
          <div
            className={clsx(
              'd-flex gap-1 align-items-center',
              onlineCount < 2 ? 'text-muted' : 'text-success',
            )}
          >
            <Icon icon={Person} />
            <span>{onlineCount}</span>
          </div>
        </button>
        <div className="card-body">
          {state ? (
            <StateViewer state={state} />
          ) : (
            <em className="text-muted">(nothing has been shared yet)</em>
          )}
        </div>
        <div className="card-footer d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-primary d-inline-flex gap-1 align-items-center"
            onClick={paste}
          >
            <Icon icon={Paste} />
            Paste
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary d-inline-flex gap-1 align-items-center"
            onClick={scan}
          >
            <Icon icon={QR} />
            Scan
          </button>
        </div>
      </div>
    </>
  )
}

const mask = (text: string) => text.replace(/[^]/g, '•')

function StateViewer(props: { state: State }) {
  const { state } = props
  const bytes = useMemo(() => {
    return new TextEncoder().encode(state.text)
  }, [state.text])
  const hash = useMemo(() => {
    return hex.encode(sha256.hash(bytes), true)
  }, [bytes])
  const multiline = state.text.split('\n').length > 1
  const [hidden, setHidden] = useState(true)
  const hue = parseInt(hash.slice(0, 6), 16) % 360
  const color = `hsl(${hue}, 80%, 80%)`
  return (
    <div className="d-flex gap-2 flex-column">
      <div className="d-flex gap-2">
        <button
          className="btn btn-outline-secondary d-inline-flex align-items-center"
          title={hidden ? 'Show contents' : 'Hide contents'}
          type="button"
          onClick={() => setHidden(!hidden)}
        >
          {hidden ? <Icon icon={Visible} /> : <Icon icon={Hidden} />}
        </button>
        <Acknowledger>
          {(ok, acknowledge) => (
            <button
              className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
              title="Copy"
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(state.text).then(acknowledge)
              }
            >
              <Icon icon={ok ? Checkmark : Clipboard} />
              Copy
            </button>
          )}
        </Acknowledger>
        {multiline ? null : (
          <input
            type={hidden ? 'password' : 'text'}
            className="form-control font-monospace"
            readOnly
            value={hidden ? mask(state.text) : state.text}
            style={{ color, borderColor: color }}
          />
        )}
      </div>
      <div>
        <small className="text-muted">
          from {state.updatedBy === myId ? 'you' : 'another device'}, last
          updated {new Date(state.updatedAt).toLocaleString()}
        </small>
      </div>
      {!multiline ? null : (
        <textarea
          className="form-control font-monospace small"
          readOnly
          value={hidden ? mask(state.text) : state.text}
          style={{ borderColor: color, color }}
        />
      )}
    </div>
  )
}

function RoomOptions(props: {
  roomId: string
  onChangeRoom: (roomId: string) => void
}) {
  const scan = async () => {
    const raw = await scanQrCode()
    const m = raw.match(/#room=([a-f0-9]+)/)
    if (m) {
      props.onChangeRoom(m[1])
      document.querySelector<HTMLButtonElement>('#closeRoomModal')?.click()
    } else {
      alert('Invalid QR code')
    }
  }
  const leave = async () => {
    props.onChangeRoom(randomRoom())
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
              This little app lets you securely share text with other devices.
              All data is end-to-end encrypted.
            </p>
            <p>
              Your current room is{' '}
              <strong>{roomNickname(props.roomId, true)}</strong>. Other peers
              can join your room by scanning this QR code.
            </p>
            <RoomQRCode roomId={props.roomId} />
          </div>
          <div className="modal-footer d-flex gap-2">
            <div className="d-flex flex-fill gap-2">
              <button
                type="button"
                className="btn btn-secondary d-inline-flex align-items-center gap-1"
                onClick={scan}
              >
                <Icon icon={QR} />
                Scan
              </button>
              <button
                type="button"
                className="btn btn-outline-danger d-inline-flex align-items-center gap-1"
                onClick={leave}
              >
                <Icon icon={Exit} />
                Leave
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

async function scanQrCode() {
  return await new Promise<string>((resolve) => {
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
}

function RoomQRCode(props: { roomId: string }) {
  const { roomId } = props
  const connectUrl = useMemo(() => {
    const url = new URL(location.href)
    url.hash = `#room=${roomId}`
    return url.toString()
  }, [roomId])
  const copy = async () => {
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
          <Acknowledger>
            {(ok, acknowledge) => (
              <button
                onClick={() => copy().then(acknowledge)}
                className="btn btn-sm btn-outline-secondary d-inline-flex gap-1 align-items-center"
              >
                <Icon icon={ok ? Checkmark : Clipboard} />
                Copy URL
              </button>
            )}
          </Acknowledger>
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

function Acknowledger(props: {
  children: (ok: boolean, acknowledge: () => void) => ReactNode
}) {
  const [ok, setOk] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => {
      setOk(0)
    }, 1000)
    return () => clearTimeout(id)
  }, [ok])
  return <>{props.children(!!ok, () => setOk(Date.now()))}</>
}

export default App
