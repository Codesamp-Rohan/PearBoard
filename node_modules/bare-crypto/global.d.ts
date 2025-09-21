export * as crypto from './web'

type Crypto = typeof crypto

declare global {
  const crypto: Crypto
}
