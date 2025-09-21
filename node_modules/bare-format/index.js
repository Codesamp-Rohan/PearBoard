const inspect = require('bare-inspect')

module.exports = exports = function format(...args) {
  return exports.formatWithOptions({}, ...args)
}

exports.format = exports

exports.formatWithOptions = function formatWithOptions(opts, ...args) {
  const format = args[0]

  let result = ''
  let join = ''
  let i = 0

  if (typeof format === 'string') {
    if (args.length === 1) return format

    let tmp
    let j = 0
    let c

    for (let k = 0, n = format.length; k < n; k++) {
      c = format.charCodeAt(k)

      if (c === 0x25 /* % */) {
        c = format.charCodeAt(++k)

        if (i < args.length) {
          switch (c) {
            case 0x73 /* s */: {
              const value = args[++i]

              switch (typeof value) {
                case 'string':
                  tmp = value
                  break
                case 'bigint':
                  tmp = inspect(value, { ...opts, color: false })
                  break
                default:
                  tmp = String(value)
                  break
              }

              break
            }

            case 0x64 /* d */: {
              const value = args[++i]

              switch (typeof value) {
                case 'symbol':
                  tmp = NaN
                  break
                case 'bigint':
                  tmp = inspect(value, { ...opts, color: false })
                  break
                default:
                  tmp = inspect(Number(value), { ...opts, color: false })
                  break
              }

              break
            }

            case 0x69 /* i */: {
              const value = args[++i]

              switch (typeof value) {
                case 'symbol':
                  tmp = NaN
                  break
                case 'bigint':
                  tmp = inspect(value, { ...opts, color: false })
                  break
                default:
                  tmp = inspect(parseInt(value, 10), { ...opts, color: false })
                  break
              }

              break
            }

            case 0x66 /* f */: {
              const value = args[++i]

              switch (typeof value) {
                case 'symbol':
                  tmp = NaN
                  break
                default:
                  tmp = inspect(parseFloat(value), { ...opts, color: false })
                  break
              }

              break
            }

            case 0x4f /* O */:
            case 0x6f /* o */:
              tmp = inspect(args[++i], opts)
              break

            case 0x6a /* j */:
              tmp = JSON.stringify(args[++i])
              break

            case 0x63 /* c */:
              i++
              tmp = ''
              break

            case 0x25 /* % */:
              result += format.substring(j, k)
              j = k + 1
              continue

            default:
              continue
          }

          if (j !== k - 1) result += format.substring(j, k - 1)

          result += tmp
          j = k + 1
        } else if (c === 0x25 /* % */) {
          result += format.substring(j, k)
          j = k + 1
        }
      }
    }

    if (j !== 0) {
      i++
      join = ' '

      if (j < format.length) {
        result += format.substring(j)
      }
    }
  }

  while (i < args.length) {
    const value = args[i++]

    result += join
    result += typeof value === 'string' ? value : inspect(value, opts)

    join = ' '
  }

  return result
}
