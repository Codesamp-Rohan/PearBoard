// app.js — P2P Collaborative Whiteboard (stable networking + text + move)
// Runtime: Pear/Holepunch (browser), Hyperswarm, vanilla canvas
// Keys: Shift = move/drag selection, Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo
// Tools: P (pen), E (eraser), L (line), R (rect), O (ellipse), D (diamond), T (text)

import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import crypto from 'hypercore-crypto'
import {getRandomColorPair} from "./helper.js";

let localPeerId = randomId()
console.log(localPeerId)
let peerName = ''

// ---------- DOM ----------
const $ = (s) => (document.querySelector(s))
const ui = {
  mouse: $('#mouse-follower'),
  setup: $('#setup'),
  loading: $('#loading'),
  toolbar: (document.querySelector('header.toolbar')),
  boardWrap: (document.querySelector('.board-wrap')),
  canvas: ($('#board')),
  overlayCanvas: ($('#overlay')),
  // session controls (from index.html)
  createBtn: ($('#create-canvas')),
  joinBtn: ($('#join-canvas')),
  joinInput: ($('#join-canvas-topic')),
  topicOut: $('#canvas-topic'),
  peersCount: $('#peers-count'),
  localPeerName: $('#local-peer-name'),
  // tools (from index.html)
  tools: ($('#tools')),
  color: ($('#color')),
  size: ($('#size')),
  undo: ($('#undo')),
  redo: ($('#redo')),
  clear: ($('#clear')),
  save: ($('#save')),

  peerNameBtn: $('#username-submit'),
  peerNameInput: $('#username-input'),

  namePopup: $('#name--input--popup')
}

ui.localPeerName.addEventListener('click', (e) => {
  e.preventDefault();
  if (ui.namePopup.classList.contains('hidden')) {
    ui.namePopup.classList.remove('hidden');
  } else {
    ui.namePopup.classList.add('hidden');
  }
});

ui.localPeerName.innerHTML = localPeerId

ui.peerNameBtn.addEventListener('click', e => {
  e.preventDefault();
  const username = ui.peerNameInput.value.trim();
  if (username.length > 0) {
    updatePeerName(localPeerId, username);
    peerName = username;
    ui.localPeerName.innerHTML = peerName
    console.log('Local Peer ID set to', localPeerId, 'Username:', username);
  }
});

// Mouse Follower ---------------------
document.addEventListener("mousemove", (event) => {
  updatePeerCursor(localPeerId, peerName, { x: event.clientX, y: event.clientY });
  if (ui.mouse) ui.mouse.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
  broadcast({ t: 'cursor', from: {name: peerName, id: localPeerId}, x: event.clientX, y: event.clientY });
});

const peerCursors = new Map()
const peerNames = new Map()

function updatePeerName(peerId, name) {
  console.log('Line 61 peerId: ', peerId, 'name: ', name);
  peerNames.set(peerId, name);
}

function updatePeerCursor(peerId, peerName, cursor) {
  peerCursors.set(peerId, { name: peerName, cursor: cursor });
}

// ---------- Canvas & state ----------
const ctx = ui.canvas.getContext('2d', { alpha: true })
let DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1))
function resizeCanvas() {
  const r = ui.boardWrap.getBoundingClientRect()
  ui.canvas.width = Math.floor(r.width * DPR)
  ui.canvas.height = Math.floor(r.height * DPR)
  ui.canvas.style.width = `${r.width}px`
  ui.canvas.style.height = `${r.height}px`
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  requestRender()
}
window.addEventListener('resize', resizeCanvas)

const doc = {
  objects: /** @type {Record<string, WhiteObj>} */({}),
  order: /** @type {string[]} */([]), // z-order
  version: 0
}
/**
 * @typedef {{ id:string, type:'pen'|'eraser'|'line'|'rect'|'ellipse'|'diamond'|'text',
 *   x:number, y:number, w?:number, h?:number,
 *   points?: {x:number,y:number}[], text?:string, font?:string, align?:CanvasTextAlign, baseline?:CanvasTextBaseline,
 *   color:string, size:number, createdBy:string, rev:number }} WhiteObj
 */

let tool = 'pen'
let strokeColor = ui.color.value
let strokeSize = parseInt(ui.size.value, 10)
let drawing = false
let start = null /** @type {null|{x:number,y:number}} */
let activeId = null // currently editing or created element id
let hoverId = null
let isDragging = false
let dragOffset = { x: 0, y: 0 }

// Text editor portal
let textEl = /** @type {HTMLDivElement|null} */(null)

