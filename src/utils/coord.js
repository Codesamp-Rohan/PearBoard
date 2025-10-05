import { ui } from "../ui/dom.js";
import { state } from "../app/state.js";

/**
 * Convert a mouse or touch event to canvas (world) coordinates.
 * @param {MouseEvent|TouchEvent} event
 * @param {HTMLCanvasElement} canvas
 */
export class CoordinateUtils {
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