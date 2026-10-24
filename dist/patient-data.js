import {defaultParams,normalizeParams} from './geometry.js?v=3';

export const parameterLimits={flatK:[35,55],steepK:[35,55],steepAxis:[0,180],q:[-1.5,.5],bc:[7.5,10.5],rzd:[400,700],lza:[25,45],diameter:[10.5,11],offsetX:[-1,1],offsetY:[-1,1],tiltX:[-5,5],tiltY:[-5,5],clearance:[-.1,.5],seatTarget:[0,10],hvid:[8,15],vvid:[8,15],qFlat:[-1.5,.5],qSteep:[-1.5,.5],sag8Flat:[100,5000],sag8Steep:[100,5000],sag10Flat:[100,6000],sag10Steep:[100,6000],asymNT:[-200,200],asymSI:[-200,200],pupilDay:[1,10],pupilNight:[1,10],pupilX:[-2,2],pupilY:[-2,2],treatmentDiameter:[1,8],treatmentX:[-2,2],treatmentY:[-2,2]};
export const optionalParameters=new Set(['qFlat','qSteep','sag8Flat','sag8Steep','sag10Flat','sag10Steep','treatmentDiameter']);
export const sourceNames={assumed:'가정값',entered:'수기 입력',measured:'측정값 입력'};
export const emptyMetadata=()=>({label:'가상 예제',axl:null,kind:'conditions',qMode:'q',qRange:'',vvidMeasured:false,treatmentSource:'assumed',sources:{size:'assumed',q:'assumed',rings:'assumed',asym:'assumed',pupil:'assumed'},ringForm:{kind:'sag',bfsRadius:null,apexElevation:null}});
const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';

export function validateParameters(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('설정 형식이 올바르지 않습니다.');
  const p={...defaultParams};
  for(const [key,[low,high]] of Object.entries(parameterLimits)){
    if(!(key in raw))continue;
    const v=raw[key];
    if(v===null&&optionalParameters.has(key)){p[key]=null;continue;}
    if(typeof v!=='number'||!Number.isFinite(v)||v<low||v>high)throw new Error(`${key} 입력 범위를 확인해 주세요 (${low}~${high}).`);
    p[key]=v;
  }
  if(p.flatK>p.steepK)throw new Error('Steep K는 Flat K 이상이어야 합니다.');
  if(![10.5,11].includes(p.diameter))throw new Error('렌즈 직경은 10.5 또는 11.0 mm여야 합니다.');
  if(raw.eye!==undefined&&!['OD','OS'].includes(raw.eye))throw new Error('우안/좌안 값을 확인해 주세요.');
  if(raw.pupilLight!==undefined&&!['day','night'].includes(raw.pupilLight))throw new Error('동공 조명 조건을 확인해 주세요.');
  p.eye=raw.eye??p.eye;p.pupilLight=raw.pupilLight??p.pupilLight;
  if(raw.autoSeat!==undefined&&typeof raw.autoSeat!=='boolean')throw new Error('자동 안착 설정을 확인해 주세요.');
  p.autoSeat=raw.autoSeat??p.autoSeat;
  const normalized=normalizeParams(p);
  for(const chord of [8,10])for(const axis of ['Flat','Steep']){
    if(normalized[`sag${chord}${axis}`]===null)continue;
    const t=normalized[axis==='Flat'?'flatAxis':'steepAxis']*Math.PI/180,r=chord/2;
    if((r*Math.cos(t)/(normalized.hvid/2))**2+(r*Math.sin(t)/(normalized.vvid/2))**2>1+1e-8)throw new Error(`Ø${chord} mm ${axis} 측정점이 입력한 각막 경계 밖입니다.`);
  }
  return normalized;
}

export function sanitizeRecord(raw){
  if(!raw||typeof raw!=='object')throw new Error('비교 자료가 올바르지 않습니다.');
  const input=validateParameters(raw.input),meta=emptyMetadata(),m=raw.meta||{};
  meta.label=text(m.label,40)||'비교 자료';
  if(m.axl!==null&&m.axl!==undefined){if(typeof m.axl!=='number'||!Number.isFinite(m.axl)||m.axl<15||m.axl>40)throw new Error('AXL은 15~40 mm 범위로 입력해 주세요.');meta.axl=m.axl;}
  if(['conditions','patients','time'].includes(m.kind))meta.kind=m.kind;
  meta.qRange=text(m.qRange,30);meta.qMode=m.qMode==='e'?'e':'q';
  meta.vvidMeasured=m.vvidMeasured===true;
  for(const key of Object.keys(meta.sources))if(Object.hasOwn(sourceNames,m.sources?.[key]))meta.sources[key]=m.sources[key];
  if(['sag8Flat','sag8Steep','sag10Flat','sag10Steep'].every(key=>input[key]===null))meta.sources.rings='assumed';
  meta.treatmentSource=m.treatmentSource==='measured'?'measured':'assumed';
  // Keep only validated numbers and known fields; arbitrary imported metadata is dropped.
  if(m.ringForm&&['sag','bfs'].includes(m.ringForm.kind)){
    meta.ringForm.kind=m.ringForm.kind;
    for(const key of ['bfsRadius','apexElevation','sag8Flat','sag8Steep','sag10Flat','sag10Steep']){
      const v=m.ringForm[key];
      if(v===null||v===undefined){meta.ringForm[key]=null;continue;}
      const [lo,hi]=key==='bfsRadius'?[5.1,15]:key==='apexElevation'?[-1000,1000]:[-1000,6000];
      if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new Error('주변부 원본 입력 범위를 확인해 주세요.');
      meta.ringForm[key]=v;
    }
    if(meta.ringForm.kind==='bfs')for(const key of ['sag8Flat','sag8Steep','sag10Flat','sag10Steep']){
      const v=meta.ringForm[key];if(v===null||v===undefined)continue;
      const converted=elevationToSag(key.includes('10')?10:8,v,meta.ringForm.bfsRadius,meta.ringForm.apexElevation);
      if(input[key]===null||Math.abs(converted-input[key])>.1)throw new Error('BFS 원본값과 변환된 Sag가 일치하지 않습니다.');
    }
  }
  return {input,meta};
}

/** Centered spherical BFS, common x/y registration, anterior-positive elevation. */
export function elevationToSag(chord,elevationUm,radiusMm,apexElevationUm){
  const r=chord/2;
  if(![chord,elevationUm,radiusMm,apexElevationUm].every(Number.isFinite)||radiusMm<=r)throw new Error('BFS 반경과 정점 elevation을 모두 입력해 주세요.');
  return r*r/(radiusMm+Math.sqrt(radiusMm*radiusMm-r*r))*1000-elevationUm+apexElevationUm;
}

export function parseSession(textValue){
  if(textValue.length>500000)throw new Error('설정 파일이 너무 큽니다. CORNEA LAB JSON을 선택해 주세요.');
  const raw=JSON.parse(textValue);
  if(raw.format!=='cornea-lab-comparison'||raw.version!==2)throw new Error('CORNEA LAB 비교 설정 v2 파일을 선택해 주세요.');
  return {current:sanitizeRecord(raw.current),cases:{A:raw.cases?.A?sanitizeRecord(raw.cases.A):null,B:raw.cases?.B?sanitizeRecord(raw.cases.B):null}};
}

export function makeSession(current,cases){
  return {format:'cornea-lab-comparison',version:2,purpose:'Patient explanation and geometric comparison; not a clinical fitting or efficacy predictor',current:sanitizeRecord(current),cases:{A:cases.A?sanitizeRecord(cases.A):null,B:cases.B?sanitizeRecord(cases.B):null}};
}
