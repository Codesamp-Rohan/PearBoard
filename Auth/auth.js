// src/Auth/auth.js

import Corestore from 'corestore';
import Hyperbee from 'hyperbee';
import crypto from 'crypto';
import { ui } from '../src/ui/dom.js';
import { state } from '../src/app/state.js';

export let userDB;

/**
 * Initialize Corestore and Hyperbee for user data.
 */
async function setupAuthStorage() {
    const corestore = new Corestore(state.PEAR_PATH);
    await corestore.ready();

    const userCore = corestore.get({ name: 'users' });
    await userCore.ready();

    userDB = new Hyperbee(userCore, {
        keyEncoding: 'utf-8',
        valueEncoding: 'json'
    });
    await userDB.ready();
}

/**
 * Authentication methods.
 */
export class Auth {
    async signUp(username, password) {
        // Prevent empty credentials
        if (!username || !password) return false;

        // Check if user exists
        const existing = await this.getUser(username);
        if (existing) {
            console.error('User already exists');
            return false;
        }

        // Hash password
        const passwordHash = crypto.createHash('sha256')
            .update(password)
            .digest('hex');

        // Generate peer ID
        const peerID = crypto.randomBytes(5).toString('hex');

        // Create and store user record
        const userData = { username, passwordHash, peerID, createdAt: Date.now() };
        await userDB.put(username, userData);

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

        return user.peerID;
    }

    async getUser(username) {
        const node = await userDB.get(username);
        return node ? node.value : null;
    }
}

export const auth = new Auth();

/**
 * Display auth UI and wait for user action.
 * Returns a Promise that resolves with the peerID on success.
 */
export async function initAuth() {
    // Initialize storage if not done
    if (!userDB) {
        await setupAuthStorage();
    }

    return new Promise(resolve => {
        ui.signUpBtn.addEventListener('click', async () => {
            console.log('SignUp clicked');
            const username = ui.authInput.value.trim();
            const password = ui.authPass.value;
            const peerID = await auth.signUp(username, password);
            if (peerID) {
                state.peerID = peerID;
                ui.authContainer.style.display = 'none';
                resolve(peerID);
            } else {
                alert('Sign up failed');
            }
        });

        ui.signInBtn.addEventListener('click', async () => {
            console.log('SignIn clicked');
            const username = ui.authInput.value.trim();
            const password = ui.authPass.value;
            const peerID = await auth.signIn(username, password);
            if (peerID) {
                state.peerID = peerID;
                ui.authContainer.style.display = 'none';
                resolve(peerID);
            } else {
                alert('Sign in failed');
            }
        });
    });
}
