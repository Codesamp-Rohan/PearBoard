const crypto = require('../../..')
const errors = require('../../errors')
const CryptoKey = require('../crypto-key')

// https://w3c.github.io/webcrypto/#pbkdf2

// https://w3c.github.io/webcrypto/#pbkdf2-operations-derive-bits
exports.deriveBits = function deriveBits(algorithm, key, length) {
  if (length === undefined || length % 8) {
    throw errors.OPERATION_ERROR('Length must be multiple of 8')
  }

  if (algorithm.iterations === 0) {
    throw errors.OPERATION_ERROR('Iterations must be non-0')
  }

  if (length === 0) {
    return new ArrayBuffer(0)
  }

  let hash = algorithm.hash

  if (typeof hash === 'string') hash = { name: hash }

  const result = crypto.pbkdf2(
    key._handle,
    algorithm.salt,
    algorithm.iterations,
    length / 8,
    hash.name
  )

  return result.buffer
}

// https://w3c.github.io/webcrypto/#pbkdf2-operations-import-key
exports.importKey = function importKey(
  format,
  keyData,
  algorithm,
  extractable,
  usages
) {
  if (format !== 'raw') {
    throw errors.NOT_SUPPORTED(
      `Format '${format}' cannot be used for the PBKDF2 importKey() operation`
    )
  }

  for (const usage of usages) {
    if (usage !== 'deriveKey' && usage !== 'deriveBits') {
      throw new SyntaxError(`Invalid usage ${usage}`)
    }
  }

  if (extractable) {
    throw new SyntaxError('Extractable must be false')
  }

  return new CryptoKey(
    'secret',
    extractable,
    {
      name: 'PBKDF2'
    },
    usages,
    keyData
  )
}
