import { state } from '../../app/state.js';
import { CONFIG } from '../../config/constants.js';
import { ui } from '../../ui/dom.js';

export class GridRenderer {
    static render(ctx) {
        const width = ui.canvas.width;
        const height = ui.canvas.height;
        const stepWorld = CONFIG.GRID_TARGET_PX / state.zoom;
        const startX = Math.floor(-state.panX / (stepWorld * state.zoom)) * stepWorld;
        const startY = Math.floor(-state.panY / (stepWorld * state.zoom)) * stepWorld;
        ctx.save();
        ctx.setTransform(state.DPR * state.zoom, 0, 0, state.DPR * state.zoom, state.panX * state.DPR, state.panY * state.DPR);
        ctx.lineWidth = 1 / state.zoom;
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';

        // vertical lines
        for (let x = startX; x < CONFIG.WORLD_WIDTH; x += stepWorld) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONFIG.WORLD_HEIGHT);
            ctx.stroke();
        }
        // horizontal lines
        for (let y = startY; y < CONFIG.WORLD_HEIGHT; y += stepWorld) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CONFIG.WORLD_WIDTH, y);
            ctx.stroke();
        }

        ctx.restore();
    }
}
