import { NetworkManager } from './network-manager.js';
import { CanvasManager } from '../canvas/canvas-manager.js';
import { UIManager } from '../ui/ui-manager.js';
import { state } from '../app/state.js';
import crypto from 'hypercore-crypto';

export class SessionManager {
    static async createSession() {
        return crypto.randomBytes(4).toString('hex');
    }
    static async startSession(topicHex) {
        if (state.joined) return;
        state.topicKey = topicHex;
        state.joined = true;

        UIManager.showLoading();
        await NetworkManager.init(topicHex);

        UIManager.showWorkspace();
        CanvasManager.init();
    }
}
