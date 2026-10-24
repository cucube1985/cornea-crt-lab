import {defaultParams,corneaZ,lensZ,lensSag,sampleFit} from './geometry.js?v=5';
import {createViewer} from './renderer.js?v=5';
import {calculatorLinks,resultFields,parseCalculatorText} from './recommend.js';
import {createPatientWorkspace} from './patient-ui.js?v=5';
import {modelModes,modelParameters} from './model-modes.js?v=5';

const $=id=>document.getElementById(id);
const BASE={...defaultParams,flatK:42.5,steepK:44,clearance:.020};
const numberKeys=['flatK','steepK','steepAxis','q','bc','rzd','lza','offsetX','offsetY','tiltX','tiltY','clearance'];
let params={...BASE},fit,model='advanced',mode='fit',meridian='flat',viewer,updateTimer,toastTimer,patientWorkspace;
const options={mode,scale:1,exploded:false,wireframe:false,showClearance:false,showAxes:true,showPupil:true};
const viewOptions=()=>({...options,showPupil:model==='advanced'&&options.showPupil,showClearance:mode==='fit'&&options.showClearance,exploded:mode==='fit'&&options.exploded});
function updateViewer(){if(fit)viewer?.update(fit.params,fit,viewOptions());}

// Patient inputs stay in memory unless the comparison panel's device-storage option is enabled.

