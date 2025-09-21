const path = require('path')
const process = require('process')

// TODO: colorize output if available

const PERCENT_WIDTH = 9
const DIR_INDENT = 1
const FILE_INDENT = 2
const TERMINAL_WIDTH = process?.stdout?.columns ?? 80
const STATIC_WIDTH = PERCENT_WIDTH * 4 + 6 // 4 percent columns + 5 separators and 1 branch col space
const MIN_NAME_WIDTH = 5
const MIN_UNCOVERED_WIDTH = 17

function findCommonPath (paths) {
  const getCommon = (a, b) => {
    let i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    return a.slice(0, i)
  }

  if (!paths || paths.length === 0) return []

  const splitPaths = paths.map(p => p.split(path.sep))
  return splitPaths.slice(1).reduce((acc, path) => {
    return getCommon(acc, path)
  }, splitPaths[0])
}

function truncate (str, width, right = false, delimiter = null) {
  if (str.length <= width) return str
  let truncateAt = right ? str.length - width + 1 : width - 1
  if (delimiter) {
    const nextSeparatorIndex = right ? str.indexOf(delimiter, truncateAt) : str.lastIndexOf(delimiter, truncateAt - 1)
    if (nextSeparatorIndex === -1) return '…'
    truncateAt = right ? nextSeparatorIndex : nextSeparatorIndex + 1
  }
  return right ? '…' + str.slice(truncateAt) : str.slice(0, truncateAt) + '…'
}

function toPercent (covered, total) {
  if (total === 0 || covered === total) return '100'
  if (covered === 0) return '0'
  return (covered / total * 100).toFixed(2)
}

function ntimes (n, str) {
  return Array(n).fill(str).join('')
}

function pad (str, width, right) {
  if (str.length >= width) return str
  const fill = ntimes(width - str.length, ' ')
  return right ? str + fill : fill + str
}

function rowSeparator (nameWidth, uncoveredWidth) {
  const name = ntimes(nameWidth, '-')
  const uncovered = ntimes(uncoveredWidth, '-')
  const percent = ntimes(PERCENT_WIDTH, '-')
  const branch = ntimes(PERCENT_WIDTH + 1, '-')
  return [name, percent, branch, percent, percent, uncovered].join('|')
}

function printHeader (nameWidth, uncoveredWidth) {
  const name = pad('File', nameWidth, true)
  const unc = pad(truncate('Uncovered Line #s', uncoveredWidth - 1), uncoveredWidth - 1, true)

  console.log(`${name}| % Stmts | % Branch | % Funcs | % Lines | ${unc}`)
}

function printRow (fileSummary, fileName, nameWidth, uncoveredWidth) {
  const statements = toPercent(fileSummary.covered.statements, fileSummary.total.statements)
  const branches = toPercent(fileSummary.covered.branches, fileSummary.total.branches)
  const functions = toPercent(fileSummary.covered.functions, fileSummary.total.functions)
  const lines = toPercent(fileSummary.covered.lines, fileSummary.total.lines)

  const uncoveredLines = fileSummary?.uncovered?.normalizedLines
    ? fileSummary.uncovered.normalizedLines
    : ' '

  console.log([
    pad(` ${truncate(fileName, nameWidth - 2)} `, nameWidth, true),
    pad(` ${statements} `, PERCENT_WIDTH),
    pad(` ${branches} `, PERCENT_WIDTH + 1),
    pad(` ${functions} `, PERCENT_WIDTH),
    pad(` ${lines} `, PERCENT_WIDTH),
    pad(` ${truncate(uncoveredLines, uncoveredWidth - 2, true, ',')} `, uncoveredWidth, true)
  ].join('|'))
}

