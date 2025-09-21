declare class Type {
  constructor(type: number)

  isUndefined(): boolean

  isNull(): boolean

  isBoolean(): boolean

  isNumber(): boolean

  isInt32(): boolean

  isUint32(): boolean

  isString(): boolean

  isSymbol(): boolean

  isObject(): boolean

  isArray(): boolean

  isArguments(): boolean

  isDate(): boolean

  isRegExp(): boolean

  isError(): boolean

  isPromise(): boolean

  isProxy(): boolean

  isGenerator(): boolean

  isMap(): boolean

  isSet(): boolean

  isWeakMap(): boolean

  isWeakSet(): boolean

  isWeakRef(): boolean

  isArrayBuffer(): boolean

  isSharedArrayBuffer(): boolean

  isTypedArray(): boolean

  isInt8Array(): boolean

  isUint8Array(): boolean

  isUint8ClampedArray(): boolean

  isInt16Array(): boolean

  isUint16Array(): boolean

  isInt32Array(): boolean

  isUint32Array(): boolean

  isFloat32Array(): boolean

  isFloat64Array(): boolean

  isBigInt64Array(): boolean

  isBigUint64Array(): boolean

  isDataView(): boolean

  isModuleNamespace(): boolean

  isFunction(): boolean

  isAsyncFunction(): boolean

  isGeneratorFunction(): boolean

  isExternal(): boolean

  isBigInt(): boolean
}

declare function type(value: unknown): Type

declare namespace type {
  export function createTag(...components: number[]): Uint32Array

  export function addTag(object: object, tag: Uint32Array): void

  export function checkTag(object: object, tag: Uint32Array): boolean
}

export = type
