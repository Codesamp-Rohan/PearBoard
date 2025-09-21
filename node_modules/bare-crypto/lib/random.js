const binding = require('../binding')

exports.randomBytes = function randomBytes(size, cb) {
  const buffer = Buffer.allocUnsafe(size)
  exports.randomFill(buffer)
  if (cb) queueMicrotask(() => cb(null, buffer))
  else return buffer
}

exports.randomFill = function randomFill(buffer, offset, size, cb) {
  if (typeof offset === 'function') {
    cb = offset
    offset = undefined
  } else if (typeof size === 'function') {
    cb = size
    size = undefined
  }

  const elementSize = buffer.BYTES_PER_ELEMENT || 1

  if (offset === undefined) offset = 0
  else offset *= elementSize

  if (size === undefined) size = buffer.byteLength - offset
  else size *= elementSize

  if (offset < 0 || offset > buffer.byteLength) {
    throw new RangeError('offset is out of range')
  }

  if (size < 0 || size > buffer.byteLength) {
    throw new RangeError('size is out of range')
  }

  if (offset + size > buffer.byteLength) {
    throw new RangeError('offset + size is out of range')
  }

  let arraybuffer

  if (ArrayBuffer.isView(buffer)) {
    offset += buffer.byteOffset
    arraybuffer = buffer.buffer
  } else {
    arraybuffer = buffer
  }

  binding.randomFill(arraybuffer, offset, size)

  if (cb) queueMicrotask(() => cb(null, buffer))
  else return buffer
}

exports.randomUUID = function randomUUID() {
  const uuid = exports.randomBytes(16)

  uuid[6] = (uuid[6] >>> 4) | 0b01000000
  uuid[8] = (uuid[8] >>> 2) | 0b10000000

  return (
    uuid.subarray(0, 4).toString('hex') +
    '-' +
    uuid.subarray(4, 6).toString('hex') +
    '-' +
    uuid.subarray(6, 8).toString('hex') +
    '-' +
    uuid.subarray(8, 10).toString('hex') +
    '-' +
    uuid.subarray(10, 16).toString('hex')
  )
}
