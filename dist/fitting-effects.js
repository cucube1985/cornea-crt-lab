// Public mechanics/optics, with explicit assumptions; no prescription formula.
export const retentionDefaults=Object.freeze({gamma:40,beta:30,show:true});
export function sanitizeRetention(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('표면장력 설정 형식을 확인해 주세요.');
  const result={...retentionDefaults};
  for(const [key,max] of [['gamma',100],['beta',90]])if(raw[key]!==undefined){if(typeof raw[key]!=='number'||!Number.isFinite(raw[key])||raw[key]<0||raw[key]>max)throw new Error('표면장력은 0~100 mN/m, 방향각은 0~90°로 입력해 주세요.');result[key]=raw[key];}
  if(raw.show!==undefined){if(typeof raw.show!=='boolean')throw new Error('힘 표시 설정을 확인해 주세요.');result.show=raw.show;}
  return result;
}
/** One fully wetted circular lens contact line; beta is measured from -z.
 * gamma [mN/m] * circumference [m] => axial line-force component [mN].
 * No pressure-area term, lid load, detachment force, or treatment prediction.
 */
export function capillaryLineForce(diameterMm,settings=retentionDefaults){
  if(!Number.isFinite(diameterMm)||diameterMm<=0)throw new Error('접촉선 직경을 확인해 주세요.');
  const {gamma,beta}=sanitizeRetention(settings),circumferenceMm=Math.PI*diameterMm;
  const projection=beta===90?0:Math.cos(beta*Math.PI/180);
  return {circumferenceMm,maximumMn:gamma*circumferenceMm/1000,axialMn:gamma*circumferenceMm/1000*projection};
}

const visitKeys=['sphere','cylinder','axis','flatK','steepK','steepAxis'];
const emptyVisit=()=>Object.fromEntries(visitKeys.map(key=>[key,null]));
export const emptyOutcome=()=>({eye:null,before:emptyVisit(),after:emptyVisit(),zoneDiameter:null,zoneX:null,zoneY:null,beforeDate:'',afterDate:'',wearDays:null,removalHours:null,conditions:''});
function optional(value,lo,hi,label){
  if(value===undefined||value===null)return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<lo||value>hi)throw new Error(`${label} 범위를 확인해 주세요 (${lo}~${hi}).`);
  return value;
}
function date(value){
  if(value===undefined||value==='')return '';
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error('측정 날짜를 확인해 주세요.');
  return value;
}
export function sanitizeOutcome(raw){
  const out=emptyOutcome();if(raw===undefined)return out;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('착용 전후 측정값 형식을 확인해 주세요.');
  if(raw.eye!==undefined&&raw.eye!==null&&!['OD','OS'].includes(raw.eye))throw new Error('측정 자료의 우안/좌안을 확인해 주세요.');out.eye=raw.eye??null;
  for(const phase of ['before','after']){
    const visit=raw[phase]??{};if(typeof visit!=='object'||Array.isArray(visit))throw new Error('측정값 형식을 확인해 주세요.');
    for(const key of visitKeys){const range=key==='sphere'?[-30,30]:key==='cylinder'?[-15,15]:key.includes('K')?[20,65]:[0,180];out[phase][key]=optional(visit[key],...range,key);}
    if(out[phase].flatK!==null&&out[phase].steepK!==null&&out[phase].flatK>out[phase].steepK)throw new Error('측정한 Steep K는 Flat K 이상이어야 합니다.');
  }
  for(const [key,lo,hi]of [['zoneDiameter',1,9],['zoneX',-3,3],['zoneY',-3,3],['wearDays',0,20000],['removalHours',0,168]])out[key]=optional(raw[key],lo,hi,key);
  out.beforeDate=date(raw.beforeDate);out.afterDate=date(raw.afterDate);
  if(out.beforeDate&&out.afterDate&&out.beforeDate>out.afterDate)throw new Error('착용 후 측정 날짜는 착용 전보다 빠를 수 없습니다.');
  out.conditions=typeof raw.conditions==='string'?raw.conditions.slice(0,120):'';
  return out;
}
export const sphericalEquivalent=visit=>Number.isFinite(visit?.sphere)&&Number.isFinite(visit?.cylinder)?visit.sphere+visit.cylinder/2:null;
export const meanK=visit=>Number.isFinite(visit?.flatK)&&Number.isFinite(visit?.steepK)?(visit.flatK+visit.steepK)/2:null;
export function outcomeMetrics(raw,currentEye){
  const data=sanitizeOutcome(raw),sameEye=data.eye!==null&&data.eye===currentEye;
  const preSE=sphericalEquivalent(data.before),postSE=sphericalEquivalent(data.after),preK=meanK(data.before),postK=meanK(data.after);
  return {data,sameEye,preSE,postSE,preK,postK,seChange:sameEye&&preSE!==null&&postSE!==null?postSE-preSE:null,kReduction:sameEye&&preK!==null&&postK!==null?preK-postK:null};
}
/** Optional K-only teaching surfaces: discard unknown post-treatment shape.
 * Never carry measured pre-treatment peripheral heights into the post surface.
 */
export function outcomeKModels(raw,current){
  const {data,sameEye,preK,postK}=outcomeMetrics(raw,current.eye);
  if(!sameEye||preK===null||postK===null)throw new Error('같은 눈의 착용 전후 Flat/Steep K를 모두 입력해 주세요.');
  if([data.before.flatK,data.before.steepK,data.after.flatK,data.after.steepK].some(k=>k<35||k>55))throw new Error('수치 비교는 가능하지만 K 근사 모델 표시 범위는 35~55 D입니다.');
  const reset={q:-.25,qFlat:null,qSteep:null,sag8Flat:null,sag8Steep:null,sag10Flat:null,sag10Steep:null,asymNT:0,asymSI:0,treatmentDiameter:null,treatmentX:0,treatmentY:0};
  return Object.fromEntries(['before','after'].map(phase=>[phase,{...current,...reset,flatK:data[phase].flatK,steepK:data[phase].steepK,steepAxis:data[phase].steepAxis??90,...(phase==='after'&&data.zoneDiameter!==null&&data.zoneDiameter<=8&&data.zoneX!==null&&data.zoneY!==null&&Math.abs(data.zoneX)<=2&&Math.abs(data.zoneY)<=2?{treatmentDiameter:data.zoneDiameter,treatmentX:data.zoneX,treatmentY:data.zoneY}:{})}]));
}
