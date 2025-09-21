const { Transform } = require('bare-stream')
const binding = require('../binding')
const constants = require('./constants')

module.exports = class CryptoHmac extends Transform {
  constructor(algorithm, key, opts = {}) {
    super(opts)

    const { encoding = 'utf8' } = opts

    if (typeof key === 'string') key = Buffer.from(key, encoding)

    this._handle = binding.hmacInit(
      constants.toHash(algorithm),
      key.buffer,
      key.byteOffset,
      key.byteLength
    )
  }

  update(data, encoding = 'utf8') {
    if (typeof data === 'string') data = Buffer.from(data, encoding)

    binding.hmacUpdate(
      this._handle,
      data.buffer,
      data.byteOffset,
      data.byteLength
    )

    return this
  }

  digest(encoding) {
    const digest = Buffer.from(binding.hmacFinal(this._handle))

    return encoding && encoding !== 'buffer'
      ? digest.toString(encoding)
      : digest
  }

  _transform(data, encoding, cb) {
    this.update(data)

    cb(null)
  }

  _flush(cb) {
    this.push(this.digest())

    cb(null)
  }
}
