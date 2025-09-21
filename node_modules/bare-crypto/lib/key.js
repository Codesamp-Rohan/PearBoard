const binding = require('../binding')
const constants = require('./constants')

const {
  keyType: { ED25519 }
} = constants

class CryptoKey {
  constructor(keyType) {
    this._keyType = keyType
  }
}

exports.Key = CryptoKey

class CryptoEd25519Key extends CryptoKey {
  constructor(key) {
    super(ED25519)

    this._key = key
  }

  get asymmetricKeyType() {
    return 'ed25519'
  }
}

class CryptoEd25519PublicKey extends CryptoEd25519Key {
  get type() {
    return 'public'
  }
}

exports.Ed25519PublicKey = CryptoEd25519PublicKey

class CryptoEd25519PrivateKey extends CryptoEd25519Key {
  get type() {
    return 'private'
  }
}

exports.Ed25519PrivateKey = CryptoEd25519PrivateKey

exports.generateKeyPair = function generateKeyPair(type, opts = {}) {
  type = constants.toKeyType(type)

  switch (type) {
    case ED25519: {
      const { publicKey, privateKey } = binding.ed25519GenerateKeypair()

      return {
        publicKey: new CryptoEd25519PublicKey(publicKey),
        privateKey: new CryptoEd25519PrivateKey(privateKey)
      }
    }
  }
}
