/**
 * Educational anterior-cornea / CRT-like posterior-surface geometry.
 * Distances and coordinates are millimetres; reported gaps are micrometres.
 * World +z points anteriorly, corneal apex is (0,0,0), and x/y are image-right/up.
 * This is a geometric illustration, not a reconstruction of a manufactured lens,
 * a topographic measurement, a biomechanical simulation, or a fitting algorithm.
 */

export const defaultParams = Object.freeze({
  flatK: 43.0,
  steepK: 44.5,
  steepAxis: 90,
  q: -0.25,
  bc: 8.6,
  rzd: 550,
  lza: 33,
  diameter: 10.5,
  offsetX: 0,
  offsetY: 0,
  tiltX: 0,
  tiltY: 0,
  clearance: 0.002,
  autoSeat: true,
  seatTarget: 2,
});

export const modelAssumptions = Object.freeze({
  keratometricIndex: 1.3375,
  radiusConversion: 'r [mm] = 337.5 / K [D]',
  opticRadius: 3,
  returnOuterRadius: 4,
  edgeWidth: 0.35,
  edgeLift: 0.025,
  cornea: 'Biconic anterior surface with orthogonal principal axes and one assumed Q.',
  returnZone: 'C2 quintic interpolation; sag increases by RZD/1000 between radii 3 and 4 mm.',
  landingZone: 'Straight radial tangent with slope tan(abs(LZA)); final 0.35 mm has 25 µm assumed edge lift.',
  seating: 'Vertical translation only to sampled minimum gap; no tear, pressure, flexure, motion, or remodeling model.',
  tilt: 'Planar slope approximation: tan(tiltX)*localX + tan(tiltY)*localY, not rigid-body rotation.',
});

const DEG = Math.PI / 180;
const finite = (value, fallback) => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : fallback;
const axis180 = (angle) => ((angle % 180) + 180) % 180;
const smootherstep = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Reversed K entries are swapped together with a 90° principal-axis rotation. */
export function normalizeParams(input = {}) {
  const p = { ...defaultParams, ...input };
  for (const key of ['flatK', 'steepK', 'steepAxis', 'q', 'bc', 'rzd', 'lza', 'diameter', 'offsetX', 'offsetY', 'tiltX', 'tiltY', 'clearance', 'seatTarget']) {
    p[key] = finite(p[key], defaultParams[key]);
  }
  if (p.flatK <= 0 || p.steepK <= 0) throw new RangeError('K must be positive dioptres.');
  if (p.bc <= 3) throw new RangeError('BC must exceed the 3 mm optic-zone radius.');
  if (p.rzd <= 0) throw new RangeError('RZD must be positive micrometres.');
  if (p.diameter <= 8) throw new RangeError('Diameter must exceed the 8 mm return-zone chord.');
  if (Math.abs(p.lza) >= 85) throw new RangeError('LZA magnitude must be below 85 degrees.');
  if (Math.abs(p.tiltX) >= 45 || Math.abs(p.tiltY) >= 45) throw new RangeError('Tilt magnitude must be below 45 degrees per direction.');
  p.axesSwapped = false;
  if (p.flatK > p.steepK) {
    [p.flatK, p.steepK] = [p.steepK, p.flatK];
    p.steepAxis += 90;
    p.axesSwapped = true;
  }
  p.steepAxis = axis180(p.steepAxis);
  p.flatAxis = axis180(p.steepAxis + 90);
  p.lza = Math.abs(p.lza);
  p.autoSeat = p.autoSeat !== false;
  p.seatTarget = Math.max(0, p.seatTarget);
  return p;
}

function compile(input) {
  const p = normalizeParams(input);
  const theta = p.steepAxis * DEG;
  const radius = p.diameter / 2;
  const bcRoot = Math.sqrt(p.bc * p.bc - 9);
  const y0 = 9 / (p.bc + bcRoot);
  const m0 = 3 / bcRoot;
  const c0 = p.bc * p.bc / (bcRoot * bcRoot * bcRoot);
  const m1 = Math.tan(p.lza * DEG);
  // Quintic endpoint constraints: value, first derivative and second derivative.
  const a = p.rzd / 1000 - m0 - c0 / 2;
  const b = m1 - m0 - c0;
  const c = -c0;
  return {
    p, radius,
    rf: 337.5 / p.flatK,
    rs: 337.5 / p.steepK,
    cos: Math.cos(theta),
    sin: Math.sin(theta),
    sx: Math.tan(p.tiltX * DEG),
    sy: Math.tan(p.tiltY * DEG),
    y0, m0, c0, m1,
    a3: 10 * a - 4 * b + c / 2,
    a4: -15 * a + 7 * b - c,
    a5: 6 * a - 3 * b + c / 2,
    edgeStart: radius - modelAssumptions.edgeWidth,
  };
}

