const ansiEscapes = require('bare-ansi-escapes')
const getType = require('bare-type')
const binding = require('./binding')

const PLAIN_KEY = /^[a-zA-Z_][a-zA-Z_0-9]*$/

const defaultDepth = 2
const defaultBreakLength = 80
const defaultMaxArrayLength = 40

module.exports = exports = function inspect(value, opts = {}) {
  const {
    colors = false,
    depth = defaultDepth,
    breakLength = defaultBreakLength,
    stylize = defaultStylize(colors)
  } = opts

  const references = new InspectRefMap()

  const tree = inspectValue(value, 0, {
    colors,
    depth,
    breakLength,
    stylize,
    references
  })

  return tree.toString()
}

exports.styles = {
  bigint: ansiEscapes.colorYellow,
  boolean: ansiEscapes.colorYellow,
  date: ansiEscapes.colorMagenta,
  module: ansiEscapes.modifierUnderline,
  name: ansiEscapes.modifierReset,
  null: ansiEscapes.modifierBold,
  number: ansiEscapes.colorYellow,
  regexp: ansiEscapes.colorRed,
  special: ansiEscapes.colorCyan,
  string: ansiEscapes.colorGreen,
  symbol: ansiEscapes.colorGreen,
  undefined: ansiEscapes.colorBrightBlack
}

const styles = exports.styles

function defaultStylize(colors) {
  return function stylize(value, style) {
    const color = colors && styles[style]

    if (color) return color + value + ansiEscapes.modifierReset

    return value
  }
}

class InspectRefMap {
  constructor() {
    this.refs = new WeakMap()
    this.ids = new WeakMap()
    this.nextId = 1
  }

  has(object) {
    return this.refs.has(object)
  }

  get(object) {
    return this.refs.get(object) || null
  }

  set(object, ref) {
    this.refs.set(object, ref)
  }

  id(object) {
    let id = this.ids.get(object)
    if (id) return id

    id = this.nextId++
    this.ids.set(object, id)

    return id
  }
}

class InspectNode {
  constructor(depth, length, opts) {
    const { breakLength = defaultBreakLength, breakAlways = false } = opts

    this.depth = depth
    this.length = length
    this.breakLength = breakLength
    this.breakAlways = breakAlways
  }

  pad(n, string) {
    return string.padStart(n, ' ')
  }

  indent(n, string) {
    return '  '.repeat(n) + string
  }
}

class InspectRef extends InspectNode {
  constructor(depth, opts) {
    super(depth, '[circular *]'.length, opts)

    this.refs = opts.references
    this.count = 0
    this.circular = false
    this.color = opts.colors && styles.special
  }

  get id() {
    return this.refs.id(this)
  }

  increment() {
    return ++this.count
  }

  decrement() {
    return --this.count
  }

  toString(opts = {}) {
    const { offset = 0, pad = 0, indent = 0 } = opts

    let value = this.pad(pad, '[circular *' + this.id + ']')

    if (this.color) value = this.color + value + ansiEscapes.modifierReset

    return offset ? value : this.indent(indent, value)
  }
}

class InspectLeaf extends InspectNode {
  constructor(value, color, depth, opts) {
    const length = value.length

    super(depth, length, opts)

    this.value = value
    this.color = opts.colors && color
  }

  toString(opts = {}) {
    const { offset = 0, pad = 0, indent = 0 } = opts

    let value = this.pad(pad, this.value)

    if (this.color) value = this.color + value + ansiEscapes.modifierReset

    return offset ? value : this.indent(indent, value)
  }
}

class InspectPair extends InspectNode {
  constructor(delim, left, right, depth, opts) {
    const length = left.length + delim.length + right.length

    super(depth, length, opts)

    this.delim = delim
    this.left = left
    this.right = right
  }

  toString(opts = {}) {
    const { indent = 0 } = opts

    return this.indent(
      indent,
      this.left +
        this.delim +
        this.right.toString({
          indent,
          offset: this.left.length + this.delim.length
        })
    )
  }
}

class InspectSuspension extends InspectNode {
  constructor(overflow, depth, opts) {
    const label = `... ${overflow} more`

    super(depth, label.length, opts)

    this.overflow = overflow
    this.label = label
  }

  toString(opts = {}) {
    const { indent = 0 } = opts

    return this.indent(indent, this.label)
  }
}

