const binding = require('../binding')
const constants = require('./constants')

const {
  keyType: { ED25519 }
} = constants

exports.sign = function sign(algorithm, data, key) {
  if (ArrayBuffer.isView(data)) {
    data = Buffer.coerce(data)
  } else {
    data = Buffer.from(data)
  }

  switch (key._keyType) {
    case ED25519:
      return Buffer.from(
        binding.ed25519Sign(
          data.buffer,
          data.byteOffset,
          data.byteLength,
          key._key
        )
      )
  }
}

exports.verify = function verify(algorithm, data, key, signature) {
  if (ArrayBuffer.isView(data)) {
    data = Buffer.coerce(data)
  } else {
    data = Buffer.from(data)
  }

  if (ArrayBuffer.isView(signature)) {
    signature = Buffer.coerce(signature)
  } else {
    signature = Buffer.from(signature)
  }

  switch (key._keyType) {
    case ED25519:
      return binding.ed25519Verify(
        data.buffer,
        data.byteOffset,
        data.byteLength,
        signature.buffer,
        signature.byteOffset,
        key._key
      )
  }
}
