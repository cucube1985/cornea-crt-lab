import assert from 'node:assert/strict';
import {defaultParams,corneaZ,anteriorMetrics,sampleFit,circleOverlapFraction,createGeometrySampler} from './dist/geometry.js';
import {emptyMetadata,sanitizeRecord,elevationToSag,parseSession,makeSession,validateParameters} from './dist/patient-data.js';
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const p={...defaultParams,qFlat:-.1,qSteep:-.5};
const sag=(r,R,Q)=>r*r/(R*(1+Math.sqrt(1-(1+Q)*r*r/(R*R))));
near(-corneaZ(4,0,p),sag(4,337.5/p.flatK,-.1));
near(-corneaZ(0,4,p),sag(4,337.5/p.steepK,-.5));
// Independent, measured opposite-meridian means must constrain both selected chords.
const measured={...p,sag8Flat:1080,sag8Steep:1140,sag10Flat:1800,sag10Steep:1900,asymNT:40,asymSI:-30};
const m=anteriorMetrics(measured);
near(m.sag8Flat,1080);near(m.sag8Steep,1140);near(m.ced8,60);near(m.sag10Flat,1800);near(m.sag10Steep,1900);
near(m.asymNT,40);near(m.asymSI,-30);
const left={...measured,eye:'OS'};near(anteriorMetrics(left).asymNT,40);near(corneaZ(4,0,left),corneaZ(-4,0,measured));
// Sparse peripheral corrections preserve the apex and its measured paraxial curvature.
const h=1e-5;
near(corneaZ(0,0,measured),0);
near(-(corneaZ(h,0,measured)+corneaZ(-h,0,measured))/(h*h),p.flatK/337.5,1e-6);
near(-(corneaZ(0,h,measured)+corneaZ(0,-h,measured))/(h*h),p.steepK/337.5,1e-6);
// Missing peripheral measurements continue to use their analytic base; they are not zero sag.
near(anteriorMetrics({...p,sag8Flat:null}).sag8Flat,sag(4,337.5/p.flatK,-.1)*1000);
const compiled=createGeometrySampler(measured);near(compiled.corneaZ(2,1),corneaZ(2,1,measured));
// Boundary clipping excludes a too-large/decentered footprint rather than extrapolating it.
assert.ok(Number.isNaN(corneaZ(5,0,{...p,hvid:9,vvid:10})));
const clipped=sampleFit({...p,hvid:9,vvid:10,diameter:11});assert.ok(clipped.metrics.coverageFraction<1);assert.ok(clipped.metrics.coverageFraction>0);near(clipped.metrics.minGap,2);
for(const s of clipped.grid.samples)assert.ok((s.x/4.5)**2+(s.y/5)**2<=1+1e-8);
// Circle overlap: containment, separation and the independently known unit-circle lens.
near(circleOverlapFraction(2,3,0),1);near(circleOverlapFraction(3,2,0),4/9);near(circleOverlapFraction(1,1,2),0);
near(circleOverlapFraction(1,1,1),(2*Math.PI/3-Math.sqrt(3)/2)/Math.PI);
assert.equal(anteriorMetrics(p).pupilOverlap,null,'BC diameter is never substituted for a treatment zone');
near(anteriorMetrics({...p,treatmentDiameter:6,pupilNight:4}).pupilOverlap,1);
// BFS conversion accounts for the apex offset, direction convention and micrometre units.
near(elevationToSag(8,15,8,5),(8-Math.sqrt(64-16))*1000-10);
assert.throws(()=>elevationToSag(10,0,4,0));
// Snapshots round-trip every geometric input and keep metadata out of the corneal equation.
const record={input:measured,meta:{...emptyMetadata(),label:'가상 비교 A',axl:25.4,sources:{size:'measured',q:'entered',rings:'measured',asym:'assumed',pupil:'measured'}}};
const session=makeSession(record,{A:record,B:null});const parsed=parseSession(JSON.stringify(session));
assert.equal(parsed.current.meta.axl,25.4);assert.equal(parsed.cases.B,null);near(parsed.cases.A.input.sag10Steep,1900);
near(corneaZ(2,3,parsed.current.input),corneaZ(2,3,record.input));
const other=sanitizeRecord({...record,meta:{...record.meta,axl:22}});near(corneaZ(2,3,other.input),corneaZ(2,3,record.input));
parsed.cases.A.input.hvid=10;assert.equal(parsed.current.input.hvid,11.8,'comparison snapshots are independent');
assert.throws(()=>parseSession('{"version":1}'));assert.throws(()=>parseSession('x'.repeat(500001)));
assert.throws(()=>sanitizeRecord({input:{...p,hvid:'12'},meta:{}}));assert.throws(()=>validateParameters({...p,pupilDay:-1}));assert.throws(()=>validateParameters({...p,flatK:50,steepK:40}));
assert.throws(()=>sanitizeRecord({input:p,meta:{axl:NaN}}));
assert.throws(()=>validateParameters({...p,hvid:9,vvid:9,sag10Flat:1700}),'ring measurements must lie within the entered corneal boundary');
const bfsInput={...p,sag8Flat:elevationToSag(8,0,8,10)};
const bfsRecord={input:bfsInput,meta:{...emptyMetadata(),ringForm:{kind:'bfs',bfsRadius:8,apexElevation:10,sag8Flat:0}}};
near(sanitizeRecord(bfsRecord).input.sag8Flat,bfsInput.sag8Flat);
assert.throws(()=>sanitizeRecord({...bfsRecord,input:{...bfsInput,sag8Flat:2000}}),'contradictory BFS provenance cannot be imported');
const clean=sanitizeRecord({input:{...p,untrusted:'drop'},meta:{label:'a'.repeat(100),untrusted:'drop'}});assert.equal(clean.meta.label.length,40);assert.ok(!('untrusted'in clean.input));assert.ok(!('untrusted'in clean.meta));
console.log('Patient geometry and comparison checks passed: meridional conics, independent sag constraints, asymmetry/eye direction, central curvature, clipped coverage, circle overlap, BFS units, snapshots and input validation.');
