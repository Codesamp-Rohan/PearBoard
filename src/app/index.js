import { initAuth } from '../../Auth/auth.js';
import { SessionManager } from '../network/session-manager.js';
import { UIManager } from '../ui/ui-manager.js';
import { CanvasManager } from '../canvas/canvas-manager.js';
import { state } from './state.js';
import {DrawingTools} from "../canvas/drawing-tools.js";

async function main() {
    const peerID = await initAuth();           // wait for sign in/up
    state.peerID = peerID;

    CanvasManager.init();
    DrawingTools.selectTool('pen');
    UIManager.showSetup();                      // only show create/join

    UIManager.setupSessionHandlers(async topic => {
        state.topicKey = topic;
        await SessionManager.startSession(topic); // init Hyperswarm
        await SessionManager.loadSnapshot(topic); // load Hypercore
        UIManager.showWorkspace();                // reveal toolbar & canvas
        UIManager.init();                         // wire DOM handlers
        CanvasManager.init();
        CanvasManager.renderFrame()
    });
}

document.addEventListener('DOMContentLoaded', main);
