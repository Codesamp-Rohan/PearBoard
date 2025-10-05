// src/document/history-manager.js

import { state } from '../app/state.js';
import { DocumentManager } from '../storage/hypercore.js';
import { NetworkManager } from '../network/network-manager.js';

/**
 * Manages undo/redo stacks for document operations.
 */
export class HistoryManager {
    /**
     * Push a new entry onto the undo stack and clear redo.
     * @param {{t:string, id?:string, obj?:object, patch?:object, point?:object}} entry
     */
    static push(entry) {
        state.undoStack.push(entry);
        state.redoStack.length = 0;
    }

    /** Undo the last local operation. */
    static undo() {
        const entry = state.undoStack.pop();
        if (!entry) return;

        switch (entry.t) {
            case 'add':
                DocumentManager.applyUpdate(entry.id, entry.before);
                state.redoStack.push({ t: 'delete', id: entry.id });
                break;
            case 'delete':
                DocumentManager.applyAdd(entry.obj);
                state.redoStack.push({ t: 'add', obj: entry.obj });
                break;
            case 'update':
                DocumentManager.applyUpdate(entry.id, entry.before);
                state.redoStack.push({ t: 'update', id: entry.id, before: entry.after, after: entry.before });
                break;
            case 'patch':
                // cannot rollback patch easily
                break;
        }

        NetworkManager.broadcast({ t: 'full', snapshot: state.doc });
    }

    /** Redo the last undone operation. */
    static redo() {
        const entry = state.redoStack.pop();
        if (!entry) return;

        switch (entry.t) {
            case 'add':
                DocumentManager.applyAdd(entry.obj);
                state.undoStack.push({ t: 'delete', obj: entry.obj });
                break;
            case 'delete':
                DocumentManager.applyUpdate(entry.id, entry.before);
                state.undoStack.push({ t: 'add', obj: entry.before });
                break;
            case 'update':
                DocumentManager.applyUpdate(entry.id, entry.after);
                state.undoStack.push({ t: 'update', id: entry.id, before: entry.before, after: entry.after });
                break;
        }

        NetworkManager.broadcast({ t: 'full', snapshot: state.doc });
    }

    /** Clear the document and record snapshot. */
    static clear() {
        const snapshot = JSON.parse(JSON.stringify(state.doc));
        state.doc = { objects: {}, order: [], version: state.doc.version + 1 };
        state.requestRender();
        state.undoStack.push({ t: 'clear', snapshot });
        NetworkManager.broadcast({ t: 'full', snapshot: state.doc });
    }
}
