const { Readable } = require('bare-stream')

module.exports = class InspectorHeapSnapshot extends Readable {
  constructor(session) {
    super()

    this._session = session
    this._request = null
  }

  _open(cb) {
    const onchunk = ({ params }) => {
      this.push(params.chunk)
    }

    const onclose = ({ error } = {}) => {
      this._session.off('HeapProfiler.addHeapSnapshotChunk', onchunk)

      if (error) this.destroy(error)
      else this.push(null)
    }

    this._session.on('HeapProfiler.addHeapSnapshotChunk', onchunk)

    this._request = this._session.post('HeapProfiler.takeHeapSnapshot')
    this._request.then(onclose, onclose)

    cb()
  }
}
