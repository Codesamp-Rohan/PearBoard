import * as encoding from '.'

type TextEncoderConstructor = typeof encoding.TextEncoder
type TextDecoderConstructor = typeof encoding.TextDecoder

declare global {
  type TextEncoder = encoding.TextEncoder
  type TextDecoder = encoding.TextDecoder

  const TextEncoder: TextEncoderConstructor
  const TextDecoder: TextDecoderConstructor
}
