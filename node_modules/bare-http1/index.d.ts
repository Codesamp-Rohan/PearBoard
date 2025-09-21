import { Readable, ReadableEvents, Writable, WritableEvents } from 'bare-stream'
import {
  TCPSocket,
  TCPSocketOptions,
  TCPSocketConnectOptions,
  TCPServer,
  TCPServerEvents
} from 'bare-tcp'
import Buffer from 'bare-buffer'
import URL from 'bare-url'
import constants, {
  HTTPMethod,
  HTTPStatusCode,
  HTTPStatusMessage
} from './lib/constants'
import HTTPError from './lib/errors'

export {
  constants,
  type HTTPMethod,
  type HTTPStatusCode,
  type HTTPStatusMessage,
  type HTTPError,
  HTTPError as errors
}

export const STATUS_CODES: typeof constants.status

export interface HTTPIncomingMessageEvents extends ReadableEvents {
  timeout: []
}

export interface HTTPIncomingMessageOptions {
  method?: HTTPMethod
  url?: URL | string
  statusCode?: HTTPStatusCode
  statusMessage?: HTTPStatusMessage
}

export interface HTTPIncomingMessage<
  M extends HTTPIncomingMessageEvents = HTTPIncomingMessageEvents
> extends Readable<M> {
  readonly socket: TCPSocket
  readonly headers: Record<string, string | number>
  readonly upgrade: boolean

  readonly method: HTTPMethod
  readonly url: URL | string

  readonly statusCode: HTTPStatusCode
  readonly statusMessage: HTTPStatusMessage

  readonly httpVersion: '1.1'

  getHeader(name: string): string | number | undefined
  getHeaders(): Record<string, string | number>
  hasHeader(name: string): boolean

  setTimeout(ms: number, ontimeout?: () => void): this
}

export class HTTPIncomingMessage {
  constructor(
    socket?: TCPSocket,
    headers?: Record<string, string | number>,
    opts?: HTTPIncomingMessageOptions
  )
}

export { HTTPIncomingMessage as IncomingMessage }

export interface HTTPOutgoingMessageEvents extends WritableEvents {
  timeout: []
}

export interface HTTPOutgoingMessage<
  M extends HTTPOutgoingMessageEvents = HTTPOutgoingMessageEvents
> extends Writable<M> {
  readonly socket: TCPSocket
  readonly headers: Record<string, string | number>
  readonly headersSent: boolean
  readonly upgrade: boolean

  getHeader(name: string): string | number | undefined
  getHeaders(): Record<string, string | number>
  hasHeader(name: string): boolean
  setHeader(name: string, value: string | number): void
  flushHeaders(): void

  setTimeout(ms: number, ontimeout?: () => void): this
}

export class HTTPOutgoingMessage {
  constructor(socket?: TCPSocket)
}

export { HTTPOutgoingMessage as OutgoingMessage }

export interface HTTPAgentOptions {
  keepAlive?: boolean
  keepAliveMsecs?: number
}

export interface HTTPAgent {
  createConnection(opts?: TCPSocketOptions & TCPSocketConnectOptions): TCPSocket

  reuseSocket(socket: TCPSocket, req?: HTTPClientRequest): void

  keepSocketAlive(socket: TCPSocket): boolean

  getName(opts: { host: string; port: number }): string

  addRequest(
    req: HTTPClientRequest,
    opts: TCPSocketOptions & TCPSocketConnectOptions
  ): void

  destroy(): void
}

export class HTTPAgent {
  constructor(
    opts?: HTTPAgentOptions & TCPSocketOptions & TCPSocketConnectOptions
  )

  static global: HTTPAgent
}

export const globalAgent: HTTPAgent

export { HTTPAgent as Agent }

export interface HTTPServerEvents extends TCPServerEvents {
  request: [req: HTTPIncomingMessage, res: HTTPServerResponse]
  upgrade: [req: HTTPIncomingMessage, socket: TCPSocket, head: Buffer]
  timeout: [socket: TCPSocket]
}

export interface HTTPServer<M extends HTTPServerEvents = HTTPServerEvents>
  extends TCPServer<M> {
  readonly timeout: number | undefined

  setTimeout(ms: number, ontimeout?: () => void): this
}

