module.exports = class SignalError extends Error {
  constructor(msg, code, fn = SignalError) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'SignalError'
  }

  static UNKNOWN_SIGNAL(msg) {
    return new SignalError(msg, 'UNKNOWN_SIGNAL', SignalError.UNKNOWN_SIGNAL)
  }

  static SIGNAL_CLOSED(msg) {
    return new SignalError(msg, 'SIGNAL_CLOSED', SignalError.SIGNAL_CLOSED)
  }
}
