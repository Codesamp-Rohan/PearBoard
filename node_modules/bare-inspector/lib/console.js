const binding = require('../binding')

module.exports = class InspectorConsole {
  constructor() {
    for (const method of Object.keys(binding.console)) {
      this[method] = binding.console[method]
    }
  }
}
