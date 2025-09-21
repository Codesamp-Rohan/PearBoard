import EventEmitter, { EventMap } from 'bare-events'
import { type TCPSocketAddress } from 'bare-tcp'
import URL from 'bare-url'

interface InspectorServerEvents extends EventMap {
  listening: []
}

interface InspectorServerOptions {
  path: URL | string
}

interface InspectorServer<
  M extends InspectorServerEvents = InspectorServerEvents
> extends EventEmitter<M> {
  readonly listening: boolean

  address(): TCPSocketAddress
  close(onclose?: (err: Error) => void): void

  ref(): void
  unref(): void
}

declare class InspectorServer {
  constructor(opts: InspectorServerOptions)
  constructor(port: number, opts: InspectorServerOptions)
  constructor(port: number, host: string, opts?: InspectorServerOptions)
}

declare namespace InspectorServer {
  export { type InspectorServerEvents, type InspectorServerOptions }
}

export = InspectorServer
