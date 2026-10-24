import {defaultParams} from './geometry.js?v=3';

// Select a calculation model without overwriting the user's Advanced inputs.
export const modelModes = Object.freeze({
  basic: {name:'Basic',view:'cornea',description:'Flat K · Steep K · 축으로 단순 각막만 표시합니다. Q −0.25, 직경 11.8 mm를 고정 가정합니다.'},
  ok: {name:'OK',view:'lens',description:'BC · RZD · LZA · 10.5/11.0 mm로 CRT 렌즈 형상만 비교합니다. 각막과 안착 위치는 반영하지 않습니다.'},
  'basic-ok': {name:'Basic-OK',view:'fit',description:'Basic 각막에 CRT 렌즈를 배치합니다. 렌즈 이동·기울기·수직 간격을 비교할 수 있습니다.'},
  advanced: {name:'Advanced',view:'fit',description:'각막 크기 · Q/e · 주변부 높이 · 비대칭 · 동공 등 추가 조건과 환자별 A/B 비교를 사용합니다.'},
});

export function modelParameters(input,model='advanced') {
  if(!Object.hasOwn(modelModes,model))throw new RangeError('Unknown model.');
  if(model==='advanced')return {...input};
  const p={...defaultParams};
  const keys=model==='basic'?['flatK','steepK','steepAxis']:
    model==='ok'?['bc','rzd','lza','diameter']:
    ['flatK','steepK','steepAxis','bc','rzd','lza','diameter','offsetX','offsetY','tiltX','tiltY','clearance','autoSeat','seatTarget'];
  for(const key of keys)if(input[key]!==undefined)p[key]=input[key];
  if(model==='ok'){p.autoSeat=false;p.clearance=0;}
  return p;
}