function deriveWidths (groupedSummaries) {
  let nameWidth = MIN_NAME_WIDTH
  let uncoveredWidth = MIN_UNCOVERED_WIDTH

  for (const [dirName, dirSummary] of Object.entries(groupedSummaries)) {
    if (dirName.length + DIR_INDENT > nameWidth) nameWidth = dirName.length + DIR_INDENT

    for (const [fileName, fileSummary] of Object.entries(dirSummary.files)) {
      const normalizedLines = fileSummary.uncovered?.normalizedLines
      if (fileName.length + FILE_INDENT > nameWidth) nameWidth = fileName.length + FILE_INDENT
      if (normalizedLines && normalizedLines.length > uncoveredWidth) uncoveredWidth = normalizedLines.length
    }
  }

  // Add left/right space padding
  nameWidth += 2
  uncoveredWidth += 2

  if (nameWidth + uncoveredWidth + STATIC_WIDTH > TERMINAL_WIDTH) {
    const availableWidth = TERMINAL_WIDTH - STATIC_WIDTH
    nameWidth = Math.floor(availableWidth / 2)
    uncoveredWidth = availableWidth - nameWidth
  }

  return { nameWidth, uncoveredWidth }
}

function normalizeUncoveredLines (uncoveredLines) {
  if (!uncoveredLines || uncoveredLines.length === 0) return ''

  const lines = uncoveredLines.map(line => Number(line)).sort((a, b) => a - b)
  const ranges = []
  let start = lines[0]
  let end = start

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === end + 1) {
      end = lines[i]
      continue
    }

    ranges.push(start === end ? `${start}` : `${start}-${end}`)
    start = lines[i]
    end = start
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`)

  return ranges.join(',')
}

function addCoverages (a, b) {
  a.covered.statements += b.covered.statements
  a.covered.branches += b.covered.branches
  a.covered.functions += b.covered.functions
  a.covered.lines += b.covered.lines

  a.total.statements += b.total.statements
  a.total.branches += b.total.branches
  a.total.functions += b.total.functions
  a.total.lines += b.total.lines
}

function groupByDirectory (fileSummaries) {
  const commonPath = findCommonPath(Object.keys(fileSummaries)).join(path.sep)
  const commonDir = path.basename(commonPath)

  const directories = {}
  for (const [filePath, summary] of Object.entries(fileSummaries)) {
    const relativePath = path.relative(commonPath, filePath).replace(/^\.\//g, '')
    const pathName = path.join(commonDir, relativePath)
    const directory = path.dirname(pathName)
    const file = path.basename(pathName)
    if (!directories[directory]) {
      directories[directory] = {
        files: {},
        coverage: {
          total: { statements: 0, branches: 0, functions: 0, lines: 0 },
          covered: { statements: 0, branches: 0, functions: 0, lines: 0 }
        }
      }
    }

    directories[directory].files[file] = summary

    addCoverages(directories[directory].coverage, summary)
  }

  return directories
}

function printBody (grouped, nameWidth, uncoveredWidth) {
  for (const [dirName, dirSummary] of Object.entries(grouped)) {
    printRow(dirSummary.coverage, `${ntimes(DIR_INDENT, ' ')}${dirName}`, nameWidth, uncoveredWidth)
    for (const [fileName, fileSummary] of Object.entries(dirSummary.files)) {
      printRow(fileSummary, `${ntimes(FILE_INDENT, ' ')}${fileName}`, nameWidth, uncoveredWidth)
    }
  }
}

module.exports = function reportCoverage ({ summary, fileSummaries }) {
  Object.values(fileSummaries).forEach((fileSummary) => {
    fileSummary.uncovered.normalizedLines = normalizeUncoveredLines(fileSummary.uncovered.lines)
  })

  const grouped = groupByDirectory(fileSummaries)

  const { nameWidth, uncoveredWidth } = deriveWidths(grouped)

  const separator = rowSeparator(nameWidth, uncoveredWidth)
  const printSeparator = () => console.log(separator)

  printSeparator()
  printHeader(nameWidth, uncoveredWidth)
  printSeparator()

  printRow(summary, 'All files', nameWidth, uncoveredWidth)
  printBody(grouped, nameWidth, uncoveredWidth)

  printSeparator()
}