function corneaAt(x, y, c) {
  const v = x * c.cos + y * c.sin; // steep principal meridian
  const u = -x * c.sin + y * c.cos; // flat principal meridian
  const uf = u / c.rf;
  const vs = v / c.rs;
  const radicand = 1 - (1 + c.p.q) * (uf * uf + vs * vs);
  if (radicand < 0) return NaN;
  return -(u * uf + v * vs) / (1 + Math.sqrt(radicand));
}

function sagAt(r, c) {
  r = Math.abs(r);
  if (!Number.isFinite(r) || r > c.radius + 1e-9) return NaN;
  let sag;
  if (r <= 3) {
    sag = r * r / (c.p.bc + Math.sqrt(c.p.bc * c.p.bc - r * r));
  } else if (r < 4) {
    const t = r - 3;
    sag = c.y0 + c.m0 * t + c.c0 / 2 * t * t + c.a3 * t ** 3 + c.a4 * t ** 4 + c.a5 * t ** 5;
  } else {
    sag = c.y0 + c.p.rzd / 1000 + c.m1 * (r - 4);
  }
  // The manufacturer controls its own edge-lift system. This is an explicit
  // independent illustrative choice, not a recovered manufacturing dimension.
  if (r > c.edgeStart) sag -= modelAssumptions.edgeLift * smootherstep((r - c.edgeStart) / modelAssumptions.edgeWidth);
  return sag;
}

function lensAt(x, y, c) {
  const lx = x - c.p.offsetX;
  const ly = y - c.p.offsetY;
  return c.p.clearance - sagAt(Math.hypot(lx, ly), c) + c.sx * lx + c.sy * ly;
}

/** Biconic anterior cornea. Returns NaN outside its real-valued mathematical domain. */
export function corneaZ(x, y, p = defaultParams) {
  return corneaAt(x, y, compile(p));
}

/** Positive posterior-surface sag from the lens apex; NaN outside its diameter. */
export function lensSag(r, p = defaultParams) {
  return sagAt(r, compile(p));
}

/** Posterior lens surface in the corneal world coordinate system. */
export function lensZ(x, y, p = defaultParams) {
  return lensAt(x, y, compile(p));
}

export function zoneForRadius(r, p = defaultParams) {
  r = Math.abs(r);
  const radius = finite(p.diameter, defaultParams.diameter) / 2;
  if (r > radius + 1e-9) return 'outside';
  if (r <= 3) return 'optic';
  if (r <= 4) return 'return';
  return r >= radius - modelAssumptions.edgeWidth ? 'edge' : 'landing';
}

/**
 * Sample an undeformed lens/cornea relationship, optionally translating the lens
 * vertically until the smallest SAMPLED gap equals seatTarget (default 2 µm).
 * Use result.params for rendering: its clearance includes that translation.
 * Contact means only a numerical gap band, not measured pressure or contact.
 */