export class HTTPServer {
  constructor(
    opts?: HTTPServerConnectionOptions,
    onrequest?: (req: HTTPIncomingMessage, res: HTTPServerResponse) => void
  )

  constructor(
    onrequest: (req: HTTPIncomingMessage, res: HTTPServerResponse) => void
  )
}

export { HTTPServer as Server }

export interface HTTPServerResponse extends HTTPOutgoingMessage {
  readonly req: HTTPIncomingMessage
  readonly statusCode: HTTPStatusCode
  readonly statusMessage: HTTPStatusMessage | null

  writeHead(
    statusCode: HTTPStatusCode,
    statusMessage?: HTTPStatusMessage,
    headers?: Record<string, string | number>
  ): void

  writeHead(
    statusCode: HTTPStatusCode,
    headers?: Record<string, string | number>
  ): void
}

export class HTTPServerResponse {
  constructor(socket: TCPSocket, req: HTTPIncomingMessage, close: boolean)
}

export { HTTPServerResponse as ServerResponse }

export interface HTTPServerConnectionOptions {
  IncomingMessage?: typeof HTTPIncomingMessage
  ServerResponse?: typeof HTTPServerResponse
}

export interface HTTPServerConnection {
  readonly server: HTTPServer
  readonly socket: TCPSocket

  readonly req: HTTPIncomingMessage | null
  readonly res: HTTPServerResponse | null

  readonly idle: boolean
}

export class HTTPServerConnection {
  constructor(
    server: HTTPServer,
    socket: TCPSocket,
    opts?: HTTPServerConnectionOptions
  )

  static for(socket: TCPSocket): HTTPServerConnection
}

export { HTTPServerConnection as ServerConnection }

export interface HTTPClientRequestEvents extends HTTPOutgoingMessageEvents {
  response: [res: HTTPIncomingMessage]
  upgrade: [res: HTTPIncomingMessage, socket: TCPSocket, head: Buffer]
}

export interface HTTPClientRequestOptions extends TCPSocketConnectOptions {
  agent?: HTTPAgent | false
  headers?: Record<string, string | number>
  method?: HTTPMethod
  path?: string
}

export interface HTTPClientRequest<
  M extends HTTPClientRequestEvents = HTTPClientRequestEvents
> extends HTTPOutgoingMessage<M> {
  readonly method: HTTPMethod
  readonly path: string
  readonly headers: Record<string, string | number>
}

export class HTTPClientRequest {
  constructor(opts?: HTTPClientRequestOptions, onresponse?: () => void)

  constructor(onresponse: () => void)
}

export { HTTPClientRequest as ClientRequest }

export interface HTTPClientConnectionOptions {
  IncomingMessage?: typeof HTTPIncomingMessage
}

export interface HTTPClientConnection {
  readonly socket: TCPSocket

  readonly req: HTTPClientRequest | null
  readonly res: HTTPIncomingMessage | null

  readonly idle: boolean
}

export class HTTPClientConnection {
  constructor(socket: TCPSocket, opts?: HTTPClientConnectionOptions)

  static for(socket: TCPSocket): HTTPClientConnection | null

  static from(
    socket: TCPSocket,
    opts?: HTTPClientConnectionOptions
  ): HTTPClientConnection
}

export { HTTPClientConnection as ClientConnection }

export function createServer(
  opts?: HTTPServerConnectionOptions,
  onrequest?: (req: HTTPIncomingMessage, res: HTTPServerResponse) => void
): HTTPServer

export function createServer(
  onrequest: (req: HTTPIncomingMessage, res: HTTPServerResponse) => void
): HTTPServer

export function request(
  url: URL | string,
  opts?: HTTPClientRequestOptions,
  onresponse?: (res: HTTPIncomingMessage) => void
): HTTPClientRequest

export function request(
  url: URL | string,
  onresponse: (res: HTTPIncomingMessage) => void
): HTTPClientRequest

export function request(
  opts: HTTPClientRequestOptions,
  onresponse?: (res: HTTPIncomingMessage) => void
): HTTPClientRequest
