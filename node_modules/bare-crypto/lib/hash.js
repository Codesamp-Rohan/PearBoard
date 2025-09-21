const { Transform } = require('bare-stream')
const binding = require('../binding')
const constants = require('./constants')

module.exports = class CryptoHash extends Transform {
  constructor(algorithm, opts = {}) {
    super(opts)

    this._handle = binding.hashInit(constants.toHash(algorithm))
  }

  update(data, encoding = 'utf8') {
    if (typeof data === 'string') data = Buffer.from(data, encoding)

    binding.hashUpdate(
      this._handle,
      data.buffer,
      data.byteOffset,
      data.byteLength
    )

    return this
  }

  digest(encoding) {
    const digest = Buffer.from(binding.hashFinal(this._handle))

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
