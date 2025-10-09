import Hypercore from 'hypercore'
import Log from '../logs/log.js'
import { NetworkManager, PEAR_PATH, state } from '../app.js'

class HypercoreManager {
    static cores = new Map()
    static replicationStreams = new Map()
    static drawings = new Map()

    static async initCore(roomKey) {
        if (this.cores.has(roomKey)) {
            return this.cores.get(roomKey)
        }
        try {
            const core = new Hypercore(`${PEAR_PATH}/${state.localPeerId}/${roomKey}`, { valueEncoding: 'json' })
            await core.ready()
            this.cores.set(roomKey, core)
            return core
        } catch (error) {
            console.error(error)
            return null
        }
    }

    static async saveDrawingState(roomKey) {
        if (!state.topicKey || !roomKey) {
            return false
        }
        try {
            const core = await this.initCore(roomKey)
            if (!core) return false
            const drawingData = {
                version: state.doc.version,
                order: [...state.doc.order],
                objects: { ...state.doc.objects },
                savedAt: Date.now(),
                savedBy: state.localPeerId,
                roomKey
            }
            await core.append(drawingData)
            Log.logHypercoreData(drawingData, core.length - 1)
            this.replicateToAllPeers(roomKey)
            NetworkManager.broadcast({
                t: 'hypercore_saved',
                from: state.localPeerId,
                roomKey,
                savedAt: drawingData.savedAt,
                coreLength: core.length
            })
            return true
        } catch (error) {
            console.error(error)
            return false
        }
    }

    static async loadAllDrawings(roomKey) {
        try {
            const core = await this.initCore(roomKey);
            if (!core || core.length === 0) {
                return false;
            }

            const entries = [];
            // Stream all entries from the Hypercore feed
            for await (const data of core.createReadStream()) {
                if (data.roomKey === roomKey) {
                    entries.push(data);
                    Log.logHypercoreData(data, entries.length - 1);
                }
            }

            if (entries.length === 0) {
                return false;
            }

            // Apply each snapshot in chronological order
            for (const drawingData of entries) {
                this.applyDrawingState(drawingData);
            }

            // Notify peers and UI of completion
            NetworkManager.broadcast({
                t: 'hypercore_loaded',
                from: state.localPeerId,
                roomKey,
                loadedCount: entries.length
            });
            NetworkManager.broadcast({
                t: 'full',
                snapshot: NetworkManager.serializeDocument()
            });

            return true;
        } catch (error) {
            console.error('Hypercore loadAllDrawings error:', error);
            return false;
        }
    }


    static async loadLatestDrawing(roomKey) {
        try {
            const core = await this.initCore(roomKey)
            if (!core || core.length === 0) {
                return false
            }
            const latestIndex = core.length - 1
            const latestData = await core.get(latestIndex)
            if (!latestData || !latestData.objects || !latestData.order) {
                return false
            }
            Log.logHypercoreData(latestData, latestIndex)
            this.applyDrawingState(latestData)
            NetworkManager.broadcast({
                t: 'hypercore_loaded',
                from: state.localPeerId,
                roomKey,
                loadedVersion: latestData.version
            })
            NetworkManager.broadcast({
                t: 'full',
                snapshot: NetworkManager.serializeDocument()
            })
            return true
        } catch (error) {
            console.error(error)
            return false
        }
    }

    static applyDrawingState(drawingData) {
        const originalRequestRender = state.requestRender
        let renderRequested = false
        state.requestRender = () => {
            renderRequested = true
        }
        for (const id of drawingData.order) {
            if (drawingData.objects[id] && !state.doc.objects[id]) {
                state.doc.objects[id] = drawingData.objects[id]
                state.doc.order.push(id)
            }
        }
        state.doc.version = Math.max(state.doc.version, drawingData.version || 0) + 1
        state.requestRender = originalRequestRender
        if (renderRequested) {
            state.requestRender()
        }
    }

    static setupReplication(roomKey, connection) {
        const core = this.cores.get(roomKey)
        if (!core || !connection.socket) return
        try {
            const peerId = connection.peerId || 'unknown'
            const stream = core.replicate(false, { live: true })
            this.replicationStreams.set(peerId, { stream, core, roomKey })
            connection.socket.pipe(stream).pipe(connection.socket, { end: false })
            stream.on('sync', () => {
                setTimeout(() => {
                    this.loadLatestDrawing(roomKey)
                }, 500)
            })
            connection.socket.on('close', () => {
                this.replicationStreams.delete(peerId)
            })
        } catch (error) {
            console.error(error)
        }
    }

    static replicateToAllPeers(roomKey) {
        for (const connection of state.connections) {
            if (!connection.closed) {
                this.setupReplication(roomKey, connection)
            }
        }
    }

    static async hasDrawings(roomKey) {
        try {
            const core = await this.initCore(roomKey)
            return core && core.length > 0
        } catch {
            return false
        }
    }

    static async deleteDrawings(roomKey) {
        try {
            const core = await this.initCore(roomKey)
            if (!core || core.length === 0) {
                return false
            }
            await core.clear(roomKey)
            return true
        } catch {
            return false
        }
    }

    static async getDrawingHistory(roomKey) {
        try {
            const core = await this.initCore(roomKey)
            if (!core || core.length === 0) {
                return []
            }
            const history = []
            for (let i = 0; i < core.length; i++) {
                const entry = await core.get(i)
                history.push({
                    index: i,
                    timestamp: new Date(entry.savedAt).toLocaleString(),
                    savedBy: entry.savedBy,
                    objectCount: entry.order?.length || 0,
                    version: entry.version
                })
            }
            return history
        } catch {
            return []
        }
    }
}

export default HypercoreManager
