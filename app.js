import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { addAlphaToColor, getRandomColorPair } from "./helper.js";
import Hypercore from 'hypercore';
import {initAuth, auth} from "./Auth/auth.js";

import Log from "./logs/log.js";

export const PEAR_PATH = Pear.config.storage

// ============================================================================
// HYPERCORE SAVE STATE SYSTEM - FIXED VERSION
// ============================================================================

export class HypercoreManager {
  static cores = new Map();
  static replicationStreams = new Map();

  static async initCore(roomKey) {
    if (this.cores.has(roomKey)) {
      return this.cores.get(roomKey);
    }

    console.log(PEAR_PATH + state.localPeerId + roomKey)
    try {
      const core = new Hypercore(`${PEAR_PATH}/${state.localPeerId}/${roomKey}`, {
        valueEncoding: 'json'
      });

      await core.ready();
      this.cores.set(roomKey, core);

      console.log('Hypercore initialized for room:', roomKey);
      console.log('Core key:', core.key.toString('hex'));
      console.log('Core length:', core.length);

      return core;
    } catch (error) {
      console.error('Failed to initialize Hypercore:', error);
      return null;
    }
  }

  static async saveDrawingState(roomKey) {
    if (!state.topicKey || !roomKey) {
      console.warn('Cannot save: No active room');
      return false;
    }

    try {
      const core = await this.initCore(roomKey);
      if (!core) return false;

      const drawingData = {
        version: state.doc.version,
        order: [...state.doc.order],
        objects: { ...state.doc.objects },
        savedAt: Date.now(),
        savedBy: state.localPeerId,
        roomKey: roomKey
      };

      await core.append(drawingData);

      console.log('Drawing state saved to Hypercore for room:', roomKey);
      Log.logHypercoreData(drawingData, core.length - 1);

      this.replicateToAllPeers(roomKey);

      NetworkManager.broadcast({
        t: 'hypercore_saved',
        from: state.localPeerId,
        roomKey: roomKey,
        savedAt: drawingData.savedAt,
        coreLength: core.length
      });

      return true;
    } catch (error) {
      console.error('Failed to save to Hypercore:', error);
      return false;
    }
  }

  static async loadLatestDrawing(roomKey) {
    try {
      const core = await this.initCore(roomKey);
      if (!core || core.length === 0) {
        console.log('saved drawing found for room:', roomKey);
        return false;
      }

      // Get the latest entry (last item in hypercore)
      const latestIndex = core.length - 1;
      const latestData = await core.get(latestIndex);

      if (!latestData || !latestData.objects || !latestData.order) {
        console.warn('Invalid drawing data in Hypercore');
        return false;
      }

      console.log('Loading drawing from Hypercore for room:', roomKey);
      Log.logHypercoreData(latestData, latestIndex);

      // Apply loaded state WITHOUT triggering render twice
      this.applyDrawingState(latestData);

      // Broadcast to other peers that we've loaded
      NetworkManager.broadcast({
        t: 'hypercore_loaded',
        from: state.localPeerId,
        roomKey: roomKey,
        loadedVersion: latestData.version
      });

      NetworkManager.broadcast({
        t: 'full',
        snapshot: NetworkManager.serializeDocument()
      });

      console.log('📤 Broadcasted loaded drawing to all connected peers');


      return true;
    } catch (error) {
      console.error('âŒ Failed to load from Hypercore:', error);
      return false;
    }
  }

  // FIXED: Apply drawing state without double rendering
  static applyDrawingState(drawingData) {
    // Temporarily disable render requests to prevent double rendering
    const originalRequestRender = state.requestRender;
    let renderRequested = false;

    state.requestRender = () => {
      renderRequested = true;
    };

    for (const id of drawingData.order) {
      if (drawingData.objects[id] && !state.doc.objects[id]) {
        // Only add objects that don't already exist
        state.doc.objects[id] = drawingData.objects[id];
        state.doc.order.push(id);
      }
    }

    state.doc.version = Math.max(state.doc.version, drawingData.version || 0) + 1;

    // Restore render function and trigger once if needed
    state.requestRender = originalRequestRender;

    if (renderRequested) {
      state.requestRender();
    }

    console.log('Applied drawing state with', state.doc.order.length, 'objects');
  }


  static async saveDrawingState(roomKey) {
    if (!state.topicKey || !roomKey) {
      console.warn('Cannot save: No active room');
      return false;
    }

    try {
      const core = await this.initCore(roomKey);
      if (!core) return false;

      const drawingData = {
        version: state.doc.version,
        order: [...state.doc.order],
        objects: { ...state.doc.objects },
        savedAt: Date.now(),
        savedBy: state.localPeerId,
        roomKey: roomKey
      };

      await core.append(drawingData);

      console.log('Drawing state saved to Hypercore for room:', roomKey);
      Log.logHypercoreData(drawingData, core.length - 1);

      this.replicateToAllPeers(roomKey);

      NetworkManager.broadcast({
        t: 'hypercore_saved',
        from: state.localPeerId,
        roomKey: roomKey,
        savedAt: drawingData.savedAt,
        coreLength: core.length
      });

      return true;
    } catch (error) {
      console.error('Failed to save to Hypercore:', error);
      return false;
    }
  }

  static async loadLatestDrawing(roomKey) {
    try {
      const core = await this.initCore(roomKey);
      if (!core || core.length === 0) {
        console.log('No saved drawing found for room:', roomKey);
        return false;
      }

      const latestIndex = core.length - 1;
      const latestData = await core.get(latestIndex);

      if (!latestData || !latestData.objects || !latestData.order) {
        console.warn('Invalid drawing data in Hypercore');
        return false;
      }

      console.log('Loading drawing from Hypercore for room:', roomKey);
      Log.logHypercoreData(latestData, latestIndex);

      this.applyDrawingState(latestData);

      NetworkManager.broadcast({
        t: 'hypercore_loaded',
        from: state.localPeerId,
        roomKey: roomKey,
        loadedVersion: latestData.version
      });

      NetworkManager.broadcast({
        t: 'full',
        snapshot: NetworkManager.serializeDocument()
      });

      console.log('📤 Broadcasted loaded drawing to all connected peers');


      return true;
    } catch (error) {
      console.error('Failed to load from Hypercore:', error);
      return false;
    }
  }

// FIXED: Apply drawing state without double rendering
  static applyDrawingState(drawingData) {
    // Temporarily disable render requests to prevent double rendering
    const originalRequestRender = state.requestRender;
    let renderRequested = false;

    state.requestRender = () => {
      renderRequested = true;
    };

    for (const id of drawingData.order) {
      if (drawingData.objects[id] && !state.doc.objects[id]) {
        // Only add objects that don't already exist
        state.doc.objects[id] = drawingData.objects[id];
        state.doc.order.push(id);
      }
    }

    state.doc.version = Math.max(state.doc.version, drawingData.version || 0) + 1;

    // Restore render function and trigger once if needed
    state.requestRender = originalRequestRender;

    if (renderRequested) {
      state.requestRender();
    }

    console.log('Applied drawing state with', state.doc.order.length, 'objects');
  }

// NEW: Hypercore replication setup for peer synchronization
  static setupReplication(roomKey, connection) {
    const core = this.cores.get(roomKey);
    if (!core || !connection.socket) return;

    try {
      const peerId = connection.peerId || 'unknown';
      console.log(`Setting up Hypercore replication for ${roomKey} with peer ${peerId}`);

      // Create replication stream
      const stream = core.replicate(false, { live: true });

      // Store replication stream
      this.replicationStreams.set(peerId, { stream, core, roomKey });

      // Pipe the replication stream to the socket
      connection.socket.pipe(stream).pipe(connection.socket, { end: false });

      // Handle replication events
      stream.on('sync', () => {
        console.log(`Hypercore synced with peer ${peerId}`);
        // Reload drawing after sync
        setTimeout(() => {
          this.loadLatestDrawing(roomKey);
        }, 500);
      });

      stream.on('error', (err) => {
        console.error(`Replication error with peer ${peerId}:`, err)
        this.replicationStreams.delete(peerId);
      });

      // Clean up on connection close
      connection.socket.on('close', () => {
        this.replicationStreams.delete(peerId);
        console.log(`Replication stream closed for peer ${peerId}`);
      });

    } catch (error) {
      console.error('Failed to setup Hypercore replication:', error);
    }
  }

// NEW: Replicate to all connected peers
  static replicateToAllPeers(roomKey) {
    for (const connection of state.connections) {
      if (!connection.closed) {
        console.log('REPLICATion : ', connection.peerId);
        this.setupReplication(roomKey, connection);
      }
    }
  }

  static async hasDrawings(roomKey) {
    try {
      const core = await this.initCore(roomKey);
      return core && core.length > 0;
    } catch (error) {
      return false;
    }
  }

  static async deleteDrawings(roomKey) {
    try {
      const core = await this.initCore(roomKey)
      if(!core || core.length === 0) {
        console.log('No saved drawing found for room:', roomKey);
        return false;
      }

      await core.clear(roomKey)
      console.log('Cleared drawings for room:', roomKey);
      return true;
    } catch (e) {
      console.error('Failed to clear the Hypercore of', roomKey, ':', e);
      return false;
    }
  }

// NEW: Get all drawing history with better formatting
  static async getDrawingHistory(roomKey) {
    try {
      const core = await this.initCore(roomKey);
      if (!core || core.length === 0) {
        console.log('No drawing history found for room:', roomKey);
        return [];
      }

      const history = [];
      for (let i = 0; i < core.length; i++) {
        const entry = await core.get(i);
        history.push({
          index: i,
          timestamp: new Date(entry.savedAt).toLocaleString(),
          savedBy: entry.savedBy,
          objectCount: entry.order?.length || 0,
          version: entry.version
        });
      }

      console.log('Drawing history for room:', roomKey.substring(0, 8) + '...');
      console.table(history);

      return history;
    } catch (error) {
      console.error('Failed to get drawing history:', error);
      return [];
    }
  }
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  WORLD_WIDTH: 50000,
  WORLD_HEIGHT: 50000,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 16,
  ZOOM_STEP: 1.1,
  GRID_TARGET_PX: 32,
  MIN_MINOR_PX: 8
};

