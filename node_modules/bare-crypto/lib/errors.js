module.exports = class CryptoError extends Error {
  constructor(msg, fn = CryptoError, code = fn.name) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'CryptoError'
  }

  static UNKNOWN_HASH(msg) {
    return new CryptoError(msg, CryptoError.UNKNOWN_HASH)
  }

  static UNKNOWN_CIPHER(msg) {
    return new CryptoError(msg, CryptoError.UNKNOWN_CIPHER)
  }

  static UNKNOWN_KEY_TYPE(msg) {
    return new CryptoError(msg, CryptoError.UNKNOWN_KEY_TYPE)
  }

  static INVALID_ACCESS(msg) {
    return new CryptoError(msg, CryptoError.INVALID_ACCESS)
  }

  static INVALID_DATA(msg) {
    return new CryptoError(msg, CryptoError.INVALID_DATA)
  }

  static OPERATION_ERROR(msg) {
    return new CryptoError(msg, CryptoError.OPERATION_ERROR)
  }

  static NOT_SUPPORTED(msg) {
    return new CryptoError(msg, CryptoError.NOT_SUPPORTED)
  }
}
