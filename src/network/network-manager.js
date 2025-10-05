import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import crypto from 'hypercore-crypto';
import { state } from '../app/state.js';
import { DocumentManager } from '../storage/hypercore.js';
import { UIManager } from '../ui/ui-manager.js';

/**
 * Handles P2P networking via Hyperswarm.
 * Manages connections, message broadcast, and incoming message handling.
 */
export class NetworkManager {
    static async init(topicHex) {
        if (state.swarm) return;
        state.swarm = new Hyperswarm();
        const topic = b4a.from(topicHex, 'hex');

        state.swarm.on('connection', socket => this._onConnection(socket));
        await state.swarm.join(topic, { server: true, client: true });
        await state.swarm.flush();
    }

    static _onConnection(socket) {
        // Assign a random peer ID for this connection
        const peerId = crypto.randomBytes(4).toString('hex');
        const conn = { socket, peerId, closed: false };

        state.connections.add(conn);
        state.peerCount = state.connections.size;
        UIManager.updatePeerCount(state.peerCount);

        // Send initial document snapshot
        socket.write(this._encode({
            t: 'full',
            snapshot: {
                doc: state.doc,
                version: state.doc.version
            }
        }));

        socket.on('data', data => {
            const msg = this._decode(data);
            if (msg) this._handleMessage(msg);
        });

        socket.once('close', () => this._onDisconnect(conn));
        socket.once('error', () => this._onDisconnect(conn));
    }

    static _onDisconnect(conn) {
        conn.closed = true;
        state.connections.delete(conn);
        state.peerCount = state.connections.size;
        UIManager.updatePeerCount(state.peerCount);
    }

    static broadcast(message) {
        const payload = this._encode(message);
        for (const conn of state.connections) {
            if (!conn.closed) {
                conn.socket.write(payload);
            }
        }
    }

    static _handleMessage(msg) {
        switch (msg.t) {
            case 'add':
                DocumentManager.applyAdd(msg.obj);
                break;
            case 'update':
                DocumentManager.applyUpdate(msg.id, msg.patch);
                break;
            case 'patch':
                DocumentManager.applyPatch(msg.id, msg.point);
                break;
            case 'full':
                DocumentManager.applyFull(msg.snapshot);
                break;
        }
    }

    static _encode(obj) {
        return b4a.from(JSON.stringify(obj));
    }

    static _decode(buffer) {
        try {
            return JSON.parse(b4a.toString(buffer));
        } catch {
            return null;
        }
    }
}