// ============================================================================
// GLOBAL STATE - FIXED VERSION
// ============================================================================

class AppState {
  constructor() {
    this.localPeerId = null;
    this.peerName = '';
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.tool = 'pen';
    this.strokeColor = '#000000';
    this.strokeSize = 2;
    this.drawing = false;
    this.isDragging = false;
    this.isPanning = false;
    this.spaceHeld = false;
    this.touchPanning = false;
    this.showGrid = true;
    this.dirty = true;
    this.eraserPath = null;
    this.renderPending = false; // FIXED: Prevent double renders

    // Object state
    this.activeId = null;
    this.hoverId = null;
    this.start = null;
    this.dragStart = null;
    this.dragInitialPos = null;
    this.tempShape = null;
    this.textEl = null;

    // Document state
    this.doc = {
      objects: {},
      order: [],
      version: 0
    };

    // History
    this.undoStack = [];
    this.redoStack = [];

    // Networking
    this.swarm = null;
    this.topicKey = null;
    this.joined = false;
    this.connections = new Set();
    this.peerCount = 0;
    this.outbox = [];
    this.flushing = false;

    // Cursor tracking
    this.peerCursors = new Map();
    this.peerNames = new Map();
    this.lastCX = 0;
    this.lastCY = 0;
    this.lastTouchMid = null;

    // Canvas
    this.ctx = null;
    this.DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    this.PEAR_PATH = PEAR_PATH
  }

  generateRandomId() {
    return crypto.randomBytes(4).toString('hex');
  }

  bumpDoc() {
    this.doc.version++;
  }

  // FIXED: Prevent double rendering with debouncing
  requestRender() {
    if (this.renderPending) return;
    this.renderPending = true;

    requestAnimationFrame(() => {
      this.dirty = true;
      this.renderPending = false;
    });
  }
}

export const state = new AppState();

// ============================================================================
// DOM UTILITIES
// ============================================================================

const $ = (selector) => document.querySelector(selector);

export const ui = {
  // Session elements
  mouse: $('#mouse-follower'),
  setup: $('#setup'),
  loading: $('#loading'),
  toolbar: $('header.toolbar'),
  boardWrap: $('.board-wrap'),
  canvas: $('#board'),
  overlayCanvas: $('#overlay'),

  // Rooms
  roomListContainer: $('#rooms-list-container'),
  roomsList: $('#rooms-list'),

  // Session controls
  createBtn: $('#create-canvas'),
  joinBtn: $('#join-canvas'),
  joinInput: $('#join-canvas-topic'),
  topicOut: $('#canvas-topic'),
  peersCount: $('#peers-count'),
  localPeerName: $('#local-peer-name'),

  // Button/Grp
  peerCountBtn: $('#peer-count-btn'),
  canvasRoomKey: $('.canvas-room-key'),
  loadStateBtn: $('.load-state-btn'),
  slideStateContainer: $('#slide-state-container'),
  slideStateBtn: $('.slide-state-btn'),

  // Auth controls
  authContainer: document.querySelector('#auth-container'),
  authInput: document.querySelector('#auth-input'),
  authPass: document.querySelector('#auth-pass'),
  signUpBtn: document.querySelector('#auth-signup'),
  signInBtn: document.querySelector('#auth-signin'),

  // Tools
  tools: $('#tools'),
  color: $('#color'),
  size: $('#size'),
  undo: $('#undo'),
  redo: $('#redo'),
  clear: $('#clear'),
  save: $('#save'),
  saveState: $('#save-state'),
  peerNameBtn: $('#username-submit'),
  peerNameInput: $('#username-input'),
  namePopup: $('#name--input--popup'),

  // Canvas
  scaleDisplay: $('#zoom-scale-display'),
  opacitySlider: $('#opacity-control'),
};

// ============================================================================
// COORDINATE UTILITIES
// ============================================================================

class CoordinateUtils {
  static toCanvas(event) {
    const rect = ui.canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    return {
      x: (clientX - state.panX) / state.zoom,
      y: (clientY - state.panY) / state.zoom
    };
  }

  static worldToScreen(worldX, worldY) {
    return {
      x: worldX * state.zoom + state.panX,
      y: worldY * state.zoom + state.panY
    };
  }

  static screenToWorld(screenX, screenY) {
    return {
      x: (screenX - state.panX) / state.zoom,
      y: (screenY - state.panY) / state.zoom
    };
  }
}

// ============================================================================
// CANVAS MANAGEMENT
// ============================================================================

class CanvasManager {
  static init() {
    state.ctx = ui.canvas.getContext('2d', { alpha: true });
    this.resizeCanvas();
    this.setupEventListeners();
    this.startRenderLoop();
    this.renderFrame();
  }

  static resizeCanvas() {
    const rect = ui.boardWrap.getBoundingClientRect();
    ui.canvas.width = Math.floor(rect.width * state.DPR);
    ui.canvas.height = Math.floor(rect.height * state.DPR);
    ui.canvas.style.width = `${rect.width}px`;
    ui.canvas.style.height = `${rect.height}px`;
    state.ctx.setTransform(state.DPR, 0, 0, state.DPR, 0, 0);
    this.clampPan();
    state.requestRender();
  }

  static clampPan() {
    const viewWidthWorld = ui.canvas.clientWidth / state.zoom;
    const viewHeightWorld = ui.canvas.clientHeight / state.zoom;
    let leftWorld = -state.panX / state.zoom;
    let topWorld = -state.panY / state.zoom;

    // Clamp to world boundaries
    leftWorld = Math.max(0, Math.min(leftWorld, CONFIG.WORLD_WIDTH - viewWidthWorld));
    topWorld = Math.max(0, Math.min(topWorld, CONFIG.WORLD_HEIGHT - viewHeightWorld));

    state.panX = -leftWorld * state.zoom;
    state.panY = -topWorld * state.zoom;
  }

  static centerView() {
    const viewWidth = ui.canvas.clientWidth;
    const viewHeight = ui.canvas.clientHeight;
    const startLeftWorld = (CONFIG.WORLD_WIDTH - viewWidth / state.zoom) / 2;
    const startTopWorld = (CONFIG.WORLD_HEIGHT - viewHeight / state.zoom) / 2;
    state.panX = -startLeftWorld * state.zoom;
    state.panY = -startTopWorld * state.zoom;
  }

  static setupEventListeners() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      if (typeof CursorManager !== 'undefined') {
        CursorManager.handleWindowResize();
      }
    });

    ui.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.handleWheel(e);
    }, { passive: false });
  }

  static handleWheel(event) {
    const factor = (event.deltaY < 0) ? CONFIG.ZOOM_STEP : (1 / CONFIG.ZOOM_STEP);
    const rect = ui.canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;

    const newZoom = Math.min(CONFIG.MAX_ZOOM, Math.max(CONFIG.MIN_ZOOM, state.zoom * factor));
    const worldX = (clientX - state.panX) / state.zoom;
    const worldY = (clientY - state.panY) / state.zoom;

    state.zoom = newZoom;
    state.panX = clientX - worldX * state.zoom;
    state.panY = clientY - worldY * state.zoom;

    // Scale Percentage
    const scalePercent = Math.round(state.zoom * 100);
    const scaleDisplay = document.getElementById('zoom-scale-display');
    if (scaleDisplay) {
      scaleDisplay.textContent = scalePercent + '%';
    }

    this.clampPan();
    state.requestRender();
    CursorManager.handleCanvasTransform();
  }

  static startRenderLoop() {
    const render = () => {
      this.renderFrame();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  static renderFrame() {
    if (!state.dirty) return;
    state.dirty = false;

    if (state.tool === 'eraser' && state.eraserPath && state.eraserPath.length > 0) {
      // Render eraser preview
      state.ctx.save();
      state.ctx.globalCompositeOperation = 'source-over';
      state.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      state.ctx.lineWidth = state.strokeSize;
      state.ctx.lineCap = 'round';
      state.ctx.beginPath();
      state.ctx.moveTo(state.eraserPath[0].x, state.eraserPath[0].y);
      for (let i = 1; i < state.eraserPath.length; i++) {
        state.ctx.lineTo(state.eraserPath[i].x, state.eraserPath[i].y);
      }
      state.ctx.stroke();
      state.ctx.restore();
    }

    // Clear canvas
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);

    // Set world transform
    const scale = state.DPR * state.zoom;
    const translateX = Math.round(state.DPR * state.panX);
    const translateY = Math.round(state.DPR * state.panY);
    state.ctx.setTransform(scale, 0, 0, scale, translateX, translateY);

    // Render grid
    if (state.showGrid) {
      GridRenderer.render(state.ctx, scale, translateX, translateY);
    }

    // Render objects
    ObjectRenderer.renderAll();

    // Render temporary shapes and hover states
    if (state.tempShape) {
      ObjectRenderer.renderTemp(state.tempShape);
    }

    if (state.hoverId && state.doc.objects[state.hoverId]) {
      ObjectRenderer.renderBounds(state.doc.objects[state.hoverId], 'rgba(37,99,235,.35)');
    }
  }
}

