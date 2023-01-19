import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import './App.css'
import SimplePeer from 'simple-peer/simplepeer.min.js'
import QRCode from 'react-qr-code'

function App() {
  const [offer, setOffer] = useState(null as string | null)
  useEffect(() => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
    })

    peer.on('signal', data => {
      setOffer(JSON.stringify(data))
    })

    return () => {
      peer.destroy()
    }
  }, [])

  return (
    <div className="App">
      {offer && <QRCode value={offer} />}
    </div>
  )
}

export default App
