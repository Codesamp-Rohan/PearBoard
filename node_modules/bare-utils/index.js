const { TextEncoder, TextDecoder } = require('bare-encoding')

exports.TextEncoder = TextEncoder
exports.TextDecoder = TextDecoder

exports.debuglog = require('bare-debug-log')
exports.format = require('bare-format')
exports.formatWithOptions = exports.format.formatWithOptions
exports.inspect = require('bare-inspect')

exports.deprecate = require('./lib/deprecate')
exports.inherits = require('./lib/inherits')
exports.promisify = require('./lib/promisify')
exports.types = require('./lib/types')