// ============================================================================
// GRID RENDERING
// ============================================================================

class GridRenderer {
  static render(ctx, scale, translateX, translateY) {
    const viewWidth = ui.canvas.clientWidth;
    const viewHeight = ui.canvas.clientHeight;

    // Calculate visible world area
    const leftWorld = -state.panX / state.zoom;
    const topWorld = -state.panY / state.zoom;
    const rightWorld = leftWorld + viewWidth / state.zoom;
    const bottomWorld = topWorld + viewHeight / state.zoom;

    // Calculate grid spacing
    const desiredWorld = CONFIG.GRID_TARGET_PX / state.zoom;
    const majorStep = this.calculateNiceStep(desiredWorld);
    const minorStep = majorStep / 5;

    // Check visibility thresholds
    const majorPixels = majorStep * state.zoom;
    const minorPixels = minorStep * state.zoom;
    const showMinor = minorPixels >= CONFIG.MIN_MINOR_PX;

    // Switch to screen space for crisp lines
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = 1;

    // Render minor grid
    if (showMinor) {
      this.renderGridLines(ctx, minorStep, leftWorld, topWorld, rightWorld, bottomWorld,
          scale, translateX, translateY, 'rgba(0,0,0,0.05)');
    }

    // Render major grid
    this.renderGridLines(ctx, majorStep, leftWorld, topWorld, rightWorld, bottomWorld,
        scale, translateX, translateY, 'rgba(0,0,0,0.12)');

    // Render axes
    this.renderAxes(ctx, scale, translateX, translateY);

    ctx.restore();

    // Restore world transform
    ctx.setTransform(scale, 0, 0, scale, translateX, translateY);
  }

  static renderGridLines(ctx, step, leftWorld, topWorld, rightWorld, bottomWorld,
                         scale, translateX, translateY, color) {
    ctx.strokeStyle = color;

    const startX = Math.floor(leftWorld / step) * step;
    const startY = Math.floor(topWorld / step) * step;

    // Vertical lines
    for (let x = startX; x <= rightWorld; x += step) {
      const screenX = Math.round(scale * x + translateX) + 0.5;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, ui.canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y <= bottomWorld; y += step) {
      const screenY = Math.round(scale * y + translateY) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(ui.canvas.width, screenY);
      ctx.stroke();
    }
  }

  static renderAxes(ctx, scale, translateX, translateY) {
    const screenX0 = Math.round(scale * 0 + translateX) + 0.5;
    const screenY0 = Math.round(scale * 0 + translateY) + 0.5;

    ctx.strokeStyle = 'rgba(0,0,0,0.25)';

    // Y-axis
    if (screenX0 >= 0 && screenX0 <= ui.canvas.width) {
      ctx.beginPath();
      ctx.moveTo(screenX0, 0);
      ctx.lineTo(screenX0, ui.canvas.height);
      ctx.stroke();
    }

    // X-axis
    if (screenY0 >= 0 && screenY0 <= ui.canvas.height) {
      ctx.beginPath();
      ctx.moveTo(0, screenY0);
      ctx.lineTo(ui.canvas.width, screenY0);
      ctx.stroke();
    }
  }

  static calculateNiceStep(value) {
    if (value <= 0) return 1;
    const exponent = Math.floor(Math.log10(value));
    const base = Math.pow(10, exponent);
    const normalized = value / base;

    if (normalized <= 1) return 1 * base;
    if (normalized <= 2) return 2 * base;
    if (normalized <= 5) return 5 * base;
    return 10 * base;
  }
}

// ============================================================================
// OBJECT RENDERING
// ============================================================================

class ObjectRenderer {
  static renderAll() {
    for (const id of state.doc.order) {
      const obj = state.doc.objects[id];
      if (obj) {
        this.renderObject(obj);
      }
    }
  }

  static renderObject(obj) {
    if (obj.type === 'eraser') return;

    state.ctx.save();
    const strokeWidth = (obj.strokeWidth ?? 2) / state.zoom;
    state.ctx.lineWidth = obj.size;
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';

    if (obj.type === "eraser") {
      return;
    } else {
      state.ctx.globalCompositeOperation = "source-over";
      const alpha = typeof obj.opacity === 'number' ? obj.opacity : 1;
      state.ctx.strokeStyle = addAlphaToColor(obj.color, alpha);
      state.ctx.fillStyle = addAlphaToColor(obj.color, alpha);
    }

    switch (obj.type) {
      case 'pen':
      case 'eraser':
        this.renderPath(obj);
        break;
      case 'line':
        this.renderLine(obj);
        break;
      case 'rect':
        this.renderRect(obj);
        break;
      case 'ellipse':
        this.renderEllipse(obj);
        break;
      case 'diamond':
        this.renderDiamond(obj);
        break;
      case 'text':
        this.renderText(obj);
        break;
    }

    state.ctx.restore();
  }

  static renderPath(obj) {
    const points = obj.points || [];
    if (points.length < 2) return;

    if (obj.type === 'eraser') {
      state.ctx.globalCompositeOperation = 'destination-out';
    } else {
      state.ctx.globalCompositeOperation = "source-over";
    }

    state.ctx.beginPath();
    state.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      state.ctx.lineTo(points[i].x, points[i].y);
    }
    state.ctx.stroke();

    if (obj.type === 'eraser') {
      state.ctx.globalCompositeOperation = 'source-over';
    }
  }

  static renderLine(obj) {
    state.ctx.beginPath();
    state.ctx.moveTo(obj.x, obj.y);
    state.ctx.lineTo(obj.x + (obj.w || 0), obj.y + (obj.h || 0));
    state.ctx.stroke();
  }

  static renderRect(obj) {
    state.ctx.strokeRect(obj.x, obj.y, obj.w || 0, obj.h || 0);
  }

  static renderEllipse(obj) {
    const radiusX = Math.abs(obj.w || 0) / 2;
    const radiusY = Math.abs(obj.h || 0) / 2;
    const centerX = obj.x + (obj.w || 0) / 2;
    const centerY = obj.y + (obj.h || 0) / 2;

    state.ctx.beginPath();
    state.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    state.ctx.stroke();
  }

  static renderDiamond(obj) {
    const width = obj.w || 0;
    const height = obj.h || 0;
    const centerX = obj.x + width / 2;
    const centerY = obj.y + height / 2;

    state.ctx.beginPath();
    state.ctx.moveTo(centerX, obj.y);
    state.ctx.lineTo(obj.x + width, centerY);
    state.ctx.lineTo(centerX, obj.y + height);
    state.ctx.lineTo(obj.x, centerY);
    state.ctx.closePath();
    state.ctx.stroke();
  }

  static renderText(obj) {
    state.ctx.fillStyle = obj.color;
    state.ctx.font = obj.font || '16px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
    state.ctx.textAlign = obj.align || 'left';
    state.ctx.textBaseline = obj.baseline || 'top';
    state.ctx.fillText(obj.text || '', obj.x, obj.y);
  }

  static renderBounds(obj, color = 'rgba(0,0,0,.2)') {
    state.ctx.save();
    state.ctx.setLineDash([6, 6]);
    state.ctx.lineWidth = 1;
    state.ctx.strokeStyle = color;

    const bounds = GeometryUtils.getBounds(obj);
    state.ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    state.ctx.restore();
  }

  static renderTemp(tempObj) {
    state.ctx.save();
    state.ctx.setLineDash([6 / state.zoom, 6 / state.zoom]);
    state.ctx.lineWidth = (tempObj.strokeWidth ?? 2) / state.zoom;
    this.renderObject(tempObj);
    state.ctx.restore();
  }
}

// ============================================================================
// GEOMETRY UTILITIES
// ============================================================================

class GeometryUtils {
  static getBounds(obj) {
    switch (obj.type) {
      case 'pen':
      case 'eraser':
        return this.getPathBounds(obj);
      case 'line':
        return this.getLineBounds(obj);
      case 'rect':
      case 'ellipse':
      case 'diamond':
        return this.getRectBounds(obj);
      case 'text':
        return this.getTextBounds(obj);
      default:
        return { x: obj.x, y: obj.y, w: Math.abs(obj.w || 0), h: Math.abs(obj.h || 0) };
    }
  }

  static getPathBounds(obj) {
    const points = obj.points || [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      x: minX,
      y: minY,
      w: (maxX - minX) || 0,
      h: (maxY - minY) || 0
    };
  }

  static getLineBounds(obj) {
    return {
      x: Math.min(obj.x, obj.x + (obj.w || 0)),
      y: Math.min(obj.y, obj.y + (obj.h || 0)),
      w: Math.abs(obj.w || 0),
      h: Math.abs(obj.h || 0)
    };
  }

  static getRectBounds(obj) {
    return {
      x: Math.min(obj.x, obj.x + (obj.w || 0)),
      y: Math.min(obj.y, obj.y + (obj.h || 0)),
      w: Math.abs(obj.w || 0),
      h: Math.abs(obj.h || 0)
    };
  }

  static getTextBounds(obj) {
    state.ctx.save();
    state.ctx.font = obj.font || '16px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
    const metrics = state.ctx.measureText(obj.text || '');
    const width = Math.max(10, metrics.width);
    const height = Math.max(16, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 20);
    state.ctx.restore();

    return { x: obj.x, y: obj.y, w: width, h: height };
  }

  static pointInBounds(obj, x, y) {
    const bounds = this.getBounds(obj);
    return x >= bounds.x && y >= bounds.y &&
        x <= bounds.x + bounds.w && y <= bounds.y + bounds.h;
  }
}

