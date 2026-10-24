import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir,chmod} from 'node:fs/promises';
import path from 'node:path';

const scrypt=promisify(scryptCallback),cost={N:131072,r:8,p:1,maxmem:192*1024*1024};
const digest=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
export class AccessError extends Error{constructor(status,message){super(message);this.status=status;}}
export function usernameValue(value){
  if(typeof value!=='string'||!/^[a-zA-Z0-9_.-]{3,40}$/.test(value.trim()))throw new AccessError(400,'아이디는 영문·숫자·밑줄·점·하이픈 3~40자로 입력해 주세요.');
  return value.trim().toLowerCase();
}
function passwordValue(value){if(typeof value!=='string'||value.length<8||value.length>128)throw new AccessError(400,'비밀번호는 8~128자로 입력해 주세요.');return value;}

// Bound memory-consuming password work across simultaneous requests.
let pending=0,hashTail=Promise.resolve();
async function derive(password,salt){
  if(pending>=8)throw new AccessError(503,'로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  pending++;const job=hashTail.then(()=>scrypt(password,salt,64,cost));hashTail=job.catch(()=>{});
  try{return await job;}finally{pending--;}
}
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');return `scrypt$${salt}$${(await derive(passwordValue(password),salt)).toString('hex')}`;}
async function passwordMatches(password,encoded){
  const [kind,salt,hash]=encoded.split('$');if(kind!=='scrypt'||!/^[0-9a-f]{32}$/.test(salt)||!/^[0-9a-f]{128}$/.test(hash))throw new Error('Invalid stored password format.');
  const actual=await derive(password,salt);return timingSafeEqual(actual,Buffer.from(hash,'hex'));
}
const safeUser=row=>({username:row.username,role:row.role,enabled:!!row.enabled});

export async function openAuthStore({filename,initialPassword,now=Date.now,idleMs=30*60*1000,absoluteMs=8*60*60*1000}={}){
  if(!filename)throw new Error('An authentication database path is required.');
  await mkdir(path.dirname(filename),{recursive:true,mode:0o700});
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','user')), enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, username TEXT NOT NULL REFERENCES users(username), csrf TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(username);
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until_time INTEGER NOT NULL);`);
  await chmod(filename,0o600).catch(()=>{});
  try{
    if(!db.prepare('SELECT username FROM users WHERE role = ?').get('admin')){
      if(!initialPassword)throw new Error('관리자 계정이 없습니다. ADMIN_INITIAL_PASSWORD를 지정하거나 npm run init-admin을 실행해 주세요.');
      const hash=await passwordHash(initialPassword);
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('admin',hash,'admin',1,now());
    }
  }catch(error){db.close();throw error;}
  const dummy=await passwordHash(token());
  function cleanup(){const t=now();db.prepare('DELETE FROM sessions WHERE created_at <= ? OR last_seen <= ?').run(t-absoluteMs,t-idleMs);db.prepare('DELETE FROM attempts WHERE until_time <= ?').run(t);}
  function throttle(keys,limit){
    cleanup();for(const key of keys){const row=db.prepare('SELECT count FROM attempts WHERE key = ?').get(key);if(row&&row.count>=limit)throw new AccessError(429,'시도 횟수가 많습니다. 15분 후 다시 시도해 주세요.');}
    for(const key of keys)db.prepare('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now()+15*60*1000);
  }
  function session(value,{touch=true}={}){
    if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))return null;
    const row=db.prepare('SELECT s.*,u.role,u.enabled FROM sessions s JOIN users u USING(username) WHERE token_hash = ?').get(digest(value));
    if(!row)return null;
    const t=now();if(!row.enabled||t-row.created_at>=absoluteMs||t-row.last_seen>=idleMs){db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);return null;}
    if(touch)db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(t,row.token_hash);
    return {...safeUser(row),csrf:row.csrf,tokenHash:row.token_hash};
  }
  function requireAdmin(actor){const user=actor&&db.prepare('SELECT role,enabled FROM users WHERE username = ?').get(actor.username);if(!user?.enabled||user.role!=='admin')throw new AccessError(403,'관리자만 계정을 관리할 수 있습니다.');}
  return {
    session,
    async login(rawName,password,ip){
      const name=typeof rawName==='string'?rawName.trim().toLowerCase().slice(0,40):'';
      const userKey='login-user:'+digest(name),ipKey='login-ip:'+digest(String(ip));
      throttle([ipKey],30);throttle([userKey],10);
      const row=db.prepare('SELECT * FROM users WHERE username = ?').get(name);
      const validInput=typeof password==='string'&&password.length>=8&&password.length<=128;
      const verified=await passwordMatches(validInput?password:'invalid-placeholder',row?.password_hash??dummy);
      // Re-read after asynchronous hashing so disable/password-change races cannot grant a session.
      const latest=row&&db.prepare('SELECT * FROM users WHERE username = ?').get(name);
      if(!validInput||!row||!verified||!latest?.enabled||latest.password_hash!==row.password_hash)throw new AccessError(401,'아이디 또는 비밀번호를 확인해 주세요.');
      db.prepare('DELETE FROM attempts WHERE key = ?').run(userKey);
      const value=token(),csrf=token(),t=now();
      db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(digest(value),name,csrf,t,t);
      return {token:value,user:safeUser(latest),csrf};
    },
    logout(value){if(typeof value==='string')db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(value));},
    listUsers(actor){requireAdmin(actor);return db.prepare('SELECT username,role,enabled FROM users ORDER BY role,username').all().map(safeUser);},
    async createUser(actor,rawName,password){
      requireAdmin(actor);const name=usernameValue(rawName);
      if(db.prepare('SELECT username FROM users WHERE username = ?').get(name))throw new AccessError(409,'이미 사용 중인 아이디입니다.');
      const hash=await passwordHash(password);requireAdmin(actor);
      try{db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(name,hash,'user',1,now());}catch(error){if(error.code?.includes('CONSTRAINT')||error.message.includes('UNIQUE constraint'))throw new AccessError(409,'이미 사용 중인 아이디입니다.');throw error;}
      return {username:name,role:'user',enabled:true};
    },
    setEnabled(actor,rawName,enabled){
      requireAdmin(actor);const name=usernameValue(rawName);if(typeof enabled!=='boolean')throw new AccessError(400,'계정 상태를 확인해 주세요.');
      const row=db.prepare('SELECT role FROM users WHERE username = ?').get(name);if(!row)throw new AccessError(404,'계정이 없습니다.');if(row.role==='admin')throw new AccessError(400,'관리자 계정은 비활성화할 수 없습니다.');
      db.prepare('UPDATE users SET enabled = ? WHERE username = ?').run(enabled?1:0,name);
      db.prepare('DELETE FROM sessions WHERE username = ?').run(name);
    },
    async changePassword(actor,currentPassword,nextPassword,ip){
      throttle(['password:'+digest(actor.username+':'+ip)],6);
      const row=db.prepare('SELECT * FROM users WHERE username = ?').get(actor.username);
      if(!row?.enabled||typeof currentPassword!=='string'||currentPassword.length>128||!await passwordMatches(currentPassword,row.password_hash))throw new AccessError(400,'현재 비밀번호를 확인해 주세요.');
      const hash=await passwordHash(nextPassword);
      const result=db.prepare('UPDATE users SET password_hash = ? WHERE username = ? AND enabled = 1 AND password_hash = ?').run(hash,actor.username,row.password_hash);
      if(!result.changes)throw new AccessError(409,'계정이 변경되었습니다. 다시 로그인해 주세요.');
      db.prepare('DELETE FROM sessions WHERE username = ?').run(actor.username);
    },
    close(){db.close();},
  };
}
