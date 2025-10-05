import crypto from 'hypercore-crypto';

// Global application state
class AppState {
    constructor() {
        // Storage
        this.PEAR_PATH = Pear.config.storage;

        // Identification
        this.peerID = null;
        this.peerName = '';

        // Document / Drawing state
        this.doc = { objects: {}, order: [], version: 0 };

        // History stacks
        this.undoStack = [];
        this.redoStack = [];

        // Canvas transform
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

        // Current tool and drawing attributes
        this.tool = 'pen';
        this.strokeColor = '#000000';
        this.strokeSize = 2;
        this.strokeOpacity = 1;

        // Interaction flags
        this.drawing = false;
        this.isDragging = false;
        this.isPanning = false;
        this.spaceHeld = false;
        this.touchPanning = false;

        // IDs for active/hovered objects
        this.activeId = null;
        this.hoverId = null;

        // Networking
        this.swarm = null;
        this.topicKey = null;
        this.joined = false;
        this.connections = new Set();
        this.peerCount = 0;
        this.outbox = [];
        this.flushing = false;

        // Cursor tracking
        this.peerCursors = new Map();

        // Debounce render
        this.renderPending = false;
        this.dirty = true;
    }

    // Generate a random ID for objects
    generateId() {
        return crypto.randomBytes(4).toString('hex');
    }

    // Increment document version
    bumpDoc() {
        this.doc.version++;
    }

    // Request a single animation-frame render
    requestRender() {
        if (this.renderPending) return;
        this.renderPending = true;
        requestAnimationFrame(() => {
            this.dirty = true;
            this.renderPending = false;
        });
    }
}

export const state = new AppState();