// ============================================================================
// DRAWING TOOLS
// ============================================================================

class DrawingTools {
  static selectTool(toolName) {
    state.tool = toolName;

    // Update UI
    [...ui.tools.querySelectorAll('.btn')].forEach(button => {
      button.classList.toggle('active', button.dataset.tool === toolName);
    });

    TextEditor.close(true);
  }

  static beginFreeDrawing(id, type, x, y) {
    if (type === 'eraser') {
      state.activeId = id;
      state.eraserPath = [{ x, y }];
      return;
    }

    const obj = {
      id,
      type,
      x,
      y,
      points: [{ x, y }],
      color: state.strokeColor,
      size: state.strokeSize,
      opacity: state.strokeOpacity ?? 1,
      createdBy: state.localPeerId,
      rev: 0
    };

    DocumentManager.addObject(obj, true);
    state.activeId = id;
  }

  static addPoint(id, x, y) {
    if (state.tool === 'eraser') {
      state.eraserPath.push({ x, y });
      this.checkEraserIntersections({ x, y }); // Detect and delete intersected objects
      return;
    }

    const obj = state.doc.objects[id];
    if (!obj || !obj.points) return;

    obj.points.push({ x, y });
    obj.rev++;
    state.bumpDoc();
    state.requestRender();

    NetworkManager.queueOperation({ t: 'patch', id, path: 'points', push: { x, y } });
  }

  static checkEraserIntersections(currentPoint) {
    const eraserRadius = state.strokeSize;
    const objectsToDelete = [];

    for (const objId of state.doc.order) {
      const obj = state.doc.objects[objId];
      if (!obj || obj.type === 'eraser') continue;

      if (this.objectIntersectsPoint(obj, currentPoint, eraserRadius)) {
        objectsToDelete.push(objId);
      }
    }

    objectsToDelete.forEach(id => {
      DocumentManager.deleteObject(id, true);
    });
  }

  static objectIntersectsPoint(obj, point, radius) {
    switch (obj.type) {
      case 'pen':
        return this.pathIntersectsPoint(obj.points || [], point, radius);
      case 'line':
        return this.lineIntersectsPoint(obj, point, radius);
      case 'rect':
      case 'ellipse':
      case 'diamond':
        return this.shapeIntersectsPoint(obj, point, radius);
      case 'text':
        return this.textIntersectsPoint(obj, point, radius);
      default:
        return false;
    }
  }

  static pathIntersectsPoint(points, point, radius) {
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (this.lineSegmentIntersectsCircle(p1, p2, point, radius)) {
        return true;
      }
    }
    return false;
  }

  static lineIntersectsPoint(obj, point, radius) {
    const start = { x: obj.x, y: obj.y };
    const end = { x: obj.x + (obj.w || 0), y: obj.y + (obj.h || 0) };
    return this.lineSegmentIntersectsCircle(start, end, point, radius);
  }

  static shapeIntersectsPoint(obj, point, radius) {
    const bounds = GeometryUtils.getBounds(obj);
    // Expand bounds by eraser radius
    return point.x >= bounds.x - radius &&
        point.x <= bounds.x + bounds.w + radius &&
        point.y >= bounds.y - radius &&
        point.y <= bounds.y + bounds.h + radius;
  }

  static textIntersectsPoint(obj, point, radius) {
    const bounds = GeometryUtils.getBounds(obj);
    // Expand bounds by eraser radius
    return point.x >= bounds.x - radius &&
        point.x <= bounds.x + bounds.w + radius &&
        point.y >= bounds.y - radius &&
        point.y <= bounds.y + bounds.h + radius;
  }

  static lineSegmentIntersectsCircle(p1, p2, center, radius) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      // Point to point distance
      const dist = Math.sqrt((p1.x - center.x) ** 2 + (p1.y - center.y) ** 2);
      return dist <= radius;
    }

    const unitX = dx / length;
    const unitY = dy / length;
    const toPointX = center.x - p1.x;
    const toPointY = center.y - p1.y;
    const dot = toPointX * unitX + toPointY * unitY;

    const closestPoint = {
      x: p1.x + Math.max(0, Math.min(length, dot)) * unitX,
      y: p1.y + Math.max(0, Math.min(length, dot)) * unitY
    };

    const distance = Math.sqrt(
        (center.x - closestPoint.x) ** 2 + (center.y - closestPoint.y) ** 2
    );

    return distance <= radius;
  }

  static finishStroke(id) {
    if (!id) return;

    if (state.tool === 'eraser') {
      state.eraserPath = null;
      return;
    }

    NetworkManager.queueOperation({ t: 'touch', id });
  }

  static beginShape(id, type, x, y) {
    const obj = {
      id,
      type,
      x,
      y,
      w: 0,
      h: 0,
      color: state.strokeColor,
      size: state.strokeSize,
      opacity: state.strokeOpacity ?? 1,
      createdBy: state.localPeerId,
      rev: 0
    };

    DocumentManager.addObject(obj, true);
    state.activeId = id;
  }

  static resizeShape(id, x, y) {
    const obj = state.doc.objects[id];
    if (!obj) return;

    obj.w = x - obj.x;
    obj.h = y - obj.y;
    obj.rev++;
    state.bumpDoc();
    state.requestRender();

    NetworkManager.queueOperation({
      t: 'update',
      id,
      patch: { w: obj.w, h: obj.h, rev: obj.rev }
    });
  }
}

// ============================================================================
// TEXT EDITOR
// ============================================================================

class TextEditor {
  static open(worldX, worldY, initialText = '') {
    this.close(true);

    const id = state.generateRandomId();
    const fontPixels = Math.max(12, state.strokeSize * 3);

    // Create text object
    const textObj = {
      id,
      type: 'text',
      x: worldX,
      y: worldY,
      text: initialText,
      color: state.strokeColor,
      size: state.strokeSize,
      font: `${fontPixels}px Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial`,
      align: 'left',
      baseline: 'top',
      createdBy: state.localPeerId,
      rev: 0
    };

    DocumentManager.addObject(textObj, true);
    state.activeId = id;

    // Create editor element
    const screenPos = CoordinateUtils.worldToScreen(worldX, worldY);
    const canvasRect = ui.canvas.getBoundingClientRect();

    const editorDiv = this.createEditorElement(
        screenPos.x + canvasRect.left,
        screenPos.y + canvasRect.top,
        textObj,
        fontPixels,
        initialText
    );

    document.body.appendChild(editorDiv);
    state.textEl = editorDiv;

    // Focus and position cursor
    setTimeout(() => {
      editorDiv.focus();
      if (initialText) {
        this.placeCaretAtEnd(editorDiv);
      }
    }, 0);
  }

  static createEditorElement(x, y, textObj, fontPixels, initialText) {
    const div = document.createElement('div');
    div.className = 'text-editor';
    div.contentEditable = 'true';
    div.dataset.id = textObj.id;
    div.spellcheck = false;

    Object.assign(div.style, {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      font: textObj.font,
      fontSize: `${fontPixels}px`,
      color: textObj.color,
      border: '2px solid #007bff',
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '4px',
      padding: '4px 6px',
      margin: '0',
      outline: 'none',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      zIndex: '9999',
      whiteSpace: 'nowrap',
      overflow: 'visible',
      minWidth: '20px',
      minHeight: '16px',
      transformOrigin: 'top left',
      transform: state.zoom !== 1 ? `scale(${state.zoom})` : 'none'
    });

    if (initialText) {
      div.textContent = initialText;
    }

    this.attachEditorEventListeners(div);
    return div;
  }

  static attachEditorEventListeners(div) {
    div.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close(false);
      }
    });

    div.addEventListener('blur', () => {
      setTimeout(() => this.commit(), 100);
    });

    // Prevent canvas events
    ['mousedown', 'mousemove', 'mouseup'].forEach(eventType => {
      div.addEventListener(eventType, (e) => e.stopPropagation());
    });
  }

  static commit() {
    if (!state.textEl) return;

    const id = state.textEl.dataset.id;
    const obj = state.doc.objects[id];
    if (!obj) {
      this.close(false);
      return;
    }

    const text = (state.textEl.textContent || '').trim();
    if (text === '') {
      // Remove empty text object
      DocumentManager.deleteObject(id, true);
    } else {
      // Update text object
      DocumentManager.updateObject(id, { text, rev: obj.rev + 1 }, true);
    }

    this.close(false);
  }

  static close(shouldCommit = false) {
    if (!state.textEl) return;

    const element = state.textEl;
    const id = element.dataset.id;
    state.textEl = null;
    state.activeId = null;

    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }

    // Clean up empty object if not committing
    if (!shouldCommit && id && state.doc.objects[id] && !state.doc.objects[id].text) {
      DocumentManager.deleteObject(id, false);
    }
  }

  static placeCaretAtEnd(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================

class DocumentManager {
  static addObject(obj, isLocal = false) {
    if (state.doc.objects[obj.id]) return; // Idempotent

    state.doc.objects[obj.id] = obj;
    state.doc.order.push(obj.id);
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'del', id: obj.id, before: obj });
      NetworkManager.queueOperation({ t: 'add', obj });
    }
  }

  static updateObject(id, patch, isLocal = false) {
    const obj = state.doc.objects[id];
    if (!obj) return;

    const before = { ...obj };
    Object.assign(obj, patch);
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'update', id, before, after: { ...obj } });
      NetworkManager.queueOperation({ t: 'update', id, patch });
    }
  }

  static deleteObject(id, isLocal = false) {
    const obj = state.doc.objects[id];
    if (!obj) return;

    delete state.doc.objects[id];
    state.doc.order = state.doc.order.filter(objId => objId !== id);
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'add', obj });
      NetworkManager.queueOperation({ t: 'delete', id });
    }
  }

  static clearAll(isLocal = false) {
    const snapshot = JSON.stringify(state.doc);
    state.doc.objects = {};
    state.doc.order = [];
    state.bumpDoc();
    state.requestRender();

    if (isLocal) {
      HistoryManager.pushUndo({ t: 'restore', snapshot });
      NetworkManager.queueOperation({ t: 'clear' });
    }
  }

  static findTopObjectAt(x, y) {
    for (let i = state.doc.order.length - 1; i >= 0; i--) {
      const id = state.doc.order[i];
      const obj = state.doc.objects[id];
      if (obj && GeometryUtils.pointInBounds(obj, x, y)) {
        return id;
      }
    }
    return null;
  }
}

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

