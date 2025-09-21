import EventEmitter, { EventMap } from 'bare-events'
import { Duplex, DuplexEvents } from 'bare-stream'
import {
  Pipe,
  PipeServer,
  createConnection as createPipeConnection,
  createServer as createPipeServer
} from 'bare-pipe'
import {
  TCPSocket,
  TCPServer,
  createConnection as createTCPConnection,
  createServer as createTCPServer,
  isIP,
  isIPv4,
  isIPv6
} from 'bare-tcp'
import constants from './lib/constants'

export { constants, isIP, isIPv4, isIPv6 }

export interface NetOptions {
  allowHalfOpen?: boolean
  readBufferSize?: number
}

export interface NetSocketEvents extends DuplexEvents {
  connect: []
}

interface NetSocket<M extends NetSocketEvents = NetSocketEvents>
  extends Duplex<M> {
  readonly connecting: boolean
  readonly pending: boolean

  connect: Pipe['connect'] & TCPSocket['connect']

  ref(): void
  unref(): void
}

declare class NetSocket {
  constructor(opts?: NetOptions)
}

export { type NetSocket, NetSocket as Socket }

export interface NetServerEvents extends EventMap {
  close: []
  connection: [socket: NetSocket]
  error: [err: Error]
  listening: []
}

interface NetServer<M extends NetServerEvents = NetServerEvents>
  extends EventEmitter<M> {
  readonly listening: boolean

  address(): (PipeServer['address'] & TCPServer['address']) | null

  listen: PipeServer['listen'] & TCPServer['listen']

  close(onclose: () => void): void

  ref(): void
  unref(): void
}

declare class NetServer {
  constructor(opts?: NetOptions, onconnection?: (socket: NetSocket) => void)
  constructor(onconnection: (socket: NetSocket) => void)
}

export { type NetServer, NetServer as Server }

export function createConnection(
  ...args: Parameters<typeof createPipeConnection & typeof createTCPConnection>
): NetSocket

export { createConnection as conntect }

export function createServer(
  ...args: Parameters<typeof createPipeServer & typeof createTCPServer>
): NetServer
