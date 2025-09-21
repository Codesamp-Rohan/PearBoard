module.exports = function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      args.push((err, ...result) => {
        if (err) reject(err)
        else resolve(...result)
      })

      Reflect.apply(fn, this, args)
    })
  }
}
