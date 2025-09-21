import { Readable } from 'bare-stream'
import Session from './session'

interface InspectorHeapSnapshot extends Readable {}

declare class InspectorHeapSnapshot {
  constructor(session: Session)
}

export = InspectorHeapSnapshot
