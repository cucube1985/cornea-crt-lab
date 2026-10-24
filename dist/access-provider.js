// Same-origin sessions. Passwords/tokens are never saved to browser storage.
export function serverAccess(){
  let csrf='';
  async function request(route,{method='GET',body}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(new URL('./api/'+route,location.href),{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:method==='GET'?{}:{'Content-Type':'application/json','X-Cornea-Request':'1','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
      let result;try{result=await response.json();}catch{throw new Error('인증 서버에 연결되지 않았습니다. 서버 주소에서 다시 열어 주세요.');}
      if(!response.ok){if(response.status===401&&csrf)window.dispatchEvent(new Event('cornea-session-expired'));throw new Error(result.error||'요청을 처리하지 못했습니다.');}
      return result;
    }catch(error){if(error instanceof TypeError||error.name==='AbortError')throw new Error('서버에 연결할 수 없습니다. 연결 상태를 확인해 주세요.');throw error;}
    finally{clearTimeout(timer);}
  }
  function accept(result){
    if(result.user===null){csrf='';return null;}
    if(!result.user||!/^[a-z0-9_.-]{3,40}$/.test(result.user.username)||!['admin','user'].includes(result.user.role)||typeof result.csrf!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(result.csrf))throw new Error('계정 응답을 확인할 수 없습니다.');
    csrf=result.csrf;return result.user;
  }
  return {
    notice:'계정은 서버에 저장되며 여러 기기에서 사용할 수 있습니다.',
    session:async({observe=false}={})=>accept(await request('session'+(observe?'?observe=1':''))),
    login:async(username,password)=>accept(await request('login',{method:'POST',body:{username,password}})),
    async logout(){await request('logout',{method:'POST',body:{}});csrf='';},
    listUsers:async()=>(await request('users')).users,
    createUser:(username,password)=>request('users',{method:'POST',body:{username,password}}),
    setEnabled:(username,enabled)=>request('users/'+encodeURIComponent(username)+'/enabled',{method:'PATCH',body:{enabled}}),
    changePassword:(currentPassword,nextPassword)=>request('password',{method:'POST',body:{currentPassword,nextPassword}}),
  };
}
