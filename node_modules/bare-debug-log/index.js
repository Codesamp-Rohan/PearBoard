const os = require('bare-os')

const pid = os.pid()
const env = os.getEnv('BARE_DEBUG') || os.getEnv('NODE_DEBUG') || ''

const test = new RegExp(
  `^${env.replace(/[|\\{}()[\]^$+?.]/g, '\\$&').replace(/\*/g, '.*').replace(/,/g, '$|^')}$`,
  'i'
)

module.exports = function debug (section) {
  section = section.toUpperCase()

  const enabled = test.test(section)

  function debug (...args) {
    if (enabled) console.error('%s %s:', section, pid, ...args)
  }

  debug.enabled = enabled

  return debug
}
