const crypto = require('.')
const errors = require('./lib/errors')
const CryptoKey = require('./lib/web/crypto-key')
const hmac = require('./lib/web/algorithm/hmac')
const pbkdf2 = require('./lib/web/algorithm/pbkdf2')
const ed25519 = require('./lib/web/algorithm/ed25519')

exports.CryptoKey = CryptoKey

// https://w3c.github.io/webcrypto/#Crypto-method-getRandomValues
exports.getRandomValues = function getRandomValues(array) {
  return crypto.randomFillSync(array)
}

// https://w3c.github.io/webcrypto/#dfn-Crypto-method-randomUUID
exports.randomUUID = crypto.randomUUID

// https://w3c.github.io/webcrypto/#subtlecrypto-interface
exports.SubtleCrypto = class SubtleCrypto {
  // https://w3c.github.io/webcrypto/#SubtleCrypto-method-generateKey
  async generateKey(algorithm, extractable, usages) {
    if (typeof algorithm === 'string') algorithm = { name: algorithm }

    switch (algorithm.name.toLowerCase()) {
      case 'hmac':
        return hmac.generateKey(algorithm, extractable, usages)
      case 'ed25519':
        return ed25519.generateKey(algorithm, extractable, usages)
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${algorithm.name}' does not support the generateKey() operation`
        )
    }
  }

  // https://w3c.github.io/webcrypto/#SubtleCrypto-method-importKey
  async importKey(format, keyData, algorithm, extractable, usages) {
    if (typeof algorithm === 'string') algorithm = { name: algorithm }

    switch (format) {
      case 'raw':
      case 'pkcs8':
      case 'spki':
        if (ArrayBuffer.isView(keyData)) {
          keyData = Buffer.from(keyData)
        } else {
          keyData = Buffer.concat([Buffer.from(keyData)])
        }
        break
    }

    switch (algorithm.name.toLowerCase()) {
      case 'hmac':
        return hmac.importKey(format, keyData, algorithm, extractable, usages)
      case 'ed25519':
        return ed25519.importKey(
          format,
          keyData,
          algorithm,
          extractable,
          usages
        )
      case 'pbkdf2':
        return pbkdf2.importKey(format, keyData, algorithm, extractable, usages)
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${algorithm.name}' does not support the importKey() operation`
        )
    }
  }

  // https://w3c.github.io/webcrypto/#SubtleCrypto-method-exportKey
  async exportKey(format, key) {
    if (!key.extractable) {
      throw errors.INVALID_ACCESS('Key is not extractable')
    }

    switch (key.algorithm.name.toLowerCase()) {
      case 'hmac':
        return hmac.exportKey(format, key)
      case 'ed25519':
        return ed25519.exportKey(format, key)
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${key.algorithm.name}' does not support the exportKey() operation`
        )
    }
  }

  // https://w3c.github.io/webcrypto/#SubtleCrypto-method-sign
  async sign(algorithm, key, data) {
    if (typeof algorithm === 'string') algorithm = { name: algorithm }

    if (algorithm.name.toLowerCase() !== key.algorithm.name.toLowerCase()) {
      throw errors.INVALID_ACCESS(
        `Algorithm '${algorithm.name}' does not match key'`
      )
    }

    if (!key.usages.includes('sign')) {
      throw errors.INVALID_ACCESS('Key cannot be used for signing')
    }

    switch (algorithm.name.toLowerCase()) {
      case 'hmac':
        return hmac.sign(algorithm, key, data)
      case 'ed25519':
        return ed25519.sign(algorithm, key, data)
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${algorithm.name}' does not support the sign() operation`
        )
    }
  }

  // https://w3c.github.io/webcrypto/#SubtleCrypto-method-verify
  async verify(algorithm, key, signature, data) {
    if (typeof algorithm === 'string') algorithm = { name: algorithm }

    if (algorithm.name.toLowerCase() !== key.algorithm.name.toLowerCase()) {
      throw errors.INVALID_ACCESS(
        `Algorithm '${algorithm.name}' does not match key'`
      )
    }

    if (!key.usages.includes('verify')) {
      throw errors.INVALID_ACCESS('Key cannot be used for verification')
    }

    switch (algorithm.name.toLowerCase()) {
      case 'hmac':
        return hmac.verify(algorithm, key, signature, data)
      case 'ed25519':
        return ed25519.verify(algorithm, key, signature, data)
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${algorithm.name}' does not support the verify() operation`
        )
    }
  }

  // https://w3c.github.io/webcrypto/#SubtleCrypto-method-deriveBits
  async deriveBits(algorithm, key, length) {
    if (typeof algorithm === 'string') algorithm = { name: algorithm }

    if (algorithm.name.toLowerCase() !== key.algorithm.name.toLowerCase()) {
      throw errors.INVALID_ACCESS(
        `Algorithm '${algorithm.name}' does not match key'`
      )
    }

    if (!key.usages.includes('deriveBits')) {
      throw errors.INVALID_ACCESS('Key cannot be used to derive bits')
    }

    switch (algorithm.name.toLowerCase()) {
      case 'pbkdf2':
        return pbkdf2.deriveBits(algorithm, key, length)
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${algorithm.name}' does not support the deriveBits() operation`
        )
    }
  }

  // https://w3c.github.io/webcrypto/#SubtleCrypto-method-deriveKey
  async deriveKey(algorithm, baseKey, derivedKeyType, extractable, usages) {
    if (typeof algorithm === 'string') algorithm = { name: algorithm }

    if (typeof derivedKeyType === 'string') {
      derivedKeyType = { name: derivedKeyType }
    }

    if (algorithm.name.toLowerCase() !== baseKey.algorithm.name.toLowerCase()) {
      throw errors.INVALID_ACCESS(
        `Algorithm '${algorithm.name}' does not match key'`
      )
    }

    if (!baseKey.usages.includes('deriveKey')) {
      throw errors.INVALID_ACCESS('Key cannot be used to derive key')
    }

    let length

    switch (derivedKeyType.name.toLowerCase()) {
      case 'hmac':
        length = hmac.getKeyLength(derivedKeyType)
        break
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${derivedKeyType.name}' does not support the getKeyLength() operation`
        )
    }

    let secret

    switch (algorithm.name.toLowerCase()) {
      case 'pbkdf2':
        secret = pbkdf2.deriveBits(algorithm, baseKey, length)
        break
      default:
        throw errors.NOT_SUPPORTED(
          `Algorithm '${algorithm.name}' does not support the deriveBits() operation`
        )
    }

    return this.importKey('raw', secret, derivedKeyType, extractable, usages)
  }
}

exports.subtle = new exports.SubtleCrypto()
