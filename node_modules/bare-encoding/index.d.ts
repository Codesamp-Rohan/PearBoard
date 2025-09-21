import Buffer from 'bare-buffer'

export interface TextEncoder {
  readonly encoding: 'utf-8'

  encode(input: string): Buffer
  encodeInto(
    input: string,
    destination: ArrayBufferView | ArrayBuffer | SharedArrayBuffer
  ): { read: number; written: number }
}

export class TextEncoder {}

export interface TextDecoder {
  readonly encoding: 'utf-8'

  decode(
    input: ArrayBufferView | ArrayBuffer | SharedArrayBuffer,
    options?: { stream: boolean }
  ): string
}

export class TextDecoder {
  constructor(label?: string)
}