export function sampleFit(input = {}, options = {}) {
  const c = compile(input);
  const originalClearance = c.p.clearance;
  const size = Math.max(25, Math.min(151, Math.round(options.gridSize ?? 81) | 1));
  const radialCount = Math.max(24, Math.min(180, Math.round(options.radialCount ?? 80)));
  const angularCount = Math.max(48, Math.min(360, Math.round(options.angularCount ?? 160)));
  const step = c.radius * 2 / (size - 1);
  const originX = c.p.offsetX - c.radius;
  const originY = c.p.offsetY - c.radius;
  const rawGrid = new Array(size * size).fill(null);
  const allRaw = [];
  let minBaseGap = Infinity;
  let maxBaseGap = -Infinity;
  let minRaw = null;
  let maxRaw = null;
  let footprintCount = 0;

  const rawAt = (lx, ly) => {
    const x = lx + c.p.offsetX;
    const y = ly + c.p.offsetY;
    const r = Math.hypot(lx, ly);
    const cz = corneaAt(x, y, c);
    const baseLensZ = -sagAt(r, c) + c.sx * lx + c.sy * ly;
    if (!Number.isFinite(cz) || !Number.isFinite(baseLensZ)) return null;
    const baseGap = baseLensZ - cz;
    const raw = { x, y, r, corneaZ: cz, baseLensZ, baseGap };
    allRaw.push(raw);
    if (baseGap < minBaseGap) { minBaseGap = baseGap; minRaw = raw; }
    if (baseGap > maxBaseGap) { maxBaseGap = baseGap; maxRaw = raw; }
    return raw;
  };

  // Area-uniform Cartesian samples supply averages and area fractions.
  for (let row = 0; row < size; row++) {
    const ly = -c.radius + row * step;
    for (let col = 0; col < size; col++) {
      const lx = -c.radius + col * step;
      if (Math.hypot(lx, ly) > c.radius + 1e-9) continue;
      footprintCount++;
      rawGrid[row * size + col] = rawAt(lx, ly);
    }
  }
  // Extra polar samples include the actual circular boundary and zone joins.
  const radii = new Set([0, 3, 4, c.radius, c.edgeStart]);
  for (let ring = 1; ring < radialCount; ring++) radii.add(c.radius * ring / radialCount);
  for (const r of radii) {
    if (r < 0 || r > c.radius) continue;
    const directions = r === 0 ? 1 : angularCount;
    for (let k = 0; k < directions; k++) {
      const theta = 2 * Math.PI * k / directions;
      rawAt(r * Math.cos(theta), r * Math.sin(theta));
    }
  }
  if (!allRaw.length) throw new RangeError('Lens footprint is outside the real-valued corneal model domain.');
  if (c.p.autoSeat) c.p.clearance = c.p.seatTarget / 1000 - minBaseGap;

  const finish = (s) => ({
    x: s.x, y: s.y, r: s.r,
    corneaZ: s.corneaZ,
    lensZ: c.p.clearance + s.baseLensZ,
    gap: (c.p.clearance + s.baseGap) * 1000,
    zone: zoneForRadius(s.r, c.p),
  });
  const samples = rawGrid.filter(Boolean).map(finish);
  const values = rawGrid.map(s => s ? (c.p.clearance + s.baseGap) * 1000 : null);
  const average = arr => arr.length ? arr.reduce((sum, s) => sum + s.gap, 0) / arr.length : NaN;
  const at = (x, y) => {
    const cz = corneaAt(x, y, c);
    const lz = lensAt(x, y, c);
    return { x, y, corneaZ: cz, lensZ: lz, gap: (lz - cz) * 1000 };
  };
  const referenceRadius = Math.min(4.5, c.radius - modelAssumptions.edgeWidth);
  const ringGaps = [];
  for (let k = 0; k < angularCount; k++) {
    const theta = k / angularCount * 2 * Math.PI;
    const point = at(c.p.offsetX + referenceRadius * Math.cos(theta), c.p.offsetY + referenceRadius * Math.sin(theta));
    if (Number.isFinite(point.gap)) ringGaps.push(point.gap);
  }
  const principalGap = (angle) => {
    const theta = angle * DEG;
    return [1, -1].map(sign => at(c.p.offsetX + sign * referenceRadius * Math.cos(theta), c.p.offsetY + sign * referenceRadius * Math.sin(theta)).gap).reduce((a, b) => a + b, 0) / 2;
  };
  const flatAt4 = corneaAt(-4 * c.sin, 4 * c.cos, c);
  const steepAt4 = corneaAt(4 * c.cos, 4 * c.sin, c);
  const metrics = {
    minGap: (minBaseGap + c.p.clearance) * 1000,
    maxGap: (maxBaseGap + c.p.clearance) * 1000,
    meanGap: average(samples),
    centralGap: at(c.p.offsetX, c.p.offsetY).gap,
    apicalGap: at(0, 0).gap,
    centralMeanGap: average(samples.filter(s => s.r <= 1.5)),
    returnGap: average(samples.filter(s => s.r > 3 && s.r <= 4)),
    landingGap: average(samples.filter(s => s.r > 4 && s.r < c.edgeStart)),
    edgeGap: average(samples.filter(s => s.r >= c.edgeStart)),
    contactFraction: samples.filter(s => s.gap >= -0.1 && s.gap <= 5).length / samples.length,
    penetrationFraction: samples.filter(s => s.gap < -0.1).length / samples.length,
    // Peak-to-peak gap on one common circle is a geometric asymmetry measure.
    asymmetry: ringGaps.length ? Math.max(...ringGaps) - Math.min(...ringGaps) : NaN,
    asymmetryRadius: referenceRadius,
    flatGap: principalGap(c.p.flatAxis),
    steepGap: principalGap(c.p.steepAxis),
    elevationDifference: (flatAt4 - steepAt4) * 1000,
    decentration: Math.hypot(c.p.offsetX, c.p.offsetY),
    coverageFraction: samples.length / footprintCount,
    minGapLocation: finish(minRaw),
    maxGapLocation: finish(maxRaw),
  };
  const meridian = angle => {
    const theta = angle * DEG;
    const halfSpan = Math.max(6, c.radius + Math.hypot(c.p.offsetX, c.p.offsetY));
    return Array.from({ length: 241 }, (_, i) => {
      const r = -halfSpan + i / 240 * halfSpan * 2;
      return { r, ...at(r * Math.cos(theta), r * Math.sin(theta)) };
    });
  };
  return {
    params: c.p,
    autoSeated: c.p.autoSeat,
    clearance: c.p.clearance,
    verticalShift: c.p.clearance - originalClearance,
    radii: { flat: c.rf, steep: c.rs },
    zones: { opticRadius: 3, returnOuterRadius: 4, lensRadius: c.radius, edgeStart: c.edgeStart },
    metrics,
    grid: { size, step, originX, originY, values, samples },
    meridians: { flat: meridian(c.p.flatAxis), steep: meridian(c.p.steepAxis), horizontal: meridian(0), vertical: meridian(90) },
    assumptions: modelAssumptions,
  };
}
