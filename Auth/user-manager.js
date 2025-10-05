import { userDB } from './auth.js';

/**
 * List all registered users (for debugging)
 */
export async function logAllUsers() {
    console.log('=== Registered Users ===');
    for await (const { key, value } of userDB.createReadStream({ keys: true, values: true })) {
        console.log(`Username: ${key}`);
        console.log('Data:', value);
        console.log('------------------------');
    }
}