class HistoryManager {
  static pushUndo(entry) {
    state.undoStack.push(entry);
    state.redoStack.length = 0; // Clear redo stack
  }

  static undo() {
    const entry = state.undoStack.pop();
    if (!entry) return;

    switch (entry.t) {
      case 'del': // Undo add â†’ delete
        const obj = state.doc.objects[entry.id];
        if (obj) {
          DocumentManager.deleteObject(entry.id, false);
          state.redoStack.push({ t: 'add', obj: entry.before });
        }
        break;
      case 'add': // Undo delete â†’ add
        DocumentManager.addObject(entry.obj, false);
        state.redoStack.push({ t: 'del', id: entry.obj.id, before: entry.obj });
        break;
      case 'update':
        state.doc.objects[entry.id] = entry.before;
        state.bumpDoc();
        state.requestRender();
        NetworkManager.queueOperation({ t: 'update', id: entry.id, patch: entry.before });
        state.redoStack.push({ t: 'update', id: entry.id, before: entry.after, after: entry.before });
        break;
      case 'restore':
        const currentSnapshot = JSON.stringify(state.doc);
        Object.assign(state.doc, JSON.parse(entry.snapshot));
        state.bumpDoc();
        state.requestRender();
        NetworkManager.queueOperation({ t: 'full', snapshot: entry.snapshot });
        state.redoStack.push({ t: 'restore', snapshot: currentSnapshot });
        break;
    }
  }

  static redo() {
    const entry = state.redoStack.pop();
    if (!entry) return;

    switch (entry.t) {
      case 'add':
        DocumentManager.addObject(entry.obj, true);
        break;
      case 'update':
        DocumentManager.updateObject(entry.id, entry.after, true);
        break;
      case 'restore':
        const currentSnapshot = JSON.stringify(state.doc);
        Object.assign(state.doc, JSON.parse(entry.snapshot));
        state.bumpDoc();
        state.requestRender();
        NetworkManager.queueOperation({ t: 'full', snapshot: entry.snapshot });
        state.undoStack.push({ t: 'restore', snapshot: currentSnapshot });
        break;
    }
  }
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

class InputHandler {
  static init() {
    this.setupKeyboardHandlers();
    this.setupMouseHandlers();
    this.setupTouchHandlers();
    this.setupPanningHandlers();
  }

  static setupKeyboardHandlers() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && key === 'z') {
        e.preventDefault();
        HistoryManager.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && key === 'z') {
        e.preventDefault();
        HistoryManager.redo();
      }

      // Tool shortcuts
      else if (!e.ctrlKey && !e.metaKey) {
        switch (key) {
          case 'p': DrawingTools.selectTool('pen'); break;
          case 'e': DrawingTools.selectTool('eraser'); break;
          case 'l': DrawingTools.selectTool('line'); break;
          case 'r': DrawingTools.selectTool('rect'); break;
          case 'o': DrawingTools.selectTool('ellipse'); break;
          case 'd': DrawingTools.selectTool('diamond'); break;
          case 't': DrawingTools.selectTool('text'); break;
        }
      }

