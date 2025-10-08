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
        const rooms = new Map()
        console.log(await this.getAllUsers())
        if (existing) {
            return false;
        }

        const passwordHash = crypto.createHash('sha256')
            .update(password)
            .digest('hex');

        const peerID = crypto.randomBytes(5).toString('hex');
        console.log('Auth.signUP -> PEERID : ', peerID)

        const userData = { username, passwordHash, peerID, createdAt: Date.now(), rooms: rooms };
        await userDB.put(username, userData);

        console.log('User signed up successfully:', username, 'with ID:', peerID);
        console.log(await this.getAllUsers())
        return peerID;
    }

    async signIn(username, password) {
        if (!username || !password) return false;

        const user = await this.getUser(username);
        console.log(await this.getAllUsers())
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
        console.log(await this.getAllUsers())
        return user.peerID;
    }

    // User Functions
    async getUser(username) {
        const node = await userDB.get(username);
        console.log('Get User : ', node)
        return node ? node.value : null;
    }

    async getAllUsers() {
        const users = [];
        for await (const { key, value } of userDB.createReadStream({ keys: true, values: true })) {
            users.push({ key, value });
            if(key !== value.username) {
                console.log(key, value)
                if(await this.deleteUser(key)) {
                    alert('Faulty Users deleted successfully')
                }
            }
        }
        return users;
    }

    async deleteUser(key) {
        await userDB.del(key);
        return true;
    }

    // Rooms functions
    async addRoom(username, roomKey, roomName = 'New Room' ) {
        const user = await this.getUser(username);
        if(!user) return;

        if (await this.hasRoom(username, roomKey)) {
            console.log('Room already exists for user:', username, 'roomKey:', roomKey);
            return { roomKey, roomName, createdAt: Date.now(), alreadyExists: true };
        }

        if (!user.rooms || user.rooms instanceof Map) {
            user.rooms = {};
        }

        const room = {
            roomKey,
            roomName,
            createdAt: Date.now()
        };
        console.log('Room : ', room)

        user.rooms[roomKey] = room;
        await userDB.put(username, user);

        console.log('Room added successfully to user:', username);
        return room;
    }

    async getRoom(roomKey) {
        const room = await userDB.get(roomKey);
        return room ? room.value : null;
    }

    async hasRoom(username, roomKey) {
        const user = await this.getUser(username);
        if(!user) return false;
        return !!(user.rooms && user.rooms[roomKey]);
    }

    async getAllRooms(username) {
        const users = await this.getUser(username)
        return users.rooms;
    }

    async deleteRoom(roomKey) {
        await userDB.del(roomKey);
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