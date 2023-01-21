declare module 'simple-peer/simplepeer.min.js' {
  export * from 'simple-peer'
  import SimplePeer from 'simple-peer'
  export default SimplePeer
}

declare module 'docker-names' {
  class DockerNames {
    getRandomName(): string
    left: string[]
    right: string[]
  }
  var dockerNames: DockerNames
  export default dockerNames
}