// Undo/redo stacks (store ops)
const undoStack = []
const redoStack = []

// Render flag
let dirty = true
function requestRender() {
  dirty = true
}
function renderNow() {
  if (!dirty) return
  dirty = false
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height)

  // draw in z-order
  for (const id of doc.order) {
    const o = doc.objects[id]
    if (!o) continue
    drawObject(o)
  }

  // hover highlight
  if (hoverId && doc.objects[hoverId]) {
    const o = doc.objects[hoverId]
    drawBounds(o, 'rgba(37,99,235,.35)')
  }
}
function rafLoop() {
  renderNow()
  requestAnimationFrame(rafLoop)
}
requestAnimationFrame(rafLoop)

// ---------- Drawing primitives ----------
function drawObject(o) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = o.type === 'eraser' ? '#ffffff' : o.color
  ctx.lineWidth = o.size

  switch (o.type) {
    case 'pen':
    case 'eraser': {
      const pts = o.points || []
      if (pts.length < 2) break
      if (o.type === 'eraser') ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      break
    }
    case 'line': {
      ctx.beginPath()
      ctx.moveTo(o.x, o.y)
      ctx.lineTo(o.x + (o.w || 0), o.y + (o.h || 0))
      ctx.stroke()
      break
    }
    case 'rect': {
      ctx.strokeRect(o.x, o.y, o.w || 0, o.h || 0)
      break
    }
    case 'ellipse': {
      const rx = Math.abs(o.w || 0) / 2
      const ry = Math.abs(o.h || 0) / 2
      const cx = o.x + (o.w || 0) / 2
      const cy = o.y + (o.h || 0) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'diamond': {
      const w = o.w || 0, h = o.h || 0
      const cx = o.x + w / 2, cy = o.y + h / 2
      ctx.beginPath()
      ctx.moveTo(cx, o.y)
      ctx.lineTo(o.x + w, cy)
      ctx.lineTo(cx, o.y + h)
      ctx.lineTo(o.x, cy)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'text': {
      ctx.fillStyle = o.color
      ctx.font = o.font || '16px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial'
      ctx.textAlign = o.align || 'left'
      ctx.textBaseline = o.baseline || 'top'
      // draw a faint rect for visibility of selection handled elsewhere
      ctx.fillText(o.text || '', o.x, o.y)
      break
    }
  }
  ctx.restore()
}

function drawBounds(o, color = 'rgba(0,0,0,.2)') {
  ctx.save()
  ctx.setLineDash([6, 6])
  ctx.lineWidth = 1
  ctx.strokeStyle = color
  const b = bounds(o)
  ctx.strokeRect(b.x, b.y, b.w, b.h)
  ctx.restore()
}

function bounds(o) {
  switch (o.type) {
    case 'pen':
    case 'eraser': {
      const pts = o.points || []
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity
      for (const p of pts) {
        if (p.x < minx) minx = p.x
        if (p.y < miny) miny = p.y
        if (p.x > maxx) maxx = p.x
        if (p.y > maxy) maxy = p.y
      }
      return { x: minx, y: miny, w: (maxx - minx) || 0, h: (maxy - miny) || 0 }
    }
    case 'line': return { x: Math.min(o.x, o.x + (o.w || 0)), y: Math.min(o.y, o.y + (o.h || 0)),
      w: Math.abs(o.w || 0), h: Math.abs(o.h || 0) }
    case 'rect':
    case 'ellipse':
    case 'diamond': return { x: Math.min(o.x, o.x + (o.w || 0)), y: Math.min(o.y, o.y + (o.h || 0)),
      w: Math.abs(o.w || 0), h: Math.abs(o.h || 0) }
    case 'text': {
      // coarse measure: approximate width via canvas measureText
      ctx.save()
      ctx.font = o.font || '16px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial'
      const metrics = ctx.measureText(o.text || '')
      const w = Math.max(10, metrics.width)
      const h = Math.max(16, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 20)
      ctx.restore()
      return { x: o.x, y: o.y, w, h }
    }
  }
  return { x: o.x, y: o.y, w: Math.abs(o.w || 0), h: Math.abs(o.h || 0) }
}

function pointIn(o, x, y) {
  const b = bounds(o)
  return x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h
}

// ---------- Tool helpers ----------
function selectTool(name) {
  tool = name
  ;[...ui.tools.querySelectorAll('.btn')].forEach(b => {
    b.classList.toggle('active', b.dataset.tool === name)
  })
  closeTextEditor(true)
}

function beginFree(id, type, x, y) {
  const obj = {
    id, type, x, y, points: [{ x, y }], color: strokeColor, size: strokeSize,
    createdBy: localPeerId, rev: 0
  }
  addObject(obj, true)
  activeId = id
}
function addPoint(id, x, y) {
  const o = doc.objects[id]; if (!o || !o.points) return
  o.points.push({ x, y }); o.rev++; bumpDoc()
  requestRender(); queueOp({ t: 'patch', id, path: 'points', push: { x, y } })
}
function finishStroke(id) {
  if (!id) return
  queueOp({ t: 'touch', id }) // bump rev on network
}

// Shape create/resize
function beginShape(id, type, x, y) {
  const obj = { id, type, x, y, w: 0, h: 0, color: strokeColor, size: strokeSize,
    createdBy: localPeerId, rev: 0 }
  addObject(obj, true)
  activeId = id
}
function resizeShape(id, x, y) {
  const o = doc.objects[id]; if (!o) return
  o.w = x - o.x; o.h = y - o.y; o.rev++; bumpDoc()
  requestRender()
  queueOp({ t: 'update', id, patch: { w: o.w, h: o.h, rev: o.rev } })
}

function commitTextFromEditor() {
  if (!textEl) return
  const id = textEl.dataset.id
  const o = doc.objects[id]
  if (!o) { closeTextEditor(true); return }
  const txt = textEl.textContent || ''
  o.text = txt
  o.rev++; bumpDoc()
  requestRender()
  queueOp({ t: 'update', id, patch: { text: o.text, rev: o.rev } })
  closeTextEditor(true)
}

function openTextEditor(x, y, initial = '') {
  closeTextEditor(true)
  const id = randomId()
  const fontPx = Math.max(12, strokeSize * 3)
  const obj = {
    id, type: 'text', x, y, text: initial, color: strokeColor, size: strokeSize,
    font: `${fontPx}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`,
    align: 'left', baseline: 'top', createdBy: localPeerId, rev: 0
  }
  addObject(obj, true)
  activeId = id

  const div = document.createElement('div')
  div.className = 'text-editor'
  div.contentEditable = 'true'
  div.style.left = `${x}px`
  div.style.top = `${y}px`
  div.style.font = obj.font
  div.style.color = obj.color
  div.dataset.id = id
  div.spellcheck = false
  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitTextFromEditor()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeTextEditor(true)
    }
  })
  div.addEventListener('blur', () => commitTextFromEditor())
  ui.boardWrap.appendChild(div)
  textEl = div
  // place caret
  setTimeout(() => {
    div.focus()
    placeCaretAtEnd(div)
  }, 0)
}

