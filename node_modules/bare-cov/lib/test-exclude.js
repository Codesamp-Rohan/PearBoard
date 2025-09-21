const { isWindows } = require('which-runtime')
const path = require('path')
const process = require('process')
const picomatch = require('picomatch')

const DEFAULT_EXCLUDES = [
  'coverage/**',
  'packages/*/test{,s}/**',
  '**/*.d.ts',
  'test{,s}/**',
  'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
  '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
  '**/__tests__/**',
  '**/{ava,babel,nyc}.config.{js,cjs,mjs}',
  '**/jest.config.{js,cjs,mjs,ts}',
  '**/{karma,rollup,webpack}.config.js',
  '**/.{eslint,mocha}rc.{js,cjs}'
]

const DEFAULT_EXTENSIONS = ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx']

function isOutsideDir (dir, filename) {
  return isWindows
    ? !path.resolve(dir, filename).startsWith(path.resolve(dir) + path.sep)
    : /^\.\./.test(path.relative(dir, filename))
}

// Based off https://github.com/istanbuljs/test-exclude/blob/master/index.js with glob-related code removed and minimatch replaced with picomatch
class TestExclude {
  constructor (opts = {}) {
    this.cwd = opts.cwd ?? process.cwd()
    this.include = opts.include ?? []
    this.exclude = opts.exclude ?? DEFAULT_EXCLUDES
    this.extension = opts.extension ?? DEFAULT_EXTENSIONS
    this.excludeNodeModules = opts.excludeNodeModules || true
    this.relativePath = opts.relativePath || true

    if (typeof this.include === 'string') this.include = [this.include]
    if (typeof this.exclude === 'string') this.exclude = [this.exclude]

    if (typeof this.extension === 'string') this.extension = [this.extension]
    else if (this.extension.length === 0) this.extension = false

    if (this.include && this.include.length > 0) this.include = prepGlobPatterns([].concat(this.include))
    else this.include = false

    if (this.excludeNodeModules && !this.exclude.includes('**/node_modules/**')) this.exclude = this.exclude.concat('**/node_modules/**')

    this.exclude = prepGlobPatterns([].concat(this.exclude))

    this.handleNegation()
  }

  /* handle the special case of negative globs
   * (!**foo/bar); we create a new this.excludeNegated set
   * of rules, which is applied after excludes and we
   * move excluded include rules into this.excludes.
   */
  handleNegation () {
    const noNeg = e => e.charAt(0) !== '!'
    const onlyNeg = e => e.charAt(0) === '!'
    const stripNeg = e => e.slice(1)

    if (Array.isArray(this.include)) {
      const includeNegated = this.include.filter(onlyNeg).map(stripNeg)
      this.exclude.push(...prepGlobPatterns(includeNegated))
      this.include = this.include.filter(noNeg)
    }

    this.excludeNegated = this.exclude.filter(onlyNeg).map(stripNeg)
    this.exclude = this.exclude.filter(noNeg)
    this.excludeNegated = prepGlobPatterns(this.excludeNegated)
  }

  shouldInstrument (filename, relFile) {
    if (this.extension && !this.extension.some(ext => filename.endsWith(ext))) return false

    let pathToCheck = filename

    if (this.relativePath) {
      relFile = relFile || path.relative(this.cwd, filename)

      // Don't instrument files that are outside of the current working directory.
      if (isOutsideDir(this.cwd, filename)) return false

      pathToCheck = relFile.replace(/^\.[\\/]/, '') // remove leading './' or '.\'.
    }

    const dot = { dot: true, windows: isWindows }
    const matches = pattern => picomatch.isMatch(pathToCheck, pattern, dot)
    return ((!this.include || this.include.some(matches)) && (!this.exclude.some(matches) || this.excludeNegated.some(matches)))
  }
}

function prepGlobPatterns (patterns) {
  return patterns.reduce((result, pattern) => {
    // Allow gitignore style of directory exclusion
    if (!/\/\*\*$/.test(pattern)) result = result.concat(pattern.replace(/\/$/, '') + '/**')

    // Any rules of the form **/foo.js, should also match foo.js.
    if (/^\*\*\//.test(pattern)) result = result.concat(pattern.replace(/^\*\*\//, ''))

    return result.concat(pattern)
  }, [])
}

module.exports = TestExclude
