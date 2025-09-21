const { Transform } = require('bare-stream')
const binding = require('../binding')
const constants = require('./constants')

const {
  cipher: {
    AES128ECB,
    AES128CBC,
    AES128CTR,
    AES128OFB,
    AES256ECB,
    AES256CBC,
    AES256CTR,
    AES256OFB,
    AES128GCM,
    AES256GCM,
    CHACHA20POLY1305,
    XCHACHA20POLY1305
  }
} = constants

class CryptoCipher {
  constructor(algorithm, key, iv, encrypt, opts = {}) {
    const { encoding = 'utf8' } = opts

    if (typeof key === 'string') key = Buffer.from(key, encoding)
    if (typeof iv === 'string') iv = Buffer.from(iv, encoding)

    if (key.byteLength !== binding.cipherKeyLength(algorithm)) {
      throw new RangeError('Invalid key length')
    }

    if (iv.byteLength < binding.cipherIVLength(algorithm)) {
      throw new RangeError('Invalid iv length')
    }

    this._handle = binding.cipherInit(
      algorithm,
      key.buffer,
      key.byteOffset,
      key.byteLength,
      iv.buffer,
      iv.byteOffset,
      iv.byteLength,
      encrypt
    )
  }

  update(data, inputEncoding = 'utf8', outputEncoding) {
    if (typeof data === 'string') data = Buffer.from(data, inputEncoding)

    const out = new ArrayBuffer(binding.cipherBlockSize(this._handle))

    const written = binding.cipherUpdate(
      this._handle,
      data.buffer,
      data.byteOffset,
      data.byteLength,
      out
    )

    const result = Buffer.from(out, 0, written)

    return outputEncoding ? result.toString(outputEncoding) : result
  }

  final(outputEncoding) {
    const out = new ArrayBuffer(binding.cipherBlockSize(this._handle))

    const written = binding.cipherFinal(this._handle, out)

    const result = Buffer.from(out, 0, written)

    return outputEncoding ? result.toString(outputEncoding) : result
  }

  setAutoPadding(pad) {
    binding.cipherSetPadding(pad)
  }
}

class CryptoAuthenticatedCipher {
  constructor(algorithm, key, nonce, opts = {}) {
    const { encoding = 'utf8', authTagLength = 16 } = opts

    if (typeof key === 'string') key = Buffer.from(key, encoding)
    if (typeof nonce === 'string') nonce = Buffer.from(nonce, encoding)

    if (key.byteLength !== binding.aeadKeyLength(algorithm)) {
      throw new RangeError('Invalid key length')
    }

    if (nonce.byteLength < binding.aeadNonceLength(algorithm)) {
      throw new RangeError('Invalid nonce length')
    }

    this._buffer = []
    this._nonce = nonce
    this._authTag = null
    this._authTagLength = authTagLength
    this._additionalData = null

    this._handle = binding.aeadInit(
      algorithm,
      key.buffer,
      key.byteOffset,
      key.byteLength,
      authTagLength
    )
  }

  update(data, inputEncoding = 'utf8', outputEncoding) {
    if (typeof data === 'string') data = Buffer.from(data, inputEncoding)

    this._buffer.push(data)

    return outputEncoding ? '' : Buffer.alloc(0)
  }

  setAAD(buffer, opts = {}) {
    const { encoding = 'utf8' } = opts

    if (typeof buffer === 'string') buffer = Buffer.from(buffer, encoding)

    this._additionalData = buffer
  }

  getAuthTag() {
    return this._authTag
  }

  setAuthTag(authTag, encoding) {
    if (typeof authTag === 'string') authTag = Buffer.from(authTag, encoding)

    this._authTag = authTag
  }
}