function closeTextEditor(commit) {
  if (!textEl) return
  const el = textEl
  textEl = null
  if (commit) {
    // handled in commitTextFromEditor
  }
  if (el.parentNode === ui.boardWrap) {
    ui.boardWrap.removeChild(el)
  }
}

function placeCaretAtEnd(el) {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

// ---------- Scene ops (apply locally + network queue) ----------
function bumpDoc() { doc.version++ }

function addObject(o, isLocal=false) {
  if (doc.objects[o.id]) return // idempotent
  doc.objects[o.id] = o
  doc.order.push(o.id)
  bumpDoc()
  requestRender()
  if (isLocal) {
    pushUndo({ t: 'del', id: o.id, before: o })
    queueOp({ t: 'add', obj: o })
  }
}

function updateObject(id, patch, isLocal=false) {
  const o = doc.objects[id]; if (!o) return
  const before = { ...o }
  Object.assign(o, patch)
  bumpDoc(); requestRender()
  if (isLocal) {
    pushUndo({ t: 'update', id, before, after: { ...o } })
    queueOp({ t: 'update', id, patch })
  }
}

function deleteAll(isLocal=false) {
  const snapshot = JSON.stringify(doc)
  doc.objects = {}
  doc.order = []
  bumpDoc(); requestRender()
  if (isLocal) {
    pushUndo({ t: 'restore', snapshot })
    queueOp({ t: 'clear' })
  }
}

// Undo/redo
function pushUndo(entry) { undoStack.push(entry); redoStack.length = 0 }
function doUndo() {
  const e = undoStack.pop(); if (!e) return
  switch (e.t) {
    case 'del': { // undo add → delete
      const { id, before } = e
      const obj = doc.objects[id]
      if (obj) {
        delete doc.objects[id]
        doc.order = doc.order.filter(x => x !== id)
        bumpDoc(); requestRender()
        queueOp({ t: 'delete', id })
        redoStack.push({ t: 'add', obj: before })
      }
      break
    }
    case 'update': {
      const { id, before, after } = e
      doc.objects[id] = before
      bumpDoc(); requestRender()
      queueOp({ t: 'update', id, patch: before })
      redoStack.push({ t: 'update', id, before: after, after: before })
      break
    }
    case 'restore': {
      const snap = JSON.stringify(doc)
      Object.assign(doc, JSON.parse(e.snapshot))
      bumpDoc(); requestRender()
      queueOp({ t: 'full', snapshot: e.snapshot })
      redoStack.push({ t: 'restore', snapshot: snap })
      break
    }
  }
}
function doRedo() {
  const e = redoStack.pop(); if (!e) return
  switch (e.t) {
    case 'add': addObject(e.obj, true); break
    case 'update': updateObject(e.id, e.after, true); break
    case 'restore': {
      const snap = JSON.stringify(doc)
      Object.assign(doc, JSON.parse(e.snapshot))
      bumpDoc(); requestRender()
      queueOp({ t: 'full', snapshot: e.snapshot })
      undoStack.push({ t: 'restore', snapshot: snap })
      break
    }
  }
}

// ---------- Selection & Move (Shift + drag) ----------
function findTopAt(x, y) {
  for (let i = doc.order.length - 1; i >= 0; i--) {
    const id = doc.order[i]
    const o = doc.objects[id]
    if (o && pointIn(o, x, y)) return o.id
  }
  return null
}

ui.canvas.addEventListener('mousemove', (e) => {
  const { x, y } = toCanvas(e)
  if (drawing && activeId) {
    if (tool === 'pen' || tool === 'eraser') addPoint(activeId, x, y)
    else if (tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'diamond') {
      resizeShape(activeId, x, y)
    }
  } else if (isDragging && activeId) {
    const o = doc.objects[activeId]; if (!o) return
    // apply drag
    const nx = x - dragOffset.x
    const ny = y - dragOffset.y
    const before = { x: o.x, y: o.y }
    // for pen/eraser move all points; for shapes update x/y; for text x/y
    if (o.points) {
      const dx = nx - o.x, dy = ny - o.y
      o.points = o.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
    }
    o.x = nx; o.y = ny; o.rev++; bumpDoc()
    requestRender()
    queueOp({ t: 'move', id: o.id, patch: { x: o.x, y: o.y, points: o.points || null, rev: o.rev } })
    dragOffset.x = x - o.x
    dragOffset.y = y - o.y
  } else {
    // hover detection
    const id = findTopAt(x, y)
    hoverId = id
    ui.canvas.style.cursor = (id && e.shiftKey) ? 'move' : 'crosshair'
    requestRender()
  }
})

ui.canvas.addEventListener('mousedown', (e) => {
  const { x, y } = toCanvas(e)
  if (e.shiftKey) {
    const id = findTopAt(x, y)
    if (id) {
      activeId = id
      isDragging = true
      const o = doc.objects[id]
      const b = bounds(o)
      dragOffset.x = x - b.x
      dragOffset.y = y - b.y
      return
    }
  }
  // normal tools
  drawing = true
  start = { x, y }
  const id = randomId()
  if (tool === 'pen' || tool === 'eraser') beginFree(id, tool, x, y)
  else if (tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'diamond') beginShape(id, tool, x, y)
  else if (tool === 'text') openTextEditor(x, y)
})

window.addEventListener('mouseup', () => {
  if (isDragging) { isDragging = false; activeId = null; return }
  if (!drawing) return
  drawing = false
  if (tool === 'pen' || tool === 'eraser') finishStroke(activeId)
  activeId = null
})

ui.canvas.addEventListener('dblclick', (e) => {
  // quick-edit text on double click if any
  const { x, y } = toCanvas(e)
  const id = findTopAt(x, y)
  if (!id) return
  const o = doc.objects[id]
  if (o.type === 'text') {
    openTextEditor(o.x, o.y, o.text || '')
    // preload existing text
    if (textEl) textEl.textContent = o.text || ''
  }
})

// ---------- Keyboard ----------
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();

  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && k === 'z') {
    e.preventDefault();
    doUndo();
  } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === 'z') {
    e.preventDefault();
    doRedo();
  } else if (k === 'p' && e.shiftKey) {
    selectTool('specialPen');
  } else if (k === 'p' && e.shiftKey) {
    selectTool('pen');
  }
  else if (k === 'e' && e.shiftKey) selectTool('specialEraser');
});


