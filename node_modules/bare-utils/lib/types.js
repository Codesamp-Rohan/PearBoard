const type = require('bare-type')

exports.isAnyArrayBuffer = (value) => {
  const t = type(value)
  return t.isArrayBuffer() || t.isSharedArrayBuffer()
}

exports.isArrayBufferView = (value) => ArrayBuffer.isView(value)

exports.isArgumentsObject = (value) => type(value).isArguments()

exports.isArrayBuffer = (value) => type(value).isArrayBuffer()

exports.isAsyncFunction = (value) => type(value).isAsyncFunction()

exports.isBigInt64Array = (value) => type(value).isBigInt64Array()

exports.isBigIntObject = (value) => value instanceof BigInt

exports.isBigUint64Array = (value) => type(value).isBigUint64Array()

exports.isBooleanObject = (value) => value instanceof Boolean

exports.isBoxedPrimitive = (value) =>
  exports.isBigIntObject(value) ||
  exports.isBooleanObject(value) ||
  exports.isNumberObject(value) ||
  exports.isStringObject(value) ||
  exports.isSymbolObject(value)

exports.isCryptoKey = () => {
  throw new Error('Not implemented')
}

exports.isDataView = (value) => type(value).isDataView()

exports.isDate = (value) => type(value).isDate()

exports.isExternal = (value) => type(value).isExternal()

exports.isFloat16Array = () => {
  throw new Error('Not implemented')
}

exports.isFloat32Array = (value) => type(value).isFloat32Array()

exports.isFloat64Array = (value) => type(value).isFloat64Array()

exports.isGeneratorFunction = (value) => type(value).isGeneratorFunction()

exports.isGeneratorObject = (value) => type(value).isGenerator()

exports.isInt8Array = (value) => type(value).isInt8Array()

exports.isInt16Array = (value) => type(value).isInt16Array()

exports.isInt32Array = (value) => type(value).isInt32Array()

exports.isKeyObject = () => {
  throw new Error('Not implemented')
}

exports.isMap = (value) => type(value).isMap()

exports.isMapIterator = () => {
  throw new Error('Not implemented')
}

exports.isModuleNamespaceObject = (value) => type(value).isModuleNamespace()

exports.isNativeError = () => {
  throw new Error('Not implemented')
}

exports.isNumberObject = (value) => value instanceof Number

exports.isPromise = (value) => type(value).isPromise()

exports.isProxy = (value) => type(value).isProxy()

exports.isRegExp = (value) => type(value).isRegExp()

exports.isSet = (value) => type(value).isSet()

exports.isSetIterator = () => {
  throw new Error('Not implemented')
}

exports.isSharedArrayBuffer = (value) => type(value).isSharedArrayBuffer()

exports.isStringObject = (value) => value instanceof String

exports.isSymbolObject = (value) => value instanceof Symbol

exports.isTypedArray = (value) => type(value).isTypedArray()

exports.isUint8Array = (value) => type(value).isUint8Array()

exports.isUint8ClampedArray = (value) => type(value).isUint8ClampedArray()

exports.isUint16Array = (value) => type(value).isUint16Array()

exports.isUint32Array = (value) => type(value).isUint32Array()
