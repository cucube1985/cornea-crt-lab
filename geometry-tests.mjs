import assert from 'node:assert/strict';
import { corneaZ, lensSag, lensZ, sampleFit, normalizeParams, defaultParams } from './dist/geometry.js';
import { parseCalculatorText } from './dist/recommend.js';

const near = (a, b, tolerance, label) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`);
const p = { ...defaultParams };

// Spherical analytic special case independently checks sag signs and units.
const sphere = { ...p, flatK: 45, steepK: 45, q: 0 };
const radius = 337.5 / 45;
near(corneaZ(3, 4, sphere), -(radius - Math.sqrt(radius ** 2 - 25)), 1e-12, 'spherical biconic special case');
near(corneaZ(0, 0, p), 0, 1e-14, 'corneal apex');
assert.ok(corneaZ(0, 3, p) < corneaZ(3, 0, p), '90 degree steep axis must sag more vertically');
near(corneaZ(2, 1, { ...p, steepAxis: 27 }), corneaZ(-1, 2, { ...p, steepAxis: 117 }), 1e-12, 'principal-axis rotational covariance');
near(corneaZ(2, 1, p), corneaZ(2, 1, { ...p, steepAxis: p.steepAxis + 180 }), 1e-12, 'axis modulo 180');
const swapped = normalizeParams({ ...p, flatK: p.steepK, steepK: p.flatK, steepAxis: 0 });
near(corneaZ(2, 1, swapped), corneaZ(2, 1, p), 1e-12, 'swapping K and principal axes preserves the surface');
assert.ok(Number.isNaN(corneaZ(20, 20, p)), 'invalid conic domain is not silently extrapolated');

// BC is a millimetre radius; RZD is the explicit model depth across radii 3..4.
near(lensSag(2, p), p.bc - Math.sqrt(p.bc ** 2 - 4), 1e-12, 'spherical optic-zone sag');
near(lensSag(4, p) - lensSag(3, p), p.rzd / 1000, 1e-12, 'return zone depth units');
near(lensSag(4, { ...p, rzd: 575 }) - lensSag(4, p), 0.025, 1e-12, 'RZD 25 micron increment');
const h = 1e-4;
for (const join of [3, 4]) {
  const leftSlope = (lensSag(join, p) - lensSag(join - h, p)) / h;
  const rightSlope = (lensSag(join + h, p) - lensSag(join, p)) / h;
  near(leftSlope, rightSlope, 1e-4, `first derivative at radius ${join}`);
  const leftCurve = (lensSag(join, p) - 2 * lensSag(join - h, p) + lensSag(join - 2 * h, p)) / h ** 2;
  const rightCurve = (lensSag(join + 2 * h, p) - 2 * lensSag(join + h, p) + lensSag(join, p)) / h ** 2;
  near(leftCurve, rightCurve, 0.004, `second derivative at radius ${join}`);
}
near((lensSag(4.4 + h, p) - lensSag(4.4 - h, p)) / (2 * h), Math.tan(33 * Math.PI / 180), 1e-9, 'landing-zone tangent');
const r3Sag = lensSag(3, p);
const expectedNoLiftEdge = r3Sag + p.rzd / 1000 + Math.tan(p.lza * Math.PI / 180) * (p.diameter / 2 - 4);
near(expectedNoLiftEdge - lensSag(p.diameter / 2, p), 0.025, 1e-12, 'assumed 25 micron edge lift');
assert.ok(Number.isNaN(lensSag(p.diameter / 2 + 0.01, p)), 'outside lens has no surface');
const moved = { ...p, offsetX: 0.6, offsetY: -0.3, tiltX: 1.5, tiltY: -0.7, clearance: 0.08 };
near(lensZ(moved.offsetX, moved.offsetY, moved), 0.08, 1e-12, 'decentered apex height');
near(lensZ(1.6, -0.3, moved), 0.08 - lensSag(1, p) + Math.tan(1.5 * Math.PI / 180), 1e-12, 'tilt and lens-local coordinate');

// Seating is a translation: minimum gap reaches 2 µm and all valid samples agree.
const fit = sampleFit(p);
near(fit.metrics.minGap, 2, 1e-9, 'automatic sampled minimum gap');
assert.equal(fit.metrics.penetrationFraction, 0);
assert.equal(fit.metrics.coverageFraction, 1);
assert.ok(fit.grid.samples.every(s => s.gap >= 2 - 1e-8), 'seating prevents sampled geometric penetration');
for (const s of fit.grid.samples.filter((_, index) => index % 137 === 0)) {
  near(s.gap, (lensZ(s.x, s.y, fit.params) - corneaZ(s.x, s.y, fit.params)) * 1000, 1e-9, 'rendered geometry and fit metric agree');
}
const manual = sampleFit({ ...p, autoSeat: false, clearance: -0.05 });
assert.ok(manual.metrics.penetrationFraction > 0, 'manual negative clearance exposes overlap');
near(manual.metrics.centralGap, -50, 1e-9, 'manual clearance µm reporting');
const raised = sampleFit({ ...p, autoSeat: false, clearance: -0.025 });
near(raised.metrics.minGap - manual.metrics.minGap, 25, 1e-9, 'clearance translates gaps linearly');
const circular = sampleFit({ ...p, flatK: 43, steepK: 43 });
near(circular.metrics.asymmetry, 0, 1e-9, 'centered spherical eye has rotationally symmetric gap');
assert.ok(fit.metrics.asymmetry > 20, 'toricity creates circumferential gap asymmetry');
const tilted = sampleFit(moved);
near(tilted.metrics.minGap, 2, 1e-9, 'decentration and tilt still seat only vertically');
assert.ok(tilted.metrics.asymmetry > circular.metrics.asymmetry);
for (const diameter of [10.5, 11]) {
  const result = sampleFit({ ...p, diameter });
  near(result.zones.lensRadius, diameter / 2, 1e-12, 'requested diameter');
  assert.ok(Number.isFinite(result.metrics.returnGap) && Number.isFinite(result.metrics.edgeGap));
}

// Pasted calculator output is parsed into lens parameters; DA wording sets the toric flag.
{
  const da = parseCalculatorText('Toric: CRT DA(toric) recommended\nOAD: 10.5\nBC: 8.6\nRZD1: 525\nRZD2: 550\nLZA: 33\nLensSag@8mm: 1071');
  assert.deepEqual(da, { bc: 8.6, rzd1: 525, rzd2: 550, lza: 33, oad: 10.5, toric: true });
  const sph = parseCalculatorText('Toric: CRT(spherical) available\nOAD: 11.0\nBC: 8.3\nRZD1: 525\nRZD2: 525\nLZA: 33');
  assert.deepEqual(sph, { bc: 8.3, rzd1: 525, rzd2: 525, lza: 33, oad: 11, toric: false });
  const loose = parseCalculatorText('BC 8.4 RZD 550 LZA 34 K1 42.75 K2 44 Ecc 0.5 Flat Ecc 0.4');
  assert.deepEqual(loose, { k1: 42.75, k2: 44, ecc: 0.5, bc: 8.4, rzd1: 550, lza: 34 });
  assert.deepEqual(parseCalculatorText('no numbers here'), {});
}

console.log('Geometry checks passed: analytic cornea, axes, zone continuity, units, diameter, pose, seating, gap metrics, and calculator paste parsing.');
