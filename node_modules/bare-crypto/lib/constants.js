const binding = require('../binding')
const errors = require('./errors')

module.exports = exports = {
  hash: {
    MD5: binding.MD5,
    SHA1: binding.SHA1,
    SHA256: binding.SHA256,
    SHA512: binding.SHA512,
    BLAKE2B256: binding.BLAKE2B256
  },
  signature: {
    ED25519: binding.ED25519
  },
  cipher: {
    AES128ECB: binding.AES128ECB,
    AES128CBC: binding.AES128CBC,
    AES128CTR: binding.AES128CTR,
    AES128OFB: binding.AES128OFB,
    AES256ECB: binding.AES256ECB,
    AES256CBC: binding.AES256CBC,
    AES256CTR: binding.AES256CTR,
    AES256OFB: binding.AES256OFB,
    AES128GCM: binding.AES128GCM,
    AES256GCM: binding.AES256GCM,
    CHACHA20POLY1305: binding.CHACHA20POLY1305,
    XCHACHA20POLY1305: binding.XCHACHA20POLY1305
  },
  keyType: {
    ED25519: binding.ED25519
  }
}

exports.toHash = function toHash(hash) {
  if (typeof hash === 'number') return hash

  if (typeof hash === 'string') {
    hash = hash.replace(/-/g, '')

    if (hash in exports.hash === false) {
      hash = hash.toUpperCase()

      if (hash in exports.hash === false) {
        throw errors.UNKNOWN_HASH(`Unknown hash '${hash}'`)
      }
    }

    return exports.hash[hash]
  }

  throw new TypeError(
    `Hash must be a number or string. Received ${typeof hash} (${hash})`
  )
}

exports.toCipher = function toCiper(cipher) {
  if (typeof cipher === 'number') return cipher

  if (typeof cipher === 'string') {
    cipher = cipher.replace(/-/g, '')

    if (cipher in exports.cipher === false) {
      cipher = cipher.toUpperCase()

      if (cipher in exports.cipher === false) {
        throw errors.UNKNOWN_CIPHER(`Unknown cipher '${cipher}'`)
      }
    }

    return exports.cipher[cipher]
  }

  throw new TypeError(
    `Cipher must be a number or string. Received ${typeof cipher} (${cipher})`
  )
}

exports.toKeyType = function toKeyType(type) {
  if (typeof type === 'number') return type

  if (typeof type === 'string') {
    type = type.replace(/-/g, '')

    if (type in exports.keyType === false) {
      type = type.toUpperCase()

      if (type in exports.keyType === false) {
        throw errors.UNKNOWN_KEY_TYPE(`Unknown key type '${type}'`)
      }
    }

    return exports.keyType[type]
  }

  throw new TypeError(
    `Key type must be a number or string. Received ${typeof type} (${type})`
  )
}
