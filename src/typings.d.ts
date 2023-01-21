declare module 'simple-peer/simplepeer.min.js' {
  export * from 'simple-peer'
  import SimplePeer from 'simple-peer'
  export default SimplePeer
}

declare module 'docker-names' {
  export function getRandomName(): string
}
