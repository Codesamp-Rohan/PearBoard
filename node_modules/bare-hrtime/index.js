const binding = require('./binding')

module.exports = exports = function hrtime(past) {
  let now = binding.hrtime()

  if (past) now -= BigInt(past[0]) * 1000000000n + BigInt(past[1])

  return [Number(now / 1000000000n), Number(now % 1000000000n)]
}

exports.bigint = function hrtime() {
  return binding.hrtime()
}