// ---------- UI wiring ----------
ui.tools.addEventListener('click', (e) => {
  const b = (e.target)
  if (b && b.dataset.tool) selectTool(b.dataset.tool)
})
ui.color.addEventListener('input', (e) => {
  strokeColor = ui.color.value
})
ui.size.addEventListener('input', () => {
  strokeSize = parseInt(ui.size.value, 10)
})
ui.undo.addEventListener('click', () => doUndo())
ui.redo.addEventListener('click', () => doRedo())
ui.clear.addEventListener('click', () => deleteAll(true))
ui.save.addEventListener('click', () => savePNG())

// ---------- Create / Join (stable) ----------
let swarm = null
let topicKey = null
let joined = false
const conns = new Set()
let peerCount = 0

ui.createBtn.addEventListener('click', async () => {
  startSession(hex(crypto.randomBytes(32)))
})
ui.joinBtn.addEventListener('click', async () => {
  const t = ui.joinInput.value.trim()
  if (!t) return alert('Enter a topic key')
  startSession(t)
})

function startSession(topicHex) {
  if (joined) return
  joined = true
  ui.setup.classList.add('hidden')
  ui.loading.classList.remove('hidden')
  topicKey = topicHex
  ui.topicOut.textContent = topicHex // show in header
  initSwarm(topicHex).then(() => {
    ui.loading.classList.add('hidden')
    ui.toolbar.classList.remove('hidden')
    ui.boardWrap.classList.remove('hidden')
    resizeCanvas()
  }).catch(err => {
    console.error(err)
    alert('Failed to start networking')
    window.location.reload()
  })
}

