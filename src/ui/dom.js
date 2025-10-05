export const ui = {
    // Canvas and board
    board: document.querySelector('.board-wrap'),
    canvas: document.querySelector('#board'),

    // Toolbar buttons
    tools: document.querySelector('#tools'),
    colorInput: document.querySelector('#color'),
    sizeInput: document.querySelector('#size'),
    opacityInput: document.querySelector('#opacity-control'),
    undoBtn: document.querySelector('#undo'),
    redoBtn: document.querySelector('#redo'),
    clearBtn: document.querySelector('#clear'),
    saveBtn: document.querySelector('#save'),

    // Session controls
    createBtn: document.querySelector('#create-canvas'),
    joinBtn: document.querySelector('#join-canvas'),
    joinInput: document.querySelector('#join-canvas-topic'),
    topicDisplay: document.querySelector('#canvas-topic'),
    peersCount: document.querySelector('#peers-count'),

    // Auth controls
    authContainer: document.querySelector('#auth-container'),
    authInput: document.querySelector('#auth-input'),
    authPass: document.querySelector('#auth-pass'),
    signUpBtn: document.querySelector('#auth-signup'),
    signInBtn: document.querySelector('#auth-signin'),

    // Misc
    loadingScreen: document.querySelector('#loading'),
    setupScreen: document.querySelector('#setup'),
    toolbar: document.querySelector('header.toolbar'),
    peerNameDisplay: document.querySelector('#local-peer-name'),
    mouseFollower: document.querySelector('#mouse-follower')
};
