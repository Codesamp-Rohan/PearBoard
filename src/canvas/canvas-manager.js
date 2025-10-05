// src/canvas/canvas-manager.js

import { state } from '../app/state.js';
import { ui } from '../ui/dom.js';
import { CoordinateUtils } from '../utils/coord.js';
import { GridRenderer } from './renderers/grid-renderer.js';
import { ObjectRenderer } from './renderers/object-renderer.js';
import { DrawingTools } from './drawing-tools.js';
import { CONFIG } from '../config/constants.js';

export class CanvasManager {
    static init() {
        state.ctx = ui.canvas.getContext('2d');
        this.resizeCanvas();
        this._bindEvents();
        this._renderLoop();
    }

    static resizeCanvas() {
        const rect = ui.board.getBoundingClientRect();
        ui.canvas.width = rect.width * state.DPR;
        ui.canvas.height = rect.height * state.DPR;
        ui.canvas.style.width = `${rect.width}px`;
        ui.canvas.style.height = `${rect.height}px`;
        state.requestRender();
    }

    // Use a private method to bind with proper `this`
    static _bindEvents() {
        window.addEventListener('resize', () => this.resizeCanvas());
        ui.canvas.addEventListener('mousedown', e => this._onDown(e));
        ui.canvas.addEventListener('mousemove', e => this._onMove(e));
        ui.canvas.addEventListener('mouseup', () => this._onUp());
        ui.canvas.addEventListener('wheel', e => this._onWheel(e), { passive: false });
        // Touch events if needed...
    }

    static _onDown(event) {
        const { x, y } = CoordinateUtils.toCanvas(event);
        DrawingTools.begin(x, y);
    }

    static _onMove(event) {
        if (!state.drawing) return;
        const { x, y } = CoordinateUtils.toCanvas(event);
        DrawingTools.move(x, y);
    }

    static _onUp() {
        DrawingTools.end();
    }

    static _onWheel(event) {
        event.preventDefault();
        const { x, y } = CoordinateUtils.toCanvas(event);
        const factor = event.deltaY < 0 ? CONFIG.ZOOM_STEP : 1 / CONFIG.ZOOM_STEP;
        const newZoom = Math.min(CONFIG.MAX_ZOOM, Math.max(CONFIG.MIN_ZOOM, state.zoom * factor));
        const worldX = (x - state.panX) / state.zoom;
        const worldY = (y - state.panY) / state.zoom;
        state.zoom = newZoom;
        state.panX = x - worldX * newZoom;
        state.panY = y - worldY * newZoom;
        state.requestRender();
    }

    static _renderLoop() {
        if (state.dirty) {
            state.dirty = false;
            const ctx = state.ctx;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
            const s = state.zoom * state.DPR;
            ctx.setTransform(s, 0, 0, s, state.panX * state.DPR, state.panY * state.DPR);
            GridRenderer.render(ctx);
            ObjectRenderer.renderAll(ctx);
        }
        requestAnimationFrame(() => this._renderLoop());
    }
}
