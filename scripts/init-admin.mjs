import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openAuthStore} from '../auth/store.mjs';

// Secrets are read from stdin or hosting secret settings, never command arguments.
let piped='';if(process.argv.includes('--password-stdin'))for await(const chunk of process.stdin)piped+=chunk;
const password=piped?piped.replace(/\r?\n$/,''):process.env.ADMIN_INITIAL_PASSWORD;
if(!password)throw new Error('Set ADMIN_INITIAL_PASSWORD in a server secret, or pipe the password with --password-stdin.');
const dir=fileURLToPath(new URL('../.private/',import.meta.url));
const store=await openAuthStore({filename:path.join(dir,'accounts.sqlite'),initialPassword:password});
store.close();console.log('Administrator initialization complete. Existing accounts and passwords were preserved.');
