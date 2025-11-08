import Corestore from 'corestore';
import Hyperbee from 'hyperbee';
import {CanvasManager, NetworkManager, PEAR_PATH, ui} from '../app.js';
import {globalState} from "../storage/GlobalState.js";
import {state} from "../storage/AppState.js";

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
            creator: {
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

        const thumbnail = CanvasManager.generateThumbnail(ui.canvas);

        const drawingState = {
            version: state.doc.version,
            order: [...state.doc.order],
            objects: {...state.doc.objects},
            savedAt: Date.now(),
            savedBy: state.localPeerId,
            roomKey: roomKey,
            thumbnail: thumbnail,
        };

        const updatedRoom = {
            ...room,
            states: [...room.states, drawingState]
        };

        // Save updated room
        await roomDB.put(roomKey, updatedRoom);
        console.log('Room state added:', drawingState);

        Room.replicateToAllPeers(roomKey);
        return drawingState;
    }


    async deleteState(roomKey, index) {
        try {
            await this.ensureStorage();
            const room = await this.getRoom(roomKey);

            if (!room || !room.states) {
                console.warn('No room or states found for:', roomKey);
                return false;
            }

            if (index < 0 || index >= room.states.length) {
                console.warn('Invalid state index:', index);
                return false;
            }

            const updatedStates = [...room.states];
            updatedStates.splice(index, 1);

            const updatedRoom = {
                ...room,
                states: updatedStates,
                lastModified: Date.now()
            };

            await roomDB.put(roomKey, updatedRoom);

            console.log(`State at index ${index} deleted from room:`, roomKey);

            NetworkManager.broadcast({
                t: 'state_deleted',
                from: state.localPeerId,
                roomKey,
                deletedIndex: index
            });

            return updatedStates;
        } catch (error) {
            console.error('Error deleting state:', error);
            return false;
        }
    }


    async deleteAllStates(roomKey) {
        try {
            await this.ensureStorage();
            const room = await this.getRoom(roomKey);

            if(!this.hasDrawings(roomKey)) {
                alert('No drawings found.')
                return
            }

            const updatedStates = []
            const updatedRoom = {
                ...room,
                states: updatedStates,
                lastModified: Date.now()
            };

            await roomDB.put(roomKey, updatedRoom);
            console.log(`All states deleted from room:`, roomKey);
            NetworkManager.broadcast({
                t: 'all_states_deleted',
                from: state.localPeerId,
                roomKey,
            });
            return updatedStates;
        } catch (error) {
            console.error('Error deleting states:', error);
            return false;
        }
    }

    async getRoomState(roomKey) {
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


    async loadAllStates(roomKey) {
        await this.ensureStorage();
        const room = await this.getRoom(roomKey);
        if(!room) {
            console.log('Room not found:', roomKey);
            return [];
        }
        if(!(await this.hasDrawings(roomKey))) {
            console.log('No drawings found.')
            return null;
        }

        const node = room.states;
        console.log('Node : ', node)

        const validStates = node.filter(state =>
            state && state.objects && state.order
        );

        if (validStates.length === 0) {
            console.warn('No valid states found');
            return [];
        }
        console.log('Valid States : ', validStates)
        console.log(`Loaded ${validStates.length} states for room:`, roomKey);
        return validStates;
    }

    async loadLatestRoomState(roomKey) {
        await this.ensureStorage();
        const node = await this.getRoom(roomKey)

        if(!(await this.hasDrawings(roomKey))) {
            console.log('No drawings found.')
            return null;
        }

        console.log(node.states)

        const lastIndex = Room.lastIndex(node.states);
        const lastData = Room.lastestData(lastIndex, node.states);

        console.log('Last Data : ', lastData)
        Room.applyDrawingState(lastData);

        NetworkManager.broadcast({
            t: 'latestDrawing_loaded',
            from: state.localPeerId,
            roomKey: roomKey,
            loadedVersion: node.states[lastIndex],
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
                state.doc.objects[id] = drawingData.objects[id];
                state.doc.order.push(id);
            }
        }

        state.doc.version = Math.max(state.doc.version, drawingData.version || 0) + 1;

        state.requestRender = originalRequestRender;

        state.requestRender();
        state.dirty = true;
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

    async hasDrawings(roomKey) {
        try {
            await this.ensureStorage()
            const room = await this.getRoom(roomKey);
            if(room.states.length > 0) {
                return true;
            } else {
                return false;
            }
        } catch (e) {
            console.error(e)
            return false;
        }
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

    static setupReplication(roomKey, connection) {
        if(!connection.closed) return;
        try {
            const peerId = connection.peerId || 'Unknown'
            console.log('Setting up Room Replication for : ', peerId)
            connection.socket.on('room_state_added', (message) => {
                if (message.from !== state.localPeerId) {
                    console.log(`Received room state from peer ${message.from}`);
                    Room.applyDrawingState(message.drawingState);
                }
            });

            connection.socket.on('room_details', (message) => {
                if (message.from !== state.localPeerId) {
                    console.log(`Received room details from peer ${message.from}`);
                    globalState.updateRoom(message.roomKey, message.details);
                }
            });

        } catch (e) {
            console.error(e)
            return null;
        }
    }

    static replicateToAllPeers(roomKey) {
        console.log('Replicating to all peers');
        for (const connection of state.connections) {
            if(!connection.closed) {
                console.log('Setting Up Replication for : ', connection.peerId)
                Room.setupReplication(roomKey, connection)
            }
        }
    }

    static lastIndex(arr) {
        return arr.length - 1;
    }

    static lastestData(lastIndex, arr) {
        return arr[lastIndex];
    }
}

export const room = new Room();