import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openAuthStore} from './auth/store.mjs';
import {createAuthenticatedServer,validateOrigin,originFromEnvironment} from './auth/http.mjs';

const temp=await mkdtemp(path.join(tmpdir(),'cornea-auth-test-')),filename=path.join(temp,'auth.sqlite');
const seed='Test-only-admin-password-42',memberPassword='Test-only-member-password-42',changed='Test-only-new-password-84';
const origin='http://127.0.0.1:4173';let clock=Date.now(),store,server,secureServer;
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=server=>server?new Promise(resolve=>server.close(resolve)):Promise.resolve();
try{
  assert.throws(()=>validateOrigin('http://example.com'));assert.throws(()=>validateOrigin('https://example.com/path'));
  assert.equal(originFromEnvironment({NODE_ENV:'production',RENDER_EXTERNAL_URL:'https://cornea-test.onrender.com/'},10000),'https://cornea-test.onrender.com');
  assert.equal(originFromEnvironment({NODE_ENV:'production',PUBLIC_ORIGIN:'https://custom.example',RENDER_EXTERNAL_URL:'https://cornea-test.onrender.com'},10000),'https://custom.example');
  assert.throws(()=>originFromEnvironment({NODE_ENV:'production'},10000));
  assert.throws(()=>originFromEnvironment({NODE_ENV:'production',RENDER_EXTERNAL_URL:'http://cornea-test.onrender.com'},10000));
  await assert.rejects(()=>openAuthStore({filename:path.join(temp,'missing.sqlite')}),/관리자 계정/);
  store=await openAuthStore({filename,initialPassword:seed,now:()=>clock});
  server=await createAuthenticatedServer({store,root:fileURLToPath(new URL('./dist/',import.meta.url)),origin});await listen(server);
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(route,{method='GET',body,cookie='',csrf='',requestOrigin=origin,extra={}}={})=>{
    const response=await fetch(base+route,{method,headers:{...(method==='GET'?{}:{Origin:requestOrigin,'Content-Type':'application/json','X-Cornea-Request':'1','X-CSRF-Token':csrf}),...(cookie?{Cookie:cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
    return {response,status:response.status,text,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const login=(username,password)=>call('/api/login',{method:'POST',body:{username,password}});
  assert.match((await call('/')).text,/로그인 · CORNEA LAB/);
  assert.equal((await call('/app.js')).status,401);assert.equal((await call('/geometry.js')).status,401);
  assert.equal((await call('/api/users',{cookie:'cornea-session=admin'})).status,401);
  const wrong=await login('admin','bad-password'),unknown=await login('unknown','bad-password');
  assert.equal(wrong.status,401);assert.deepEqual(wrong.data,unknown.data);
  assert.equal((await call('/api/login',{method:'POST',requestOrigin:'https://evil.invalid',body:{username:'admin',password:seed}})).status,403);
  const admin=await login('ADMIN',seed);assert.equal(admin.status,200);assert.equal(admin.data.user.role,'admin');
  assert.match(admin.response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const cookie=admin.cookie,csrf=admin.data.csrf;
  const page=await call('/',{cookie});assert.match(page.text,/lab-app/);assert.equal(page.response.headers.get('cache-control'),'no-store');
  assert.equal((await call('/app.js',{cookie})).status,200);
  const session=await call('/api/session',{cookie});assert.equal(session.data.user.username,'admin');assert.ok(!session.text.includes('tokenHash'));assert.ok(!session.text.includes('password_hash'));
  assert.equal((await call('/api/users',{method:'POST',cookie,body:{username:'member',password:memberPassword}})).status,403);
  assert.equal((await call('/api/users',{method:'POST',cookie,csrf:'é'.repeat(43),body:{username:'member',password:memberPassword}})).status,403);
  assert.equal((await call('/api/users',{method:'POST',cookie,csrf,body:{username:'member',password:memberPassword,role:'admin'}})).status,201);
  assert.equal((await call('/api/users',{method:'POST',cookie,csrf,body:{username:'MEMBER',password:memberPassword}})).status,409);
  const member=await login('member',memberPassword),member2=await login('member',memberPassword);
  assert.equal(member.data.user.role,'user');
  assert.equal((await call('/api/users',{cookie:member.cookie})).status,403);
  assert.equal((await call('/api/users',{method:'POST',cookie:member.cookie,csrf:member.data.csrf,body:{username:'attacker',password:memberPassword}})).status,403);
  assert.equal((await call('/api/users/admin/enabled',{method:'PATCH',cookie,csrf,body:{enabled:false}})).status,400);
  assert.equal((await call('/api/users/member/enabled',{method:'PATCH',cookie,csrf,body:{enabled:false}})).status,200);
  assert.equal((await call('/app.js',{cookie:member.cookie})).status,401);assert.equal((await call('/app.js',{cookie:member2.cookie})).status,401);
  assert.equal((await login('member',memberPassword)).status,401);
  assert.equal((await call('/api/users/member/enabled',{method:'PATCH',cookie,csrf,body:{enabled:true}})).status,200);
  assert.equal((await call('/app.js',{cookie:member.cookie})).status,401);
  const renewed=await login('member',memberPassword),renewed2=await login('member',memberPassword);
  assert.equal((await call('/api/password',{method:'POST',cookie:renewed.cookie,csrf:renewed.data.csrf,body:{currentPassword:'incorrect-password',nextPassword:changed}})).status,400);
  assert.equal((await call('/api/password',{method:'POST',cookie:renewed.cookie,csrf:renewed.data.csrf,body:{currentPassword:memberPassword,nextPassword:changed}})).status,200);
  assert.equal((await call('/app.js',{cookie:renewed2.cookie})).status,401);
  assert.equal((await login('member',memberPassword)).status,401);assert.equal((await login('member',changed)).status,200);
  const logout=await call('/api/logout',{method:'POST',cookie,csrf,body:{}});assert.equal(logout.status,200);assert.match(logout.response.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await call('/app.js',{cookie})).status,401);
  for(let i=0;i<10;i++)assert.equal((await login('absent-user','incorrect-password')).status,401);
  assert.equal((await login('absent-user','incorrect-password')).status,429);
  // A background observation must not extend inactivity expiry.
  const idle=await store.login('admin',seed,'expiry-test');clock+=29*60*1000;
  assert.equal((await call('/api/session?observe=1',{cookie:'cornea-session='+idle.token})).data.user.username,'admin');
  clock+=61*1000;assert.equal((await call('/api/session?observe=1',{cookie:'cornea-session='+idle.token})).data.user,null);
  const absolute=await store.login('admin',seed,'absolute-test');for(let i=0;i<16;i++){clock+=29*60*1000;assert.ok(store.session(absolute.token));}clock+=17*60*1000;assert.equal(store.session(absolute.token),null);
  secureServer=await createAuthenticatedServer({store,root:fileURLToPath(new URL('./dist/',import.meta.url)),origin:'https://cornea.example'});await listen(secureServer);
  const tls=await fetch(`http://127.0.0.1:${secureServer.address().port}/api/login`,{method:'POST',headers:{Origin:'https://cornea.example','Content-Type':'application/json','X-Cornea-Request':'1'},body:JSON.stringify({username:'admin',password:seed})});
  assert.equal(tls.status,200);assert.match(tls.headers.get('set-cookie'),/^__Host-cornea-session=.*; Secure$/);await tls.text();
  await close(secureServer);secureServer=null;await close(server);server=null;store.close();store=null;
  // Persistence across a process/store restart; bootstrap cannot reset an existing admin.
  store=await openAuthStore({filename,initialPassword:'Ignored-new-bootstrap-value',now:()=>clock});
  assert.equal((await store.login('member',changed,'restart')).user.username,'member');assert.equal((await store.login('admin',seed,'restart')).user.role,'admin');store.close();store=null;
  for(const file of await readdir(temp))if(file.startsWith('auth.sqlite')){const bytes=await readFile(path.join(temp,file));for(const secret of [seed,memberPassword,changed,admin.cookie.split('=')[1]])assert.ok(!bytes.includes(Buffer.from(secret)));}
  console.log('Server authentication passed: protected assets, salted hashes, sessions, CSRF/origin, roles, account persistence, disable/re-enable, password changes, logout, throttling, and expiry.');
}finally{
  await close(secureServer);await close(server);store?.close();
  if(path.resolve(temp).startsWith(path.resolve(tmpdir())+path.sep+'cornea-auth-test-'))await rm(temp,{recursive:true,force:true});
}
