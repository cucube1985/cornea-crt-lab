// The provider owns verification and account storage; this module only renders UI.
const $=id=>document.getElementById(id);
const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
const message=(id,text,bad=false)=>{const node=$(id);node.textContent=text;node.hidden=!text;node.classList.toggle('access-error',bad);};
const passwordField=(id,label,autocomplete='new-password')=>`<label class="access-field">${label}<input id="${id}" type="password" autocomplete="${autocomplete}" minlength="8" maxlength="128" required></label>`;

export async function requireAccess(provider){
  const page=document.createElement('main');page.id='access-page';page.className='access-page';
  page.innerHTML=`<section class="access-card" aria-labelledby="access-title"><a class="access-brand" href="./">CORNEA <span>LAB</span><small>ORTHOKERATOLOGY EXPLORER</small></a><div class="access-badge">WORKSPACE ACCESS</div><h1 id="access-title">로그인</h1><p class="access-intro">계정으로 로그인하고 각막과 CRT 렌즈 모델을 살펴보세요.</p><form id="access-form"><label class="access-field">아이디<input id="access-id" type="text" autocomplete="username" maxlength="40" required autocapitalize="none" spellcheck="false"></label>${passwordField('access-password','비밀번호','current-password')}<label class="access-show"><input id="access-show-password" type="checkbox">비밀번호 표시</label><p id="access-message" class="access-message" role="alert" hidden></p><button id="access-submit" class="access-primary" type="submit" disabled>로그인</button></form><p class="access-scope"></p><p class="access-foot">교육용 기하 모델 · CORNEA LAB</p><noscript>로그인하려면 JavaScript를 활성화해 주세요.</noscript></section>`;
  page.querySelector('.access-scope').textContent=provider.notice;
  document.body.prepend(page);
  $('access-show-password').addEventListener('change',()=>{$('access-password').type=$('access-show-password').checked?'text':'password';});
  const user=await new Promise(resolve=>{
    let busy=true;
    $('access-form').addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;busy=true;message('access-message','');$('access-submit').disabled=true;$('access-submit').textContent='확인 중…';
      try{const current=await provider.login($('access-id').value.trim(),$('access-password').value);$('access-password').value='';resolve(current);}
      catch(error){message('access-message',error.message||'로그인할 수 없습니다. 다시 시도해 주세요.',true);$('access-password').value='';$('access-password').focus();}
      finally{busy=false;$('access-submit').disabled=false;$('access-submit').textContent='로그인';}
    });
    provider.session().then(current=>{if(current)resolve(current);}).catch(error=>message('access-message',error.message||'계정 상태를 확인할 수 없습니다.',true)).finally(()=>{busy=false;$('access-submit').disabled=false;});
  });
  page.remove();return user;
}

export function mountAccountSettings(provider,user){
  const tools=document.createElement('div');tools.className='account-tools';
  const current=el('span',user.username);current.className='account-current';
  const settings=el('button','설정');settings.id='account-settings-btn';settings.className='text-button';
  const logout=el('button','로그아웃');logout.id='account-logout-btn';logout.className='text-button';
  tools.append(current,settings,logout);document.querySelector('.top-actions').prepend(tools);
  const dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.setAttribute('aria-labelledby','account-title');
  dialog.innerHTML=`<div class="dialog-heading"><div class="eyebrow">ACCOUNT SETTINGS</div><button id="account-close" class="icon-button" aria-label="설정 닫기">×</button><h2 id="account-title">계정 설정</h2><p class="account-context"></p></div><div class="dialog-body"><section id="account-admin"><h3>로그인 계정</h3><p>관리자는 사용 계정을 추가하고 비활성화할 수 있습니다.</p><ul id="account-list" class="account-list"></ul><h3>계정 추가</h3><form id="account-add-form"><label class="access-field">새 아이디<input id="account-new-id" type="text" minlength="3" maxlength="40" pattern="[A-Za-z0-9_.-]{3,40}" autocomplete="off" required><small>영문·숫자·밑줄·점·하이픈, 3~40자</small></label>${passwordField('account-new-password','새 비밀번호')}${passwordField('account-confirm-password','새 비밀번호 확인')}<p class="access-help">비밀번호는 8~128자입니다. 추가 계정은 모델을 사용할 수 있으며 계정 관리는 관리자만 가능합니다.</p><button class="access-primary" type="submit">계정 추가</button><p id="account-add-message" class="access-message" role="status" hidden></p></form></section><section class="account-password-section"><h3>내 비밀번호 변경</h3><form id="account-password-form">${passwordField('account-old-password','현재 비밀번호','current-password')}${passwordField('account-change-password','변경할 비밀번호')}${passwordField('account-change-confirm','변경할 비밀번호 확인')}<button class="access-primary" type="submit">비밀번호 변경</button><p id="account-password-message" class="access-message" role="status" hidden></p></form></section><p id="account-action-message" class="access-message" role="alert" hidden></p></div>`;
  dialog.querySelector('.account-context').textContent=`${user.username} · ${user.role==='admin'?'관리자':'사용자'} / ${provider.notice}`;
  document.body.append(dialog);$('account-admin').hidden=user.role!=='admin';
  async function refreshUsers(){
    if(user.role!=='admin')return;
    const users=await provider.listUsers();
    $('account-list').replaceChildren(...users.map(account=>{
      const row=el('li',''),label=el('span',account.username),state=el('small',account.role==='admin'?'관리자':account.enabled?'사용 가능':'비활성');row.append(label,state);
      if(account.role!=='admin'){
        const toggle=el('button',account.enabled?'비활성화':'활성화');toggle.type='button';toggle.className='account-toggle';
        toggle.addEventListener('click',async()=>{toggle.disabled=true;try{await provider.setEnabled(account.username,!account.enabled);await refreshUsers();message('account-action-message','계정 상태를 변경했습니다.');}catch(error){message('account-action-message',error.message,true);toggle.disabled=false;}});row.append(toggle);
      }
      return row;
    }));
  }
  settings.addEventListener('click',async()=>{message('account-action-message','');dialog.showModal();try{await refreshUsers();}catch(error){message('account-action-message',error.message,true);}});
  $('account-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{for(const input of dialog.querySelectorAll('input[type="password"]'))input.value='';});
  logout.addEventListener('click',async()=>{logout.disabled=true;try{await provider.logout();location.reload();}catch(error){logout.disabled=false;dialog.showModal();message('account-action-message',error.message,true);}});
  const action=(formId,messageId,handler)=>$(formId).addEventListener('submit',async event=>{event.preventDefault();const form=event.target,button=form.querySelector('button[type="submit"]');if(button.disabled)return;button.disabled=true;message(messageId,'');try{await handler();form.reset();}catch(error){message(messageId,error.message,true);}finally{button.disabled=false;}});
  action('account-add-form','account-add-message',async()=>{
    if($('account-new-password').value!==$('account-confirm-password').value)throw new Error('새 비밀번호와 확인 값이 다릅니다.');
    await provider.createUser($('account-new-id').value.trim(),$('account-new-password').value);await refreshUsers();message('account-add-message','계정을 추가했습니다.');
  });
  action('account-password-form','account-password-message',async()=>{
    if($('account-change-password').value!==$('account-change-confirm').value)throw new Error('변경할 비밀번호와 확인 값이 다릅니다.');
    await provider.changePassword($('account-old-password').value,$('account-change-password').value);await provider.logout();location.reload();
  });
}
