module.exports = class EncodingError extends Error {
  constructor(msg, code, fn = EncodingError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'EncodingError'
  }

  static INVALID_LABEL(msg) {
    return new EncodingError(msg, 'INVALID_LABEL', EncodingError.INVALID_LABEL)
  }
}
