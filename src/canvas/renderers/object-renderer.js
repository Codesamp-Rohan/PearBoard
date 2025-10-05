import { state } from '../../app/state.js';
import addAlphaToColor from '../../utils/helper.js';

export class ObjectRenderer {
    static renderAll(ctx) {
        for (const id of state.doc.order) {
            const obj = state.doc.objects[id];
            this.render(ctx, obj);
        }
    }

    static render(ctx, obj) {
        ctx.save();
        ctx.lineWidth = obj.size;
        ctx.strokeStyle = addAlphaToColor(obj.color, obj.opacity);
        ctx.fillStyle = addAlphaToColor(obj.color, obj.opacity);
        switch (obj.type) {
            case 'pen':
            case 'eraser':
                this.renderPath(ctx, obj);
                break;
            case 'rect':
                ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
                break;
            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(
                    obj.x + obj.w / 2,
                    obj.y + obj.h / 2,
                    Math.abs(obj.w / 2),
                    Math.abs(obj.h / 2),
                    0,
                    0,
                    2 * Math.PI
                );
                ctx.stroke();
                break;
            case 'line':
                ctx.beginPath();
                ctx.moveTo(obj.x, obj.y);
                ctx.lineTo(obj.x + obj.w, obj.y + obj.h);
                ctx.stroke();
                break;
        }
        ctx.restore();
    }

    static renderPath(ctx, obj) {
        ctx.globalCompositeOperation = obj.type === 'eraser' ? 'destination-out' : 'source-over';
        ctx.beginPath();
        const pts = obj.points;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
    }
}
