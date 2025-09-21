const EventEmitter = require('bare-events')
const binding = require('../binding')
const constants = require('./constants')

module.exports = class InspectorSession extends EventEmitter {
  constructor(onpaused) {
    super()

    this._state = 0

    this._nextId = 1
    this._requests = new Map()

    this._onpaused = onpaused || defaultPaused

    this._handle = binding.create(this, this._onresponse, this._onpaused)
  }

  get connected() {
    return (
      (this._state & constants.state.CONNECTED) !== 0 &&
      (this._state & constants.state.DESTROYED) === 0
    )
  }

  get destroyed() {
    return (this._state & constants.state.DESTROYED) !== 0
  }

  connect() {
    if (this._state & (constants.state.CONNECTED | constants.state.DESTROYED))
      return

    this._state |= constants.state.CONNECTED

    binding.connect(this._handle)
  }

  post(method, params, cb) {
    if (typeof params === 'function') {
      cb = params
      params = null
    }

    let result

    if (typeof cb !== 'function') {
      result = new Promise((resolve, reject) => {
        cb = (err, result) => {
          if (err) reject(err)
          else resolve(result)
        }
      })
    }

    const id = this._nextId++

    const req = {
      id,
      callback: cb
    }

    this._requests.set(id, req)

    binding.post(
      this._handle,
      JSON.stringify({
        id,
        method,
        params
      })
    )

    return result
  }

  destroy() {
    if (this._state & constants.state.DESTROYED) return

    this._state |= constants.state.DESTROYED

    binding.destroy(this._handle)
  }

  _onresponse(string) {
    const message = JSON.parse(string)

    if (message.method) {
      this.emit(message.method, message)
      this.emit('inspectorNotification', message)
    } else {
      const req = this._requests.get(message.id)

      if (req) {
        this._requests.delete(message.id)

        let err = null

        if (message.error) {
          err = new Error(message.error.message)
          err.code = message.error.code
        }

        req.callback(err, message.result)
      }
    }
  }
}

function defaultPaused() {
  return false
}
