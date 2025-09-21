/* global Bare */
const EventEmitter = require('bare-events')
const url = require('bare-url')
const ws = require('bare-ws')
const http = require('bare-http1')
const Session = require('./session')

module.exports = class InspectorServer extends EventEmitter {
  constructor(port, host, opts = {}) {
    if (typeof port === 'object' && port !== null) {
      opts = port
      port = 0
      host = 'localhost'
    } else if (typeof host === 'object' && host !== null) {
      opts = host
      host = 'localhost'
    }

    const { path = require.main.path } = opts

    super()

    this._path = typeof path === 'string' ? url.pathToFileURL(path) : path
    this._sessions = new Map()

    this._server = new ws.Server(
      {
        server: new http.Server(this._onrequest.bind(this)).listen(
          { port, host },
          this._onlistening.bind(this)
        )
      },
      this._onconnection.bind(this)
    )
  }

  get listening() {
    return this._server.listening
  }

  address() {
    return this._server.address()
  }

  close(cb) {
    for (const socket of this._sessions.keys()) socket.destroy()

    return this._server.close(cb)
  }

  ref() {
    this._server.ref()
  }

  unref() {
    this._server.unref()
  }

  _onlistening() {
    this.emit('listening')
  }

  _onrequest(req, res) {
    if (req.url === '/json/list') return this._onlist(req, res)

    res.writeHead(404)
    res.end()
  }

  _onconnection(socket) {
    const sessions = this._sessions

    const session = new Session()

    sessions.set(socket, session)

    session.on('inspectorNotification', onnotification).connect()

    socket.on('close', onclose).on('data', ondata)

    function onnotification(message) {
      socket.write(JSON.stringify(message))
    }

    function onclose() {
      session.destroy()
      sessions.delete(socket)
    }

    function ondata(data) {
      const { id, method, params } = JSON.parse(data)

      session.post(method, params, (err, result) => {
        const response = err ? { id, error: err } : { id, result }

        socket.write(JSON.stringify(response))
      })
    }
  }

  _onlist(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })

    const { address, port } = this.address()

    res.end(
      JSON.stringify([
        {
          title: `bare[${Bare.pid}]`,
          id: `${Bare.pid}`,
          type: 'node',
          url: this._path,
          devtoolsFrontendUrl: `devtools://devtools/bundled/js_app.html?ws=${address}:${port}`,
          webSocketDebuggerUrl: `ws://${address}:${port}`,
          faviconUrl: 'https://holepunch.to/favicon.ico'
        }
      ])
    )
  }
}
