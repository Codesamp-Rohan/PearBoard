// Based on https://github.com/istanbuljs/istanbuljs/blob/main/packages/istanbul-lib-coverage/lib/file-coverage.js
const isLineColumn = o => typeof o?.line === 'number' && typeof o?.column === 'number'
const isLoc = o => isLineColumn(o?.start) && isLineColumn(o.end)
const getLoc = o => (isLoc(o) ? o : isLoc(o.loc) ? o.loc : null)

function findNearestContainer (coverageRecord, targetRecordMap) {
  const loc = getLoc(coverageRecord)
  if (!loc) return null

  let container = { nearest: null, distance: null, key: null }
  for (const [key, [, targetCoverageRecord]] of Object.entries(targetRecordMap)) {
    const tLoc = getLoc(targetCoverageRecord)
    if (!tLoc) continue

    const distance = [loc.start.line - tLoc.start.line, loc.start.column - tLoc.start.column, tLoc.end.line - loc.end.line, tLoc.end.column - loc.end.column]
    if (distance[0] < 0 || distance[2] < 0 || (distance[0] === 0 && distance[1] < 0) || (distance[2] === 0 && distance[3] < 0)) continue
    if (container.nearest === null) {
      container = { nearest: targetCoverageRecord, distance, key }
      continue
    }

    const closerBefore = distance[0] < container.distance[0] || (distance[0] === 0 && distance[1] < container.distance[1])
    const closerAfter = distance[2] < container.distance[2] || (distance[2] === 0 && distance[3] < container.distance[3])
    if (closerBefore || closerAfter) container = { nearest: targetCoverageRecord, distance, key }
  }
  return container.key
}

function addContainedHits (hits, coverageRecord, sourceRecord) {
  const container = findNearestContainer(coverageRecord, sourceRecord)
  return container ? addHits(hits, sourceRecord[container][0]) : hits
}

function addHits (a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a + b

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length >= b.length) return a.map((hits, i) => hits + (b[i] || 0))
    return b.map((hits, i) => hits + (a[i] || 0))
  }

  return null
}

function toHitMap (hits, map, toKey) {
  return Object.entries(hits).reduce((acc, [id, value]) => {
    const coverageRecord = map[id]
    if (coverageRecord) acc[toKey(coverageRecord)] = [value, coverageRecord]
    return acc
  }, {})
}

function mergeHitMaps (a, b) {
  const mergedRecords = {}
  for (const [key, [hits, record]] of Object.entries(a)) {
    const matchingValue = b[key]
    const newHits = matchingValue ? addHits(hits, matchingValue[0]) : addContainedHits(hits, record, b)
    mergedRecords[key] = [newHits, record]
  }

  for (const [key, [hits, record]] of Object.entries(b)) {
    if (mergedRecords[key]) continue
    const newHits = addContainedHits(hits, record, a)
    mergedRecords[key] = [newHits, record]
  }

  return Object.values(mergedRecords).reduce((acc, [hits, record], index) => {
    acc.hits[index] = hits
    acc.map[index] = record
    return acc
  }, { hits: {}, map: {} })
}

function mergeCoverages (a, b) {
  const merged = { ...a }

  const toKey = ({ start, end }) => `${start.line}|${start.column}|${end.line}|${end.column}`;
  ({ hits: merged.s, map: merged.statementMap } = mergeHitMaps(toHitMap(a.s, a.statementMap, toKey), toHitMap(b.s, b.statementMap, toKey)))

  const toKeyFn = ({ loc }) => toKey(loc);
  ({ hits: merged.f, map: merged.fnMap } = mergeHitMaps(toHitMap(a.f, a.fnMap, toKeyFn), toHitMap(b.f, b.fnMap, toKeyFn)))

  const toKeyBranch = ({ locations }) => toKey(locations[0]);
  ({ hits: merged.b, map: merged.branchMap } = mergeHitMaps(toHitMap(a.b, a.branchMap, toKeyBranch), toHitMap(b.b, b.branchMap, toKeyBranch)))

  return merged
}

module.exports = mergeCoverages
