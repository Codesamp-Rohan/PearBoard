import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { addAlphaToColor, getRandomColorPair } from "./helper.js";
import {Room, room} from "./Room/room.js";

import {globalState} from "./storage/GlobalState.js";
import { state } from './storage/AppState.js'
export const PEAR_PATH = Pear.config.storage

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
  slideStateCloseBtn: $('#slide-state-close-btn'),

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
  zoomMin: $('.zoom_min'),
  zoomMax: $('.zoom_max'),
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

export class CanvasManager {
  static init() {
    state.ctx = ui.canvas.getContext('2d', { alpha: true });
    this.resizeCanvas();
    this.setupEventListeners();
    this.startRenderLoop();
    this.renderFrame();

    // Add state for tracking touches and space key
    state.isDragging = false;
    state.isSpacePressed = false;
    state.lastTouchX = 0;
    state.lastTouchY = 0;
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
      if (e.ctrlKey) {
        const zoomFactor = e.deltaY < 0 ? CONFIG.ZOOM_STEP : 1 / CONFIG.ZOOM_STEP;
        const newZoom = Math.min(
            CONFIG.MAX_ZOOM,
            Math.max(CONFIG.MIN_ZOOM, state.zoom * zoomFactor)
        );

        if (newZoom === state.zoom) return;

        const rect = ui.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - state.panX) / state.zoom;
        const worldY = (mouseY - state.panY) / state.zoom;

        state.zoom = newZoom;

        state.panX = mouseX - (worldX * newZoom);
        state.panY = mouseY - (worldY * newZoom);

        const scalePercent = Math.round(newZoom * 100);
        ui.scaleDisplay.textContent = `${scalePercent}%`;

        this.clampPan();
        state.requestRender();

        if (typeof CursorManager !== 'undefined') {
          CursorManager.handleCanvasTransform();
        }
      } else {
        state.panX -= e.deltaX;
        state.panY -= e.deltaY;

        this.clampPan();
        state.requestRender();

        if (typeof CursorManager !== 'undefined') {
          CursorManager.handleCanvasTransform();
        }
      }
    }, { passive: false });


    // Add these variables at the class level (keep as-is)
    let lastPinchDistance = 0;
    let initialPinchDistance = 0;  // Add this
    let pinchStartZoom = 0;
    let pinchCenter = { x: 0, y: 0 };

// CORRECTED touchstart handler
    ui.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate initial pinch distance
        initialPinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        lastPinchDistance = initialPinchDistance;

        // Store initial zoom level
        pinchStartZoom = state.zoom;

        // Calculate and STORE the initial pinch center point
        const rect = ui.canvas.getBoundingClientRect();
        pinchCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };

        // Convert initial pinch center to world coordinates
        pinchCenter.worldX = (pinchCenter.x - rect.left - state.panX) / state.zoom;
        pinchCenter.worldY = (pinchCenter.y - rect.top - state.panY) / state.zoom;
      }
    });

// CORRECTED touchmove handler
    ui.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        // Calculate current pinch distance
        const currentPinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        // Calculate zoom based on initial distance (not last distance)
        const scale = currentPinchDistance / initialPinchDistance;
        const newZoom = Math.min(
            CONFIG.MAX_ZOOM,
            Math.max(CONFIG.MIN_ZOOM, pinchStartZoom * scale)
        );

        if (newZoom !== state.zoom) {
          // Get current pinch center
          const currentPinchCenter = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
          };

          const rect = ui.canvas.getBoundingClientRect();

          // Apply new zoom
          state.zoom = newZoom;

          // Update pan to keep the world point under the pinch center fixed
          state.panX = currentPinchCenter.x - rect.left - (pinchCenter.worldX * newZoom);
          state.panY = currentPinchCenter.y - rect.top - (pinchCenter.worldY * newZoom);

          // Update zoom display
          ui.scaleDisplay.textContent = `${Math.round(newZoom * 100)}%`;

          // Update canvas and bounds
          CanvasManager.clampPan();
          state.requestRender();
          if (typeof CursorManager !== 'undefined') {
            CursorManager.handleCanvasTransform();
          }
        }
      }
    });