class CryptoAuthenticatedSeal extends CryptoAuthenticatedCipher {
  final(outputEncoding) {
    const data =
      this._buffer.length === 1 ? this._buffer[0] : Buffer.concat(this._buffer)

    const nonce = this._nonce
    const ad = this._additionalData || Buffer.alloc(0)

    const out = new ArrayBuffer(
      data.byteLength + binding.aeadMaxOverhead(this._handle)
    )

    binding.aeadSeal(
      this._handle,
      data.buffer,
      data.byteOffset,
      data.byteLength,
      nonce.buffer,
      nonce.byteOffset,
      nonce.byteLength,
      ad.buffer,
      ad.byteOffset,
      ad.byteLength,
      out
    )

    const written = out.byteLength - this._authTagLength

    this._authTag = Buffer.from(out, written)

    const result = Buffer.from(out, 0, written)

    return outputEncoding ? result.toString(outputEncoding) : result
  }
}

class CryptoAuthenticatedOpen extends CryptoAuthenticatedCipher {
  final(outputEncoding) {
    this._buffer.push(this._authTag)

    const data = Buffer.concat(this._buffer)

    const nonce = this._nonce
    const ad = this._additionalData || Buffer.alloc(0)

    const out = new ArrayBuffer(data.byteLength)

    binding.aeadOpen(
      this._handle,
      data.buffer,
      data.byteOffset,
      data.byteLength,
      nonce.buffer,
      nonce.byteOffset,
      nonce.byteLength,
      ad.buffer,
      ad.byteOffset,
      ad.byteLength,
      out
    )

    const written = out.byteLength - this._authTagLength

    const result = Buffer.from(out, 0, written)

    return outputEncoding ? result.toString(outputEncoding) : result
  }
}

exports.Cipheriv = class CryptoCipheriv extends Transform {
  constructor(algorithm, key, iv, opts = {}) {
    super(opts)

    algorithm = constants.toCipher(algorithm)

    switch (algorithm) {
      case AES128ECB:
      case AES128CBC:
      case AES128CTR:
      case AES128OFB:
      case AES256ECB:
      case AES256CBC:
      case AES256CTR:
      case AES256OFB:
        this._cipher = new CryptoCipher(algorithm, key, iv, true, opts)
        break

      case AES128GCM:
      case AES256GCM:
      case CHACHA20POLY1305:
      case XCHACHA20POLY1305:
        this._cipher = new CryptoAuthenticatedSeal(algorithm, key, iv, opts)
        break
    }
  }

  update(data, inputEncoding, outputEncoding) {
    return this._cipher.update(data, inputEncoding, outputEncoding)
  }

  final(outputEncoding) {
    return this._cipher.final(outputEncoding)
  }

  setAutoPadding(pad) {
    this._cipher.setAutoPadding(pad)

    return this
  }

  setAAD(buffer, opts) {
    this._cipher.setAAD(buffer, opts)

    return this
  }

  getAuthTag() {
    return this._cipher.getAuthTag()
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

exports.Decipheriv = class CryptoDeipheriv extends Transform {
  constructor(algorithm, key, iv, opts = {}) {
    super(opts)

    algorithm = constants.toCipher(algorithm)

    switch (algorithm) {
      case AES128ECB:
      case AES128CBC:
      case AES128CTR:
      case AES128OFB:
      case AES256ECB:
      case AES256CBC:
      case AES256CTR:
      case AES256OFB:
        this._cipher = new CryptoCipher(algorithm, key, iv, false, opts)
        break

      case AES128GCM:
      case AES256GCM:
      case CHACHA20POLY1305:
      case XCHACHA20POLY1305:
        this._cipher = new CryptoAuthenticatedOpen(algorithm, key, iv, opts)
        break
    }
  }

  update(data, inputEncoding, outputEncoding) {
    return this._cipher.update(data, inputEncoding, outputEncoding)
  }

  final(outputEncoding) {
    return this._cipher.final(outputEncoding)
  }

  setAutoPadding(pad) {
    this._cipher.setAutoPadding(pad)

    return this
  }

  setAAD(buffer, opts) {
    this._cipher.setAAD(buffer, opts)

    return this
  }

  setAuthTag(authTag, encoding) {
    this._cipher.setAuthTag(authTag, encoding)

    return this
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
