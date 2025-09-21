const { isBare } = require('which-runtime')

if (isBare) {
  const originalProcess = global.process
  global.process = require('bare-process')

  try { module.exports = require('v8-to-istanbul', { with: { imports: './package.json' } }) } finally { global.process = originalProcess }
} else {
  module.exports = require('v8-to-istanbul')
}
