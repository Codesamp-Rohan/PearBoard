const binding = require('../binding')
const constants = require('./constants')

module.exports = function pbkdf2(
  password,
  salt,
  iterations,
  keylen,
  digest,
  cb
) {
  if (iterations <= 0) {
    throw new RangeError('iterations is out of range')
  }

  if (typeof password === 'string') password = Buffer.from(password)
  if (typeof salt === 'string') salt = Buffer.from(salt)

  const buffer = Buffer.from(
    binding.pbkdf2(
      password.buffer,
      password.byteOffset,
      password.byteLength,
      salt.buffer,
      salt.byteOffset,
      salt.byteLength,
      iterations,
      constants.toHash(digest),
      keylen
    )
  )

  if (cb) queueMicrotask(() => cb(null, buffer))
  else return buffer
}
