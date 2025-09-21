function summarizeFileCoverage (file) {
  const summary = {
    total: { statements: 0, branches: 0, functions: 0, lines: 0 },
    covered: { statements: 0, branches: 0, functions: 0, lines: 0 },
    uncovered: { lines: [] }
  }

  if (file.s) {
    const statements = Object.values(file.s)
    summary.total.statements = statements.length
    summary.covered.statements = statements.filter(hitCount => hitCount > 0).length
  }

  if (file.b) {
    for (const branch of Object.values(file.b)) {
      summary.total.branches += branch.length
      summary.covered.branches += branch.filter(hitCount => hitCount > 0).length
    }
  }

  if (file.f) {
    const functions = Object.values(file.f)
    summary.total.functions = functions.length
    summary.covered.functions = functions.filter(hitCount => hitCount > 0).length
  }

  let lineCoverage = file.l
  if (!lineCoverage && file.s && file.statementMap) {
    lineCoverage = {}
    for (const [statementId, hitCount] of Object.entries(file.s)) {
      const statementInfo = file.statementMap[statementId]
      if (!statementInfo) continue

      const { line } = statementInfo.start
      const lastCount = lineCoverage[line]
      if (lastCount === undefined || lastCount < hitCount) lineCoverage[line] = hitCount
    }
  }

  const lines = Object.entries(lineCoverage)
  summary.total.lines = lines.length
  for (const [line, hitCount] of lines) {
    if (hitCount > 0) summary.covered.lines++
    else summary.uncovered.lines.push(line)
  }

  return summary
}

module.exports = function summarizeCoverage (coverageData) {
  const summary = {
    total: { statements: 0, branches: 0, functions: 0, lines: 0 },
    covered: { statements: 0, branches: 0, functions: 0, lines: 0 }
  }

  const fileSummaries = {}

  for (const [filename, file] of Object.entries(coverageData)) {
    const fileSummary = fileSummaries[filename] = summarizeFileCoverage(file)

    summary.total.statements += fileSummary.total.statements
    summary.covered.statements += fileSummary.covered.statements
    summary.total.branches += fileSummary.total.branches
    summary.covered.branches += fileSummary.covered.branches
    summary.total.functions += fileSummary.total.functions
    summary.covered.functions += fileSummary.covered.functions
    summary.total.lines += fileSummary.total.lines
    summary.covered.lines += fileSummary.covered.lines
  }

  return {
    summary,
    fileSummaries
  }
}