      // Panning
      if (e.code === 'Space') {
        state.spaceHeld = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        state.spaceHeld = false;
      }
    });
  }

  static setupMouseHandlers() {
    ui.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    ui.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    ui.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    ui.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    ui.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  static setupTouchHandlers() {
    ui.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    ui.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    ui.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  static setupPanningHandlers() {
    window.addEventListener('mousemove', (e) => this.handlePanMove(e));
    window.addEventListener('mouseup', () => this.handlePanEnd());
  }

  static handleMouseDown(event) {
    const coords = CoordinateUtils.toCanvas(event);

    // Check for panning
    if (this.shouldStartPanning(event)) {
      this.startPanning(event);
      return;
    }

    // Check for object dragging
    if (event.shiftKey) {
      const objectId = DocumentManager.findTopObjectAt(coords.x, coords.y);
      if (objectId) {
        this.startDragging(objectId, coords);
        return;
      }
    }

    // Start drawing
    this.startDrawing(coords);
  }

  static handleMouseMove(event) {
    const coords = CoordinateUtils.toCanvas(event);

    if (state.drawing && state.activeId) {
      this.continuDrawing(coords);
    } else if (state.isDragging && state.activeId) {
      this.continueDragging(coords);
    } else {
      this.updateHover(coords, event.shiftKey);
    }
  }

  static handleMouseUp(event) {
    if (state.isDragging) {
      state.isDragging = false;
      state.activeId = null;
      state.dragStart = null;
      state.dragInitialPos = null;
      return;
    }

    if (!state.drawing) return;

    state.drawing = false;
    if (['pen', 'eraser'].includes(state.tool)) {
      DrawingTools.finishStroke(state.activeId);
    }

    state.activeId = null;
  }

  static handleDoubleClick(event) {
    const coords = CoordinateUtils.toCanvas(event);
    const objectId = DocumentManager.findTopObjectAt(coords.x, coords.y);

    if (objectId) {
      const obj = state.doc.objects[objectId];
      if (obj && obj.type === 'text') {
        TextEditor.open(obj.x, obj.y, obj.text || '');
      }
    }
  }

  static handleMouseLeave() {
    state.isPanning = false;
  }

  static shouldStartPanning(event) {
    return (state.spaceHeld && event.button === 0) ||
        event.button === 1 ||
        state.tool === 'hand';
  }

  static startPanning(event) {
    state.isPanning = true;
    const rect = ui.canvas.getBoundingClientRect();
    state.lastCX = event.clientX - rect.left;
    state.lastCY = event.clientY - rect.top;
    event.preventDefault();
  }

  static startDragging(objectId, coords) {
    state.activeId = objectId;
    state.isDragging = true;
    const obj = state.doc.objects[objectId];
    if (!obj) return;

    state.dragStart = { x: coords.x, y: coords.y };
    if (obj.points) {
      const bounds = GeometryUtils.getBounds(obj);
      state.dragInitialPos = { x: bounds.x, y: bounds.y };
    } else {
      state.dragInitialPos = { x: obj.x, y: obj.y };
    }

    console.log('Starting drag:', { objectId, coords, initialPos: state.dragInitialPos });
  }

  static startDrawing(coords) {
    state.drawing = true;
    state.start = coords;
    const id = state.generateRandomId();

    switch (state.tool) {
      case 'pen':
      case 'eraser':
        DrawingTools.beginFreeDrawing(id, state.tool, coords.x, coords.y);
        break;
      case 'line':
      case 'rect':
      case 'ellipse':
      case 'diamond':
        DrawingTools.beginShape(id, state.tool, coords.x, coords.y);
        break;
      case 'text':
        TextEditor.open(coords.x, coords.y);
        break;
    }
  }

  static continuDrawing(coords) {
    if (state.tool === 'pen' || state.tool === 'eraser') {
      DrawingTools.addPoint(state.activeId, coords.x, coords.y);
    } else if (['line', 'rect', 'ellipse', 'diamond'].includes(state.tool)) {
      DrawingTools.resizeShape(state.activeId, coords.x, coords.y);
    }
  }

  static continueDragging(coords) {
    const obj = state.doc.objects[state.activeId];
    if (!obj || !state.dragStart || !state.dragInitialPos) return;

    const deltaX = coords.x - state.dragStart.x;
    const deltaY = coords.y - state.dragStart.y;
    const newX = state.dragInitialPos.x + deltaX;
    const newY = state.dragInitialPos.y + deltaY;

    if (obj.points) {
      const currentBounds = GeometryUtils.getBounds(obj);
      const moveX = newX - currentBounds.x;
      const moveY = newY - currentBounds.y;

      obj.points = obj.points.map(point => ({
        x: point.x + moveX,
        y: point.y + moveY
      }));
    } else {
      obj.x = newX;
      obj.y = newY;
    }

    obj.rev++;
    state.bumpDoc();
    state.requestRender();

    NetworkManager.queueOperation({
      t: 'move',
      id: obj.id,
      patch: {
        x: obj.x,
        y: obj.y,
        points: obj.points || null,
        rev: obj.rev
      }
    });
  }

  static updateHover(coords, isShiftPressed) {
    const objectId = DocumentManager.findTopObjectAt(coords.x, coords.y);
    state.hoverId = objectId;
    ui.canvas.style.cursor = (objectId && isShiftPressed) ? 'move' : 'crosshair';
    state.requestRender();
  }

  static handlePanMove(event) {
    if (!state.isPanning) return;

    const rect = ui.canvas.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    const deltaX = clientX - state.lastCX;
    const deltaY = clientY - state.lastCY;

    state.panX += deltaX;
    state.panY += deltaY;
    state.lastCX = clientX;
    state.lastCY = clientY;

    CanvasManager.clampPan();
    state.requestRender();
    CursorManager.handleCanvasTransform();
  }

  static handlePanEnd() {
    state.isPanning = false;
  }

  // Touch handlers
  static handleTouchStart(event) {
    if (event.touches.length === 2) {
      state.touchPanning = true;
      state.lastTouchMid = this.getTouchMidpoint(event.touches[0], event.touches[1]);
      event.preventDefault();
    }
  }

  static handleTouchMove(event) {
    if (!state.touchPanning || event.touches.length !== 2) return;

    const midpoint = this.getTouchMidpoint(event.touches[0], event.touches[1]);
    state.panX += (midpoint.x - state.lastTouchMid.x);
    state.panY += (midpoint.y - state.lastTouchMid.y);
    state.lastTouchMid = midpoint;

    CanvasManager.clampPan();
    state.requestRender();
    event.preventDefault();
  }

  static handleTouchEnd(event) {
    state.touchPanning = false;
  }

  static getTouchMidpoint(touch1, touch2) {
    const rect = ui.canvas.getBoundingClientRect();
    return {
      x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
      y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
    };
  }
}

// ============================================================================
// CURSOR TRACKING - CORRECTED VERSION
// ============================================================================

class CursorManager {
  static init() {
    this.cursors = new Map();
    this.lastBroadcast = 0;
    this.broadcastThrottle = 16;
    this.animationFrame = null;

    // Smoothing configuration
    this.smoothingConfig = {
      easingFactor: 0.15, // Lower = smoother, higher = more responsive
      velocityDecay: 0.8, // Velocity decay for natural movement
      minDistance: 1, // Minimum distance to trigger movement
      maxVelocity: 50 // Maximum velocity per frame
    };

    document.addEventListener("mousemove", (event) => {
      this.updateLocalCursor(event);
    });

    // Start smooth animation loop for peer cursors
    this.startAnimationLoop();

    // Clean up stale cursors periodically
    setInterval(() => {
      this.cleanupStaleCursors();
    }, 5000);
  }

  static updateLocalCursor(event) {
    const now = Date.now();

    // Update local cursor position immediately (no interpolation needed)
    if (ui.mouse) {
      ui.mouse.style.left = `${event.clientX + 20}px`;
      ui.mouse.style.top = `${event.clientY + 20}px`;
      ui.mouse.style.transform = "translate(-50%, -50%)";
      ui.mouse.textContent = state.peerName || 'You';
    }

    // Throttle network broadcasts
    if (now - this.lastBroadcast < this.broadcastThrottle) {
      return;
    }

    this.lastBroadcast = now;

    // Convert to world coordinates for broadcasting
    const worldCoords = this.screenToWorld(event.clientX, event.clientY);

    // Broadcast world coordinates instead of canvas coordinates
    NetworkManager.broadcast({
      t: 'cursor',
      from: {
        name: state.peerName || `Peer-${state.localPeerId}`,
        id: state.localPeerId
      },
      worldX: worldCoords.x,
      worldY: worldCoords.y,
      timestamp: now
    });
  }

  static updatePeerCursor(peerId, peerName, cursorInfo) {
    if (peerId === state.localPeerId) {
      return; // Don't track our own cursor
    }

    const now = Date.now();

    // Convert world coordinates to screen coordinates
    const screenCoords = this.worldToScreen(cursorInfo.worldX, cursorInfo.worldY);

    let cursorData = this.cursors.get(peerId);

    if (!cursorData) {
      // Create new cursor data with element
      cursorData = {
        name: peerName,
        element: this.createPeerCursorElement(peerId, peerName),
        // Current position (for smooth interpolation)
        currentX: screenCoords.x,
        currentY: screenCoords.y,
        // Target position (where we want to move to)
        targetX: screenCoords.x,
        targetY: screenCoords.y,
        // Velocity for smoother movement
        velocityX: 0,
        velocityY: 0,
        // World coordinates (for recalculation on zoom/pan)
        worldX: cursorInfo.worldX,
        worldY: cursorInfo.worldY,
        lastUpdate: now,
        visible: true,
        lastFrameTime: now
      };

      this.cursors.set(peerId, cursorData);
    } else {
      // Calculate new target position
      const newTargetX = screenCoords.x;
      const newTargetY = screenCoords.y;

      // Update cursor data
      cursorData.name = peerName;
      cursorData.targetX = newTargetX;
      cursorData.targetY = newTargetY;
      cursorData.worldX = cursorInfo.worldX;
      cursorData.worldY = cursorInfo.worldY;
      cursorData.lastUpdate = now;
      cursorData.visible = true;
    }

    // Update cursor name if changed
    if (cursorData.element) {
      cursorData.element.textContent = peerName || `Peer-${peerId}`;
    }
  }

  static startAnimationLoop() {
    const animate = (timestamp) => {
      this.updateAllCursors(timestamp);
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  static updateAllCursors(timestamp) {
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (!cursorData.element || !cursorData.visible) continue;

      // Calculate delta time for frame-rate independent smoothing
      const deltaTime = Math.min(timestamp - cursorData.lastFrameTime, 50); // Cap at 50ms
      cursorData.lastFrameTime = timestamp;

      // Calculate distance to target
      const deltaX = cursorData.targetX - cursorData.currentX;
      const deltaY = cursorData.targetY - cursorData.currentY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Skip if we're close enough
      if (distance < this.smoothingConfig.minDistance) {
        continue;
      }

      // Calculate desired velocity with easing
      const easingFactor = this.smoothingConfig.easingFactor * (deltaTime / 16); // Normalize to 60fps
      const desiredVelX = deltaX * easingFactor;
      const desiredVelY = deltaY * easingFactor;

      // Apply velocity smoothing
      cursorData.velocityX = cursorData.velocityX * this.smoothingConfig.velocityDecay +
          desiredVelX * (1 - this.smoothingConfig.velocityDecay);
      cursorData.velocityY = cursorData.velocityY * this.smoothingConfig.velocityDecay +
          desiredVelY * (1 - this.smoothingConfig.velocityDecay);

      // Clamp velocity
      const velocity = Math.sqrt(cursorData.velocityX ** 2 + cursorData.velocityY ** 2);
      if (velocity > this.smoothingConfig.maxVelocity) {
        const scale = this.smoothingConfig.maxVelocity / velocity;
        cursorData.velocityX *= scale;
        cursorData.velocityY *= scale;
      }

      // Update position
      cursorData.currentX += cursorData.velocityX;
      cursorData.currentY += cursorData.velocityY;

      // Check if cursor is within viewport bounds with buffer
      const buffer = 100;
      const inBounds = cursorData.currentX >= -buffer &&
          cursorData.currentX <= window.innerWidth + buffer &&
          cursorData.currentY >= -buffer &&
          cursorData.currentY <= window.innerHeight + buffer;

      if (inBounds) {
        // Update element position with smooth values
        cursorData.element.style.left = `${Math.round(cursorData.currentX)}px`;
        cursorData.element.style.top = `${Math.round(cursorData.currentY)}px`;
        cursorData.element.style.opacity = '1';
        cursorData.element.style.visibility = 'visible';
      } else {
        // Fade out off-screen cursors
        cursorData.element.style.opacity = '0.3';
      }
    }
  }

  // Helper method to convert screen coordinates to world coordinates
  static screenToWorld(screenX, screenY) {
    const rect = ui.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    return {
      x: (canvasX - state.panX) / state.zoom,
      y: (canvasY - state.panY) / state.zoom
    };
  }

  // Helper method to convert world coordinates to screen coordinates
  static worldToScreen(worldX, worldY) {
    const rect = ui.canvas.getBoundingClientRect();
    const canvasX = worldX * state.zoom + state.panX;
    const canvasY = worldY * state.zoom + state.panY;
    return {
      x: canvasX + rect.left,
      y: canvasY + rect.top
    };
  }

  static createPeerCursorElement(peerId, peerName) {
    const { bg, text } = getRandomColorPair();
    const element = document.createElement('div');
    element.className = 'peer-cursor';
    element.dataset.peerId = peerId;

    // Enhanced styling for smoother appearance
    element.style.cssText = `
            position: fixed;
            left: 0px;
            top: 0px;
            width: fit-content;
            height: fit-content;
            background: ${bg};
            border-radius: 4px 50px 50px 50px;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 9999;
            color: ${text};
            padding: 4px 8px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            opacity: 1;
            visibility: visible;
            transform: translate(-50%, -100%);
            will-change: transform, left, top;
            backface-visibility: hidden;
            transition: opacity 0 ease-out;
        `;

    element.textContent = peerName || `Peer-${peerId}`;
    document.body.appendChild(element);

    return element;
  }

  static updatePeerName(peerId, name) {
    state.peerNames.set(peerId, name);
    const cursorData = this.cursors.get(peerId);
    if (cursorData) {
      cursorData.name = name;
      if (cursorData.element) {
        cursorData.element.textContent = name || `Peer-${peerId}`;
      }
    }
  }

  static cleanupStaleCursors() {
    const now = Date.now();
    const staleThreshold = 10000; // 10 seconds

    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (now - cursorData.lastUpdate > staleThreshold) {
        this.removePeerCursor(peerId);
      }
    }
  }

  static removePeerCursor(peerId) {
    const cursorData = this.cursors.get(peerId);
    if (cursorData && cursorData.element) {
      // Fade out before removing
      cursorData.element.style.transition = 'opacity 200ms ease-out';
      cursorData.element.style.opacity = '0';

      setTimeout(() => {
        if (cursorData.element && cursorData.element.parentNode) {
          cursorData.element.parentNode.removeChild(cursorData.element);
        }
      }, 200);
    }

    this.cursors.delete(peerId);
    state.peerCursors.delete(peerId);
  }

  static handleWindowResize() {
    // Recalculate all cursor positions when window resizes
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (cursorData.visible && cursorData.worldX !== undefined && cursorData.worldY !== undefined) {
        // Recalculate screen position from world coordinates
        const newScreenCoords = this.worldToScreen(cursorData.worldX, cursorData.worldY);
        cursorData.targetX = newScreenCoords.x;
        cursorData.targetY = newScreenCoords.y;
        cursorData.currentX = newScreenCoords.x;
        cursorData.currentY = newScreenCoords.y;
      }
    }
  }

  // Called when canvas pan/zoom changes
  static handleCanvasTransform() {
    // Update all cursor positions based on new transform
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (cursorData.visible && cursorData.worldX !== undefined && cursorData.worldY !== undefined) {
        const newScreenCoords = this.worldToScreen(cursorData.worldX, cursorData.worldY);
        cursorData.targetX = newScreenCoords.x;
        cursorData.targetY = newScreenCoords.y;
      }
    }
  }

  static renderPeerCursors() {
    // This method is now mainly for compatibility
    // Most rendering is handled by the animation loop
  }

  static destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Clean up all cursor elements
    for (const [peerId, cursorData] of this.cursors.entries()) {
      if (cursorData.element && cursorData.element.parentNode) {
        cursorData.element.parentNode.removeChild(cursorData.element);
      }
    }

    this.cursors.clear();
  }
}

