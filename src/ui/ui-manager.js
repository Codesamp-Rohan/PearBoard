import { ui } from './dom.js';
import { state } from '../app/state.js';
import { DrawingTools } from '../canvas/drawing-tools.js';
import { HistoryManager } from '../canvas/history-manager.js';
import { SessionManager } from '../network/session-manager.js';

/**
 * Wires up UI event handlers and controls visibility.
 */
export class UIManager {
    static init() {
        this._setupToolHandlers();
        this._setupHistoryHandlers();
        this._setupColorSizeHandlers();
    }

    static _setupToolHandlers() {
        ui.tools.addEventListener('click', e => {
            const tool = e.target.dataset.tool;
            if (!tool) return;
            DrawingTools.selectTool(tool);
            // update active class
            ui.tools.querySelectorAll('.btn').forEach(btn =>
                btn.classList.toggle('active', btn.dataset.tool === tool)
            );
        });
    }

    static _setupHistoryHandlers() {
        ui.undoBtn.addEventListener('click', () => HistoryManager.undo());
        ui.redoBtn.addEventListener('click', () => HistoryManager.redo());
        ui.clearBtn.addEventListener('click', () => HistoryManager.clear());
    }

    static _setupColorSizeHandlers() {
        ui.colorInput.addEventListener('input', () => {
            state.strokeColor = ui.colorInput.value;
        });
        ui.sizeInput.addEventListener('input', () => {
            state.strokeSize = parseInt(ui.sizeInput.value, 10);
        });
        ui.opacityInput.addEventListener('input', () => {
            state.strokeOpacity = parseFloat(ui.opacityInput.value);
        });
    }

    static setupSessionHandlers() {
        ui.createBtn.addEventListener('click', async () => {
            const topic = await SessionManager.createSession();
            SessionManager.startSession(topic);
        });
        ui.joinBtn.addEventListener('click', () => {
            const topic = ui.joinInput.value.trim();
            if (!topic) {
                alert('Enter a room key');
                return;
            }
            SessionManager.startSession(topic);
        });
    }

    static updatePeerCount(count) {
        ui.peersCount.textContent = `${count + 1}`;
    }

    static showSetup() {
        ui.setupScreen.classList.remove('hidden');
        ui.loadingScreen.classList.add('hidden');
        ui.toolbar.classList.add('hidden');
        ui.board.classList.add('hidden');
    }

    static showLoading() {
        ui.setupScreen.classList.add('hidden');
        ui.loadingScreen.classList.remove('hidden');
    }

    static showWorkspace() {
        ui.loadingScreen.classList.add('hidden');
        ui.toolbar.classList.remove('hidden');
        ui.board.classList.remove('hidden');
    }
}
