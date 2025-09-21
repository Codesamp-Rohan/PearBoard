// https://w3c.github.io/webcrypto/#cryptokey-interface
module.exports = class CryptoKey {
  constructor(type, extractable, algorithm, usages, handle = null) {
    this._type = type
    this._extractable = extractable
    this._algorithm = algorithm
    this._usages = usages
    this._handle = handle
  }

  // https://w3c.github.io/webcrypto/#dom-cryptokey-type
  get type() {
    return this._type
  }

  // https://w3c.github.io/webcrypto/#dom-cryptokey-extractable
  get extractable() {
    return this._extractable
  }

  // https://w3c.github.io/webcrypto/#dom-cryptokey-algorithm
  get algorithm() {
    return this._algorithm
  }

  // https://w3c.github.io/webcrypto/#dom-cryptokey-usages
  get usages() {
    return this._usages
  }

  [Symbol.for('bare.inspect')]() {
    return {
      __proto__: { constructor: CryptoKey },

      type: this.type,
      extractable: this.extractable,
      algorithm: this.algorithm,
      usages: this.usages
    }
  }
}
