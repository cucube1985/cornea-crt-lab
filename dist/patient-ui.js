import {defaultParams,sampleFit} from './geometry.js?v=5';
import {emptyMetadata,sourceNames,sanitizeRecord,elevationToSag,parseSession,makeSession} from './patient-data.js?v=5';

const $=id=>document.getElementById(id);
const fmt=(n,d=1)=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(d):'—';
const clone=value=>structuredClone(value);
const number=(id,label,unit,min,max,step,value='',optional=false)=>`<label class="patient-field">${label}<span class="patient-number"><input id="pt-${id}" type="number" min="${min}" max="${max}" step="any" ${optional?'':'required'} value="${value}" inputmode="decimal"><span>${unit}</span></span></label>`;
const sources=group=>`<label class="source-select">값의 출처 <select id="pt-source-${group}" aria-label="${{size:'각막 크기',q:'비구면도',rings:'주변부 높이',asym:'비대칭',pupil:'동공'}[group]} 출처">${Object.entries(sourceNames).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>`;
const heading=(n,title,group)=>`<div class="patient-group-title"><span>${n}</span><h3>${title}</h3>${sources(group)}</div>`;

export function createPatientWorkspace({getParams,getFit,applyParams,toast}){
  let meta=emptyMetadata(),cases={A:null,B:null},snapshots={A:null,B:null},activeMeridian='flat';
  const account=document.documentElement.dataset.account;
  if(!account)throw new Error('Authenticated account context is required.');
  const storage='cornea-lab-patient-v2:'+account,consent='cornea-lab-patient-optin:'+account;
  let keep=false;
  try{keep=localStorage.getItem(consent)==='true';}catch{}

  const summary=document.createElement('section');summary.className='patient-summary panel';summary.id='patient-summary';
  summary.innerHTML=`<div class="patient-summary-heading"><div><div class="eyebrow">PATIENT COMPARISON</div><h2 id="patient-current-label">가상 예제 · OD</h2><p id="patient-current-context">측정값과 가정을 구분하여 형태와 간격을 비교합니다.</p></div><div class="patient-actions"><button class="button subtle" id="patient-import-btn">설정 불러오기</button><a class="button subtle" href="#patient-comparison">A/B 비교 ↓</a><button class="button primary" id="patient-edit-btn">①~⑤ 조건 입력</button></div></div><div class="patient-quick-grid"><div><span>① 각막 크기</span><strong id="pt-summary-size">—</strong></div><div><span>② Q Flat / Steep</span><strong id="pt-summary-q">—</strong></div><div><span>③ CED · Ø8 mm</span><strong id="pt-summary-ced">—</strong></div><div><span>④ N−T / S−I</span><strong id="pt-summary-asym">—</strong></div><div><span>⑤ 동공 · 투영</span><strong id="pt-summary-pupil">—</strong></div></div><div class="patient-summary-foot"><span id="patient-source-summary">가정 기반 근사</span><span>입력값·설정 파일은 브라우저 안에서 처리됩니다.</span></div>`;
  document.querySelector('.workspace').before(summary);
  const pupilPanel=document.querySelector('.pupil-analysis');pupilPanel.classList.add('patient-pupil-strip');summary.append(pupilPanel);

  const comparison=document.createElement('section');comparison.className='patient-comparison panel';comparison.id='patient-comparison';
  comparison.innerHTML=`<div class="comparison-heading"><div><div class="eyebrow">COMPARE & EXPLAIN</div><h2>A / B 비교 보드</h2><a class="comparison-back" href="#patient-summary">현재 모델로 ↑</a><p>현재 조건을 A와 B에 각각 담아 비교하세요. 저장된 슬롯은 현재 입력을 바꿔도 유지됩니다.</p></div><label class="comparison-kind">비교 목적<select id="patient-kind" aria-label="비교 목적"><option value="conditions">같은 환자 · 조건/렌즈 A/B</option><option value="patients">서로 다른 환자</option><option value="time">같은 환자 · 착용 전/후</option></select></label></div><div class="case-slot-grid">${['A','B'].map(s=>`<article class="case-slot" id="slot-${s}"><div class="case-slot-title"><b>${s}</b><h3 id="slot-${s}-label">아직 담은 조건이 없습니다</h3><div><button id="capture-${s}">현재 → ${s}</button><button id="load-${s}" disabled>${s} 불러오기</button></div></div><p id="slot-${s}-context">현재 모델을 이 슬롯에 저장합니다.</p><canvas id="slot-${s}-canvas" aria-label="${s} 조건의 각막·렌즈·동공 정면 비교"></canvas><p class="case-source" id="slot-${s}-source"></p></article>`).join('')}</div><div class="comparison-legend"><span><i class="key-cornea"></i>각막 경계</span><span><i class="key-lens"></i>렌즈</span><span><i class="key-pupil"></i>동공 투영</span><span><i class="key-zone"></i>별도 입력한 치료 영역</span><span>두 그림의 mm 축척 동일</span></div><div class="comparison-results"><div class="comparison-table-wrap"><table class="comparison-table"><caption>조건과 계산값 비교 · 차이 = B − A</caption><thead><tr><th>항목</th><th>A</th><th>B</th><th>차이</th></tr></thead><tbody id="comparison-values"></tbody></table></div><div class="comparison-profile"><div class="chart-heading"><div><h3>단면 겹쳐 보기</h3><p>각 자료의 선택 주경선 · 실선 각막 / 점선 렌즈</p></div><select id="comparison-meridian" aria-label="비교 단면"><option value="flat">Flat</option><option value="steep">Steep</option></select></div><canvas id="comparison-profile-canvas" aria-label="A와 B의 각막·렌즈 단면 겹침"></canvas><div class="comparison-line-legend"><span>A</span><span>B</span><span>각 축 단위 mm</span></div><div id="comparison-explanation" aria-live="polite"></div></div></div><div class="comparison-footer"><div><label><input type="checkbox" id="patient-keep">이 기기에 비교 설정 보관</label><span>기본은 메모리 보관 · 이름/차트번호 대신 비교용 별칭 사용</span></div><div><button class="button subtle" id="patient-demo">가상 A/B 예제</button><button class="button subtle" id="patient-print">비교표 인쇄</button><button class="button primary" id="patient-export">비교 설정 저장</button></div></div><p class="patient-limitation">수기 입력으로 구성한 근사 표면입니다. 실제 지형도 전체·압력·탈중심 발생·교정 시력·근시 억제 효과를 예측하지 않습니다. AXL은 기록용이며 표면 계산에 반영하지 않습니다.</p>`;
  document.querySelector('.scenario-bar').after(comparison);

  const dialog=document.createElement('dialog');dialog.id='patient-dialog';dialog.setAttribute('aria-labelledby','patient-dialog-title');
  dialog.innerHTML=`<div class="dialog-heading"><div class="eyebrow">MANUAL MEASUREMENTS</div><button id="close-patient" class="icon-button" aria-label="환자 조건 닫기">×</button><h2 id="patient-dialog-title">환자별 전안부 조건</h2><p>지형도와 동공 검사에서 확인한 수치를 직접 입력합니다. 비어 있는 주변부 값은 기본 모델로 보완됩니다.</p></div><form id="patient-form" class="dialog-body" novalidate><div class="patient-identification"><label class="patient-field">비교용 별칭<input id="pt-label" type="text" maxlength="40" placeholder="예: 설명용 우안 A"></label><label class="patient-field">눈<select id="pt-eye"><option value="OD">OD · 우안</option><option value="OS">OS · 좌안</option></select></label>${number('axl','AXL · 기록용','mm',15,40,.01,'',true)}</div><p class="patient-help">AXL은 안축장 기록입니다. 전안부 기하나 교정 효과의 계산 계수로 사용하지 않습니다.</p>
  <section class="patient-input-group">${heading('01','각막 크기','size')}<div class="patient-form-grid">${number('hvid','HVID · 수평 직경','mm',8,15,.01)}${number('vvid','수직 직경 · 선택, 비우면 HVID로 가정','mm',8,15,.01,'',true)}</div><p class="patient-help">HVID/WTW는 장비별 정의가 다를 수 있습니다. 각막 경계에 사용하며, 렌즈가 경계를 넘는 부분은 계산에서 제외합니다.</p></section>
  <section class="patient-input-group">${heading('02','주경선별 비구면도','q')}<div class="patient-form-grid"><label class="patient-field">입력 표현<select id="pt-q-mode"><option value="q">Q값</option><option value="e">e값 · Q = −e²</option></select></label><label class="patient-field">장비 피팅 구간 · 선택<input id="pt-q-range" type="text" maxlength="30" placeholder="예: 직경 8 mm"></label>${number('qFlat','Flat 주경선','',-1.5,.5,.01)}${number('qSteep','Steep 주경선','',-1.5,.5,.01)}</div><p class="patient-help">같은 conic 정의의 e만 환산합니다. 두 주경선 값은 같은 측정 구간으로 비교하세요. ARK의 두 K값은 원래 패널에서 입력합니다.</p></section>
  <section class="patient-input-group">${heading('03','주변부 높이 · 두 반대편의 평균','rings')}<label class="patient-field">지형도 높이의 종류<select id="pt-ring-kind"><option value="sag">Sag · 정점에서 뒤쪽으로 깊이(+)</option><option value="bfs">Elevation · 중심정렬 BFS에서 전방 높이(+)</option></select></label><div class="patient-form-grid" id="patient-bfs-fields" hidden>${number('bfsRadius','중심정렬 BFS 반경','mm',5.1,15,.01,'',true)}${number('apexElevation','같은 BFS에서 정점 elevation','µm',-1000,1000,.1,'',true)}</div><div class="patient-form-grid ring-grid">${number('sag8Flat','Ø8 mm · Flat 평균','µm',100,5000,1,'',true)}${number('sag8Steep','Ø8 mm · Steep 평균','µm',100,5000,1,'',true)}${number('sag10Flat','Ø10 mm · Flat 평균','µm',100,6000,1,'',true)}${number('sag10Steep','Ø10 mm · Steep 평균','µm',100,6000,1,'',true)}</div><p class="patient-help" id="patient-ring-help">Ø8 mm는 정점에서 반경 4 mm, Ø10 mm는 반경 5 mm입니다. 각 주경선 양쪽의 평균 깊이를 입력합니다. 단일 CED 값만으로 평균 높이는 알 수 없으므로, 원본 두 높이가 없으면 비워 두세요.</p><p class="patient-help bfs-note" hidden>BFS 입력은 동일 원점·축에 중심정렬된 구면 기준만 지원합니다. 반경과 정점 elevation을 모르면 Sag를 얻을 수 없으므로 적용하지 않습니다. 미측정 점을 0으로 입력하지 마세요.</p></section>
  <section class="patient-input-group">${heading('04','비대칭 · Ø8 mm 높이 차이','asym')}<div class="patient-form-grid">${number('asymNT','비측 − 이측 · 전방 높이','µm',-200,200,1)}${number('asymSI','상측 − 하측 · 전방 높이','µm',-200,200,1)}</div><p class="patient-help">같은 반경의 elevation 차이를 입력합니다. Sag 깊이 차이인 경우 부호를 반대로 입력하세요. 양수 N−T는 비측이 더 전방입니다. 중심 K를 유지하는 매끄러운 비대칭 근사이며, 주변부 전체 측정은 아닙니다.</p></section>
  <section class="patient-input-group">${heading('05','동공과 설명용 치료 영역','pupil')}<div class="patient-form-grid">${number('pupilDay','명소시 동공 직경','mm',1,10,.1)}${number('pupilNight','박명시 동공 직경','mm',1,10,.1)}${number('pupilX','동공 중심 X · 오른쪽(+)','mm',-2,2,.01)}${number('pupilY','동공 중심 Y · 위쪽(+)','mm',-2,2,.01)}<label class="patient-field">표시할 조명<select id="pt-pupilLight"><option value="night">박명시</option><option value="day">명소시</option></select></label></div><p class="patient-help">중심 좌표는 선택한 조명에서의 값입니다. 조명을 바꾸면 해당 조명의 좌표를 다시 입력하세요. 동공은 각막 좌표면에 투영한 입사동공의 표시입니다. 정점=0, 정면 관찰자 기준 +X 오른쪽·+Y 위쪽. OD 비측은 +X, OS 비측은 −X입니다. 측정 장비와 방향을 맞춰 입력하세요.</p><details class="patient-zone"><summary>치료 영역과 동공의 겹침 비교 · 선택</summary><p class="patient-help">렌즈 BC 직경과 실제 치료 영역은 다릅니다. 착용 후 측정한 영역 또는 설명을 위해 가정한 영역을 별도로 입력합니다. 미입력 시 겹침률은 계산하지 않습니다.</p><div class="patient-form-grid">${number('treatmentDiameter','치료 영역 직경 · 선택','mm',1,8,.1,'',true)}<label class="patient-field">치료 영역 출처<select id="pt-treatment-source"><option value="assumed">설명용 가정</option><option value="measured">착용 후 측정</option></select></label>${number('treatmentX','치료 영역 중심 X','mm',-2,2,.01)}${number('treatmentY','치료 영역 중심 Y','mm',-2,2,.01)}</div></details></section>
  <p class="input-error" id="patient-error" hidden role="alert"></p><div class="recommend-actions"><button type="button" id="patient-cancel" class="button subtle">닫기</button><button type="submit" class="button primary">현재 모델에 적용</button></div></form>`;
  document.body.append(dialog);
  const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;document.body.append(file);

  const input=id=>$('pt-'+id);
  const numericKeys=['hvid','vvid','qFlat','qSteep','asymNT','asymSI','pupilDay','pupilNight','pupilX','pupilY','treatmentDiameter','treatmentX','treatmentY'];
  const ringKeys=['sag8Flat','sag8Steep','sag10Flat','sag10Steep'];
  const currentRecord=()=>sanitizeRecord({input:getParams(),meta});
  function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function persist(){if(!keep)return;try{localStorage.setItem(storage,JSON.stringify(makeSession(currentRecord(),cases)));}catch{toast('이 기기에 저장하지 못했습니다. JSON으로 저장해 주세요.');}}
  function exportSession(){download(makeSession(currentRecord(),cases),'cornea-lab-comparison.json');toast('현재 조건과 A/B를 JSON으로 저장했습니다.');}
  function sourceSummary(record){const values=Object.values(record.meta.sources),measured=values.filter(v=>v==='measured').length;return measured?`측정값 포함 항목군 ${measured}/5 · 부분 실측 기반 근사`:values.includes('entered')?'수기 입력 포함 · 근사 표면':'가정 기반 근사';}
  function ringKind(){const bfs=input('ring-kind').value==='bfs';$('patient-bfs-fields').hidden=!bfs;dialog.querySelector('.bfs-note').hidden=!bfs;input('bfsRadius').disabled=!bfs;input('apexElevation').disabled=!bfs;ringKeys.forEach(key=>{input(key).min=bfs?-1000:100;input(key).max=bfs?1000:key.includes('10')?6000:5000;});}
  function fillForm(){
    const p=getParams();input('label').value=meta.label;input('eye').value=p.eye;input('axl').value=meta.axl??'';input('q-range').value=meta.qRange;input('q-mode').value=meta.qMode;
    numericKeys.forEach(key=>{let v=key==='qFlat'?(p.qFlat??p.q):key==='qSteep'?(p.qSteep??p.q):p[key];if(meta.qMode==='e'&&key.startsWith('q'))v=v<=0?Math.sqrt(-v):'';input(key).value=v??'';});
    if(!meta.vvidMeasured)input('vvid').value='';input('pupilLight').value=p.pupilLight;input('treatment-source').value=meta.treatmentSource;
    for(const group of Object.keys(meta.sources))input('source-'+group).value=meta.sources[group];
    const ring=meta.ringForm;input('ring-kind').value=ring.kind;input('bfsRadius').value=ring.bfsRadius??'';input('apexElevation').value=ring.apexElevation??'';
    ringKeys.forEach(key=>input(key).value=ring.kind==='bfs'?(ring[key]??''):(p[key]??''));
    qModeLimits();ringKind();$('patient-error').hidden=true;
  }
  function qModeLimits(){for(const key of ['qFlat','qSteep']){input(key).min=input('q-mode').value==='e'?0:-1.5;input(key).max=input('q-mode').value==='e'?1.22:.5;}}
  input('q-mode').addEventListener('change',()=>{const e=input('q-mode').value==='e';for(const key of ['qFlat','qSteep']){const v=Number(input(key).value);input(key).value=e?(v<=0?fmt(Math.sqrt(-v),4):''):fmt(-v*v,4);}qModeLimits();});
  input('ring-kind').addEventListener('change',()=>{ringKeys.forEach(key=>input(key).value='');ringKind();});
  const groupFor={hvid:'size',vvid:'size',qFlat:'q',qSteep:'q',asymNT:'asym',asymSI:'asym',pupilDay:'pupil',pupilNight:'pupil',pupilX:'pupil',pupilY:'pupil',...Object.fromEntries(ringKeys.map(k=>[k,'rings'])),bfsRadius:'rings',apexElevation:'rings'};
  for(const [key,group] of Object.entries(groupFor))input(key).addEventListener('input',()=>{if(input('source-'+group).value==='assumed')input('source-'+group).value='entered';});
  $('patient-edit-btn').addEventListener('click',()=>{fillForm();dialog.showModal();});
  for(const id of ['close-patient','patient-cancel'])$(id).addEventListener('click',()=>dialog.close());
  $('patient-form').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const form=$('patient-form');if(!form.checkValidity()){const bad=[...form.querySelectorAll('input')].find(el=>!el.validity.valid);bad?.focus();throw new Error('숫자의 범위와 단위를 확인해 주세요.');}
      const next={...getParams()},m=clone(meta);m.label=input('label').value.trim()||'비교 자료';m.axl=input('axl').value===''?null:Number(input('axl').value);m.qMode=input('q-mode').value;m.qRange=input('q-range').value;
      numericKeys.forEach(key=>next[key]=input(key).value===''?null:Number(input(key).value));
      m.vvidMeasured=input('vvid').value!=='';if(!m.vvidMeasured)next.vvid=next.hvid;
      if(m.qMode==='e'){next.qFlat=-(next.qFlat**2);next.qSteep=-(next.qSteep**2);}
      next.eye=input('eye').value;next.pupilLight=input('pupilLight').value;
      m.treatmentSource=input('treatment-source').value;
      m.ringForm={kind:input('ring-kind').value,bfsRadius:input('bfsRadius').value===''?null:Number(input('bfsRadius').value),apexElevation:input('apexElevation').value===''?null:Number(input('apexElevation').value)};
      if(m.ringForm.kind==='sag'){m.ringForm.bfsRadius=null;m.ringForm.apexElevation=null;}
      for(const key of ringKeys){const raw=input(key).value===''?null:Number(input(key).value);m.ringForm[key]=raw;next[key]=raw;if(raw!==null&&m.ringForm.kind==='bfs'){if(m.ringForm.bfsRadius===null||m.ringForm.apexElevation===null)throw new Error('BFS 반경과 정점 elevation을 모두 입력해야 변환할 수 있습니다.');next[key]=elevationToSag(key.includes('10')?10:8,raw,m.ringForm.bfsRadius,m.ringForm.apexElevation);}}
      for(const key of Object.keys(m.sources))m.sources[key]=input('source-'+key).value;
      if(ringKeys.every(key=>next[key]===null))m.sources.rings='assumed';
      const record=sanitizeRecord({input:next,meta:m});
      if(!applyParams(record.input))throw new Error('표면을 계산하지 못했습니다. 주변부 높이와 각막 크기를 확인해 주세요.');
      meta=record.meta;update(getParams(),getFit());persist();dialog.close();toast('전안부 조건을 현재 모델에 적용했습니다.');
    }catch(error){$('patient-error').textContent=error.message;$('patient-error').hidden=false;}
  });

  function makeSnapshot(record){return record?{record,fit:sampleFit(record.input)}:null;}
  function setCases(next){const a=makeSnapshot(next.A),b=makeSnapshot(next.B);cases=next;snapshots={A:a,B:b};renderComparison();persist();}
  for(const s of ['A','B']){
    $('capture-'+s).addEventListener('click',()=>{try{const next={...cases,[s]:clone(currentRecord())};setCases(next);toast(`현재 조건을 ${s}에 담았습니다.`);}catch(error){toast(error.message);}});
    $('load-'+s).addEventListener('click',()=>{if(!cases[s])return;const record=clone(cases[s]);if(applyParams(record.input)){meta=record.meta;$('patient-kind').value=meta.kind;update(getParams(),getFit());toast(`${s} 조건을 불러왔습니다.`);}});
  }
  $('patient-kind').addEventListener('change',()=>{meta.kind=$('patient-kind').value;renderComparison();persist();});
  $('comparison-meridian').addEventListener('change',()=>{activeMeridian=$('comparison-meridian').value;drawComparisonProfile();});
  $('patient-export').addEventListener('click',exportSession);
  $('patient-print').addEventListener('click',()=>window.print());
  $('patient-import-btn').addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{try{const selected=file.files[0];if(!selected)return;if(selected.size>500000)throw new Error('500 KB 이하의 비교 JSON을 선택해 주세요.');const session=parseSession(await selected.text());const a=makeSnapshot(session.cases.A),b=makeSnapshot(session.cases.B);if(!applyParams(session.current.input))throw new Error('불러올 표면을 계산할 수 없습니다.');meta=session.current.meta;cases=session.cases;snapshots={A:a,B:b};$('patient-kind').value=meta.kind;renderComparison();update(getParams(),getFit());toast('비교 설정을 불러왔습니다.');}catch(error){toast(error.message);}finally{file.value='';}});
  $('patient-keep').checked=keep;
  $('patient-keep').addEventListener('change',()=>{keep=$('patient-keep').checked;try{localStorage.setItem(consent,String(keep));if(!keep)localStorage.removeItem(storage);else persist();}catch{toast('브라우저 저장소를 사용할 수 없습니다.');}});
  $('patient-demo').addEventListener('click',()=>{if(cases.A||cases.B)return;const a={input:{...defaultParams,flatK:42.5,steepK:44},meta:emptyMetadata()},b=clone(a);a.meta.label='가상 예제 A';b.meta.label='가상 예제 B';Object.assign(b.input,{hvid:11.2,vvid:11.4,qFlat:-.2,qSteep:-.5,asymNT:35,asymSI:-20,pupilNight:6.2,pupilX:.25});b.meta.axl=25.3;setCases({A:a,B:b});toast('실제 환자와 무관한 가상 예제를 표시합니다.');});

  function update(p,fit){
    if(!fit)return;
    const a=fit.anterior;
    $('patient-current-label').textContent=`${meta.label} · ${p.eye==='OD'?'OD 우안':'OS 좌안'}`;
    $('patient-current-context').textContent=`${meta.axl===null?'AXL 미입력':`AXL ${fmt(meta.axl,2)} mm · 기록용`} · ${p.pupilLight==='night'?'박명시':'명소시'} 동공 · 정점 기준 좌표`;
    $('pt-summary-size').textContent=`${fmt(p.hvid,2)} × ${fmt(p.vvid,2)} mm`;
    $('pt-summary-q').textContent=`${fmt(a.qFlat,2)} / ${fmt(a.qSteep,2)}`;
    $('pt-summary-ced').textContent=`${fmt(Math.abs(a.ced8),0)} µm`;
    $('pt-summary-asym').textContent=`${fmt(a.asymNT,0)} / ${fmt(a.asymSI,0)} µm`;
    $('pt-summary-pupil').textContent=`Ø${fmt(a.pupilDiameter)} · 중심 ${fmt(a.pupilToVertex,2)} mm`;
    $('patient-source-summary').textContent=sourceSummary({meta});
    $('patient-kind').value=meta.kind;persist();
  }

  function canvasSetup(id){const canvas=$(id),rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,rect.width),h=Math.max(1,rect.height);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return{ctx,w,h};}
  function drawFront(s){const{ctx,w,h}=canvasSetup(`slot-${s}-canvas`),snap=snapshots[s];if(w<=60||h<=35)return;if(!snap){ctx.fillStyle='#9aa9b1';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('현재 조건을 담으면 정면 비교가 표시됩니다.',w/2,h/2);return;}
    const p=snap.record.input,a=snap.fit.anterior,scale=Math.min((w-60)/15,(h-35)/15),cx=w/2,cy=h/2;
    const point=(x,y)=>[cx+x*scale,cy-y*scale];
    const ring=(x,y,rx,ry,color,dash=false,fill=null)=>{const q=point(x,y);ctx.beginPath();ctx.ellipse(q[0],q[1],rx*scale,ry*scale,0,0,Math.PI*2);ctx.setLineDash(dash?[4,3]:[]);ctx.strokeStyle=color;ctx.lineWidth=1.5;if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.stroke();ctx.setLineDash([]);};
    ring(0,0,p.hvid/2,p.vvid/2,'#6aa99e',false,'#eaf5f14d');ring(p.offsetX,p.offsetY,p.diameter/2,p.diameter/2,'#719bc5',true);ring(p.pupilX,p.pupilY,a.pupilDiameter/2,a.pupilDiameter/2,'#a678bb',false,'#ad8ab511');if(p.treatmentDiameter!==null)ring(p.treatmentX,p.treatmentY,p.treatmentDiameter/2,p.treatmentDiameter/2,'#c69952',true);
    ctx.strokeStyle='#687e89';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-4,cy);ctx.lineTo(cx+4,cy);ctx.moveTo(cx,cy-4);ctx.lineTo(cx,cy+4);ctx.stroke();
    const pupil=point(p.pupilX,p.pupilY);ctx.fillStyle='#9565ac';ctx.beginPath();ctx.arc(...pupil,2,0,Math.PI*2);ctx.fill();
    ctx.font='9px system-ui';ctx.fillStyle='#97a8b1';ctx.textAlign='center';ctx.fillText(p.eye==='OD'?'T':'N',cx-7*scale,cy+3);ctx.fillText(p.eye==='OD'?'N':'T',cx+7*scale,cy+3);ctx.fillText('S',cx,cy-7*scale);ctx.fillText('5 mm',w-40,h-6);ctx.beginPath();ctx.moveTo(w-40-2.5*scale,h-17);ctx.lineTo(w-40+2.5*scale,h-17);ctx.strokeStyle='#a4b7bf';ctx.stroke();
  }
  const rows=[
    ['HVID (mm)',s=>s.record.input.hvid,2],['수직 직경 (mm)',s=>s.record.input.vvid,2],['렌즈 직경 (mm)',s=>s.record.input.diameter,1],['렌즈/HVID (%)',s=>s.fit.anterior.lensToHvid*100,1],['Q Flat / Steep',s=>`${fmt(s.fit.anterior.qFlat,2)} / ${fmt(s.fit.anterior.qSteep,2)}`,null],
    ['Ø8 Flat 평균 Sag (µm)',s=>s.fit.anterior.sag8Flat,0],['Ø8 Steep 평균 Sag (µm)',s=>s.fit.anterior.sag8Steep,0],['Ø8 CED 절댓값 (µm)',s=>Math.abs(s.fit.anterior.ced8),0],['Ø10 Flat 평균 Sag (µm)',s=>s.fit.anterior.sag10Flat,0],['Ø10 Steep 평균 Sag (µm)',s=>s.fit.anterior.sag10Steep,0],
    ['비측−이측 높이 (µm)',s=>s.fit.anterior.asymNT,0],['상측−하측 높이 (µm)',s=>s.fit.anterior.asymSI,0],['표시 동공 직경 (mm)',s=>s.fit.anterior.pupilDiameter,1],['동공–정점 거리 (mm)',s=>s.fit.anterior.pupilToVertex,2],['동공–렌즈 중심 거리 (mm)',s=>s.fit.anterior.pupilToLens,2],['치료 영역–동공 겹침 (%)',s=>s.fit.anterior.pupilOverlap===null?null:s.fit.anterior.pupilOverlap*100,1],['렌즈 중심 간격 (µm)',s=>s.fit.metrics.centralGap,0],['유효 격자 비율 (%)',s=>s.fit.metrics.coverageFraction*100,1],['AXL · 기록용 (mm)',s=>s.record.meta.axl,2]
  ];
  function renderComparison(){
    for(const s of ['A','B']){const snap=snapshots[s];$('load-'+s).disabled=!snap;$(`slot-${s}-label`).textContent=snap?snap.record.meta.label:'아직 담은 조건이 없습니다';$(`slot-${s}-context`).textContent=snap?`${snap.record.input.eye} · K ${fmt(snap.record.input.flatK,2)} / ${fmt(snap.record.input.steepK,2)} D · BC ${fmt(snap.record.input.bc)} / RZD ${snap.record.input.rzd} / LZA ${snap.record.input.lza}°`:'현재 모델을 이 슬롯에 저장합니다.';$(`slot-${s}-source`).textContent=snap?sourceSummary(snap.record)+(snap.record.input.treatmentDiameter===null?'':` · 치료 영역: ${snap.record.meta.treatmentSource==='measured'?'착용 후 측정':'설명용 가정'}`):'';drawFront(s);}
    $('patient-demo').disabled=!!(cases.A||cases.B);
    $('comparison-values').replaceChildren(...rows.map(([label,get,d])=>{const row=document.createElement('tr'),head=document.createElement('th');head.scope='row';head.textContent=label;row.append(head);const values=['A','B'].map(s=>snapshots[s]?get(snapshots[s]):null);values.forEach((value,i)=>{const cell=document.createElement('td');cell.textContent=value===null?'—':d===null?value:fmt(value,d);const snap=snapshots[i?'B':'A'];if(snap&&label==='수직 직경 (mm)'&&!snap.record.meta.vvidMeasured){const note=document.createElement('small');note.textContent='가정 경계';cell.append(note);}if(snap&&label.includes('평균 Sag')){const key=`sag${label.includes('10')?'10':'8'}${label.includes('Flat')?'Flat':'Steep'}`;const note=document.createElement('small');note.textContent=!Number.isFinite(value)?'경계/범위 밖':snap.record.input[key]===null?'모델 추정':'입력값';cell.append(note);}if(snap&&label.includes('겹침')&&value!==null){const note=document.createElement('small');note.textContent=snap.record.meta.treatmentSource==='measured'?'측정 영역':'가정 영역';cell.append(note);}row.append(cell);});const delta=document.createElement('td');delta.textContent=d!==null&&values.every(v=>typeof v==='number'&&Number.isFinite(v))?`${values[1]-values[0]>0?'+':''}${fmt(values[1]-values[0],d)}`:'—';row.append(delta);return row;}));
    const paragraphs=[];
    if(snapshots.A&&snapshots.B){const a=snapshots.A.fit.anterior,b=snapshots.B.fit.anterior;paragraphs.push(`B − A: Ø8 mm 주경선 높이 차이 ${fmt(Math.abs(b.ced8)-Math.abs(a.ced8),0)} µm, 표시 동공 직경 ${fmt(b.pupilDiameter-a.pupilDiameter,1)} mm. 조건별 표면·위치 차이를 설명하는 값입니다.`);if(meta.kind==='time')paragraphs.push('착용 전/후 비교는 각각 입력한 측정값의 비교입니다. 치료 후 표면을 착용 전 조건에서 자동 예측한 결과가 아닙니다.');if(snapshots.A.record.input.eye!==snapshots.B.record.input.eye)paragraphs.push('OD/OS의 N/T 표시는 눈별로 바뀝니다. 단면은 각 자료의 주경선으로 표시되며 좌우눈을 자동 영상 정합하지 않습니다.');if(snapshots.A.record.input.pupilLight!==snapshots.B.record.input.pupilLight)paragraphs.push('A/B의 동공 조명 조건이 다릅니다. 같은 조명 조건으로 맞추면 직경을 비교하기 쉽습니다.');}
    else paragraphs.push('A와 B에 조건을 담으면 숫자 차이와 단면을 함께 비교할 수 있습니다.');
    $('comparison-explanation').replaceChildren(...paragraphs.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));drawComparisonProfile();
  }
  function drawComparisonProfile(){const{ctx,w,h}=canvasSetup('comparison-profile-canvas');if(w<=60||h<=40)return;const available=['A','B'].filter(s=>snapshots[s]);if(!available.length){ctx.fillStyle='#a5b1b8';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('A / B 조건을 먼저 담아 주세요.',w/2,h/2);return;}
    const series=available.map(s=>({s,data:snapshots[s].fit.meridians[activeMeridian]}));const values=series.flatMap(s=>s.data.flatMap(p=>[p.corneaZ,p.lensZ])).filter(Number.isFinite);const max=Math.max(...values)+.1,min=Math.min(...values)-.1,span=Math.max(...series.flatMap(s=>s.data.map(p=>Math.abs(p.r))));const left=32,right=12,top=14,bottom=26;const X=x=>left+(x+span)/(2*span)*(w-left-right),Y=y=>top+(max-y)/(max-min)*(h-top-bottom);
    ctx.font='9px system-ui';ctx.fillStyle='#a6b1b8';ctx.textAlign='right';for(let y=Math.ceil(min);y<=max;y++){ctx.beginPath();ctx.moveTo(left,Y(y));ctx.lineTo(w-right,Y(y));ctx.strokeStyle='#edf1f4';ctx.lineWidth=1;ctx.stroke();ctx.fillText(y,left-7,Y(y)+3);}ctx.textAlign='center';for(let x=-Math.floor(span/2)*2;x<=span;x+=2)ctx.fillText(x,X(x),h-7);
    for(const{data,s}of series)for(const key of ['corneaZ','lensZ']){ctx.beginPath();let started=false;for(const p of data){if(!Number.isFinite(p[key])){started=false;continue;}if(!started){ctx.moveTo(X(p.r),Y(p[key]));started=true;}else ctx.lineTo(X(p.r),Y(p[key]));}ctx.strokeStyle=s==='A'?'#278f80':'#6a91c6';ctx.lineWidth=key==='corneaZ'?2:1.3;ctx.setLineDash(key==='lensZ'?[4,3]:[]);ctx.stroke();ctx.setLineDash([]);}
  }
  const resize=new ResizeObserver(()=>{drawFront('A');drawFront('B');drawComparisonProfile();});for(const id of ['slot-A-canvas','slot-B-canvas','comparison-profile-canvas'])resize.observe($(id).parentElement);
  if(keep){try{const raw=localStorage.getItem(storage);if(raw){const session=parseSession(raw);const a=makeSnapshot(session.cases.A),b=makeSnapshot(session.cases.B);if(applyParams(session.current.input)){meta=session.current.meta;cases=session.cases;snapshots={A:a,B:b};}}}catch{toast('보관된 비교 설정을 읽지 못했습니다. 기본값을 표시합니다.');}}
  renderComparison();update(getParams(),getFit());
  return{update,exportSession,markCommonQ(){meta.sources.q='entered';meta.qMode='q';},resetMetadata(){meta=emptyMetadata();update(getParams(),getFit());},dispose(){resize.disconnect();}};
}
