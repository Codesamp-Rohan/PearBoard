const crypto = require('../../..')
const binding = require('../../../binding')
const errors = require('../../errors')
const { Ed25519PublicKey, Ed25519PrivateKey } = require('../../key')
const CryptoKey = require('../crypto-key')

// https://w3c.github.io/webcrypto/#ed25519

// https://w3c.github.io/webcrypto/#ed25519-operations-sign
exports.sign = function sign(algorithm, key, data) {
  if (key.type !== 'private') {
    throw errors.INVALID_ACCESS('Must pass private key for Ed25519 signing')
  }

  const signature = crypto.sign(null, data, key._handle)

  const result = new ArrayBuffer(signature.byteLength)
  Buffer.from(result).set(signature)
  return result
}

// https://w3c.github.io/webcrypto/#ed25519-operations-verify
exports.verify = function verify(algorithm, key, signature, data) {
  if (key.type !== 'public') {
    throw errors.INVALID_ACCESS('Must pass public key for Ed25519 verification')
  }

  return crypto.verify(null, data, key._handle, signature)
}

// https://w3c.github.io/webcrypto/#ed25519-operations-generate-key
exports.generateKey = function generateKey(algorithm, extractable, usages) {
  for (const usage of usages) {
    if (usage !== 'sign' && usage !== 'verify') {
      throw new SyntaxError(
        `Usage '${usage}' cannot be used for the Ed25519 generateKey() operation`
      )
    }
  }

  const keys = crypto.generateKeyPair('ed25519')

  algorithm = { name: 'Ed25519' }

  return {
    publicKey: new CryptoKey(
      'public',
      true,
      algorithm,
      ['verify'],
      keys.publicKey
    ),
    privateKey: new CryptoKey(
      'private',
      extractable,
      algorithm,
      ['sign'],
      keys.privateKey
    )
  }
}

// https://w3c.github.io/webcrypto/#ed25519-operations-import-key
exports.importKey = function importKey(
  format,
  keyData,
  algorithm,
  extractable,
  usages
) {
  switch (format) {
    case 'spki':
      for (const usage of usages) {
        if (usage !== 'verify') {
          throw new SyntaxError(
            `Usage '${usage}' cannot be used for the Ed25519 importKey() operation`
          )
        }
      }

      keyData = binding.ed25519FromSPKI(
        keyData.buffer,
        keyData.byteOffset,
        keyData.byteLength
      )

      return new CryptoKey(
        'public',
        extractable,
        {
          name: 'Ed25519'
        },
        usages,
        new Ed25519PublicKey(keyData)
      )
    case 'pkcs8':
      for (const usage of usages) {
        if (usage !== 'sign') {
          throw new SyntaxError(
            `Usage '${usage}' cannot be used for the Ed25519 importKey() operation`
          )
        }
      }

      keyData = binding.ed25519FromPKCS8(
        keyData.buffer,
        keyData.byteOffset,
        keyData.byteLength
      )

      return new CryptoKey(
        'private',
        extractable,
        {
          name: 'Ed25519'
        },
        usages,
        new Ed25519PrivateKey(keyData)
      )
    case 'raw':
      for (const usage of usages) {
        if (usage !== 'verify') {
          throw new SyntaxError(
            `Usage '${usage}' cannot be used for the Ed25519 importKey() operation`
          )
        }
      }

      if (keyData.byteLength * 8 !== 256) {
        throw errors.INVALID_DATA('Key must be 256 bits')
      }

      return new CryptoKey(
        'public',
        extractable,
        {
          name: 'Ed25519'
        },
        usages,
        new Ed25519PublicKey(keyData.buffer)
      )
    case 'jwk':
      const jwk = keyData

      if ('d' in jwk) {
        if (usages.some((usage) => usage !== 'sign')) {
          throw new SyntaxError('JWK must be valid for signing')
        }
      } else {
        if (usages.some((usage) => usage !== 'verify')) {
          throw new SyntaxError('JWK must be valid for verification')
        }
      }

      if (jwk.kty !== 'OKP') {
        throw errors.INVALID_DATA('JWK key must be an octet key-pair')
      }

      if (jwk.crv !== 'Ed25519') {
        throw errors.INVALID_DATA('JWK must use the Ed25519 curve')
      }

      if ('alg' in jwk && jwk.alg !== 'Ed25519' && jwk.alg !== 'EdDSA') {
        throw errors.INVALID_DATA('JWK must use the Ed25519 curve')
      }

      if (usages.length && 'use' in jwk && jwk.use !== 'sig') {
        throw errors.INVALID_DATA('JWK cannot be used for signatures')
      }

      if ('ext' in jwk && jwk.ext !== extractable && extractable) {
        throw errors.INVALID_DATA('JWK is not extractable')
      }

      if ('d' in jwk) {
        return new CryptoKey(
          'private',
          extractable,
          {
            name: 'Ed25519'
          },
          usages,
          new Ed25519PrivateKey(Buffer.from(jwk.d, 'base64url').buffer)
        )
      }

      return new CryptoKey(
        'public',
        extractable,
        {
          name: 'Ed25519'
        },
        usages,
        new Ed25519PublicKey(Buffer.from(jwk.x, 'base64url').buffer)
      )
    default:
      throw errors.NOT_SUPPORTED(
        `Format '${format}' cannot be used for the Ed25519 importKey() operation`
      )
  }
}

// https://w3c.github.io/webcrypto/#ed25519-operations-export-key
exports.exportKey = function exportKey(format, key) {
  const data = key._handle

  switch (format) {
    case 'spki':
      if (key.type !== 'public') {
        throw errors.INVALID_ACCESS(
          `Key of type '${key.type}' cannot be used for the Ed25519 exportKey() operations`
        )
      }

      return binding.ed25519ToSPKI(data._key)
    case 'pkcs8':
      if (key.type !== 'private') {
        throw errors.INVALID_ACCESS(
          `Key of type '${key.type}' cannot be used for the Ed25519 exportKey() operations`
        )
      }

      return binding.ed25519ToPKCS8(data._key)
    case 'raw': {
      if (key.type !== 'public') {
        throw errors.INVALID_ACCESS(
          `Key of type '${key.type}' cannot be used for the Ed25519 exportKey() operations`
        )
      }

      const result = new ArrayBuffer(data._key.byteLength)
      Buffer.from(result).set(data._key)
      return result
    }
    case 'jwk':
      return {
        kty: 'OKP',
        alg: 'Ed25519',
        crv: 'Ed25519',
        x: Buffer.from(data._key).toString('base64url'),
        key_ops: key.usages,
        ext: key.extractable
      }
    default:
      throw errors.NOT_SUPPORTED(
        `Format '${format}' cannot be used for the HMAC exportKey() operation`
      )
  }
}