class InspectSequence extends InspectNode {
  constructor(header, footer, delim, values, ref, depth, opts) {
    const { tabulate = false } = opts

    const length =
      (ref.circular ? '<ref *>'.length + 1 : 0) +
      header.length +
      values.reduce(
        (length, value, i) =>
          length + value.length + (i === 0 ? 0 : delim.length),
        0
      ) +
      footer.length

    super(depth, length, opts)

    this.header = header
    this.footer = footer
    this.delim = delim
    this.values = values
    this.ref = ref
    this.tabulate = tabulate
  }

  toString(opts = {}) {
    const { offset = 0, indent = 0 } = opts

    const split =
      this.values.length &&
      (offset + this.length > this.breakLength ||
        indent * 2 + this.length > this.breakLength)

    let header = this.header

    if (this.ref.circular) {
      header = '<ref *' + this.ref.id + '> ' + header
    }

    if (this.values.length === 0) {
      header = header.trimEnd()
    }

    if (offset === 0) {
      header = this.indent(indent, header)
    }

    if (split) {
      header = header.trimEnd() + '\n'
    }

    let string = header

    let columns = 1
    let pad = 0

    if (this.tabulate) {
      const widest = this.values.reduce(
        (length, value) =>
          value.breakAlways ? length : Math.max(length, value.length),
        0
      )

      if (widest) {
        columns = Math.max(
          columns,
          Math.floor(
            (this.breakLength - indent * 2) / (widest + this.delim.length)
          )
        )

        if (columns > 1) pad = widest
      }
    }

    for (let i = 0, n = this.values.length, offset = 0; i < n; i++) {
      const value = this.values[i]

      if (split) {
        let part

        if (i % columns === 0 || value.breakAlways) {
          part = value.toString({ indent: indent + 1, pad })
        } else {
          part = value.toString({ pad })
        }

        string += part

        if (i < n - 1) {
          if (i % columns === columns - 1 || this.values[i + 1].breakAlways) {
            string += this.delim.trimEnd() + '\n'
          } else {
            string += this.delim
          }
        }
      } else {
        if (i > 0) string += this.delim

        string += value.toString({ offset })

        offset += value.length
      }
    }

    let footer = this.footer

    if (this.values.length === 0) {
      footer = footer.trimStart()
    }

    if (split) {
      string += '\n' + this.indent(indent, footer.trimStart())
    } else {
      string += footer
    }

    return string
  }
}

function inspectValue(value, depth, opts) {
  const type = getType(value)

  if (type.isUndefined()) return inspectUndefined(depth, opts)
  if (type.isNull()) return inspectNull(depth, opts)
  if (type.isBoolean()) return inspectBoolean(value, depth, opts)
  if (type.isNumber()) return inspectNumber(value, depth, opts)
  if (type.isBigInt()) return inspectBigInt(value, depth, opts)
  if (type.isString()) return inspectString(value, depth, opts)
  if (type.isSymbol()) return inspectSymbol(value, depth, opts)
  if (type.isObject()) return inspectObject(type, value, depth, opts)
  if (type.isFunction()) return inspectFunction(type, value, depth, opts)
  if (type.isExternal()) return inspectExternal(value, opts, opts)
}

function inspectUndefined(depth, opts) {
  return new InspectLeaf('undefined', styles.undefined, depth, opts)
}

function inspectNull(depth, opts) {
  return new InspectLeaf('null', styles.null, depth, opts)
}

function inspectBoolean(value, depth, opts) {
  return new InspectLeaf(value.toString(), styles.boolean, depth, opts)
}

function inspectNumber(value, depth, opts) {
  let string

  if (Object.is(value, -0)) {
    string = '-0'
  } else {
    string = value.toString(10)
  }

  return new InspectLeaf(string, styles.number, depth, opts)
}

function inspectBigInt(value, depth, opts) {
  return new InspectLeaf(value.toString(10) + 'n', styles.bigint, depth, opts)
}

