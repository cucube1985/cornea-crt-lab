import {spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {localServerConfig} from '../auth/local-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const privateDir=path.join(root,'.private'),stateFile=path.join(privateDir,'local-server.json');
const {origin}=localServerConfig();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function health(){
  try{const response=await fetch(origin+'/healthz',{signal:AbortSignal.timeout(1000)});if(!response.ok)return null;const data=await response.json();return data.service==='cornea-crt-lab'&&data.scope==='loopback'?data:null;}catch{return null;}
}
async function state(){
  try{const data=JSON.parse(await readFile(stateFile,'utf8'));return data.service==='cornea-crt-lab'&&typeof data.instanceId==='string'&&/^[A-Za-z0-9_-]{43}$/.test(data.token)?data:null;}catch{return null;}
}
async function openBrowser(){
  if(process.argv.includes('--no-browser')||process.platform!=='win32')return;
  await new Promise((resolve,reject)=>{
    // Fixed local URL only; no user-controlled shell arguments or file operations.
    const browser=spawn('cmd.exe',['/d','/c',`start "" "${origin}/"`],{windowsHide:true,stdio:'ignore'});
    browser.once('error',reject);browser.once('exit',code=>code===0?resolve():reject(new Error('브라우저를 열지 못했습니다. '+origin+' 주소를 직접 열어 주세요.')));
  });
}
async function start(){
  const existing=await health();
  if(existing){const saved=await state();if(saved?.instanceId!==existing.instanceId)throw new Error('4173 포트를 다른 앱이 사용 중입니다. 이 폴더의 서버인지 확인해 주세요.');console.log('이미 실행 중입니다: '+origin);await openBrowser();return;}
  await mkdir(privateDir,{recursive:true,mode:0o700});
  const log=openSync(path.join(privateDir,'server.log'),'w',0o600);
  let child,spawnError,exitCode=null;
  try{child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,windowsHide:true,detached:true,stdio:['ignore',log,log]});}
  finally{closeSync(log);}
  child.once('error',error=>{spawnError=error;});child.once('exit',code=>{exitCode=code??1;});child.unref();
  for(let i=0;i<60;i++){
    if(spawnError||exitCode!==null)break;
    await delay(200);const current=await health(),saved=await state();
    if(current&&saved?.instanceId===current.instanceId){console.log('이 노트북 전용 서버를 시작했습니다: '+origin);console.log('종료하려면 앱 종료.cmd를 실행하세요.');await openBrowser();return;}
  }
  throw new Error('서버를 시작하지 못했습니다. Node 24, 관리자 초기 설정, 4173 포트와 .private/server.log를 확인해 주세요.');
}
async function stop(){
  const current=await health();if(!current){console.log('실행 중인 로컬 서버가 없습니다.');return;}
  const saved=await state();if(!saved||saved.instanceId!==current.instanceId)throw new Error('서버 소유 정보를 확인하지 못했습니다. 다른 프로세스는 종료하지 않았습니다.');
  const response=await fetch(origin+'/__local/shutdown',{method:'POST',headers:{'X-Cornea-Stop':saved.token},signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('서버 종료 요청을 처리하지 못했습니다.');await response.text();
  for(let i=0;i<30;i++){await delay(100);if(!await health()&&!await state()){console.log('로컬 서버를 종료했습니다. 계정은 보관됩니다.');return;}}
  throw new Error('서버 종료가 진행 중입니다. 잠시 후 다시 확인해 주세요.');
}
try{
  if(Number(process.versions.node.split('.')[0])!==24)throw new Error('Node.js 24가 필요합니다.');
  if(process.argv[2]==='start')await start();else if(process.argv[2]==='stop')await stop();else throw new Error('Use start or stop.');
}catch(error){console.error(error.message);process.exitCode=1;}
