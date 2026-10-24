import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile,readFile,unlink} from 'node:fs/promises';
import {openAuthStore} from './auth/store.mjs';
import {createAuthenticatedServer} from './auth/http.mjs';
import {localServerConfig} from './auth/local-config.mjs';

const {host,port,origin,trustProxy}=localServerConfig();
const privateDir=fileURLToPath(new URL('./.private/',import.meta.url));
const statePath=path.join(privateDir,'local-server.json');
const store=await openAuthStore({filename:path.join(privateDir,'accounts.sqlite'),initialPassword:process.env.ADMIN_INITIAL_PASSWORD});
delete process.env.ADMIN_INITIAL_PASSWORD;
let shuttingDown=false;
const localControl={ready:false,instanceId:randomUUID(),token:randomBytes(32).toString('base64url'),shutdown};
const server=await createAuthenticatedServer({store,root:fileURLToPath(new URL('./dist/',import.meta.url)),origin,trustProxy,localControl});
async function shutdown(){
  if(shuttingDown)return;shuttingDown=true;localControl.ready=false;
  server.close(async()=>{
    store.close();
    try{const state=JSON.parse(await readFile(statePath,'utf8'));if(state.instanceId===localControl.instanceId)await unlink(statePath);}catch{}
    process.exit(0);
  });
  server.closeIdleConnections();
}
server.on('error',()=>{console.error('Cannot start CORNEA LAB. Port 4173 may already be in use.');store.close();process.exit(1);});
server.listen(port,host,async()=>{
  try{
    await writeFile(statePath,JSON.stringify({service:'cornea-crt-lab',instanceId:localControl.instanceId,token:localControl.token,pid:process.pid}),{mode:0o600});
    localControl.ready=true;console.log(`CORNEA LAB laptop-only server: ${origin}`);
  }catch{console.error('Cannot save local server control information.');shutdown();}
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,shutdown);