function format(n,digits=0){return Number.isFinite(n)?n.toFixed(digits):'—';}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function syncInputs(){
  numberKeys.forEach(key=>{$(key).value=key==='clearance'?Math.round(params.clearance*1000):params[key];});
  $('autoSeat').checked=params.autoSeat;$('clearance').disabled=params.autoSeat;
  for(const key of ['steepAxis','bc']){$(key+'-range').value=params[key];paintRange($(key+'-range'));}
  document.querySelectorAll('[data-diameter]').forEach(button=>{const active=Number(button.dataset.diameter)===params.diameter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function paintRange(input){input.style.setProperty('--progress',((Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');}
function clearPreset(){document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('selected'));}
function validate(){
  const reversed=model!=='ok'&&params.flatK>params.steepK;
  $('flatK').setAttribute('aria-invalid',String(reversed));$('steepK').setAttribute('aria-invalid',String(reversed));
  $('input-error').hidden=!reversed;
  return !reversed;
}
function schedule(){clearTimeout(updateTimer);updateTimer=setTimeout(recalculate,35);}
function recalculate(){
  if(!validate())return false;
  try{
    fit=sampleFit(modelParameters(params,model));
    updateViewer();
    updateReadout();drawProfile();drawMap();
    if(model==='advanced')patientWorkspace?.update(params,fit);
    return true;
  }catch(error){toast('모델을 계산할 수 없습니다. 입력 범위를 확인해 주세요.');console.error(error);return false;}
}
function updateReadout(){
  const p=fit.params,m=fit.metrics;
  updateSceneLegend();
  $('flat-radius').textContent=format(fit.radii.flat,2);$('steep-radius').textContent=format(fit.radii.steep,2);
  $('flat-axis').textContent=format(p.flatAxis)+'°';$('astig-value').textContent=format(p.steepK-p.flatK,2);
  $('axis-summary').textContent=`Flat ${format(p.flatAxis)}° / Steep ${format(p.steepAxis)}°`;
  $('central-gap').textContent=format(m.centralGap);$('edge-gap').textContent=format(m.edgeGap);
  $('profile-axis').textContent=`${format(p[meridian==='flat'?'flatAxis':'steepAxis'])}° 주경선 · 단위 mm`;
  const insights=[];
  if(m.penetrationFraction>0.0001){insights.push({tone:'rose',title:'표면 간섭이 계산됩니다',body:`격자 면적의 ${format(m.penetrationFraction*100,1)}%에서 간격이 음수입니다. 수동 높이를 조절해 두 표면의 관계를 비교하세요.`});}
  else if(params.autoSeat){insights.push({tone:'',title:'수직 이동으로 배치한 상태',body:`샘플 최소 간격 ${format(m.minGap,1)} µm. 실제 눈 위의 안착 위치나 피팅 적합도를 의미하지 않습니다.`});}
  else{insights.push({tone:'',title:'수동 높이로 배치한 상태',body:`샘플 최소 간격 ${format(m.minGap,1)} µm. 꼭짓점 높이를 바꾸면 지도와 단면이 함께 변합니다.`});}
  if(Math.hypot(params.offsetX,params.offsetY)>.05 || Math.abs(params.tiltX)+Math.abs(params.tiltY)>.1){insights.push({tone:'amber',title:'원주 방향 간격의 차이',body:`반경 ${format(m.asymmetryRadius,1)} mm 원에서 최대−최소 ${format(m.asymmetry)} µm. 이동·기울기는 사용자가 설정한 정적 조건입니다.`});}
  else{insights.push({tone:'',title:'두 주경선의 높이 차이',body:`반경 4 mm에서 각막 높이 차이 ${format(Math.abs(m.elevationDifference))} µm. 회전대칭 렌즈와 난시 각막 사이의 간격을 비교해 보세요.`});}
  if(m.coverageFraction<.999){insights.push({tone:'rose',title:'각막 경계 밖 또는 계산 불가 영역',body:`렌즈 격자의 ${format((1-m.coverageFraction)*100,1)}%가 각막 경계 또는 수학 영역 밖입니다. 지도 빈 영역과 해당 부분은 분석에서 제외됩니다.`});}
  const a=fit.anterior;
  $('pupil-distance').textContent=format(a.pupilToLens,2);
  $('pupil-overlap').textContent=a.pupilOverlap===null?'—':format(a.pupilOverlap*100,1);
  $('pupil-overlap-note').textContent=p.treatmentDiameter===null?'치료 영역 미입력 · BC 직경을 대신 쓰지 않습니다.':'별도 입력한 치료 영역과의 평면 겹침 · 시력 예측 아님';
  $('insights').replaceChildren(...insights.map(item=>{const div=document.createElement('div');div.className='insight '+item.tone;const strong=document.createElement('strong');strong.textContent=item.title;const paragraph=document.createElement('p');paragraph.textContent=item.body;div.append(strong,paragraph);return div;}));
}
function updateSceneLegend(){
  const spans=document.querySelectorAll('.scene-legend>span');spans[0].hidden=mode==='lens';spans[1].hidden=mode==='cornea';
  $('pupil-legend').hidden=!viewOptions().showPupil||mode==='lens';
  $('treatment-legend').hidden=!viewOptions().showPupil||mode==='lens'||fit.params.treatmentDiameter===null;
}

// A single distance palette is used in the 2D map and the 3D surface overlay.
const stops=[[-5,[231,96,87]],[2,[244,181,91]],[25,[131,212,182]],[100,[84,191,201]],[250,[70,125,204]]];
function gapColor(gap){
  if(gap<=stops[0][0])return stops[0][1];
  for(let i=1;i<stops.length;i++)if(gap<=stops[i][0]){const t=(gap-stops[i-1][0])/(stops[i][0]-stops[i-1][0]);return stops[i][1].map((v,j)=>Math.round(stops[i-1][1][j]+t*(v-stops[i-1][1][j])));}
  return stops.at(-1)[1];
}
function setupCanvas(canvas){
  const box=canvas.getBoundingClientRect();const ratio=Math.min(window.devicePixelRatio||1,2);
  const width=Math.max(1,box.width),height=Math.max(1,box.height);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);return{ctx,width,height};
}
function drawMap(){
  if(!fit||$('gap-canvas').closest('[hidden]'))return;
  const {ctx,width:w,height:h}=setupCanvas($('gap-canvas'));const radius=Math.min(w,h)*.418,cx=w/2,cy=h/2;
  const grid=fit.grid,n=grid.size,cell=2*radius/(n-1);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.clip();
  for(let row=0;row<n;row++)for(let col=0;col<n;col++){
    const gap=grid.values[row*n+col];if(gap===null||!Number.isFinite(gap))continue;
    ctx.fillStyle=`rgb(${gapColor(gap).join(',')})`;ctx.fillRect(cx-radius+col*cell-cell/2,cy+radius-row*cell-cell/2,cell+.3,cell+.3);
  }
  ctx.restore();
  for(const r of [3,4,params.diameter/2]){ctx.beginPath();ctx.arc(cx,cy,r/(params.diameter/2)*radius,0,Math.PI*2);ctx.strokeStyle=r===params.diameter/2?'#bccbd2':'#ffffff80';ctx.lineWidth=.7;ctx.stroke();}
  ctx.strokeStyle='#f8fdff85';ctx.lineWidth=.6;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(cx-radius,cy);ctx.lineTo(cx+radius,cy);ctx.moveTo(cx,cy-radius);ctx.lineTo(cx,cy+radius);ctx.stroke();ctx.setLineDash([]);
  const theta=fit.params.steepAxis*Math.PI/180;ctx.beginPath();ctx.moveTo(cx-Math.cos(theta)*radius,cy+Math.sin(theta)*radius);ctx.lineTo(cx+Math.cos(theta)*radius,cy-Math.sin(theta)*radius);ctx.strokeStyle='#ffffffc0';ctx.lineWidth=.85;ctx.stroke();
  // The cross marks the corneal apex relative to the lens-local footprint.
  const ax=cx-params.offsetX/(params.diameter/2)*radius,ay=cy+params.offsetY/(params.diameter/2)*radius;
  ctx.strokeStyle='#365561';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ax-3,ay);ctx.lineTo(ax+3,ay);ctx.moveTo(ax,ay-3);ctx.lineTo(ax,ay+3);ctx.stroke();
  if(viewOptions().showPupil){
    const projected=(x,y,r,color,dash=false)=>{ctx.beginPath();ctx.arc(cx+(x-params.offsetX)/(params.diameter/2)*radius,cy-(y-params.offsetY)/(params.diameter/2)*radius,r/(params.diameter/2)*radius,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.setLineDash(dash?[3,2]:[]);ctx.stroke();ctx.setLineDash([]);};
    projected(params.pupilX,params.pupilY,fit.anterior.pupilDiameter/2,'#9260af');
    if(params.treatmentDiameter!==null)projected(params.treatmentX,params.treatmentY,params.treatmentDiameter/2,'#b98540',true);
  }
}
function drawProfile(){
  if(!fit)return;
  const {ctx,width:w,height:h}=setupCanvas($('profile-canvas'));const data=fit.meridians[meridian];
  const margin={left:33,right:10,top:17,bottom:22},cw=w-margin.left-margin.right,ch=h-margin.top-margin.bottom;
  const span=Math.max(...data.map(s=>Math.abs(s.r)));
  const all=data.flatMap(s=>mode==='cornea'?[s.corneaZ]:mode==='lens'?[s.lensZ]:[s.corneaZ,s.lensZ]).filter(Number.isFinite);
  const min=Math.min(...all)-.1,max=Math.max(...all)+.12;
  const X=x=>margin.left+(x+span)/(span*2)*cw,Y=y=>margin.top+(max-y)/(max-min)*ch;
  ctx.font='8px "DM Sans",sans-serif';ctx.fillStyle='#acb7c0';ctx.textAlign='right';ctx.textBaseline='middle';
  const step=(max-min)>4?1:.5;
  for(let value=Math.ceil(min/step)*step;value<=max;value+=step){
    const y=Y(value);ctx.strokeStyle='#eef2f4';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(margin.left,y);ctx.lineTo(w-margin.right,y);ctx.stroke();ctx.fillText(value===0?'0':value.toFixed(1),margin.left-8,y);
  }
  ctx.textAlign='center';for(let x=-Math.floor(span/2)*2;x<=span;x+=2){const px=X(x);ctx.fillText(x===0?'0':x.toFixed(0),px,h-7);ctx.strokeStyle='#f0f3f5';ctx.beginPath();ctx.moveTo(px,margin.top);ctx.lineTo(px,h-margin.bottom);ctx.stroke();}
  const pathFor=key=>{ctx.beginPath();let started=false;data.forEach(s=>{if(!Number.isFinite(s[key])){started=false;return;}if(!started){ctx.moveTo(X(s.r),Y(s[key]));started=true;}else ctx.lineTo(X(s.r),Y(s[key]));});};
  // Shaded central optic and return-zone chord guides, referenced to lens pose.
  const angle=fit.params[meridian==='flat'?'flatAxis':'steepAxis']*Math.PI/180;
  const along=fit.params.offsetX*Math.cos(angle)+fit.params.offsetY*Math.sin(angle);
  const perpendicular=-fit.params.offsetX*Math.sin(angle)+fit.params.offsetY*Math.cos(angle);
  for(const r of mode==='cornea'?[]:[4,3])if(Math.abs(perpendicular)<r){const half=Math.sqrt(r*r-perpendicular*perpendicular);ctx.fillStyle=r===4?'#d8e7f515':'#e0f0ed30';ctx.fillRect(X(along-half),margin.top,X(along+half)-X(along-half),ch);}
  if(mode!=='lens'){pathFor('corneaZ');ctx.lineWidth=1.8;ctx.strokeStyle='#62a99e';ctx.stroke();}
  if(mode!=='cornea'){pathFor('lensZ');ctx.lineWidth=1.7;ctx.strokeStyle='#7f9fc9';ctx.stroke();}
  ctx.setLineDash([3,4]);ctx.strokeStyle='#c8d8de';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(X(0),margin.top);ctx.lineTo(X(0),h-margin.bottom);ctx.stroke();ctx.setLineDash([]);
  ctx.textAlign='left';ctx.font='7px "DM Sans",sans-serif';ctx.fillStyle='#afbac2';ctx.fillText('z',9,margin.top-6);ctx.textAlign='right';ctx.fillText('r',w-3,h-7);
}

function setMode(next){
  mode=model==='advanced'?next:modelModes[model].view;options.mode=mode;
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));});
  const text={cornea:['CORNEAL SURFACE','곡률이 만드는 각막 형태','추가 전안부 조건을 반영한 근사 각막 전면'],lens:['CRT LENS DESIGN','세 구역, 하나의 렌즈','BC · Return zone · Landing zone의 후면 구조'],fit:['CORNEA × CRT','두 표면 사이의 공간','각막 전면과 렌즈 후면의 기하학적 관계']}[mode];
  $('scene-kicker').textContent=modelModes[model].name.toUpperCase()+' / '+text[0];$('scene-title').textContent=text[1];$('scene-description').textContent=model==='advanced'?text[2]:model==='ok'?'BC · RZD · LZA · 직경으로 구성한 렌즈 후면':model==='basic'?'Flat K · Steep K · 축 / Q −0.25 · 직경 11.8 mm 고정':'Basic 각막과 CRT 렌즈 사이의 정적 수직 간격';
  updateModelPanels();updateViewer();drawProfile();
  if(fit){updateSceneLegend();drawMap();}
}
function updateModelPanels(){
  const advanced=model==='advanced',fitting=mode==='fit';
  document.body.dataset.model=model;
  const hide=(selector,hidden)=>document.querySelectorAll(selector).forEach(el=>el.hidden=hidden);
  hide('#patient-summary,#patient-comparison,#export-btn,#cornea-section .advanced',!advanced);
  hide('.mode-tabs',!advanced);$('model-view-label').hidden=advanced;$('model-view-label').textContent=modelModes[model].name+' 모델';
  hide('#cornea-section',model==='ok');hide('#lens-section',model==='basic');hide('.fit-section,.scenario-bar',!fitting);
  hide('#recommend-btn',!advanced);hide('.analysis-column',mode==='lens');
  hide('.analysis-panel .metric-grid,.analysis-panel .metric-context,.map-panel,.insights-panel',!fitting);
  for(const id of ['exploded','showClearance'])$(id).closest('label').hidden=!fitting;
  $('showPupil').closest('label').hidden=!advanced||mode==='lens';
  $('exploded-note').hidden=!fitting||!options.exploded;
  $('profile-series').innerHTML=(mode!=='lens'?'<i class="line-key cornea-line"></i>각막 전면':'')+(mode!=='cornea'?'<i class="line-key lens-line"></i>렌즈 후면':'');
  document.querySelector('.profile-panel h2').textContent=mode==='lens'?'렌즈 중심 단면':'주경선 단면';
  document.querySelector('[aria-label="단면 주경선"]').hidden=mode==='lens';
  $('profile-description').textContent=mode==='cornea'?(advanced?'추가 전안부 조건을 반영한 각막 전면':'ARK 두 주경선의 각막 전면'):mode==='lens'?'CRT 렌즈 후면의 중심 단면':'같은 축에서 비교하는 두 표면';
  $('profile-canvas').setAttribute('aria-label',mode==='cornea'?'각막 전면 단면 그래프':mode==='lens'?'렌즈 후면 단면 그래프':'각막 및 렌즈 단면 그래프');
  $('gap-description').textContent='색: 수직 간격 · ＋: 각막 정점'+(advanced?' · 보라: 동공 투영':'')+' / 빈 영역: 계산 불가 · 형광 패턴 아님';
}
function selectModel(next){
  if(!Object.hasOwn(modelModes,next))return;
  if(params.flatK>params.steepK){validate();toast('Steep K를 Flat K 이상으로 입력한 뒤 모델을 선택해 주세요.');return;}
  const previous=model,previousMode=mode;model=next;setMode(modelModes[model].view);
  if(!recalculate()){model=previous;setMode(previousMode);recalculate();return;}
  document.querySelectorAll('button[data-model]').forEach(button=>{const active=button.dataset.model===model;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('model-description').textContent=modelModes[model].description;
}
const error=document.createElement('p');error.id='input-error';error.hidden=true;error.className='input-error';error.setAttribute('role','alert');error.textContent='Steep K를 Flat K 이상으로 입력해 주세요. 모델은 마지막 유효한 값으로 표시됩니다.';$('cornea-section').querySelector('.radii-note').after(error);

numberKeys.forEach(key=>{
  const input=$(key);
  input.addEventListener('input',()=>{
    if(input.value.trim()==='')return;
    const value=Number(input.value);
    if(!Number.isFinite(value)||value<Number(input.min)||value>Number(input.max))return;
    params[key]=key==='clearance'?value/1000:value;
    if(key==='q'){params.qFlat=null;params.qSteep=null;patientWorkspace?.markCommonQ();}
    if(['steepAxis','bc'].includes(key)){$(key+'-range').value=value;paintRange($(key+'-range'));}
    clearPreset();schedule();
  });
  const normalizeInput=()=>{
    if(input.value.trim()===''){input.value=key==='clearance'?params[key]*1000:params[key];return;}
    if(!input.validity.valid){
      const low=Number(input.min),high=Number(input.max),step=Number(input.step),value=Number(input.value);
      if(Number.isFinite(value)){
        const corrected=Number(Math.max(low,Math.min(high,low+Math.round((value-low)/step)*step)).toFixed(5));
        params[key]=key==='clearance'?corrected/1000:corrected;input.value=corrected;
        if(['steepAxis','bc'].includes(key)){$(key+'-range').value=corrected;paintRange($(key+'-range'));}
        schedule();toast('입력값을 표시 범위와 증감 단위에 맞췄습니다.');
      }else input.value=key==='clearance'?params[key]*1000:params[key];
    }
  };
  input.addEventListener('change',normalizeInput);
  input.addEventListener('blur',normalizeInput);
});
for(const key of ['steepAxis','bc'])$(key+'-range').addEventListener('input',event=>{params[key]=Number(event.target.value);$(key).value=params[key];paintRange(event.target);clearPreset();schedule();});
$('autoSeat').addEventListener('change',()=>{params.autoSeat=$('autoSeat').checked;$('clearance').disabled=params.autoSeat;if(!params.autoSeat&&fit){params.clearance=Math.max(-.1,Math.min(.5,Math.round(fit.clearance*1000/5)*5/1000));$('clearance').value=Math.round(params.clearance*1000);}clearPreset();recalculate();});
document.querySelectorAll('[data-diameter]').forEach(button=>button.addEventListener('click',()=>{params.diameter=Number(button.dataset.diameter);clearPreset();syncInputs();recalculate();}));
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
document.querySelectorAll('button[data-model]').forEach(button=>button.addEventListener('click',()=>selectModel(button.dataset.model)));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{viewer?.setView(button.dataset.view);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));}));
document.querySelectorAll('[data-meridian]').forEach(button=>button.addEventListener('click',()=>{meridian=button.dataset.meridian;document.querySelectorAll('[data-meridian]').forEach(b=>b.classList.toggle('active',b===button));updateReadout();drawProfile();}));
for(const key of ['exploded','wireframe','showClearance','showPupil'])$(key).addEventListener('change',()=>{options[key]=$(key).checked;$('exploded-note').hidden=mode!=='fit'||!options.exploded;updateViewer();drawMap();updateSceneLegend();});
$('scale').addEventListener('change',()=>{options.scale=Number($('scale').value);$('scene-scale').textContent=options.scale===1?'실제 비율 ×1':`깊이 강조 ×${options.scale} · 수직축만 확대`;updateViewer();});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  const preset=button.dataset.preset;
  const centered={offsetX:0,offsetY:0,tiltX:0,tiltY:0,autoSeat:true};
  const patches={baseline:centered,astig:{...centered,flatK:42,steepK:45},decenter:{...centered,offsetX:.6,offsetY:.3},tilt:{...centered,tiltX:1.5,tiltY:-.75},interference:{...centered,autoSeat:false,clearance:-.02}};
  params={...params,...patches[preset]};syncInputs();setMode('fit');recalculate();
  document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('selected',b===button));
  if(preset==='interference'){options.showClearance=true;$('showClearance').checked=true;updateViewer();}
}));
$('reset-btn').addEventListener('click',()=>{params={...BASE};Object.assign(options,{mode:'fit',scale:1,exploded:false,wireframe:false,showClearance:false,showPupil:true});$('showPupil').checked=true;for(const key of ['exploded','wireframe','showClearance'])$(key).checked=false;$('scale').value='1';$('exploded-note').hidden=true;$('scene-scale').textContent='실제 비율 ×1';meridian='flat';document.querySelectorAll('[data-meridian]').forEach(b=>b.classList.toggle('active',b.dataset.meridian==='flat'));syncInputs();setMode('fit');recalculate();viewer?.setView('perspective');document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='perspective'));document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('selected',b.dataset.preset==='baseline'));toast('기본 파라미터로 초기화했습니다.');});
$('export-btn').addEventListener('click',()=>{
  if(!validate())return;
  clearTimeout(updateTimer);recalculate();
  patientWorkspace?.exportSession();
});
// Recommended starting lens: results come from an external calculator and are applied on request.
let recDiameter=10.5,recApply=null;
const recInput=key=>$('rec-'+key);
const recLimits={flatK:[35,55,.25],steepK:[35,55,.25],q:[-.8,0,.05],bc:[7.5,10.5,.1],rzd:[400,700,25],lza:[25,45,1]};
function fitLimit(key,value){const [low,high,step]=recLimits[key];const v=Number(Math.max(low,Math.min(high,Math.round(value/step)*step)).toFixed(5));return{value:Object.is(v,-0)?0:v,clamped:value<low-1e-9||value>high+1e-9};}
const signed=n=>format(n,2).replace('-','−');
$('recommend-fields').replaceChildren(...resultFields.map(field=>{
  const label=document.createElement('label');label.className='field';label.textContent=field.label;
  const wrap=document.createElement('div');wrap.className='number-wrap';
  const input=document.createElement('input');Object.assign(input,{id:'rec-'+field.key,type:'number',step:field.step,inputMode:'decimal'});
  const unit=document.createElement('span');unit.textContent=field.unit;
  wrap.append(input,unit);label.append(wrap);return label;
}));
$('recommend-links').replaceChildren(...calculatorLinks.map(link=>{const a=document.createElement('a');a.className='button subtle recommend-link';a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=link.name+' ↗';return a;}));
function setRecDiameter(value){recDiameter=value;document.querySelectorAll('[data-rec-diameter]').forEach(b=>{const active=Number(b.dataset.recDiameter)===value;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
function updateRecommendation(){
  const values={},errors=[];
  for(const field of resultFields){
    const input=recInput(field.key),raw=input.value.trim(),v=Number(raw),bounded=['k1','k2','ecc'].includes(field.key);
    let ok=raw===''?!!field.optional:Number.isFinite(v);
    if(ok&&raw!==''&&bounded)ok=v>=field.min&&v<=field.max;
    input.setAttribute('aria-invalid',String(!ok));
    if(!ok)errors.push(bounded?`${field.label} (${field.min}–${field.max})`:field.label);
    else if(raw!=='')values[field.key]=v;
  }
  let message=errors.length?`입력을 확인해 주세요: ${errors.join(', ')}`:'';
  if(!message&&values.k1>values.k2)message='K1(Flat)을 K2(Steep) 이하로 입력해 주세요.';
  $('recommend-error').textContent=message;$('recommend-error').hidden=!message;
  recApply=null;$('recommend-apply').disabled=!!message;
  if(message){$('recommend-notes').replaceChildren();return;}
  const lens={bc:fitLimit('bc',values.bc),rzd:fitLimit('rzd',values.rzd1),lza:fitLimit('lza',values.lza)};
  const q=values.ecc===undefined?null:fitLimit('q',-(values.ecc**2)).value;
  recApply={flatK:fitLimit('flatK',values.k1).value,steepK:fitLimit('steepK',values.k2).value,bc:lens.bc.value,rzd:lens.rzd.value,lza:lens.lza.value,diameter:recDiameter,...(q===null?{}:{q})};
  const notes=[];
  if($('rec-toric').checked)notes.push(`DA 렌즈 결과지만 CORNEA LAB은 단일 축 렌즈만 표현하므로 RZD1만 적용합니다${values.rzd2!==undefined?` (RZD2 ${values.rzd2} µm 미적용)`:''}.`);
  const outside=Object.entries(lens).filter(([,v])=>v.clamped).map(([k])=>k.toUpperCase());
  if(outside.length)notes.push(`${outside.join(', ')} 값이 모델 표시 범위를 벗어나 가장 가까운 값으로 적용됩니다.`);
  notes.push(q===null?`Ecc를 비워 두면 비구면도 Q는 현재 값(${signed(params.q)})을 유지합니다.`:`Ecc ${format(values.ecc,2)}는 비구면도 Q = −Ecc² ≈ ${signed(q)}로 적용됩니다.`);
  notes.push('렌즈 위치는 중앙·자동 안착으로 초기화됩니다.');
  $('recommend-notes').replaceChildren(...notes.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
}
const pasteHint='붙여넣으면 아래 칸이 자동으로 채워집니다.';
$('recommend-paste').addEventListener('input',()=>{
  const text=$('recommend-paste').value,found=parseCalculatorText(text);
  const keys=resultFields.map(f=>f.key).filter(key=>found[key]!==undefined);
  keys.forEach(key=>recInput(key).value=found[key]);
  if(found.oad!==undefined)setRecDiameter(found.oad);
  if(found.toric!==undefined)$('rec-toric').checked=found.toric;
  const names=[...keys.map(k=>resultFields.find(f=>f.key===k).label),...(found.oad!==undefined?['OAD']:[]),...(found.toric!==undefined?['렌즈 종류']:[])];
  $('recommend-parsed').textContent=text.trim()===''?pasteHint:names.length?`인식한 값: ${names.join(', ')}`:'인식한 값이 없습니다. 아래 칸에 직접 입력해 주세요.';
  updateRecommendation();
});
$('recommend-fields').addEventListener('input',updateRecommendation);
$('rec-toric').addEventListener('change',updateRecommendation);
document.querySelectorAll('[data-rec-diameter]').forEach(button=>button.addEventListener('click',()=>{setRecDiameter(Number(button.dataset.recDiameter));updateRecommendation();}));
$('recommend-btn').addEventListener('click',()=>{
  const current={k1:params.flatK,k2:params.steepK,ecc:'',bc:params.bc,rzd1:params.rzd,rzd2:'',lza:params.lza};
  for(const key in current)recInput(key).value=current[key];
  $('recommend-paste').value='';$('recommend-parsed').textContent=pasteHint;$('rec-toric').checked=false;setRecDiameter(params.diameter);
  updateRecommendation();$('recommend-dialog').showModal();
});
for(const id of ['close-recommend','recommend-cancel'])$(id).addEventListener('click',()=>$('recommend-dialog').close());
$('recommend-form').addEventListener('submit',event=>{
  event.preventDefault();updateRecommendation();if(!recApply)return;
  params={...params,...recApply,offsetX:0,offsetY:0,tiltX:0,tiltY:0,autoSeat:true};
  if(recApply.q!==undefined){params.qFlat=null;params.qSteep=null;patientWorkspace?.markCommonQ();}
  clearPreset();syncInputs();setMode('fit');recalculate();$('recommend-dialog').close();
  toast(`추천값을 적용했습니다 · BC ${params.bc.toFixed(1)} / RZD ${params.rzd} / LZA ${params.lza}° / ${params.diameter.toFixed(1)} mm`);
});
for(const id of ['about-btn','notice-more','footer-about'])$(id).addEventListener('click',()=>$('about-dialog').showModal());
$('close-about').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')){const box=event.target.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)event.target.close();}});
document.querySelectorAll('[role="tab"]').forEach(tab=>tab.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll('[role="tab"]')];let index=tabs.indexOf(tab);index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].focus();tabs[index].click();}));
const resizeObserver=new ResizeObserver(()=>{drawProfile();drawMap();});resizeObserver.observe($('profile-canvas').parentElement);resizeObserver.observe($('gap-canvas').parentElement);
syncInputs();
try{viewer=createViewer($('viewer'),{corneaZ,lensZ,lensSag});}catch(error){console.error(error);$('viewer').textContent='이 브라우저에서 3D를 시작하지 못했습니다. 단면과 간격 지도를 확인해 주세요.';}
recalculate();
patientWorkspace=createPatientWorkspace({getParams:()=>params,getFit:()=>fit,toast,applyParams:next=>{const previous=params;params={...next};syncInputs();if(!recalculate()){params=previous;syncInputs();recalculate();return false;}clearPreset();return true;}});
$('reset-btn').addEventListener('click',()=>{patientWorkspace.resetMetadata();if(model!=='advanced')patientWorkspace.update(params,sampleFit(params));});
selectModel(model);
window.addEventListener('pagehide',()=>{viewer?.dispose();resizeObserver.disconnect();patientWorkspace?.dispose();});
