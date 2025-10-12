import Corestore from 'corestore';
import Hyperbee from 'hyperbee';
import {NetworkManager, PEAR_PATH} from '../app.js';
import {globalState} from "../storage/GlobalState.js";
import {state} from "../storage/AppState.js";
import log from "../logs/log.js";

let roomDB;
let isStorageInitialized = false;

async function setupRoomStorage() {
    if (isStorageInitialized) return;

    console.log('Initializing room storage at:', PEAR_PATH);
    const corestore = new Corestore(PEAR_PATH);
    await corestore.ready();

    const roomsCore = corestore.get({ name: 'rooms-metadata' });
    await roomsCore.ready();

    roomDB = new Hyperbee(roomsCore, {
        keyEncoding: 'utf-8',
        valueEncoding: 'json'
    });
    await roomDB.ready();

    isStorageInitialized = true;
}

export class Room {
    async ensureStorage() {
        if (!isStorageInitialized) {
            await setupRoomStorage();
        }
    }

    async addRoom(roomKey, roomName = 'joiner', createdBy = 'admin') {
        await this.ensureStorage();

        // Check for existing room
        const existing = await roomDB.get(roomKey);
        if (existing) {
            console.log('Room already exists:', roomKey);
            return { ...existing.value, alreadyExists: true };
        }

        const room = {
            roomKey,
            roomName,
            createdBy,
            states: [],
            createdAt: Date.now(),
            lastModified: Date.now(),
            creator: {  // Add creator information
                peerId: state.localPeerId,
                name: createdBy
            }
        };

        await roomDB.put(roomKey, room);
        await globalState.addRoom(roomKey, roomName, createdBy);
        console.log('Room added:', roomKey);
        return room;
    }


    async addRoomState(roomKey) {
        await this.ensureStorage();
        let room = await this.getRoom(roomKey);

        if (!room) {
            room = {
                roomKey,
                roomName: roomKey,
                createdBy: state.localPeerId,
                states: [],
                createdAt: Date.now()
            };
        }

        if (!room.states) {
            room.states = [];
        }

        const drawingState = {
            version: state.doc.version,
            order: [...state.doc.order],
            objects: {...state.doc.objects},
            savedAt: Date.now(),
            savedBy: state.localPeerId,
            roomKey: roomKey
        };

        const updatedRoom = {
            ...room,
            states: [...room.states, drawingState]
        };

        // Save updated room
        await roomDB.put(roomKey, updatedRoom);
        console.log('Room state added:', drawingState);

        NetworkManager.broadcast({
            t: 'room_state_added',
            from: state.localPeerId,
            roomKey: roomKey,
            drawingState: drawingState,
        });

        console.log('Success!!');
        return drawingState;
    }


    async getRoomStates(roomKey) {
        await this.ensureStorage();
        const room = await this.getRoom(roomKey);

        if (!room || !room.states) {
            console.log('No states found for room:', roomKey);
            return [];
        }

        return room.states.map((state, index) => ({
            ...state,
            stateIndex: index,
            timestamp: new Date(state.savedAt).toLocaleString(),
            objectCount: state.order?.length || 0
        }));
    }


    async loadAllRoomState(roomKey) {
        await this.ensureStorage();
        const node = await roomDB.get(roomKey);

        if (!node || !node.value || !node.value.states || node.value.states.length === 0) {
            console.log('No states found for room:', roomKey);
            return [];
        }

        const validStates = node.value.states.filter(state =>
            state && state.objects && state.order
        );

        if (validStates.length === 0) {
            console.warn('No valid states found');
            return [];
        }

        console.log(`Loaded ${validStates.length} states for room:`, roomKey);
        return validStates;
    }

    async loadLatestRoomState(roomKey) {
        await this.ensureStorage();
        const node = await roomDB.get(roomKey)

        if (!node || !node.value || !node.value.states || node.value.states.length === 0) {
            console.log('No states found for room:', roomKey);
            return null;
        }

        const lastIndex = node.value.states.length - 1;
        const lastData = node.value.states[lastIndex];

        console.log('Last Data : ', lastData)
        Room.applyDrawingState(lastData);

        NetworkManager.broadcast({
            t: 'autobase_loaded',
            from: state.localPeerId,
            roomKey: roomKey,
            loadedVersion: node.value.states[lastIndex],
        })

        NetworkManager.broadcast({
            t: 'full',
            snapshot: NetworkManager.serializeDocument()
        });

        console.log('📤 Broadcasted loaded drawing to all connected peers');
        return true;
    }

    static applyDrawingState(drawingData) {
        const originalRequestRender = state.requestRender;
        let renderRequested = false;

        state.requestRender = () => {
            renderRequested = true;
        };

        for (const id of drawingData.order) {
            if (drawingData.objects[id] && !state.doc.objects[id]) {
                // Only add objects that don't already exist
                state.doc.objects[id] = drawingData.objects[id];
                state.doc.order.push(id);
            }
        }

        state.doc.version = Math.max(state.doc.version, drawingData.version || 0) + 1;

        state.requestRender = originalRequestRender;

        if (renderRequested) {
            state.requestRender();
        }

        console.log('Applied drawing state with', state.doc.order.length, 'objects');
    }

    async getRoom(roomKey) {
        await this.ensureStorage();
        const node = await roomDB.get(roomKey);
        return node ? node.value : null;
    }



    async updateRoom(roomKey, roomDetails) {
        await this.ensureStorage();
        console.log('Updating room:', roomKey, roomDetails);
        const existingRoom = await this.getRoom(roomKey);
        if (!existingRoom) {
            console.warn('Cannot update: Room not found:', roomKey);
            return null;
        }
        if (existingRoom.creator?.peerId !== state.localPeerId) {
            console.warn('Only room creator can modify room details');
            return existingRoom;
        }
        const updatedRoom = {
            ...existingRoom,
            roomName: roomDetails.roomName || existingRoom.roomName,
            lastModified: Date.now(),
            createdBy: existingRoom.createdBy,
            createdAt: existingRoom.createdAt,
            creator: existingRoom.creator
        };

        await roomDB.put(roomKey, updatedRoom);
        console.log('Room updated:', roomKey, updatedRoom);
        return updatedRoom;
    }

    async deleteRoom(roomKey) {
        await this.ensureStorage();
        await roomDB.del(roomKey);
        console.log('Room deleted:', roomKey);
        return true;
    }

    async getAllRooms() {
        await this.ensureStorage();

        const allRooms = {};
        for await (const { key, value } of roomDB.createReadStream()) {
            allRooms[key] = value;
        }
        return allRooms;
    }



    async broadcastRoomDetails(roomKey, isCreator = false, targetPeerId = null) {
        console.log('Broadcasting room details');
        await this.ensureStorage();

        if (!isCreator) {
            console.log('Not a creator, skipping room details broadcast');
            return;
        }

        const roomEntry = await roomDB.get(roomKey);
        if (!roomEntry) {
            console.warn('Room not found:', roomKey);
            return;
        }

        const details = {
            roomKey,
            roomName: roomEntry.value.roomName,
            createdBy: roomEntry.value.createdBy,
            createdAt: roomEntry.value.createdAt,
            creator: roomEntry.value.creator
        };

        const message = {
            t: 'room_details',
            from: state.localPeerId,
            roomKey,
            details,
            isInitialSync: true
        };

        NetworkManager.broadcast(message)
        console.log('Broadcast room details to all peers')
    }
}

export const room = new Room();
