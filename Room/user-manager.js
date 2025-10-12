import { roomDB } from './room.js';

/**
 * List all registered users (for debugging)
 */
export async function logAllUsers() {
    console.log('=== Registered Users ===');

    try {
        await roomDB.ready();

        for await (const { key, value } of roomDB.createReadStream({ keys: true, values: true })) {
            console.log(`Username: ${key}`);
            console.log('Data:', value);
            console.log('------------------------');
        }

        console.log('=== End of Users ===');
    } catch (error) {
        console.error('Error reading users from roomDB:', error);
    }
}