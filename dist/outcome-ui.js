import {emptyOutcome,sanitizeOutcome,outcomeMetrics,sphericalEquivalent,meanK} from './fitting-effects.js?v=7';
import {circleOverlapFraction} from './geometry.js?v=7';

const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'—';
const signed=v=>Number.isFinite(v)?(v>0?'+':'')+v.toFixed(2):'—';
const visits=[['before','착용 전'],['after','착용 후']];
const fields=[['sphere','구면 S','D',-30,30],['cylinder','원주 C · ±표기 가능','D',-15,15],['axis','난시 축 · 선택','°',0,180],['flatK','Topo Flat K','D',20,65],['steepK','Topo Steep K','D',20,65],['steepAxis','Topo Steep axis · 선택','°',0,180]];
const input=(key,label,unit,min,max,type='number')=>`<label class="patient-field">${label}<span class="patient-number"><input id="oc-${key}" type="${type}" ${type==='number'?`min="${min}" max="${max}" step="any"`:''}><span>${unit}</span></span></label>`;
export function createOutcomePanel({getData,getParams,onSave,onBuildModels,onApplyZone}){
  const panel=document.createElement('section');panel.id='outcome-panel';panel.className='outcome-panel panel';
  panel.innerHTML=`<div class="effects-heading"><div><div class="eyebrow">FOLLOW-UP · ENTERED MEASUREMENTS</div><h2>착용 전후 실제 교정 정도</h2><p>같은 눈의 실측 굴절도수와 Topo 요약값을 직접 입력합니다.</p></div><button class="button primary" id="outcome-edit">전·후 측정값 입력</button></div><p id="outcome-context" class="effects-context"></p><div class="outcome-stats"><div><span>SE 변화 · 후 − 전</span><strong id="outcome-se">—</strong><small>D</small><p id="outcome-se-context">S와 C를 모두 입력하면 계산합니다.</p></div><div><span>평균 K 감소 · 전 − 후</span><strong id="outcome-k">—</strong><small>D</small><p id="outcome-k-context">양수: 입력한 평균 K가 평탄해짐</p></div><div><span>착용 후 치료 영역 직경</span><strong id="outcome-zone">—</strong><small>mm</small><p>렌즈 BC 직경과 별도인 측정 영역</p></div></div><p id="outcome-warning" class="effects-warning" hidden></p><div class="outcome-body"><div class="comparison-table-wrap"><table class="comparison-table outcome-table"><caption>실측 수기 입력값 · 빈칸은 0으로 처리하지 않습니다</caption><thead><tr><th>항목</th><th>착용 전</th><th>착용 후</th></tr></thead><tbody id="outcome-values"></tbody></table></div><div class="outcome-visual"><canvas id="outcome-zone-canvas" aria-label="측정한 치료 영역과 현재 동공의 정면 비교"></canvas><p id="outcome-overlap"></p><button id="outcome-apply-zone" class="button subtle">측정 영역을 현재 3D에 표시</button><p class="effects-help">3D 반영에는 직경과 정점 기준 중심 X/Y가 모두 필요합니다. 중심 미입력 시 아래 계산에 중앙 정렬을 대신 가정하지 않습니다.</p></div></div><div class="outcome-footer"><button id="outcome-build-models" class="button subtle">현재 A/B를 전·후 K 근사 모델로 교체</button><p>전후 Flat/Steep K 네 값이 모두 35~55 D일 때 사용할 수 있습니다. 입력 K로 만든 비교용 근사 표면입니다. Q=−0.25, 미입력 축=90°로 가정하고 주변부 높이·비대칭은 초기화합니다. 실제 전체 Topo 차이지도가 아닙니다.</p></div><p class="effects-help">SE = S + C/2. 근시안에서 양의 SE 변화는 근시 감소 방향입니다. 평균 K=(Flat+Steep)/2이며 SE 변화와 같은 값이 아닙니다. 검사 방법·정점거리·Topo 평가 구역·렌즈 제거 후 시간을 맞춰 해석하세요. 표면장력 수치에서 계산한 교정량이 아니며 AXL의 근시 진행 억제 효과를 뜻하지 않습니다.</p>`;
  document.querySelector('#patient-comparison').before(panel);
  const dialog=document.createElement('dialog');dialog.id='outcome-dialog';dialog.setAttribute('aria-labelledby','outcome-dialog-title');
  dialog.innerHTML=`<div class="dialog-heading"><div class="eyebrow">MEASURED FOLLOW-UP</div><button id="outcome-close" class="icon-button" aria-label="전후 측정 입력 닫기">×</button><h2 id="outcome-dialog-title">착용 전·후 측정값</h2><p>같은 환자·같은 눈의 검사값을 입력합니다. 입력값은 브라우저 안에서만 처리됩니다.</p></div><form id="outcome-form" class="dialog-body"><label class="patient-field">측정한 눈<select id="oc-eye"><option value="OD">OD 우안</option><option value="OS">OS 좌안</option></select></label><div class="outcome-visit-grid">${visits.map(([phase,label])=>`<section><h3>${label}</h3>${input(phase+'Date','측정 날짜','','','','date')}<div class="patient-form-grid">${fields.map(([key,label,unit,min,max])=>input(phase+'-'+key,label,unit,min,max)).join('')}</div></section>`).join('')}</div><p class="patient-help">SE 계산에는 S와 C를 함께 입력하세요. 난시가 없음을 확인했다면 C=0으로 입력합니다. K 감소량은 전후 Flat/Steep K 네 값이 모두 있어야 계산합니다. Topo 축은 굴절검사 난시 축과 별개입니다.</p><section class="patient-input-group"><h3>착용 후 측정한 치료 영역</h3><div class="patient-form-grid">${input('zoneDiameter','직경','mm',1,9)}${input('zoneX','중심 X · 오른쪽(+)','mm',-3,3)}${input('zoneY','중심 Y · 위쪽(+)','mm',-3,3)}</div><p class="patient-help">정점 기준 정면 관찰자 좌표입니다. 중심을 측정하지 않았다면 비워 두세요. 3D 표시 범위는 직경 1~8 mm, 중심 ±2 mm입니다. 영역 직경만 있어도 실제 교정 비교에는 기록할 수 있습니다.</p></section><div class="patient-form-grid">${input('wearDays','착용 기간','일',0,20000)}${input('removalHours','렌즈 제거 후 측정까지','시간',0,168)}</div><label class="patient-field">검사 조건 메모 · 선택<input id="oc-conditions" type="text" maxlength="120" placeholder="예: 자각굴절, 같은 정점거리 / 동일 장비 중심 3 mm K"></label><p id="outcome-input-error" class="input-error" role="alert" hidden></p><div class="recommend-actions"><button type="button" class="button subtle" id="outcome-cancel">닫기</button><button type="submit" class="button primary">실측 비교에 적용</button></div></form>`;
  document.body.append(dialog);
  const $=id=>document.getElementById(id),numberKeys=['zoneDiameter','zoneX','zoneY','wearDays','removalHours'];
  $('outcome-edit').addEventListener('click',()=>{
    const data=getData();$('oc-eye').value=data.eye??getParams().eye;
    for(const[phase]of visits)for(const[key]of fields)$('oc-'+phase+'-'+key).value=data[phase][key]??'';
    for(const key of [...numberKeys,'beforeDate','afterDate','conditions'])$('oc-'+key).value=data[key]??'';
    $('outcome-input-error').hidden=true;dialog.showModal();
  });
  for(const id of ['outcome-close','outcome-cancel'])$(id).addEventListener('click',()=>dialog.close());
  $('outcome-form').addEventListener('submit',event=>{
    event.preventDefault();try{
      const data=emptyOutcome(),read=id=>$(id).value===''?null:Number($(id).value);data.eye=$('oc-eye').value;
      for(const[phase]of visits)for(const[key]of fields)data[phase][key]=read('oc-'+phase+'-'+key);
      for(const key of numberKeys)data[key]=read('oc-'+key);
      for(const key of ['beforeDate','afterDate','conditions'])data[key]=$('oc-'+key).value;
      onSave(sanitizeOutcome(data));dialog.close();
    }catch(error){$('outcome-input-error').textContent=error.message;$('outcome-input-error').hidden=false;}
  });
  $('outcome-build-models').addEventListener('click',()=>onBuildModels());$('outcome-apply-zone').addEventListener('click',()=>onApplyZone());
  let currentData=emptyOutcome(),params=getParams();
  function draw(){
    const canvas=$('outcome-zone-canvas'),box=canvas.getBoundingClientRect(),w=box.width,h=box.height;if(w<60||h<40)return;
    const ratio=Math.min(devicePixelRatio||1,2);canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
    const m=outcomeMetrics(currentData,params.eye),d=m.data;
    ctx.font='11px system-ui';ctx.fillStyle='#91a1ac';ctx.textAlign='center';
    if(!m.sameEye||d.zoneDiameter===null){ctx.fillText('치료 영역 직경을 입력해 주세요.',w/2,h/2);return;}
    const located=d.zoneX!==null&&d.zoneY!==null,scale=Math.min(w/20,h/18),cx=w/2,cy=h/2;
    const circle=(x,y,r,color,dash)=>{ctx.beginPath();ctx.arc(cx+x*scale,cy-y*scale,r*scale,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash?[4,3]:[]);ctx.stroke();ctx.setLineDash([]);};
    if(located){const pupil=params.pupilLight==='day'?params.pupilDay:params.pupilNight;circle(params.pupilX,params.pupilY,pupil/2,'#a678bb',false);}
    circle(located?d.zoneX:0,located?d.zoneY:0,d.zoneDiameter/2,'#c69952',true);
    ctx.fillText(located?'주황: 치료 영역 · 보라: 현재 동공':'중심 미측정 · 직경만 도식 표시',w/2,h-9);
    ctx.fillText('Ø'+fmt(d.zoneDiameter,2)+' mm',w/2,19);
  }
  const observer=new ResizeObserver(draw);observer.observe($('outcome-zone-canvas').parentElement);
  return {update(raw,p){
    currentData=sanitizeOutcome(raw);params=p;const m=outcomeMetrics(currentData,p.eye),d=m.data;
    $('outcome-se').textContent=signed(m.seChange);$('outcome-k').textContent=signed(m.kReduction);$('outcome-zone').textContent=m.sameEye?fmt(d.zoneDiameter):'—';
    $('outcome-se-context').textContent=`전 ${m.sameEye?fmt(m.preSE):'—'} → 후 ${m.sameEye?fmt(m.postSE):'—'} D`;
    $('outcome-k-context').textContent=`전 ${m.sameEye?fmt(m.preK):'—'} → 후 ${m.sameEye?fmt(m.postK):'—'} D · 양수는 평탄화`;
    $('outcome-context').textContent=d.eye?`${d.eye} 실측 수기 입력 · ${d.beforeDate||'전 날짜 미입력'} → ${d.afterDate||'후 날짜 미입력'} · 착용 ${d.wearDays===null?'—':d.wearDays}일 · 제거 후 ${d.removalHours===null?'—':d.removalHours}시간${d.conditions?' · '+d.conditions:''}`:'실측 자료 미입력 · 모델의 기본 K값을 측정값으로 대신 사용하지 않습니다.';
    $('outcome-warning').hidden=!d.eye||m.sameEye;$('outcome-warning').textContent='측정 자료와 현재 모델의 우안/좌안이 다릅니다. 비교 결과와 3D 적용을 표시하지 않습니다.';
    const rows=[['구면 S (D)',v=>v.sphere],['원주 C (D)',v=>v.cylinder],['난시 축 (°)',v=>v.axis],['구면등가 SE (D)',sphericalEquivalent],['Topo Flat K (D)',v=>v.flatK],['Topo Steep K (D)',v=>v.steepK],['Topo Steep axis (°)',v=>v.steepAxis],['평균 K (D)',meanK]];
    $('outcome-values').replaceChildren(...rows.map(([label,get])=>{const row=document.createElement('tr'),head=document.createElement('th');head.scope='row';head.textContent=label;row.append(head);for(const[phase]of visits){const cell=document.createElement('td');cell.textContent=m.sameEye?fmt(get(d[phase]),label.includes('°')?0:2):'—';row.append(cell);}return row;}));
    const positioned=m.sameEye&&d.zoneDiameter!==null&&d.zoneX!==null&&d.zoneY!==null;
    const pupil=p.pupilLight==='day'?p.pupilDay:p.pupilNight;
    $('outcome-overlap').textContent=positioned?`측정 영역과 현재 동공의 평면 겹침 ${fmt(circleOverlapFraction(pupil/2,d.zoneDiameter/2,Math.hypot(p.pupilX-d.zoneX,p.pupilY-d.zoneY))*100,1)}% · 동공은 현재 입력 조건`:'중심 좌표 미입력 시 동공 겹침은 계산하지 않습니다.';
    $('outcome-apply-zone').disabled=!(positioned&&d.zoneDiameter<=8&&Math.abs(d.zoneX)<=2&&Math.abs(d.zoneY)<=2);
    $('outcome-build-models').disabled=!(m.sameEye&&m.preK!==null&&m.postK!==null&&[d.before.flatK,d.before.steepK,d.after.flatK,d.after.steepK].every(k=>k>=35&&k<=55));
    draw();
  },dispose(){observer.disconnect();}};
}
