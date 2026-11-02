import {capillaryLineForce,sanitizeRetention} from './fitting-effects.js?v=7';

export function createRetentionPanel({getSettings,onChange}){
  const panel=document.createElement('section');panel.className='retention-panel panel';panel.id='retention-panel';
  panel.innerHTML=`<div class="effects-heading"><div><div class="eyebrow">INITIAL FIT · ASSUMED LINE FORCE</div><h2>표면장력에 의한 렌즈 유지력 성분</h2></div><span class="effects-tag assumed">설명용 가정</span></div><div class="retention-layout"><form class="retention-controls"><label>표면장력 γ <span><input id="retention-gamma" aria-label="표면장력 계수" type="number" min="0" max="100" step="any" required> mN/m</span></label><label>유지 방향에 대한 각도 β <span><input id="retention-beta" aria-label="표면장력 방향각" type="number" min="0" max="90" step="any" required> °</span></label><label class="retention-check"><input id="retention-show" type="checkbox">3D 가장자리에 힘의 방향 표시</label><p id="retention-input-error" class="input-error" role="alert" hidden>범위를 확인해 주세요. 마지막 유효한 설정으로 표시 중입니다.</p></form><div class="retention-number"><span>각막 쪽 축방향 성분 · Fz</span><strong id="retention-force">—</strong><span class="retention-unit">mN</span><small id="retention-diameter"></small><div class="retention-sizes" id="retention-sizes"></div></div></div><p class="retention-formula">Fz = γ × πD × cosβ ÷ 1000 <span>γ: mN/m · D: mm → Fz: mN</span></p><p id="retention-geometry-note" class="effects-warning" hidden></p><p class="effects-help">렌즈 바깥 둘레 전체가 젖은 원형 접촉선이라고 가정합니다. β는 힘의 접선 방향과 각막 쪽 축 사이의 각도이며, 재질의 접촉각이나 LZA가 아닙니다. 화살표 길이는 힘의 크기를 뜻하지 않습니다.</p><details class="effects-notes"><summary>계산 가정과 출처</summary><p>초기 γ=40 mN/m, β=30°는 설명용 가정이며 환자의 측정값이나 정상 기준이 아닙니다. 동일한 D·γ·β에서는 BC/RZD/LZA를 바꿔도 이 성분은 같습니다. 눈물 압력차·눈꺼풀 하중·박리력·고착·피팅 안정성과 교정량(D)은 계산하지 않습니다.</p><p>주변 접촉선 힘을 축 방향으로 투영한 기본 역학식입니다. <a href="https://www.math.ttu.edu/~rvenkata/Papers/Bhagya_ACC_2013.pdf" target="_blank" rel="noopener noreferrer">콘택트렌즈·눈물층 평형 모델, 식 38–40 ↗</a></p></details>`;
  document.querySelector('.visual-column').append(panel);
  const gamma=panel.querySelector('#retention-gamma'),beta=panel.querySelector('#retention-beta'),show=panel.querySelector('#retention-show');
  panel.querySelector('form').addEventListener('submit',event=>event.preventDefault());
  panel.querySelector('form').addEventListener('input',()=>{
    const valid=gamma.value!==''&&beta.value!==''&&gamma.validity.valid&&beta.validity.valid;
    panel.querySelector('#retention-input-error').hidden=valid;if(!valid)return;
    onChange(sanitizeRetention({gamma:Number(gamma.value),beta:Number(beta.value),show:show.checked}));
  });
  return {update(p,fit){
    const settings=getSettings(),force=capillaryLineForce(p.diameter,settings);
    if(document.activeElement!==gamma)gamma.value=settings.gamma;if(document.activeElement!==beta)beta.value=settings.beta;show.checked=settings.show;
    panel.querySelector('#retention-force').textContent=force.axialMn.toFixed(3);
    panel.querySelector('#retention-diameter').textContent=`접촉선 직경을 렌즈 전체 직경 ${p.diameter.toFixed(1)} mm로 가정`;
    panel.querySelector('#retention-sizes').textContent=[10.5,11].map(d=>`${d.toFixed(1)} mm → ${capillaryLineForce(d,settings).axialMn.toFixed(3)} mN`).join('  /  ');
    const unsuitable=fit.metrics.penetrationFraction>0.0001||fit.metrics.coverageFraction<.999;
    const note=panel.querySelector('#retention-geometry-note');note.hidden=!unsuitable;note.textContent='현재 표면은 간섭 또는 경계 밖 영역을 포함합니다. 위 수치는 접촉선 가정의 산술값이며 이 피팅에 적용되는 유지력이 아닙니다. 3D 힘 표시는 생략합니다.';
  }};
}
