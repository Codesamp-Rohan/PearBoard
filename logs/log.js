class Log {
    constructor() {
        this.logs = [];
        this.logIndex = 0;
        this.logLength = 0;
    }

    static logHypercoreData(data, index = null) {
        console.group(`Hypercore Data ${index !== null ? `(Entry ${index})` : ''}`);
        console.log('Version:', data.version);
        console.log('Saved at:', new Date(data.savedAt).toLocaleString());
        console.log('Saved by:', data.savedBy);
        console.log('Objects count:', data.order?.length || 0);
        console.log('Room key:', data.roomKey?.substring(0, 8) + '...');

        if (data.order && data.order.length > 0) {
            console.log('Object IDs:', data.order.slice(0, 5), data.order.length > 5 ? '...' : '');
            console.log('Sample objects:');
            data.order.slice(0, 3).forEach(id => {
                const obj = data.objects[id];
                if (obj) {
                    console.log(`${id.substring(0, 6)}: ${obj.type} (${obj.color}, size: ${obj.size})`);
                }
            });
            if (data.order.length > 3) {
                console.log(`  ... and ${data.order.length - 3} more objects`);
            }
        }
        console.groupEnd();
    }

    static logDBData(data, index = null) {
        console.group(`DB Data ${index !== null ? `(Entry ${index})` : ''}`);
        console.log('Version:', data.version);
        console.log('Saved at:', new Date(data.savedAt).toLocaleString());
        console.log('Saved by:', data.savedBy);
        console.log('Objects count:', data.order?.length || 0);
        console.log('Room key:', data.roomKey?.substring(0, 8) + '...');
    }

    static logAutobaseData(data) {
        const { roomKey, savedBy, savedAt, version, order, objects } = data;
        console.log('Autobase entry saved:');
        console.log('  Room Key:', roomKey);
        console.log('  Saved By:', savedBy);
        console.log('  Saved At:', new Date(savedAt).toLocaleString());
        console.log('  Version:', version);
        console.log('  Object Count:', order.length);
        console.log('  Objects Snapshot:', objects);
    }
}

export default Log;