import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {AccessError} from './store.mjs';

const publicFiles=new Set(['/login.html','/access.css','/access-ui.js','/access-provider.js','/login.js','/style.css']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
function sameSecret(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function validateOrigin(value){
  const url=new URL(value);if(url.origin!==value||url.username||url.password)throw new Error('PUBLIC_ORIGIN must be an origin without a path or trailing slash.');
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('PUBLIC_ORIGIN must use HTTPS except on loopback.');
  return url;
}
async function jsonBody(req){
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')throw new AccessError(415,'JSON 요청만 지원합니다.');
  let bytes=0;const chunks=[];
  for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)throw new AccessError(413,'요청이 너무 큽니다.');chunks.push(chunk);}
  try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new AccessError(400,'요청 형식을 확인해 주세요.');}
}
export async function createAuthenticatedServer({store,root,origin,trustProxy=false}){
  const publicOrigin=validateOrigin(origin),secure=publicOrigin.protocol==='https:',cookieName=secure?'__Host-cornea-session':'cornea-session';
  const rootPath=await realpath(root);
  const cookie=(value,maxAge)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure?'; Secure':''}`;
  function readCookie(req){const pair=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));return pair?.slice(cookieName.length+1)||'';}
  function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
  return http.createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      const url=new URL(req.url,'http://request.invalid'),pathname=decodeURIComponent(url.pathname);
      const observing=pathname==='/api/session'&&url.searchParams.get('observe')==='1';
      const value=readCookie(req),actor=store.session(value,{touch:pathname.startsWith('/api/')&&!observing});
      const exposed=actor?{username:actor.username,role:actor.role,enabled:true}:null;
      const ip=trustProxy?(req.headers['x-forwarded-for']?.split(',').at(-1)?.trim()||req.socket.remoteAddress):req.socket.remoteAddress;
      if(pathname==='/healthz'&&req.method==='GET'){json(res,200,{ok:true});return;}
      if(pathname.startsWith('/api/')){
        if(!['GET','POST','PATCH'].includes(req.method))throw new AccessError(405,'지원하지 않는 요청입니다.');
        if(req.method!=='GET'){
          if(req.headers.origin!==publicOrigin.origin||req.headers['x-cornea-request']!=='1')throw new AccessError(403,'요청 출처를 확인할 수 없습니다. 페이지를 새로 열어 주세요.');
          if(pathname!=='/api/login'&&actor&&!sameSecret(req.headers['x-csrf-token'],actor.csrf))throw new AccessError(403,'요청을 확인할 수 없습니다. 다시 로그인해 주세요.');
        }
        if(pathname==='/api/session'&&req.method==='GET'){json(res,200,{user:exposed,csrf:actor?.csrf??null});return;}
        if(pathname==='/api/login'&&req.method==='POST'){
          const body=await jsonBody(req),result=await store.login(body.username,body.password,ip);
          store.logout(value);res.setHeader('Set-Cookie',cookie(result.token,8*60*60));json(res,200,{user:result.user,csrf:result.csrf});return;
        }
        if(pathname==='/api/logout'&&req.method==='POST'){await jsonBody(req);store.logout(value);res.setHeader('Set-Cookie',cookie('',0));json(res,200,{ok:true});return;}
        if(!actor)throw new AccessError(401,'로그인이 만료되었습니다. 다시 로그인해 주세요.');
        if(pathname==='/api/users'&&req.method==='GET'){json(res,200,{users:store.listUsers(actor)});return;}
        if(pathname==='/api/users'&&req.method==='POST'){const body=await jsonBody(req);json(res,201,{user:await store.createUser(actor,body.username,body.password)});return;}
        const match=pathname.match(/^\/api\/users\/([a-zA-Z0-9_.-]{3,40})\/enabled$/);
        if(match&&req.method==='PATCH'){const body=await jsonBody(req);store.setEnabled(actor,match[1],body.enabled);json(res,200,{ok:true});return;}
        if(pathname==='/api/password'&&req.method==='POST'){const body=await jsonBody(req);await store.changePassword(actor,body.currentPassword,body.nextPassword,ip);res.setHeader('Set-Cookie',cookie('',0));json(res,200,{ok:true,reauthenticate:true});return;}
        throw new AccessError(404,'요청한 기능이 없습니다.');
      }
      if(!['GET','HEAD'].includes(req.method))throw new AccessError(405,'지원하지 않는 요청입니다.');
      let route=pathname;
      if(route==='/'||route==='/index.html')route=actor?'/index.html':'/login.html';
      if(route==='/login')route='/login.html';
      if(!publicFiles.has(route)&&!actor)throw new AccessError(401,'로그인이 필요합니다.');
      const candidate=path.resolve(rootPath,'.'+route);
      if(!candidate.startsWith(rootPath+path.sep))throw new AccessError(404,'파일이 없습니다.');
      let file;try{file=await realpath(candidate);}catch{throw new AccessError(404,'파일이 없습니다.');}
      if(!file.startsWith(rootPath+path.sep)||!Object.hasOwn(types,path.extname(file)))throw new AccessError(404,'파일이 없습니다.');
      const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]});res.end(req.method==='HEAD'?undefined:body);
    }catch(error){
      const status=error instanceof AccessError?error.status:error instanceof URIError?400:500;
      if(status===429)res.setHeader('Retry-After','900');
      if(!res.headersSent)json(res,status,{error:status===500?'서버에서 요청을 처리하지 못했습니다.':error.message});else res.end();
      if(status===500)console.error('Authentication server request failed.');
    }
  });
}