// ============================================================================
// USER INTERFACE
// ============================================================================

class UIManager {
  static init() {
    this.setupUserNameHandlers();
    this.setupToolHandlers();
    this.setupSessionHandlers();
    this.updateLocalPeerDisplay();
  }

  static setupUserNameHandlers() {
    document.querySelector('.peer-name-container').addEventListener('click', (e) => {
      e.preventDefault();
      ui.namePopup.classList.toggle('hidden');
    });

    ui.peerNameBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const username = ui.peerNameInput.value.trim();
      if (username.length > 0) {
        this.updateUserName(username);
      }
    });
  }

  static setupToolHandlers() {
    ui.tools.addEventListener('click', (e) => {
      const button = e.target;
      if (button && button.dataset.tool) {
        DrawingTools.selectTool(button.dataset.tool);
      }
    });

    ui.color.addEventListener('input', () => {
      state.strokeColor = ui.color.value;
    });

    ui.size.addEventListener('input', () => {
      state.strokeSize = parseInt(ui.size.value, 10);
    });

    ui.opacitySlider.addEventListener('input', (e) => {
      state.strokeOpacity = parseFloat(e.target.value)
    })

    ui.undo.addEventListener('click', () => HistoryManager.undo());
    ui.redo.addEventListener('click', () => HistoryManager.redo());
    ui.clear.addEventListener('click', () => DocumentManager.clearAll(true));
    ui.save.addEventListener('click', () => this.saveCanvasAsPNG());
    ui.saveState.addEventListener('click', () => this.saveDrawingState());
  }

  static setupSessionHandlers() {
    ui.createBtn.addEventListener("click", async () => {
      const topic = crypto.randomBytes(32).toString("hex");
      const roomName = state.peerName + "-" + topic.substr(0, 6);
      const result = await auth.addRoom(state.peerName, topic, roomName);
      if (result) {
        console.log('Room created:', result);
        SessionManager.startSession(topic);
      } else {
        alert('Failed to create room');
      }
    });

    ui.joinBtn.addEventListener("click", async () => {
      const topic = ui.joinInput.value.trim();
      if (!topic) {
        alert("Enter a topic key");
        return;
      }

      const roomName = state.peerName + "-" + topic.substr(0, 6);
      const result = await auth.addRoom(state.peerName, topic, roomName);
      console.log('Result : ', result)
      if (result) {
        if (result.alreadyExists) {
          console.log('Joining existing room:', topic);
        } else {
          console.log('Room added and joining:', result);
        }
        SessionManager.startSession(topic);
      } else {
        alert('Failed to add room to your list');
      }
    });

  }

  static updateUserName(username) {
    CursorManager.updatePeerName(state.localPeerId, username);
    state.peerName = username;
    ui.localPeerName.innerHTML = state.peerName;
    ui.namePopup.classList.add('hidden');

    // Update the local mouse follower text
    if (ui.mouse) {
      ui.mouse.textContent = username || 'You';
    }

    console.log('Local Peer ID set to', state.localPeerId, 'Username:', username);
  }

  static updateLocalPeerDisplay() {
    ui.localPeerName.innerHTML = state.localPeerId;
    console.log('All State : ', this.state)
  }

  static updatePeerCount(count) {
    ui.peersCount.textContent = String(count + 1);
  }

  static saveCanvasAsPNG() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = ui.canvas.width;
    tempCanvas.height = ui.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(ui.canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `whiteboard-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(dataUrl);
  }

  static async saveDrawingState() {
    if (!state.topicKey) {
      alert('No active room to save to');
      return;
    }

    const success = await HypercoreManager.saveDrawingState(state.topicKey);
    if (success) {
      alert('Drawing state saved to Hypercore!');
      // Show visual feedback
      ui.saveState.textContent = '';
      setTimeout(() => {
        ui.saveState.textContent = 'Save State';
      }, 2000);
    } else {
      alert('Failed to save drawing state');
    }
  }

  static showSetup() {
    ui.setup.classList.remove('hidden');
    ui.loading.classList.add('hidden');
    ui.toolbar.classList.add('hidden');
    ui.boardWrap.classList.add('hidden');
  }

  static showLoading() {
    ui.setup.classList.add('hidden');
    ui.loading.classList.remove('hidden');
    ui.toolbar.classList.add('hidden');
    ui.boardWrap.classList.add('hidden');
  }

  static showWorkspace() {
    ui.setup.classList.add('hidden');
    ui.loading.classList.add('hidden');
    ui.toolbar.classList.remove('hidden');
    ui.boardWrap.classList.remove('hidden');
    ui.peerCountBtn.classList.remove('hidden');
    ui.canvasRoomKey.classList.remove('hidden');
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

class SessionManager {
  static async startSession(topicHex) {
    if (state.joined) return;

    state.joined = true;
    state.topicKey = topicHex;

    UIManager.showLoading();
    ui.topicOut.dataset.value = topicHex;

    try {
      await NetworkManager.initSwarm(topicHex);
      UIManager.showWorkspace();
      CanvasManager.resizeCanvas();
    } catch (error) {
      console.error('Failed to start networking:', error);
      alert('Failed to start networking');
      window.location.reload();
    }
  }
}

// ============================================================================
// NETWORK MANAGEMENT - FIXED VERSION
// ============================================================================

class NetworkManager {
  static async initSwarm(topicHex) {
    state.swarm = new Hyperswarm();
    const topic = b4a.from(topicHex, 'hex');

    state.swarm.on('connection', (socket) => {
      this.setupConnection(socket);
    });

    await state.swarm.join(topic, { server: true, client: true });
    await state.swarm.flush();
  }

  static setupConnection(socket) {
    const peerId = crypto.randomBytes(4).toString('hex');
    const connection = {
      socket: socket,
      peerId: peerId,
      closed: false
    };

    state.connections.add(connection);
    state.peerCount = state.connections.size;
    UIManager.updatePeerCount(state.peerCount);

    console.log(`New peer connected: ${peerId}`);

    // Setup Hypercore replication for this peer
    if (state.topicKey) {
      setTimeout(() => {
        HypercoreManager.setupReplication(state.topicKey, connection);
      }, 1000); // Wait for connection to stabilize
    }

    // Send initial hello with current document
    this.safeSend(connection, {
      t: 'hello',
      from: state.localPeerId,
      doc: this.serializeDocument()
    });

    socket.on('data', (buffer) => {
      const message = this.decode(buffer);
      if (message) {
        this.handleRemoteMessage(message);
      }
    });

    socket.once('close', () => {
      connection.closed = true;
      state.connections.delete(connection);
      state.peerCount = state.connections.size;
      UIManager.updatePeerCount(state.peerCount);
      console.log(`Peer disconnected: ${peerId}`);
    });

    socket.once('error', () => {
      connection.closed = true;
      state.connections.delete(connection);
      state.peerCount = state.connections.size;
      UIManager.updatePeerCount(state.peerCount);
    });
  }

  static queueOperation(operation) {
    state.outbox.push(operation);
    this.flushOutbox();
  }

  static flushOutbox() {
    if (state.flushing) return;
    state.flushing = true;

    while (state.outbox.length > 0) {
      const operation = state.outbox.shift();
      this.broadcast(operation);
    }

    state.flushing = false;
  }

  static broadcast(operation) {
    const payload = this.encode(operation);
    for (const connection of state.connections) {
      if (connection.closed) continue;
      try {
        connection.socket.write(payload);
      } catch (error) {
        // Connection dropped, ignore error
      }
    }
  }

  static safeSend(connection, object) {
    try {
      connection.socket.write(this.encode(object));
    } catch (error) {
      // Connection dropped, ignore error
    }
  }

  static serializeDocument() {
    return {
      version: state.doc.version,
      order: state.doc.order,
      objects: state.doc.objects
    };
  }

  static applySnapshot(snapshot) {
    if (!snapshot || (snapshot.version ?? -1) < (state.doc.version ?? -1)) {
      return;
    }

    state.doc.order = [...snapshot.order];
    state.doc.objects = {};
    for (const id of state.doc.order) {
      state.doc.objects[id] = snapshot.objects[id];
    }

    state.doc.version = snapshot.version;
    state.requestRender();
  }

  static handleRemoteMessage(message) {
    switch (message.t) {
      case 'hello':
        console.log(`Hello from peer: ${message.from}`);
        this.applySnapshot(message.doc);
        // Reply with our version if we're ahead
        if (state.doc.version > (message.doc?.version ?? -1)) {
          this.broadcast({ t: 'full', snapshot: this.serializeDocument() });
        }
        break;
      case 'full':
        this.applySnapshot(message.snapshot);
        break;
      case 'add':
        this.handleAddMessage(message);
        break;
      case 'update':
        this.handleUpdateMessage(message);
        break;
      case 'patch':
        this.handlePatchMessage(message);
        break;
      case 'touch':
        this.handleTouchMessage(message);
        break;
      case 'move':
        this.handleMoveMessage(message);
        break;
      case 'delete':
        this.handleDeleteMessage(message);
        break;
      case 'clear':
        DocumentManager.clearAll(false);
        break;
      case 'cursor':
        this.handleCursorMessage(message);
        break;
      case 'hypercore_saved':
        console.log('Peer', message.from, 'saved drawing to Hypercore at', new Date(message.savedAt));
        break;
      case 'hypercore_loaded':
        console.log(' Peer', message.from, 'loaded drawing from Hypercore, version:', message.loadedVersion);
        break;
    }
  }

  static handleAddMessage(message) {
    const obj = message.obj;
    if (state.doc.objects[obj.id]) return;

    state.doc.objects[obj.id] = obj;
    state.doc.order.push(obj.id);
    state.bumpDoc();
    state.requestRender();
  }

  static handleUpdateMessage(message) {
    const obj = state.doc.objects[message.id];
    if (!obj) return;

    // Last-writer-wins by revision number
    if ((message.patch.rev ?? 0) < (obj.rev ?? 0)) return;

    Object.assign(obj, message.patch);
    state.bumpDoc();
    state.requestRender();
  }

  static handlePatchMessage(message) {
    const obj = state.doc.objects[message.id];
    if (!obj || !obj.points) return;

    obj.points.push(message.push);
    obj.rev++;
    state.bumpDoc();
    state.requestRender();
  }

  static handleTouchMessage(message) {
    const obj = state.doc.objects[message.id];
    if (obj) {
      obj.rev++;
      state.bumpDoc();
      state.requestRender();
    }
  }

  static handleMoveMessage(message) {
    const obj = state.doc.objects[message.id];
    if (!obj) return;

    if ((message.patch.rev ?? 0) < (obj.rev ?? 0)) return;

    if (message.patch.points) {
      obj.points = message.patch.points;
    }

    obj.x = message.patch.x;
    obj.y = message.patch.y;
    obj.rev = message.patch.rev;
    state.bumpDoc();
    state.requestRender();
  }

  static handleDeleteMessage(message) {
    const id = message.id;
    if (!state.doc.objects[id]) return;

    delete state.doc.objects[id];
    state.doc.order = state.doc.order.filter(objId => objId !== id);
    state.bumpDoc();
    state.requestRender();
  }

  static handleCursorMessage(message) {
    // Ignore our own cursor updates
    if (message.from.id === state.localPeerId ||
        (message.from.name === state.peerName && message.from.name !== '')) {
      return;
    }

    // Validate message structure - now expects worldX/worldY instead of canvasX/canvasY
    if (!message.from || !message.from.id ||
        typeof message.worldX !== 'number' ||
        typeof message.worldY !== 'number') {
      return;
    }

    // Store cursor data for potential recalculations
    state.peerCursors.set(message.from.id, {
      name: message.from.name,
      cursor: {
        worldX: message.worldX,
        worldY: message.worldY,
        timestamp: message.timestamp || Date.now()
      }
    });

    // Update smooth cursor system with world coordinates
    CursorManager.updatePeerCursor(
        message.from.id,
        message.from.name || `Peer-${message.from.id}`,
        {
          worldX: message.worldX,
          worldY: message.worldY,
          timestamp: message.timestamp || Date.now()
        }
    );
  }

  static encode(object) {
    return b4a.from(JSON.stringify(object));
  }

  static decode(buffer) {
    try {
      return JSON.parse(b4a.toString(buffer));
    } catch (error) {
      return null;
    }
  }
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

class WhiteboardApp {
  static async init() {
    state.localPeerId = await initAuth()
    console.log(state.localPeerId)
    await initializeRoomList()

    CanvasManager.init();
    InputHandler.init();
    CursorManager.init();
    UIManager.init();

    DrawingTools.selectTool('pen');
    state.strokeColor = ui.color.value;
    state.strokeSize = parseInt(ui.size.value, 10);

    UIManager.showSetup();
  }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (window.__WB_BOOTED__) { console.warn('Boot skipped: already booted'); return; }
  window.__WB_BOOTED__ = true;
  console.log('WhiteboardApp.init called')
  await WhiteboardApp.init();

}, { once: true });

function initializeRoomList() {
  auth.getAllRooms(state.peerName)
      .then(raw => {
        // Debug
        console.log('RAW ROOMS:', raw, typeof raw, Array.isArray(raw));

        let roomsArray = [];

        // Case A: already an array of {key,value}
        if (Array.isArray(raw)) {
          roomsArray = raw;
        }
        // Case B: object whose values are room objects
        else if (raw && typeof raw === 'object') {
          // e.g. { roomKey1:{…}, roomKey2:{…} }
          roomsArray = Object.entries(raw).map(([key, value]) => ({ key, value }));
        }

        renderRoomList(roomsArray);
      })
      .catch(err => {
        console.error('Error loading rooms:', err);
        renderRoomList([]);
      });

  ui.roomsList.addEventListener('click', event => {
    const li = event.target.closest('.room-list');
    if (!li) return;
    SessionManager.startSession(li.dataset.value);
  });
}

// JavaScript
function renderRoomList(rooms) {
  const container = ui.roomsList;

  if (!rooms || rooms.length === 0) {
    container.innerHTML = '<li>No rooms found.</li>';
    return;
  }

  const html = rooms
      .map((room) => `
      <li class="room-list" data-value="${room.key}" data-name="${room.value.roomName}">
        <div class="room-name">${room.value.roomName}</div>
        <div class="room-date">
          Created: ${new Date(room.value.createdAt).toLocaleString()}
        </div>
        <i class="fas fa-trash delete-icon" title="Delete room"></i>
      </li>
    `)
      .join('');

  container.innerHTML = html;

  const icons = container.querySelectorAll('.delete-icon');
  icons.forEach((icon) => {
    icon.addEventListener('click', async (e) => {
      e.stopPropagation();
      const li = e.currentTarget.closest('.room-list');
      const roomKey = li.getAttribute('data-value');
      await auth.deleteRoom(state.peerName, roomKey)
      await initializeRoomList();
      console.log('Delete room with key:', roomKey);
    });
  });
}


if (!window.__WB_EVENTS_BOUND__) {
  window.__WB_EVENTS_BOUND__ = true;
// Enhanced room key copying
  ui.canvasRoomKey.addEventListener('click', () => {
    const textToCopy = ui.topicOut.getAttribute('data-value')
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        alert('Room key copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  })

// Enhanced load state button with better feedback
  ui.loadStateBtn.addEventListener('click', async () => {
    if (ui.loadStateBtn.dataset.loading === '1') return;
    ui.loadStateBtn.dataset.loading = '1';
    try {
      const roomKey = ui.topicOut.getAttribute('data-value');
      console.log('Loading drawing state for room:', roomKey);

      const success = await HypercoreManager.loadLatestDrawing(roomKey);
      if (success) {
        alert('Drawing loaded successfully!');
        // Show drawing history
        HypercoreManager.getDrawingHistory(roomKey);
      } else {
        alert('No saved drawing found or failed to load');
      }
    } finally {
      ui.loadStateBtn.dataset.loading = '0';
    }
  });


  ui.slideStateBtn.addEventListener('click', () => {
    State.listAllState(HypercoreManager.getDrawingHistory(ui.topicOut.getAttribute('data-value')))
  })


// Enhanced room management
  document.getElementById('delete-state').addEventListener('click', async () => {
    const roomKey = document.getElementById('canvas-topic').getAttribute('data-value');
    if (!roomKey) {
      alert('No active room to delete');
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete all drawings in room "${roomKey}"?`);
    if (confirmDelete) {
      const success = await HypercoreManager.deleteDrawings(roomKey);
      if (success) {
        alert('Room drawings deleted successfully');
        location.reload(); // Refresh the room list
      } else {
        alert('Failed to delete room drawings');
      }
    }
  });

  document.querySelectorAll('.room-list').forEach(room => {
    console.log(room)
    room.addEventListener('click', async () => {
      const roomKey = room.getAttribute('data-value');
      if (!roomKey) {
        alert('No active room to delete');
        return;
      }
    })
    room.addEventListener('click', () => {
      console.log('Clicked room:')
      const topic = room.dataset.value;
      console.log('Topic:', topic)
      if (topic) SessionManager.startSession(topic);
    });
  });

// Add room history viewer
  function showRoomHistory(roomKey) {
    HypercoreManager.getDrawingHistory(roomKey);
  }

  // const version = JSON.parse(fs.readFileSync('./package.json', 'utf8')).version
  // document.querySelector('#version').innerHTML = version;

  document.querySelector('#state-details').addEventListener('click', () => {
    console.log(state)
  })

// Export for potential external use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      WhiteboardApp,
      state,
      CanvasManager,
      DrawingTools,
      DocumentManager,
      NetworkManager,
      UIManager,
      HypercoreManager
    };
  }
}