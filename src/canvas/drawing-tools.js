import { state } from '../app/state.js';
import { DocumentManager } from '../storage/hypercore.js';
import { NetworkManager } from '../network/network-manager.js';

export class DrawingTools {
    static selectTool(tool) {
        state.tool = tool;
    }

    static begin(x, y) {
        const id = state.generateId();
        if (state.tool === 'pen' || state.tool === 'eraser') {
            state.activeId = id;
            state.doc.objects[id] = {
                id, type: state.tool,
                points: [{ x, y }],
                color: state.strokeColor,
                size: state.strokeSize,
                opacity: state.strokeOpacity
            };
            state.doc.order.push(id);
            state.bumpDoc();
            this.broadcastAdd(id);
        } else {
            state.activeId = id;
            state.doc.objects[id] = {
                id, type: state.tool,
                x, y, w: 0, h: 0,
                color: state.strokeColor,
                size: state.strokeSize,
                opacity: state.strokeOpacity
            };
            state.doc.order.push(id);
            state.bumpDoc();
            this.broadcastAdd(id);
        }
    }

    static move(x, y) {
        const obj = state.doc.objects[state.activeId];
        if (!obj) return;
        if (obj.points) {
            obj.points.push({ x, y });
            state.bumpDoc();
            this.broadcastPatch(obj.id, { x, y });
        } else {
            obj.w = x - obj.x;
            obj.h = y - obj.y;
            state.bumpDoc();
            this.broadcastUpdate(obj.id, { w: obj.w, h: obj.h });
        }
    }

    static end() {
        state.activeId = null;
    }

    static broadcastAdd(id) {
        NetworkManager.broadcast({ t: 'add', obj: state.doc.objects[id] });
    }

    static broadcastUpdate(id, patch) {
        NetworkManager.broadcast({ t: 'update', id, patch });
    }

    static broadcastPatch(id, point) {
        NetworkManager.broadcast({ t: 'patch', id, point });
    }
}
