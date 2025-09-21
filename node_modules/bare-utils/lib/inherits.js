module.exports = function inherits(ctor, superCtor) {
  if (superCtor) Object.setPrototypeOf(ctor.prototype, superCtor.prototype)
}
