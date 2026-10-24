import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openAuthStore} from './auth/store.mjs';
import {createAuthenticatedServer} from './auth/http.mjs';

const port=Number(process.env.PORT||4173),host=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be a valid TCP port.');
const origin=process.env.PUBLIC_ORIGIN||(process.env.NODE_ENV==='production'?null:`http://127.0.0.1:${port}`);
if(!origin)throw new Error('Production requires PUBLIC_ORIGIN=https://your-server-host.');
const privateDir=path.resolve(process.env.AUTH_DATA_DIR||fileURLToPath(new URL('./.private/',import.meta.url)));
const store=await openAuthStore({filename:path.join(privateDir,'accounts.sqlite'),initialPassword:process.env.ADMIN_INITIAL_PASSWORD});
delete process.env.ADMIN_INITIAL_PASSWORD;
const server=await createAuthenticatedServer({store,root:fileURLToPath(new URL('./dist/',import.meta.url)),origin,trustProxy:process.env.TRUST_PROXY==='1'});
server.listen(port,host,()=>console.log(`CORNEA LAB authentication server: ${origin}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