// touchend and touchcancel remain the same
    ui.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        lastPinchDistance = 0;
        initialPinchDistance = 0;  // Also reset this
        pinchStartZoom = 0;
      }
    });

    ui.canvas.addEventListener('touchcancel', () => {
      lastPinchDistance = 0;
      initialPinchDistance = 0;  // Also reset this
      pinchStartZoom = 0;
    });

    // Add space + mouse drag handlers
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !state.isSpacePressed) {
        state.isSpacePressed = true;
        ui.canvas.style.cursor = 'grab';
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        state.isSpacePressed = false;
        ui.canvas.style.cursor = 'default';
      }
    });

    ui.canvas.addEventListener('mousedown', (e) => {
      if (state.isSpacePressed) {
        e.preventDefault();
        state.isDragging = true;
        state.lastTouchX = e.clientX;
        state.lastTouchY = e.clientY;
        ui.canvas.style.cursor = 'grabbing';
      }
    });

    ui.canvas.addEventListener('mousemove', (e) => {
      if (state.isDragging && state.isSpacePressed) {
        e.preventDefault();
        const dx = e.clientX - state.lastTouchX;
        const dy = e.clientY - state.lastTouchY;

        state.panX += dx;
        state.panY += dy;

        state.lastTouchX = e.clientX;
        state.lastTouchY = e.clientY;

        this.clampPan();
        state.requestRender();
      }
    });

    ui.canvas.addEventListener('mouseup', () => {
      if (state.isSpacePressed) {
        state.isDragging = false;
        ui.canvas.style.cursor = 'grab';
      }
    });

    // Prevent space from scrolling the page
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
      }
    });

    // Existing zoom button listeners...
    ui.zoomMax.addEventListener('click', () => {
      this.handleZoomButton(CONFIG.ZOOM_STEP);
    });

    ui.zoomMin.addEventListener('click', () => {
      this.handleZoomButton(1 / CONFIG.ZOOM_STEP);
    });
  }

  static generateThumbnail(canvas, maxWidth = 300, maxHeight = 150) {
    const tmpCanvas = document.createElement('canvas')
    const ctx = tmpCanvas.getContext('2d')

    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height)
    tmpCanvas.width = canvas.width * ratio;
    tmpCanvas.height = canvas.height * ratio;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    ctx.scale(ratio, ratio);
    ctx.drawImage(canvas, 0, 0);

    return tmpCanvas.toDataURL('image/png');
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

    const leftWorld = -state.panX / state.zoom;
    const topWorld = -state.panY / state.zoom;

    const maxPanX = CONFIG.WORLD_WIDTH - viewWidthWorld;
    const maxPanY = CONFIG.WORLD_HEIGHT - viewHeightWorld;

    const clampedLeftWorld = Math.max(0, Math.min(leftWorld, maxPanX));
    const clampedTopWorld = Math.max(0, Math.min(topWorld, maxPanY));

    state.panX = -clampedLeftWorld * state.zoom;
    state.panY = -clampedTopWorld * state.zoom;
  }

  static centerView() {
    const viewWidth = ui.canvas.clientWidth;
    const viewHeight = ui.canvas.clientHeight;
    const startLeftWorld = (CONFIG.WORLD_WIDTH - viewWidth / state.zoom) / 2;
    const startTopWorld = (CONFIG.WORLD_HEIGHT - viewHeight / state.zoom) / 2;
    state.panX = -startLeftWorld * state.zoom;
    state.panY = -startTopWorld * state.zoom;
  }

  static handleZoomButton(zoomFactor) {
    const newZoom = Math.min(
        CONFIG.MAX_ZOOM,
        Math.max(CONFIG.MIN_ZOOM, state.zoom * zoomFactor)
    );

    if (newZoom === state.zoom) return;
    const rect = ui.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const worldX = (centerX - state.panX) / state.zoom;
    const worldY = (centerY - state.panY) / state.zoom;

    state.zoom = newZoom;

    state.panX = centerX - (worldX * newZoom);
    state.panY = centerY - (worldY * newZoom);

    const scalePercent = Math.round(newZoom * 100);
    ui.scaleDisplay.textContent = `${scalePercent}%`;

    this.clampPan();
    state.requestRender();
    CursorManager.handleCanvasTransform();
  }


  static handleWheel(event) {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? CONFIG.ZOOM_STEP : 1 / CONFIG.ZOOM_STEP;
    const newZoom = Math.min(
        CONFIG.MAX_ZOOM,
        Math.max(CONFIG.MIN_ZOOM, state.zoom * zoomFactor)
    );
    if (newZoom === state.zoom) return;
    const rect = ui.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = (mouseX - state.panX) / state.zoom;
    const worldY = (mouseY - state.panY) / state.zoom;
    state.zoom = newZoom;
    state.panX = mouseX - (worldX * newZoom);
    state.panY = mouseY - (worldY * newZoom);
    const scalePercent = Math.round(newZoom * 100);
    ui.scaleDisplay.textContent = `${scalePercent}%`;
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

    // Switch to screen space for crisp dots
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Render minor grid dots
    if (showMinor) {
      this.renderGridDots(ctx, minorStep, leftWorld, topWorld, rightWorld, bottomWorld,
          scale, translateX, translateY, 'rgba(0,0,0,0.15)', 1);
    }

    // Render major grid dots
    this.renderGridDots(ctx, majorStep, leftWorld, topWorld, rightWorld, bottomWorld,
        scale, translateX, translateY, 'rgba(0,0,0,0.45)', 3);

    ctx.restore();

    // Restore world transform
    ctx.setTransform(scale, 0, 0, scale, translateX, translateY);
  }

  static renderGridDots(ctx, step, leftWorld, topWorld, rightWorld, bottomWorld,
                        scale, translateX, translateY, color, dotSize) {
    ctx.fillStyle = color;

    const startX = Math.floor(leftWorld / step) * step;
    const startY = Math.floor(topWorld / step) * step;

    for (let x = startX; x <= rightWorld; x += step) {
      for (let y = startY; y <= bottomWorld; y += step) {
        const screenX = Math.round(scale * x + translateX);
        const screenY = Math.round(scale * y + translateY);

        ctx.beginPath();
        ctx.arc(screenX, screenY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
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
      case 'del':
        const obj = state.doc.objects[entry.id];
        if (obj) {
          DocumentManager.deleteObject(entry.id, false);
          NetworkManager.queueOperation({ t: 'delete', id: entry.id });
          state.redoStack.push({ t: 'add', obj: entry.before });
        }
        break;
      case 'add':
        DocumentManager.addObject(entry.obj, false);
        NetworkManager.queueOperation({ t: 'add', obj: entry.obj });
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
      document.querySelector('#color-text').textContent = state.strokeColor
    });

    ui.size.addEventListener('input', () => {
      state.strokeSize = parseInt(ui.size.value, 10);
      document.querySelector('#size-text').textContent = state.strokeSize + ' px'
    });

    ui.opacitySlider.addEventListener('input', (e) => {
      state.strokeOpacity = parseFloat(e.target.value)
      document.querySelector('#opacity-text').textContent = state.strokeOpacity
    })

    ui.undo.addEventListener('click', () => HistoryManager.undo());
    ui.redo.addEventListener('click', () => HistoryManager.redo());
    ui.clear.addEventListener('click', () => DocumentManager.clearAll(true));
    ui.save.addEventListener('click', () => this.saveCanvasAsPNG());
    ui.saveState.addEventListener('click', () => this.saveDrawingState());
  }

  static async getRoomName() {
    return document.querySelector('#room-name-input').value.trim();
  }

  static setupSessionHandlers() {
    const setNameBtn = document.querySelector("#room-name-btn");
    const roomNameForm = document.querySelector("#room-name-form");

    // 1. Toggle the custom name form on Create click
    ui.createBtn.addEventListener("click", () => {
      roomNameForm.classList.remove("hidden");
      roomNameForm.style.display = "flex";
    });

    // 2. After entering name, create the room
    setNameBtn.addEventListener("click", async () => {
      const topic = crypto.randomBytes(32).toString("hex");
      const roomName = await this.getRoomName();
      if (!roomName) {
        alert("Please enter a room name");
        return;
      }

      const result = await room.addRoom(topic, roomName, state.peerName);
      if (result) {
        console.log("Room created:", await room.getRoom(topic));
        await room.broadcastRoomDetails(topic, true, null)
        SessionManager.startSession(topic);
      } else {
        alert("Failed to create room");
      }
    });

    // 3. Join existing room flow
    ui.joinBtn.addEventListener("click", async () => {
      const topic = document
          .querySelector("#join-canvas-topic")
          .value.trim();
      if (!topic) {
        alert("Enter a topic key");
        return;
      }

      const result = await room.addRoom(
          topic);
      console.log("Result:", result);

      if (result) {
        if (result.alreadyExists) {
          console.log("Joining existing room:", topic);
        } else {
          console.log("Room added and joining:", result);
        }
        SessionManager.startSession(topic);
      } else {
        alert("Failed to add room to your list");
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

    const success = await room.addRoomState(state.topicKey);
    if (success) {
      alert('Drawing state saved to Hyperbee 🐝');
      // Show visual feedback
      ui.saveState.textContent = 'Savinggg';
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
    ui.topicOut.textContent = topicHex

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

export class NetworkManager {
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
    const connection = { socket: socket, peerId: peerId, closed: false };

    state.connections.add(connection);
    state.peerCount = state.connections.size;
    UIManager.updatePeerCount(state.peerCount);

    console.log(`New peer connected: ${`peerId`}`);

    if (state.topicKey) {
      setTimeout(() => {
        room.setupReplication(state.topicKey, connection);
      }, 1000);
    }

    this.safeSend(connection, {
      t: 'hello',
      from: state.localPeerId,
      doc: this.serializeDocument(),
      requestRoomDetails: true,
      roomKey: state.topicKey
    });

    socket.on('data', (buffer) => {
      const message = this.decode(buffer);
      if (message) {
        this.handleRemoteMessage(message, connection);
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

  static async handleRemoteMessage(message) {
    switch (message.t) {
      case 'hello':
        console.log(`Hello from peer: ${message.from}`);
        this.applySnapshot(message.doc);
        if (message.requestRoomDetails && message.roomKey === state.topicKey) {
          const roomRecord = await room.getRoom(message.roomKey);
          console.log(roomRecord)
          const isCreator = roomRecord?.creator.name === globalState.getPeerName()
          console.log(isCreator)
          if (isCreator) {
            setTimeout(() => {
              room.broadcastRoomDetails(message.roomKey, true, message.from);
            }, 500);
          }
        }
        if (state.doc.version > (message.doc?.version ?? -1)) {
          this.broadcast({
            t: 'full',
            snapshot: this.serializeDocument()
          });
        }
        break;
      case 'room_details':
        this.handleRoomDetailsMessage(message);
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
      case 'room_state_added':
        console.log('Room state added from peer', message.from, 'version:', message.drawingState.version);
        break;
      case 'latestDrawing_loaded':
        console.log(' Peer', message.from, 'loaded drawing from Autobase, version:', message.drawingState.loadedVersion);
        break;
    }
  }

  static handleRoomDetailsMessage(message) {
    console.log('📥 Received room details from peer:', message.from);

    if (message.details && message.roomKey === state.topicKey) {
      this.updateLocalRoomInfo(message.details);
      console.log('✅ Room details updated:', message.details);
    }
  }

  static async updateLocalRoomInfo(roomDetails) {
    const updatedDetails = {
      roomName: roomDetails.roomName,
      createdBy: roomDetails.createdBy,
      createdAt: roomDetails.createdAt,
    };

    console.log('Updating local room details:', updatedDetails);

    console.log(state.localPeerId === roomDetails.createdBy);

    if(state.localPeerId !== updatedDetails.createdBy) await room.updateRoom(state.topicKey, updatedDetails);

    console.log(await room.getRoom(state.topicKey));
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
    state.localPeerId = await globalState.getPeerID()
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
  room.getAllRooms()
      .then(raw => {
        console.log('RAW ROOMS:', raw, typeof raw, Array.isArray(raw));
        let roomsArray = [];
        if (Array.isArray(raw)) {
          roomsArray = raw;
        }
        else if (raw && typeof raw === 'object') {
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
        <h5 class="room-name">${room.value.roomName}</h5>
        <p class="room-date">
          Created: ${new Date(room.value.createdAt).toLocaleString()}
        </p>
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
      await room.deleteRoom(roomKey)
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

      const success = await room.loadLatestRoomState(roomKey);
      console.log('Success', success)
      if (success) {
        alert('Drawing loaded successfully!');
      } else {
        alert('No saved drawing found or failed to load');
      }
    } finally {
      ui.loadStateBtn.dataset.loading = '0';
    }
  });

  ui.slideStateBtn.addEventListener('click', async () => {
    const states = await room.loadAllStates(state.topicKey)
    await displayStates(states)
  })

  async function displayStates(states) {
    const container = document.getElementById('slide-state-container');
    const slideStateBtn = document.querySelector('.slide-state-btn');

    document.addEventListener('click', (event) => {
      if (container && !container.classList.contains('hidden')) {
        if (!container.contains(event.target) && !slideStateBtn.contains(event.target)) {
          container.classList.add('hidden');
        }
      }
    });

    container.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    container.classList.remove('hidden');

    if (!states || states.length === 0) {
      const emptyContainer = document.createElement('div');
      emptyContainer.className = 'empty-states';
      emptyContainer.innerHTML = `
            <div class="states-container-header">
                <h3>States</h3>
                <button class="slide-state-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <p class="no-states-message">No states available</p>
        `;

      const closeButton = emptyContainer.querySelector('.slide-state-close');
      closeButton.addEventListener('click', () => {
        container.classList.add('hidden');
      });

      container.innerHTML = '';
      container.appendChild(emptyContainer);
      return;
    }

    // Create container header with close button
    const containerHeader = document.createElement('div');
    containerHeader.className = 'states-container-header';
    containerHeader.innerHTML = `
        <h3>States</h3>
        <button class="slide-state-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add click handler to close button
    const closeButton = containerHeader.querySelector('.slide-state-close');
    closeButton.addEventListener('click', () => {
      container.classList.add('hidden');
    });

    // Create states list
    const statesList = document.createElement('ul');
    statesList.className = 'states-list';

    // Add states to the list
    states.forEach((state, index) => {
      const stateItem = document.createElement('li');
      stateItem.className = 'state-item';

      // Format timestamp
      const timestamp = new Date(state.savedAt).toLocaleString();
      const objectCount = state.order?.length || 0;

      stateItem.innerHTML = `
            <div class="state-info" data-index="${index}">
                <img class="state-thumbnail" src="${state.thumbnail}" alt="State preview">
                <div class="state-details">
                    <h5 class="state-index" style="background: #ffffff;padding: 4px;border-radius: 4px;">State ${index + 1}</h5>
                    <div style="display: flex; flex-direction: row; width: 100%; justify-content: space-between; flex-wrap: wrap;">
                    <p class="state-timestamp">${new Date(state.savedAt).toLocaleString()}</p>
                    <p class="object-count hidden">${state.order?.length || 0} objects</p>
                    <p class="saved-by">by ${state.savedBy}</p>
                    </div>
                    <i class="fas fa-trash delete-state" title="Delete room"></i>
                </div>
            </div>
        `;

      const deleteButton = stateItem.querySelector('.delete-state');
      deleteButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation()
        const updatedStates = await room.deleteState(state.roomKey, index);
        console.log('Updated states:', updatedStates)
        await displayStates(updatedStates)
        alert('State deleted successfully!');
      })

      stateItem.addEventListener('click', () => {
        Room.applyDrawingState(state);
      });

      statesList.appendChild(stateItem);
    });

    // Create wrapper for scrollable content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'states-content-wrapper';
    contentWrapper.appendChild(statesList);

    // Clear container and add new elements
    container.innerHTML = '';
    container.appendChild(containerHeader);
    container.appendChild(contentWrapper);
  }
// Enhanced room management
  document.getElementById('delete-state').addEventListener('click', async () => {
    const roomKey = document.getElementById('canvas-topic').getAttribute('data-value');
    if (!roomKey) {
      alert('No active room to delete');
      return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete all drawings in room "${roomKey}"?`);
    if (confirmDelete) {
      const success = await room.deleteDrawings(roomKey);
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

  // const version = JSON.parse(fs.readFileSync('./package.json', 'utf8')).version
  // document.querySelector('#version').innerHTML = version;

  document.querySelector('#state-details').addEventListener('click', () => {
    console.log(state)
  })

  // Add this to your initialization code
  document.addEventListener('DOMContentLoaded', () => {
    const toggleRightPanel = document.getElementById('toggleRightPanel');
    const rightPanelContainer = document.getElementById('rightPanelContainer');

    toggleRightPanel.addEventListener('click', () => {
      const isExpanded = toggleRightPanel.getAttribute('aria-expanded') === 'true';
      toggleRightPanel.setAttribute('aria-expanded', !isExpanded);
      rightPanelContainer.classList.toggle('hidden');
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.right-top-data')) {
        toggleRightPanel.setAttribute('aria-expanded', 'false');
        rightPanelContainer.classList.add('hidden');
      }
    });
  });

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