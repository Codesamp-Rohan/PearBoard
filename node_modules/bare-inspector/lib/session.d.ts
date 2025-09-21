import EventEmitter, { EventMap } from 'bare-events'

interface SessionMessage {
  method: string
  params: Record<string, unknown>
}

interface InspectorSessionEvents extends EventMap {
  inspectorNotification: [message: SessionMessage]
  [method: string]: [message: SessionMessage]
}

interface InspectorSession<
  M extends InspectorSessionEvents = InspectorSessionEvents
> extends EventEmitter<M> {
  readonly connected: boolean
  readonly destroyed: boolean

  connect(): void

  post<T extends unknown = unknown>(
    method: string,
    cb: (err: Error, result: T) => void
  ): Promise<T>

  post<T extends unknown = unknown>(
    method: string,
    params?: Record<string, unknown>,
    cb?: (err: Error, result: T) => void
  ): Promise<T>

  destroy(): void
}

declare class InspectorSession {
  constructor(onpaused?: () => boolean)
}

declare namespace InspectorSession {
  export { type SessionMessage, type InspectorSessionEvents }
}

export = InspectorSession
