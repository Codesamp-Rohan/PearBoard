const binding = require('./binding')

const t = binding.constants

class Type {
  constructor(type) {
    this._type = type
  }

  isUndefined() {
    return this._type === t.UNDEFINED
  }

  isNull() {
    return this._type === t.NULL
  }

  isBoolean() {
    return this._type === t.BOOLEAN
  }

  isNumber() {
    return (this._type & 0xff) === t.NUMBER
  }

  isInt32() {
    return (this._type & (0xff | t.INT32)) === (t.NUMBER | t.INT32)
  }

  isUint32() {
    return (this._type & (0xff | t.UINT32)) === (t.NUMBER | t.UINT32)
  }

  isString() {
    return this._type === t.STRING
  }

  isSymbol() {
    return this._type === t.SYMBOL
  }

  isObject() {
    return (this._type & 0xff) === t.OBJECT
  }

  isArray() {
    return this._type === (t.OBJECT | t.ARRAY)
  }

  isArguments() {
    return this._type === (t.OBJECT | t.ARGUMENTS)
  }

  isDate() {
    return this._type === (t.OBJECT | t.DATE)
  }

  isRegExp() {
    return this._type === (t.OBJECT | t.REGEXP)
  }

  isError() {
    return this._type === (t.OBJECT | t.ERROR)
  }

  isPromise() {
    return this._type === (t.OBJECT | t.PROMISE)
  }

  isProxy() {
    return this._type === (t.OBJECT | t.PROXY)
  }

  isGenerator() {
    return this._type === (t.OBJECT | t.GENERATOR)
  }

  isMap() {
    return this._type === (t.OBJECT | t.MAP)
  }

  isSet() {
    return this._type === (t.OBJECT | t.SET)
  }

  isWeakMap() {
    return this._type === (t.OBJECT | t.WEAK_MAP)
  }

  isWeakSet() {
    return this._type === (t.OBJECT | t.WEAK_SET)
  }

  isWeakRef() {
    return this._type === (t.OBJECT | t.WEAK_REF)
  }

  isArrayBuffer() {
    return this._type === (t.OBJECT | t.ARRAYBUFFER)
  }

  isSharedArrayBuffer() {
    return this._type === (t.OBJECT | t.SHAREDARRAYBUFFER)
  }

  isTypedArray() {
    return (this._type & 0xffff) === (t.OBJECT | t.TYPEDARRAY)
  }

  isInt8Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.INT8ARRAY)
  }

  isUint8Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.UINT8ARRAY)
  }

  isUint8ClampedArray() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.UINT8CLAMPEDARRAY)
  }

  isInt16Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.INT16ARRAY)
  }

  isUint16Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.UINT16ARRAY)
  }

  isInt32Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.INT32ARRAY)
  }

  isUint32Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.UINT32ARRAY)
  }

  isFloat32Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.FLOAT32ARRAY)
  }

  isFloat64Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.FLOAT64ARRAY)
  }

  isBigInt64Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.BIGINT64ARRAY)
  }

  isBigUint64Array() {
    return this._type === (t.OBJECT | t.TYPEDARRAY | t.BIGUINT64ARRAY)
  }

  isDataView() {
    return this._type === (t.OBJECT | t.DATAVIEW)
  }

  isModuleNamespace() {
    return this._type === (t.OBJECT | t.MODULE_NAMESPACE)
  }

  isFunction() {
    return (this._type & 0xff) === t.FUNCTION
  }

  isAsyncFunction() {
    return (
      (this._type & (0xff | t.ASYNC_FUNCTION)) ===
      (t.FUNCTION | t.ASYNC_FUNCTION)
    )
  }

  isGeneratorFunction() {
    return (
      (this._type & (0xff | t.GENERATOR_FUNCTION)) ===
      (t.FUNCTION | t.GENERATOR_FUNCTION)
    )
  }

  isExternal() {
    return this._type === t.EXTERNAL
  }

  isBigInt() {
    return this._type === t.BIGINT
  }
}

module.exports = exports = function type(value) {
  switch (typeof value) {
    case 'undefined':
      return new Type(t.UNDEFINED)
    case 'boolean':
      return new Type(t.BOOLEAN)
    case 'number':
      return new Type(
        Number.isSafeInteger(value) ? binding.type(value) : t.NUMBER
      )
    case 'string':
      return new Type(t.STRING)
    case 'symbol':
      return new Type(t.SYMBOL)
    case 'object':
      return new Type(value === null ? t.NULL : binding.type(value))
    case 'function':
      return new Type(binding.type(value))
    case 'bigint':
      return new Type(t.BIGINT)
  }
}

exports.createTag = function createTag(...components) {
  const tag = new Uint32Array(4)
  for (let i = 0; i < 4; i++) tag[i] = components[i] || 0
  return tag
}

exports.addTag = function addTag(object, tag) {
  binding.addTag(object, tag)
}

exports.checkTag = function checkTag(object, tag) {
  return binding.checkTag(object, tag)
}
