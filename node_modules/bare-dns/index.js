const binding = require('./binding')

exports.Resolver = class DNSResolver {
  constructor() {
    this._handle = binding.initResolver()
  }

  resolveTxt(hostname, cb = noop) {
    binding.resolveTxt(this._handle, hostname, cb, this)
  }

  destroy() {
    binding.destroyResolver(this._handle)
    this._handle = null
  }

  static global = new this()
}

function onlookup(err, addresses) {
  const req = this

  if (err) return req.cb(err, null, 0)

  const { address, family } = addresses[0]

  return req.cb(null, address, family)
}

function onlookupall(err, addresses) {
  const req = this

  if (err) return req.cb(err, null)

  return req.cb(null, addresses)
}

exports.lookup = function lookup(hostname, opts = {}, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  let { family = 0, all = false } = opts

  if (typeof family === 'string') {
    switch (family) {
      case 'IPv4':
        family = 4
        break
      case 'IPv6':
        family = 6
        break
      default:
        family = 0
    }
  }

  const req = {
    cb,
    handle: null
  }

  req.handle = binding.lookup(
    hostname,
    family || 0,
    all,
    req,
    all ? onlookupall : onlookup
  )
}

exports.resolveTxt = function resolveTxt(hostname, cb) {
  exports.Resolver.global.resolveTxt(hostname, cb)
}

function noop() {}