// ---------- Networking ----------
async function initSwarm(topicHex) {
  swarm = new Hyperswarm()
  const topic = b4a.from(topicHex, 'hex')

  swarm.on('connection', (socket) => {
    setupConn(socket)
  })

  await swarm.join(topic, { server: true, client: true })
  await swarm.flush() // ensure DHT announce before proceeding
}

function setupConn(socket) {
  // socket.setKeepAlive(10_000)
  // socket.setNoDelay(true)

  const conn = {
    sock: socket,
    inflight: 0,
    closed: false
  }
  conns.add(conn); peerCount = conns.size; updatePeerCount()

  // send a hello with snapshot throttle-safe
  safeSend(conn, { t: 'hello', from: localPeerId, doc: serializeDoc() })

  socket.on('data', (buf) => {
    const msg = decode(buf); if (!msg) return
    applyRemote(msg)
  })
  socket.once('close', () => {
    conn.closed = true
    conns.delete(conn); peerCount = conns.size; updatePeerCount()
  })
  socket.once('error', () => {
    conn.closed = true
    conns.delete(conn); peerCount = conns.size; updatePeerCount()
  })
}

function updatePeerCount() {
  ui.peersCount.textContent = String(peerCount+1)
}

// op queue with simple backpressure
const outbox = []
let flushing = false
function queueOp(op) {
  outbox.push(op)
  flushOutbox()
}
function flushOutbox() {
  if (flushing) return
  flushing = true
  while (outbox.length) {
    const op = outbox.shift()
    broadcast(op)
  }
  flushing = false
}

function broadcast(op) {
  const payload = encode(op)
  for (const c of conns) {
    if (c.closed) continue
    try {
      c.sock.write(payload)
    } catch (e) {
      // drop on error
    }
  }
}

function safeSend(conn, obj) {
  try { conn.sock.write(encode(obj)) } catch {}
}

function serializeDoc() {
  // lightweight snapshot
  return { version: doc.version, order: doc.order, objects: doc.objects }
}

function applySnapshot(snap) {
  // accept newer snapshots only
  if (!snap || (snap.version ?? -1) < (doc.version ?? -1)) return
  doc.order = [...snap.order]
  doc.objects = {}
  for (const id of doc.order) {
    doc.objects[id] = snap.objects[id]
  }
  doc.version = snap.version
  requestRender()
}

