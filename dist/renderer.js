import * as THREE from './vendor/three.module.js';
import {createGeometrySampler} from './geometry.js?v=2';

// All model coordinates are millimetres. The model's anterior axis (z) is
// Three's vertical axis (y); the camera is the only thing that is rotated.
const ANGULAR_STEPS = 176;
const RADIAL_STEPS = 58;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const GAP_STOPS = [
  [-0.005, new THREE.Color('#e76057')],
  [0.002, new THREE.Color('#f4b55b')],
  [0.025, new THREE.Color('#83d4b6')],
  [0.100, new THREE.Color('#54bfc9')],
  [0.250, new THREE.Color('#467dcc')],
];
const UNKNOWN_GAP_COLOR = new THREE.Color('#bcc7cd');

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function disposeTree(object) {
  object.traverse(child => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
    else child.material?.dispose();
  });
  object.clear();
}

function gapColor(gap) {
  // These are geometric distances, not clinical fitting classifications.
  // A missing corneal domain is unknown geometry, never a zero-gap sample.
  if (!Number.isFinite(gap)) return UNKNOWN_GAP_COLOR;
  const stops = GAP_STOPS;
  if (gap <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    if (gap <= stops[i][0]) {
      const ratio = (gap - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return stops[i - 1][1].clone().lerp(stops[i][1], ratio);
    }
  }
  return stops.at(-1)[1];
}

function makeDisc(radius, sample, colorSample) {
  const positions = [];
  const colors = [];
  const indices = [];
  const valid=[];
  const append = (x, y) => {
    const point = sample(x, y);
    valid.push(point.every(Number.isFinite));
    positions.push(...(valid.at(-1)?point:[0,0,0]));
    if (colorSample) {
      const color = colorSample(x, y);
      colors.push(color.r, color.g, color.b);
    }
  };
  append(0, 0);
  for (let ring = 1; ring <= RADIAL_STEPS; ring += 1) {
    const r = radius * ring / RADIAL_STEPS;
    for (let j = 0; j <= ANGULAR_STEPS; j += 1) {
      const angle = j / ANGULAR_STEPS * TAU;
      append(r * Math.cos(angle), r * Math.sin(angle));
    }
  }
  for (let j = 0; j < ANGULAR_STEPS; j += 1) indices.push(0, 1 + j, 2 + j);
  for (let ring = 1; ring < RADIAL_STEPS; ring += 1) {
    for (let j = 0; j < ANGULAR_STEPS; j += 1) {
      const inner = 1 + (ring - 1) * (ANGULAR_STEPS + 1) + j;
      const outer = inner + ANGULAR_STEPS + 1;
      indices.push(inner, outer, outer + 1, inner, outer + 1, inner + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colorSample) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices.filter((_,i)=>valid[indices[i-i%3]]&&valid[indices[i-i%3+1]]&&valid[indices[i-i%3+2]]));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeRim(radius, sample, thickness) {
  const positions = [];
  const indices = [];
  const valid=[];
  for (let i = 0; i <= ANGULAR_STEPS; i += 1) {
    const angle = i / ANGULAR_STEPS * TAU;
    const point = sample(radius * Math.cos(angle), radius * Math.sin(angle));
    valid.push(point.every(Number.isFinite));
    const v=valid.at(-1)?point:[0,0,0];
    positions.push(...v,v[0],v[1]+thickness,v[2]);
    if (i < ANGULAR_STEPS) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices.filter((_,i)=>{const j=i-i%3;return valid[Math.floor(indices[j]/2)]&&valid[Math.floor(indices[j+1]/2)]&&valid[Math.floor(indices[j+2]/2)];}));
  geometry.computeVertexNormals();
  return geometry;
}

function makeRing(radius, sample, color, opacity = 1, dash = false) {
  const points = [];
  for (let i = 0; i < 256; i += 1) {
    const a=i/256*TAU,b=(i+1)/256*TAU;
    const p=sample(radius*Math.cos(a),radius*Math.sin(a)),q=sample(radius*Math.cos(b),radius*Math.sin(b));
    if(p.every(Number.isFinite)&&q.every(Number.isFinite))points.push(new THREE.Vector3(...p),new THREE.Vector3(...q));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const Material = dash ? THREE.LineDashedMaterial : THREE.LineBasicMaterial;
  const material = new Material({ color, transparent: true, opacity, depthWrite: false,
    ...(dash ? { dashSize: 0.13, gapSize: 0.10 } : {}) });
  const line = new THREE.LineSegments(geometry, material);
  if (dash) line.computeLineDistances();
  return line;
}

function makeGrid(radius, sample, { color, opacity, radialStep = 0.5, spokes = 16 }) {
  const positions = [];
  const segment = (a, b) => {const p=sample(...a),q=sample(...b);if(p.every(Number.isFinite)&&q.every(Number.isFinite))positions.push(...p,...q);};
  for (let r = radialStep; r < radius - 0.08; r += radialStep) {
    for (let i = 0; i < 160; i += 1) {
      const a = i / 160 * TAU;
      const b = (i + 1) / 160 * TAU;
      segment([r * Math.cos(a), r * Math.sin(a)], [r * Math.cos(b), r * Math.sin(b)]);
    }
  }
  for (let i = 0; i < spokes; i += 1) {
    const angle = i / spokes * TAU;
    for (let j = 0; j < 48; j += 1) {
      const r1 = j / 48 * radius;
      const r2 = (j + 1) / 48 * radius;
      segment([r1 * Math.cos(angle), r1 * Math.sin(angle)], [r2 * Math.cos(angle), r2 * Math.sin(angle)]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color, opacity, transparent: true, depthWrite: false,
  }));
}

function makeAxes(radius, sample, p) {
  const group = new THREE.Group();
  const axisAngle = finite(p.steepAxis, 90) * DEG;
  [axisAngle, axisAngle + Math.PI / 2].forEach((angle, index) => {
    const points = [];
    for (let j = 0; j < 96; j += 1) {
      const r=(j/96*2-1)*radius,s=((j+1)/96*2-1)*radius;
      const a=sample(r*Math.cos(angle),r*Math.sin(angle)),b=sample(s*Math.cos(angle),s*Math.sin(angle));
      if(a.every(Number.isFinite)&&b.every(Number.isFinite))points.push(new THREE.Vector3(...a),new THREE.Vector3(...b));
    }
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({ color: index === 0 ? '#417fba' : '#55ad99',
        opacity: 0.72, transparent: true, dashSize: 0.15, gapSize: 0.10, depthWrite: false }));
    line.computeLineDistances();
    group.add(line);
  });
  return group;
}

/** Create an isolated Three viewer. No global DOM, external controls, or network. */
export function createViewer(container, { corneaZ, lensZ, lensSag }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    const fallback = document.createElement('div');
    fallback.className = 'viewer-fallback';
    fallback.style.cssText = 'height:100%;min-height:280px;display:grid;place-content:center;gap:12px;padding:32px;text-align:center;color:#657d88;font:14px/1.7 system-ui,sans-serif;';
    fallback.innerHTML = '<strong style="font-size:18px;color:#294a59">3D 뷰어를 시작할 수 없습니다.</strong><span>WebGL을 지원하는 브라우저에서 다시 열어 주세요.<br>아래 단면과 분석 결과는 계속 확인할 수 있습니다.</span>';
    container.appendChild(fallback);
    return { update() {}, setView() {}, resize() {}, dispose() { fallback.remove(); }, available: false };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xf6f9fa, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none;';
  canvas.setAttribute('aria-label', '각막과 CRT 렌즈 3D 모델. 드래그하여 회전하고 휠로 확대합니다.');
  canvas.tabIndex = 0;
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 150);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa1c0cf, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-7, 13, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc4e8ff, 1.7);
  fill.position.set(10, 5, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);
  rim.position.set(-2, 2, -10);
  scene.add(rim);

  const model = new THREE.Group();
  scene.add(model);
  const decoration = new THREE.Group();
  scene.add(decoration);
  let state = { mode: 'fit', exploded: false, wireframe: false, scale: 1, showAxes: false };
  let params = null;
  let disposed = false;
  let raf = 0;
  let previousTime = 0;
  let pointer = null;
  let dirty = true;
  let width = 1;
  let height = 1;
  let minY = -2.6;
  let frameRadius = 6;
  let baselineDistance = 0;
  const orbit = { theta: 0.52, phi: 0.91, distance: 25, targetX: 0, targetY: -0.8, targetZ: 0 };
  const goal = { ...orbit };
  const target = new THREE.Vector3(0, orbit.targetY, 0);

  const wake = () => {
    if (!disposed && !raf) raf = requestAnimationFrame(frame);
  };
  const positionCamera = () => {
    target.set(orbit.targetX, orbit.targetY, orbit.targetZ);
    const sinPhi = Math.sin(orbit.phi);
    camera.position.set(orbit.targetX + orbit.distance * sinPhi * Math.sin(orbit.theta),
      orbit.targetY + orbit.distance * Math.cos(orbit.phi),
      orbit.targetZ + orbit.distance * sinPhi * Math.cos(orbit.theta));
    camera.lookAt(target);
  };
  const refreshFraming = (immediate = false) => {
    const verticalHalfFov = camera.fov * DEG / 2;
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
    const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
    // Fit the complete model, with breathing room for the in-view legend.
    const neededDistance = frameRadius / Math.sin(limitingHalfFov) * 1.22;
    const ratio = baselineDistance ? neededDistance / baselineDistance : 1;
    if (baselineDistance) {
      goal.distance *= ratio;
      orbit.distance *= ratio;
    } else goal.distance = orbit.distance = neededDistance;
    baselineDistance = neededDistance;
    if (immediate) {
      orbit.targetX = goal.targetX;
      orbit.targetY = goal.targetY;
      orbit.targetZ = goal.targetZ;
    }
  };
  function frame(time) {
    raf = 0;
    if (disposed) return;
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = time;
    if (state.autoRotate && !pointer) goal.theta += dt * 0.10;
    let moving = false;
    const easing = 1 - Math.pow(0.001, dt);
    Object.keys(orbit).forEach(keyName => {
      const delta = goal[keyName] - orbit[keyName];
      if (Math.abs(delta) > 0.0003) {
        orbit[keyName] += delta * easing;
        moving = true;
      } else orbit[keyName] = goal[keyName];
    });
    if (dirty || moving || state.autoRotate) {
      positionCamera();
      renderer.render(scene, camera);
      dirty = false;
    }
    if (moving || state.autoRotate) wake();
  }

  function rebuildDecorations() {
    disposeTree(decoration);
    const floorY = minY - 0.48;
    const flat = (x, y) => [x, floorY, -y];
    decoration.add(makeRing(6.65, flat, '#9db7c3', 0.23));
    decoration.add(makeRing(7.35, flat, '#b7c8d0', 0.15, true));
    const crossPositions = [
      -7.7, floorY, 0, -6.8, floorY, 0, 6.8, floorY, 0, 7.7, floorY, 0,
      0, floorY, -7.7, 0, floorY, -6.8, 0, floorY, 6.8, 0, floorY, 7.7,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(crossPositions, 3));
    decoration.add(new THREE.LineSegments(geometry,
      new THREE.LineBasicMaterial({ color: '#9bb4c0', transparent: true, opacity: 0.36 })));
    // A soft, procedural shadow keeps the cap grounded without a shadow map.
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;void main(){float r=length((vUv-.5)*2.);float a=exp(-r*r*6.)*.095;gl_FragColor=vec4(.18,.35,.40,a);}',
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = floorY - 0.015;
    decoration.add(shadow);
  }

  function update(nextParams, fit = {}, options = {}) {
    if (disposed) return;
    state = { ...state, ...options };
    params = fit?.params || nextParams;
    if (!params) return;
    const p = params;
    const compiled=createGeometrySampler(p);
    const corneaRadius=p.hvid/2,ellipseRatio=p.vvid/p.hvid;
    const scale = Math.max(0.2, finite(state.scale, 1));
    const radius = finite(p.diameter, 10.5) / 2;
    const cx = finite(p.offsetX);
    const cy = finite(p.offsetY);
    const exploded = state.exploded && state.mode === 'fit' ? 1.9 : 0;
    const heatmap = Boolean(state.clearanceMap || state.showClearance || state.heatmap);
    const corneaPoint = (x, y, lift = 0) => [x, compiled.corneaZ(x,y)*scale+lift,-y];
    const ellipsePoint=(x,y,lift=0)=>corneaPoint(x,y*ellipseRatio,lift);
    const lensPoint = (x, y, lift = 0) => {
      const worldX = x + cx;
      const worldY = y + cy;
      return [worldX,compiled.lensZ(worldX,worldY)*scale+exploded+lift,-worldY];
    };
    disposeTree(model);

    minY = 0;
    for (let i = 0; i < 64; i += 1) {
      const angle = i / 64 * TAU;
      const y=ellipsePoint(corneaRadius*Math.cos(angle),corneaRadius*Math.sin(angle))[1];
      if(Number.isFinite(y))minY=Math.min(minY,y);
    }
    if (state.mode !== 'lens') {
      const cornea = new THREE.Mesh(makeDisc(corneaRadius, (x, y) => ellipsePoint(x, y)),
        new THREE.MeshPhysicalMaterial({ color: '#77d5c7', roughness: 0.22, metalness: 0.02,
          transparent: true, opacity: state.mode === 'cornea' ? 0.72 : 0.49,
          side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.8, clearcoatRoughness: 0.22 }));
      cornea.renderOrder = 1;
      model.add(cornea);
      const corneaEdge = new THREE.Mesh(makeRim(corneaRadius, (x, y) => ellipsePoint(x, y), -0.10 * scale),
        new THREE.MeshStandardMaterial({ color: '#47a99e', transparent: true, opacity: 0.19,
          side: THREE.DoubleSide, depthWrite: false, roughness: 0.3 }));
      corneaEdge.renderOrder = 1;
      model.add(corneaEdge);
      const grid = makeGrid(corneaRadius, (x, y) => ellipsePoint(x, y, 0.010), {
        color: '#388e89', opacity: state.wireframe ? 0.40 : 0.15, radialStep: state.wireframe ? 0.35 : 0.65, spokes: state.wireframe ? 24 : 16,
      });
      grid.renderOrder = 2;
      model.add(grid);
      const limbus = makeRing(corneaRadius, (x, y) => ellipsePoint(x, y, 0.012), '#46988f', 0.53);
      limbus.renderOrder = 3;
      model.add(limbus);
      if (state.showAxes) {
        const axes = makeAxes(Math.max(corneaRadius,p.vvid/2), (x, y) => corneaPoint(x, y, 0.035), p);
        axes.renderOrder = 5;
        model.add(axes);
      }
      if(state.showPupil!==false){
        const pupilRadius=(p.pupilLight==='day'?p.pupilDay:p.pupilNight)/2;
        const pupil=makeRing(pupilRadius,(x,y)=>corneaPoint(x+p.pupilX,y+p.pupilY,.065),'#9a6bb9',.95);pupil.renderOrder=12;model.add(pupil);
        const center=makeRing(.055,(x,y)=>corneaPoint(x+p.pupilX,y+p.pupilY,.07),'#855ca0',1);center.renderOrder=12;model.add(center);
        if(p.treatmentDiameter!==null){const zone=makeRing(p.treatmentDiameter/2,(x,y)=>corneaPoint(x+p.treatmentX,y+p.treatmentY,.055),'#d29c56',.95,true);zone.renderOrder=11;model.add(zone);}
      }
    }

    if (state.mode !== 'cornea') {
      const thickness = 0.14 * scale;
      const colorSample = heatmap ? (x, y) => {
        const worldX = x + cx;
        const worldY = y + cy;
        return gapColor(compiled.lensZ(worldX,worldY)-compiled.corneaZ(worldX,worldY));
      } : null;
      const posterior = new THREE.Mesh(makeDisc(radius, (x, y) => lensPoint(x, y), colorSample),
        new THREE.MeshPhysicalMaterial({ color: heatmap ? '#ffffff' : '#90cbea', vertexColors: heatmap,
          roughness: 0.19, metalness: 0.01, transparent: true, opacity: heatmap ? 0.77 : 0.37,
          side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.18 }));
      posterior.renderOrder = 4;
      model.add(posterior);
      const anterior = new THREE.Mesh(makeDisc(radius, (x, y) => lensPoint(x, y, thickness)),
        new THREE.MeshPhysicalMaterial({ color: '#c6ebfa', roughness: 0.13, metalness: 0.015,
          transparent: true, opacity: heatmap ? 0.07 : 0.18, side: THREE.DoubleSide,
          depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.12 }));
      anterior.renderOrder = 6;
      model.add(anterior);
      const lensRim = new THREE.Mesh(makeRim(radius, (x, y) => lensPoint(x, y), thickness),
        new THREE.MeshPhysicalMaterial({ color: '#8cc8e8', roughness: 0.14,
          transparent: true, opacity: 0.40, depthWrite: false, side: THREE.DoubleSide,
          clearcoat: 1 }));
      lensRim.renderOrder = 7;
      model.add(lensRim);
      [[3, '#4c90b6', 0.65], [4, '#5b9fbf', 0.55], [radius, '#478aaf', 0.74]].forEach(([r, color, opacity]) => {
        const line = makeRing(r, (x, y) => lensPoint(x, y, thickness + 0.013), color, opacity);
        line.renderOrder = 8;
        model.add(line);
      });
      const highlight = makeRing(radius - 0.022, (x, y) => lensPoint(x, y, thickness + 0.018), '#ffffff', 0.73);
      highlight.renderOrder = 9;
      model.add(highlight);
      if (state.wireframe) {
        const grid = makeGrid(radius, (x, y) => lensPoint(x, y, thickness + 0.018), {
          color: '#5998b8', opacity: 0.28, radialStep: 0.4, spokes: 24,
        });
        grid.renderOrder = 8;
        model.add(grid);
      }
      if (exploded) {
        const guidePoints = [];
        for (const angle of [Math.PI / 4, Math.PI * 5 / 4]) {
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const from = corneaPoint(x + cx, y + cy, 0.02);
          const to = lensPoint(x, y);
          if(from.every(Number.isFinite)&&to.every(Number.isFinite))guidePoints.push(...from, ...to);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(guidePoints, 3));
        const guides = new THREE.LineSegments(geometry, new THREE.LineDashedMaterial({
          color: '#7299ac', transparent: true, opacity: 0.45, dashSize: 0.10, gapSize: 0.09,
        }));
        guides.computeLineDistances();
        model.add(guides);
      }
    }

    const bounds = new THREE.Box3().setFromObject(model, true);
    const center = bounds.getCenter(new THREE.Vector3());
    goal.targetX = center.x;
    goal.targetY = center.y;
    goal.targetZ = center.z;
    minY = bounds.min.y;
    // A true vertex radius avoids the empty corners of a box making a shallow
    // cap unnecessarily small. The sphere also stays fitted while orbiting.
    let radiusSquared = 0;
    model.traverse(child => {
      const position = child.geometry?.getAttribute('position');
      if (!position) return;
      for (let i = 0; i < position.count; i += 1) {
        const dx = position.getX(i) - center.x;
        const dy = position.getY(i) - center.y;
        const dz = position.getZ(i) - center.z;
        radiusSquared = Math.max(radiusSquared, dx * dx + dy * dy + dz * dz);
      }
    });
    frameRadius = Math.max(1, Math.sqrt(radiusSquared));
    refreshFraming(!baselineDistance);
    rebuildDecorations();
    dirty = true;
    wake();
  }

  function setView(view) {
    if (view === 'top') {
      goal.theta = 0;
      goal.phi = 0.005;
    } else if (view === 'side') {
      goal.theta = 0;
      goal.phi = Math.PI / 2;
    } else {
      goal.theta = 0.52;
      goal.phi = 0.91;
    }
    dirty = true;
    wake();
  }

  function resize() {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width || container.clientWidth || 640);
    height = Math.max(1, rect.height || container.clientHeight || 480);
    camera.aspect = width / height;
    if (baselineDistance) refreshFraming();
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    dirty = true;
    wake();
  }

  const onPointerDown = event => {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onPointerMove = event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.x;
    const deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    goal.theta -= deltaX / Math.max(width, 300) * 4.8;
    goal.phi = THREE.MathUtils.clamp(goal.phi - deltaY / Math.max(height, 300) * 3.2, 0.005, Math.PI * 0.72);
    dirty = true;
    wake();
  };
  const onPointerUp = event => {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    canvas.style.cursor = 'grab';
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const onWheel = event => {
    event.preventDefault();
    goal.distance = THREE.MathUtils.clamp(goal.distance * Math.exp(event.deltaY * 0.001), 12.5, 49);
    dirty = true;
    wake();
  };
  const onKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') goal.theta -= 0.12;
    if (event.key === 'ArrowRight') goal.theta += 0.12;
    if (event.key === 'ArrowUp') goal.phi = Math.max(0.005, goal.phi - 0.10);
    if (event.key === 'ArrowDown') goal.phi = Math.min(Math.PI * 0.72, goal.phi + 0.10);
    if (event.key === '+' || event.key === '=') goal.distance = Math.max(12.5, goal.distance * 0.90);
    if (event.key === '-') goal.distance = Math.min(49, goal.distance / 0.90);
    dirty = true;
    wake();
  };
  const onDoubleClick = () => {
    goal.distance = baselineDistance || 25;
    setView('perspective');
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('dblclick', onDoubleClick);
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(container);
  window.addEventListener('resize', resize);
  resize();

  return {
    available: true,
    update,
    setView,
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('dblclick', onDoubleClick);
      disposeTree(model);
      disposeTree(decoration);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
