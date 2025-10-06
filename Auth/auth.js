import Corestore from 'corestore';
import Hyperbee from 'hyperbee';
import crypto from 'crypto';
import { state, ui, PEAR_PATH } from '../app.js';

export let userDB;
let isStorageInitialized = false;
let authListenersAdded = false;

async function setupAuthStorage() {
    if (isStorageInitialized) return;

    console.log('Setting up auth storage with path:', PEAR_PATH);

    try {
        const corestore = new Corestore(PEAR_PATH);
        await corestore.ready();

        const userCore = corestore.get({ name: 'users' });
        await userCore.ready();

        userDB = new Hyperbee(userCore, {
            keyEncoding: 'utf-8',
            valueEncoding: 'json'
        });

        await userDB.ready();
        isStorageInitialized = true;
        console.log('Auth storage initialized successfully');
    } catch (error) {
        console.error('Failed to setup auth storage:', error);
        throw error;
    }
}

export class Auth {
    async signUp(username, password) {
        if (!username || !password) return false;

        const existing = await this.getUser(username);
        if (existing) {
            console.error('User already exists');
            return false;
        }

        const passwordHash = crypto.createHash('sha256')
            .update(password)
            .digest('hex');

        const peerID = crypto.randomBytes(5).toString('hex');

        const userData = { username, passwordHash, peerID, createdAt: Date.now() };
        await userDB.put(username, userData);

        console.log('User signed up successfully:', username, 'with ID:', peerID);
        return peerID;
    }

    async signIn(username, password) {
        if (!username || !password) return false;

        const user = await this.getUser(username);
        if (!user) {
            console.error('User not found');
            return false;
        }

        const hash = crypto.createHash('sha256')
            .update(password)
            .digest('hex');

        if (hash !== user.passwordHash) {
            console.error('Incorrect password');
            return false;
        }

        console.log('User signed in successfully:', username, 'with ID:', user.peerID);
        return user.peerID;
    }

    async getUser(username) {
        const node = await userDB.get(username);
        return node ? node.value : null;
    }
}

export const auth = new Auth();

export async function initAuth() {
    console.log('Initializing authentication...');

    if (!userDB) {
        await setupAuthStorage();
    }

    return new Promise((resolve, reject) => {
        if (authListenersAdded) {
            console.log('Auth listeners already added, skipping...');
            return;
        }

        const handleSignUp = async () => {
            try {
                console.log('SignUp clicked');
                const username = ui.authInput.value.trim();
                const password = ui.authPass.value;

                if (!username || !password) {
                    alert('Please enter both username and password');
                    return;
                }

                const peerID = await auth.signUp(username, password);
                if (peerID) {
                    state.localPeerId = peerID;
                    state.peerName = username;
                    ui.authContainer.style.display = 'none';
                    isStorageInitialized = true;
                    resolve(peerID);
                } else {
                    alert('Sign up failed');
                }
                console.log(state.peerID, state.localPeerId);
            } catch (error) {
                console.error('Sign up error:', error);
                alert('Sign up failed: ' + error.message);
            }
        };

        const handleSignIn = async () => {
            try {
                console.log('SignIn clicked');
                const username = ui.authInput.value.trim();
                const password = ui.authPass.value;

                if (!username || !password) {
                    alert('Please enter both username and password');
                    return;
                }

                const peerID = await auth.signIn(username, password);
                if (peerID) {
                    state.localPeerId = peerID;
                    state.peerName = username;
                    ui.authContainer.style.display = 'none';
                    isStorageInitialized = true;
                    console.log(peerID, state.localPeerId);
                    resolve(peerID);
                } else {
                    alert('Sign in failed');
                }
            } catch (error) {
                console.error('Sign in error:', error);
                alert('Sign in failed: ' + error.message);
            }
        };

        ui.signUpBtn.addEventListener('click', handleSignUp);
        ui.signInBtn.addEventListener('click', handleSignIn);

        authListenersAdded = true;
        console.log('âœ… Auth event listeners added');
    });
}