// Message handler
function applyRemote(msg) {
  switch (msg.t) {
    case 'hello':
      applySnapshot(msg.doc)
      // reply with our latest version if we are ahead
      if (doc.version > (msg.doc?.version ?? -1)) {
        broadcast({ t: 'full', snapshot: serializeDoc() })
      }
      break
    case 'full':
      applySnapshot(msg.snapshot)
      break
    case 'add': {
      const o = msg.obj
      if (doc.objects[o.id]) return
      doc.objects[o.id] = o
      doc.order.push(o.id)
      bumpDoc(); requestRender()
      break
    }
    case 'update': {
      const o = doc.objects[msg.id]; if (!o) return
      // last-writer-wins by rev
      if ((msg.patch.rev ?? 0) < (o.rev ?? 0)) return
      Object.assign(o, msg.patch)
      bumpDoc(); requestRender()
      break
    }
    case 'patch': { // append to points
      const o = doc.objects[msg.id]; if (!o || !o.points) return
      o.points.push(msg.push)
      o.rev++; bumpDoc(); requestRender()
      break
    }
    case 'touch': {
      const o = doc.objects[msg.id]; if (o) { o.rev++; bumpDoc(); requestRender() }
      break
    }
    case 'move': {
      const o = doc.objects[msg.id]; if (!o) return
      if ((msg.patch.rev ?? 0) < (o.rev ?? 0)) return
      if (msg.patch.points) o.points = msg.patch.points
      o.x = msg.patch.x; o.y = msg.patch.y; o.rev = msg.patch.rev
      bumpDoc(); requestRender()
      break
    }
    case 'delete': {
      const id = msg.id
      if (!doc.objects[id]) return
      delete doc.objects[id]
      doc.order = doc.order.filter(x => x !== id)
      bumpDoc(); requestRender()
      break
    }
    case 'clear': {
      doc.objects = {}; doc.order = []; bumpDoc(); requestRender()
      break
    }
    case 'cursor': {
      // if (msg.from.name === peerName || msg.from.id === localPeerId) return;
      updatePeerCursor(msg.from.id, msg.from.name, { x: msg.x, y: msg.y });
      renderPeerCursors();
      break;
    }
  }
}

function logNames() {
  console.log('Peer names:');
  for (const [peerId, name] of peerNames) {
    console.log(peerId, name);
  }
}

function logCursors() {
  console.log('Peer cursors:');
  for (const [peerId, cur] of peerCursors) {
    console.log(peerId, cur);
  }
}

logNames()
logCursors()

const buttons = document.querySelectorAll('button');

buttons.forEach(b => {
  b.addEventListener('click', () => {
    logNames()
    logCursors()
  })
})

function renderPeerCursors() {
  document.querySelectorAll('.peer-cursor').forEach(el => el.remove());

  for (const [peerId, cur] of peerCursors.entries()) {
    if (peerId === localPeerId && peerName === cur.name) continue;

    const {bg, text} = getRandomColorPair()

    let el = document.createElement('p');
    el.className = 'peer-cursor';
    el.style.cssText = `
      position:fixed;
      left:${cur.cursor.x}px; top:${cur.cursor.y}px;
      width: fit-content;
      height: fit-content;
      background: ${bg};
      border-radius: 4px 50px 50px 50px;
      pointer-events: none;
      transition: left 60ms linear, top 60ms linear;
      box-shadow: 0 6px 20px rgba(251, 0, 102, 0.2);
      z-index: 9999;
      color: ${text};
      padding: 4px 8px;
    `;
    el.textContent = cur.name !== '' ? cur.name : peerId
    document.body.appendChild(el);
  }

  if (ui.mouse) {
    ui.mouse.textContent = 'You';
  }
}


function encode(obj) { return b4a.from(JSON.stringify(obj)) }
function decode(buf) { try { return JSON.parse(b4a.toString(buf)) } catch { return null } }

// ---------- Utilities ----------
function toCanvas(e) {
  const r = ui.canvas.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function randomId() {
  return crypto.randomBytes(4).toString('hex'); // 4 bytes → 8 hex chars
}
function hex(buf) { return Buffer.from(buf).toString('hex') }

function savePNG() {
  const tmp = document.createElement('canvas')
  tmp.width = ui.canvas.width
  tmp.height = ui.canvas.height
  const tctx = tmp.getContext('2d')
  tctx.drawImage(ui.canvas, 0, 0)
  const url = tmp.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `whiteboard-${Date.now()}.png`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- Boot ----------
(function boot() {
  // show setup screen; toolbar/board are initially hidden in your HTML/CSS
  // IDs used here match your markup (Create/Join buttons, topic field, toolbar)
  // Toolbar & canvas are revealed after networking is ready.
  // (See index.html, #create-canvas / #join-canvas / #join-canvas-topic / #canvas-topic / #peers-count)
  // Keyboard hint: hold Shift to move any object (cursor changes to "move" on hover).
})();
