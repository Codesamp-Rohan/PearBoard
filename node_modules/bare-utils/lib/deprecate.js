module.exports = function deprecate(fn, msg, code) {
  let warned = false

  return function (...args) {
    if (!warned) {
      warned = true

      if (code) {
        console.warn(`[${code}]`, 'DeprecationWarning:', msg)
      } else {
        console.warn('DeprecationWarning:', msg)
      }
    }

    if (new.target) return Reflect.construct(fn, args, new.target)

    return Reflect.apply(fn, this, args)
  }
}