function inspectString(value, depth, opts) {
  const string = value
    .replace(/'/g, "\\'")

    // Escape control characters
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t')

  return new InspectLeaf("'" + string + "'", styles.string, depth, opts)
}

function inspectSymbol(value, depth, opts) {
  return new InspectLeaf(value.toString(), styles.symbol, depth, opts)
}

function inspectKey(value, depth, opts) {
  if (PLAIN_KEY.test(value)) {
    return new InspectLeaf(value, null, depth, opts)
  } else {
    return inspectValue(value, depth, opts)
  }
}

function inspectObject(type, object, depth, opts) {
  const refs = opts.references

  let ref = refs.get(object)
  if (ref === null) {
    ref = new InspectRef(depth, opts)
    refs.set(object, ref)
  } else if (ref.count) {
    ref.circular = true
    return ref
  }

  const maxDepth = typeof opts.depth === 'number' ? opts.depth : Infinity

  if (maxDepth < depth) {
    const constructor = object.constructor

    return new InspectLeaf(
      '[' +
        (constructor && constructor.name ? constructor.name : 'Object') +
        ']',
      styles.special,
      depth,
      opts
    )
  }

  const inspect =
    object[Symbol.for('bare.inspect')] ||
    object[Symbol.for('nodejs.util.inspect.custom')]

  if (typeof inspect === 'function') {
    const value = inspect.call(
      object,
      typeof opts.depth === 'number' ? opts.depth - depth : null,
      {
        colors: opts.colors,
        breakLength: opts.breakLength,
        stylize: opts.stylize
      },
      exports
    )

    if (typeof value === 'object' && value !== null) {
      refs.set(value, ref)
    }

    if (typeof value !== 'string') {
      return inspectValue(value, depth, opts)
    }

    return value
  }

  if (type.isArray()) return inspectArray(object, ref, depth, opts)
  if (type.isDate()) return inspectDate(object, ref, depth, opts)
  if (type.isRegExp()) return inspectRegExp(object, ref, depth, opts)
  if (type.isError()) return inspectError(object, ref, depth, opts)
  if (type.isPromise()) return inspectPromise(object, ref, depth, opts)
  if (type.isMap()) return inspectMap(object, ref, depth, opts)
  if (type.isSet()) return inspectSet(object, ref, depth, opts)
  if (type.isWeakMap()) return inspectWeakMap(object, ref, depth, opts)
  if (type.isWeakSet()) return inspectWeakSet(object, ref, depth, opts)
  if (type.isWeakRef()) return inspectWeakRef(object, ref, depth, opts)
  if (type.isArrayBuffer()) return inspectArrayBuffer(object, ref, depth, opts)
  if (type.isSharedArrayBuffer())
    return inspectSharedArrayBuffer(object, ref, depth, opts)
  if (type.isTypedArray()) return inspectTypedArray(object, ref, depth, opts)
  if (type.isDataView()) return inspectDataView(object, ref, depth, opts)

  ref.increment()

  const values = []

  for (const key in object) {
    if (key === 'constructor') continue

    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(object[key], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  ref.decrement()

  let header = '{ '

  const tag = object[Symbol.toStringTag]

  if (tag) header = '[' + tag + '] ' + header

  if (object.constructor) {
    const name = object.constructor.name

    if (name && name !== 'Object') {
      header = object.constructor.name + ' ' + header
    }
  }

  return new InspectSequence(header, ' }', ', ', values, ref, depth, opts)
}

function inspectArray(array, ref, depth, opts) {
  const { maxArrayLength = defaultMaxArrayLength } = opts

  ref.increment()

  const values = []

  let remaining = Math.max(maxArrayLength, 0)

  for (let i = 0, n = array.length; i < n; i++) {
    if (remaining-- === 0) {
      values.push(
        new InspectSuspension(array.length - values.length, depth + 1, {
          ...opts,
          breakAlways: true
        })
      )

      break
    }

    values.push(inspectValue(array[i], depth + 1, opts))
  }

  for (const key of binding.getOwnNonIndexPropertyNames(array)) {
    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(array[key], depth + 1, opts),
        depth + 1,
        { ...opts, breakAlways: remaining < 0 }
      )
    )
  }

  ref.decrement()

  let header = '[ '

  if (array.constructor.name !== 'Array') {
    header = array.constructor.name + '(' + array.length + ') ' + header
  }

  return new InspectSequence(header, ' ]', ', ', values, ref, depth, {
    ...opts,
    tabulate: true
  })
}

function inspectDate(date, ref, depth, opts) {
  return new InspectLeaf(date.toISOString(), styles.date, depth, opts)
}

function inspectRegExp(regExp, ref, depth, opts) {
  return new InspectLeaf(regExp.toString(), styles.regexp, depth, opts)
}

function inspectError(error, ref, depth, opts) {
  let header

  if ('stack' in error) {
    header = error.stack

    if (depth > 0) {
      header = header.replaceAll('\n', '\n' + '  '.repeat(depth))
    }
  } else {
    header = error.toString()
  }

  const builtins = ['cause']

  if (error.name === 'AggregateError') {
    builtins.push('errors')
  } else if (error.name === 'SuppressedError') {
    builtins.push('error', 'suppressed')
  }

  const values = []

  for (const key of builtins) {
    if (key in error === false) continue

    values.push(
      new InspectPair(
        ': ',
        new InspectLeaf('[' + key + ']', null, depth + 1, opts),
        inspectValue(error[key], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  for (const key in error) {
    if (key === 'constructor' || builtins.includes(key)) continue

    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(error[key], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  if (values.length === 0) return new InspectLeaf(header, null, depth, opts)

  return new InspectSequence(
    header + ' {',
    ' }',
    ', ',
    values,
    ref,
    depth,
    opts
  )
}

function inspectPromise(promise, ref, depth, opts) {
  ref.increment()

  const state = binding.getPromiseState(promise)

  const values = []

  switch (state) {
    case 0: // Pending
      values.push(new InspectLeaf('<pending>', styles.special, depth, opts))
      break

    case 1: // Fulfilled
      values.push(inspectValue(binding.getPromiseResult(promise), depth, opts))
      break

    case 2: // Rejected
      values.push(
        new InspectLeaf('<rejected>', styles.special, depth, opts),
        inspectValue(binding.getPromiseResult(promise), depth, opts)
      )
  }

  ref.decrement()

  const header = promise.constructor.name + ' { '

  return new InspectSequence(header, ' }', ' ', values, ref, depth, opts)
}

function inspectMap(map, ref, depth, opts) {
  const {
    maxArrayLength = defaultMaxArrayLength,
    maxMapLength = maxArrayLength
  } = opts

  ref.increment()

  const values = []

  let remaining = maxMapLength

  for (const entry of map) {
    if (remaining-- === 0) {
      values.push(
        new InspectSuspension(map.size - values.length, depth + 1, {
          ...opts,
          breakAlways: true
        })
      )
      break
    }

    values.push(
      new InspectPair(
        ' => ',
        inspectValue(entry[0], depth + 1, opts),
        inspectValue(entry[1], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  for (const key in map) {
    if (key === 'constructor') continue

    const value = inspectValue(map[key], depth + 1, opts)

    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        value,
        depth + 1,
        { ...opts, breakAlways: remaining < 0 }
      )
    )
  }

  ref.decrement()

  const header = map.constructor.name + '(' + map.size + ') { '

  return new InspectSequence(header, ' }', ', ', values, ref, depth, {
    ...opts,
    tabulate: true
  })
}

function inspectSet(set, ref, depth, opts) {
  const {
    maxArrayLength = defaultMaxArrayLength,
    maxSetLength = maxArrayLength
  } = opts

  ref.increment()

  const values = []

  let remaining = maxSetLength

  for (const entry of set) {
    if (remaining-- === 0) {
      values.push(
        new InspectSuspension(set.size - values.length, depth + 1, {
          ...opts,
          breakAlways: true
        })
      )
      break
    }

    values.push(inspectValue(entry, depth + 1, opts))
  }

  for (const key in set) {
    if (key === 'constructor') continue

    const value = inspectValue(set[key], depth + 1, opts)

    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        value,
        depth + 1,
        { ...opts, breakAlways: remaining < 0 }
      )
    )
  }

  ref.decrement()

  const header = set.constructor.name + '(' + set.size + ') { '

  return new InspectSequence(header, ' }', ', ', values, ref, depth, {
    ...opts,
    tabulate: true
  })
}

function inspectWeakMap(weakMap, ref, depth, opts) {
  const header = weakMap.constructor.name + ' { '

  return new InspectSequence(
    header,
    ' }',
    ' ',
    [new InspectLeaf('<items unknown>', styles.special, depth + 1, opts)],
    ref,
    depth,
    opts
  )
}

function inspectWeakSet(weakSet, ref, depth, opts) {
  const header = weakSet.constructor.name + ' { '

  return new InspectSequence(
    header,
    ' }',
    ' ',
    [new InspectLeaf('<items unknown>', styles.special, depth + 1, opts)],
    ref,
    depth,
    opts
  )
}

function inspectWeakRef(weakRef, ref, depth, opts) {
  const target = weakRef.deref()

  let value

  if (target === undefined) {
    value = new InspectLeaf('<cleared>', styles.special, depth + 1, opts)
  } else {
    value = inspectValue(target, depth + 1, opts)
  }

  const header = weakRef.constructor.name + ' { '

  return new InspectSequence(header, ' }', ' ', [value], ref, depth, opts)
}

function inspectArrayBuffer(arrayBuffer, ref, depth, opts) {
  ref.increment()

  const values = []

  for (const key of ['byteLength']) {
    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(arrayBuffer[key], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  ref.decrement()

  const header = arrayBuffer.constructor.name + ' { '

  return new InspectSequence(header, ' }', ', ', values, ref, depth, opts)
}

function inspectSharedArrayBuffer(sharedArrayBuffer, ref, depth, opts) {
  ref.increment()

  const values = []

  for (const key of ['byteLength']) {
    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(sharedArrayBuffer[key], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  ref.decrement()

  const header = sharedArrayBuffer.constructor.name + ' { '

  return new InspectSequence(header, ' }', ', ', values, ref, depth, opts)
}

function inspectTypedArray(typedArray, ref, depth, opts) {
  if (Buffer.isBuffer(typedArray)) {
    return inspectBuffer(typedArray, ref, depth, opts)
  }

  const {
    maxArrayLength = defaultMaxArrayLength,
    maxTypedArrayLength = maxArrayLength
  } = opts

  ref.increment()

  const values = []

  let remaining = Math.max(maxTypedArrayLength, 0)

  for (let i = 0, n = typedArray.length; i < n; i++) {
    if (remaining-- === 0) {
      values.push(
        new InspectSuspension(typedArray.length - values.length, depth + 1, {
          ...opts,
          breakAlways: true
        })
      )

      break
    }

    values.push(inspectValue(typedArray[i], depth + 1, opts))
  }

  for (const key of binding.getOwnNonIndexPropertyNames(typedArray)) {
    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(typedArray[key], depth + 1, opts),
        depth + 1,
        { ...opts, breakAlways: remaining < 0 }
      )
    )
  }

  ref.decrement()

  const header = typedArray.constructor.name + '(' + typedArray.length + ') [ '

  return new InspectSequence(header, ' ]', ', ', values, ref, depth, {
    ...opts,
    tabulate: true
  })
}

function inspectBuffer(buffer, ref, depth, opts) {
  const {
    maxArrayLength = defaultMaxArrayLength,
    maxBufferLength = maxArrayLength
  } = opts

  ref.increment()

  const values = []

  let remaining = Math.max(maxBufferLength, 0)

  for (let i = 0, n = buffer.byteLength; i < n; i++) {
    if (remaining-- === 0) {
      values.push(
        new InspectSuspension(buffer.length - values.length, depth + 1, {
          ...opts,
          breakAlways: true
        })
      )

      break
    }

    values.push(
      new InspectLeaf(
        buffer[i].toString(16).padStart(2, '0'),
        null,
        depth + 1,
        opts
      )
    )
  }

  for (const key of binding.getOwnNonIndexPropertyNames(buffer)) {
    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(buffer[key], depth + 1, opts),
        depth + 1,
        { ...opts, breakAlways: remaining < 0 }
      )
    )
  }

  ref.decrement()

  return new InspectSequence('<Buffer ', '>', ' ', values, ref, depth, {
    ...opts,
    tabulate: true
  })
}

function inspectDataView(dataView, ref, depth, opts) {
  ref.increment()

  const values = []

  for (const key of ['byteLength', 'byteOffset', 'buffer']) {
    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(dataView[key], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  for (const key of binding.getOwnNonIndexPropertyNames(dataView)) {
    values.push(
      new InspectPair(
        ': ',
        inspectKey(key, depth + 1, opts),
        inspectValue(dataView[key], depth + 1, opts),
        depth + 1,
        opts
      )
    )
  }

  ref.decrement()

  const header = dataView.constructor.name + ' { '

  return new InspectSequence(header, ' }', ', ', values, ref, depth, opts)
}

function inspectFunction(type, fn, depth, opts) {
  if (fn.toString().startsWith('class')) return inspectClass(fn, depth, opts)

  let tag = 'function'

  if (type.isGeneratorFunction()) tag = 'generator ' + tag
  if (type.isAsyncFunction()) tag = 'async ' + tag

  return new InspectLeaf(
    '[' + tag + ' ' + (fn.name ? fn.name : '(anonymous)') + ']',
    styles.special,
    depth,
    opts
  )
}

function inspectClass(ctor, depth, opts) {
  return new InspectLeaf(
    '[class ' + (ctor.name ? ctor.name : '(anonymous)') + ']',
    styles.special,
    depth,
    opts
  )
}

function inspectExternal(external, depth, opts) {
  return new InspectLeaf(
    '[external 0x' + binding.getExternal(external).toString(16) + ']',
    styles.special,
    depth,
    opts
  )
}
