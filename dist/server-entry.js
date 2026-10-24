import {serverAccess} from './access-provider.js?v=5';
import {mountAccountSettings} from './access-ui.js?v=5';

const provider=serverAccess(),root=document.getElementById('lab-app');
let redirecting=false;
function lock(){if(redirecting)return;redirecting=true;root.hidden=true;for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();location.replace(new URL('./login',location.href));}
window.addEventListener('cornea-session-expired',lock);
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
try{
  const user=await provider.session();
  if(!user){lock();}else{
    document.documentElement.dataset.account=user.username;
    root.hidden=false;document.getElementById('server-boot').hidden=true;
    mountAccountSettings(provider,user);
    await import('./app.js?v=5');
    let lastActivity=Date.now(),lastTouch=Date.now(),checking=false;
    for(const event of ['pointerdown','keydown','wheel'])window.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
    const timer=setInterval(async()=>{
      if(checking||redirecting)return;checking=true;
      const touch=Date.now()-lastActivity<60_000&&Date.now()-lastTouch>5*60_000;
      try{const current=await provider.session({observe:!touch});if(!current||current.username!==user.username||current.role!==user.role)lock();if(touch)lastTouch=Date.now();}
      catch{lock();}finally{checking=false;}
    },60_000);
    window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  }
}catch{
  root.hidden=true;const boot=document.getElementById('server-boot');boot.hidden=false;boot.textContent='인증 서버에 연결할 수 없습니다. 서버 주소와 연결 상태를 확인한 뒤 새로고침해 주세요.';
}
