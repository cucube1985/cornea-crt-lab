import assert from 'node:assert/strict';
import {capillaryLineForce,sanitizeRetention,retentionDefaults,emptyOutcome,sanitizeOutcome,outcomeMetrics,outcomeKModels,sphericalEquivalent} from './dist/fitting-effects.js';
import {emptyMetadata,makeSession,parseSession,sanitizeRecord} from './dist/patient-data.js';
import {defaultParams,corneaZ} from './dist/geometry.js';
const near=(a,b,e=1e-10)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
// Independent force/length SI calculation, one contact line (no double counting).
near(capillaryLineForce(10,{gamma:50,beta:0}).axialMn,.05*(Math.PI*.01)*1000);
near(capillaryLineForce(10.5,{gamma:40,beta:60}).axialMn,.04*Math.PI*.0105*.5*1000);
assert.equal(capillaryLineForce(11,{gamma:40,beta:90}).axialMn,0);
assert.equal(capillaryLineForce(11,{gamma:0,beta:30}).axialMn,0);
near(capillaryLineForce(11).axialMn/capillaryLineForce(10.5).axialMn,11/10.5);
assert.throws(()=>sanitizeRetention({gamma:'40'}));assert.throws(()=>sanitizeRetention({beta:91}));assert.throws(()=>sanitizeRetention({show:1}));assert.throws(()=>capillaryLineForce(-1));
// Missing measurement is not zero; positive and negative cylinders both supported.
assert.equal(sphericalEquivalent({sphere:-3,cylinder:null}),null);
near(sphericalEquivalent({sphere:-3,cylinder:-1}),-3.5);
near(sphericalEquivalent({sphere:-4,cylinder:1}),-3.5);
const measured={...emptyOutcome(),eye:'OD',before:{sphere:-3,cylinder:-1,axis:180,flatK:43,steepK:45,steepAxis:90},after:{sphere:-.25,cylinder:-.5,axis:170,flatK:40,steepK:41,steepAxis:null},zoneDiameter:4.5,beforeDate:'2026-10-01',afterDate:'2026-11-01',wearDays:30,removalHours:2,conditions:'가상 검증 자료'};
const m=outcomeMetrics(measured,'OD');near(m.preSE,-3.5);near(m.postSE,-.5);near(m.seChange,3);near(m.kReduction,3.5);
assert.equal(m.data.zoneX,null);assert.equal(m.data.zoneY,null,'unknown centration is not measured zero');
assert.equal(outcomeMetrics(measured,'OS').seChange,null);assert.equal(outcomeMetrics(measured,'OS').kReduction,null);
assert.equal(outcomeMetrics(emptyOutcome(),'OD').seChange,null);
assert.equal(outcomeMetrics({...measured,after:{...measured.after,cylinder:null}},'OD').seChange,null);
assert.throws(()=>sanitizeOutcome({...measured,beforeDate:'2026-02-30'}));
assert.throws(()=>sanitizeOutcome({...measured,afterDate:'2026-09-01'}));
assert.throws(()=>sanitizeOutcome({...measured,eye:'left'}));
assert.throws(()=>sanitizeOutcome({...measured,after:{flatK:45,steepK:40}}));
assert.throws(()=>sanitizeOutcome({...measured,zoneDiameter:0}));
assert.throws(()=>sanitizeOutcome({...measured,zoneX:'0'}));
const clean=sanitizeOutcome({...measured,conditions:'a'.repeat(300),untrusted:'drop'});assert.equal(clean.conditions.length,120);assert.ok(!('untrusted'in clean));
// Existing v2 settings remain compatible; full new data survives independent snapshots.
const legacy=parseSession(JSON.stringify({format:'cornea-lab-comparison',version:2,current:{input:defaultParams,meta:{label:'legacy'}},cases:{}}));
assert.deepEqual(legacy.current.meta.retention,retentionDefaults);assert.equal(legacy.current.meta.outcome.before.sphere,null);
const record={input:{...defaultParams},meta:{...emptyMetadata(),retention:{gamma:45,beta:50,show:false},outcome:measured}};
const saved=parseSession(JSON.stringify(makeSession(record,{A:record,B:null})));
near(saved.current.meta.retention.gamma,45);near(outcomeMetrics(saved.current.meta.outcome,'OD').seChange,3);
saved.cases.A.meta.outcome.before.sphere=-5;near(saved.current.meta.outcome.before.sphere,-3);
assert.throws(()=>sanitizeRecord({...record,meta:{...record.meta,outcome:{...measured,zoneDiameter:'4.5'}}}));
// K previews cannot reuse pre-wear peripheral measurements as post-wear shape.
const current={...defaultParams,qFlat:-.5,sag8Flat:1200,asymNT:80,treatmentDiameter:6,treatmentX:.3};
const pair=outcomeKModels(measured,current);
near(pair.before.flatK,43);near(pair.after.steepK,41);assert.equal(pair.after.steepAxis,90);
for(const p of Object.values(pair)){assert.equal(p.q,-.25);assert.equal(p.qFlat,null);assert.equal(p.sag8Flat,null);assert.equal(p.asymNT,0);assert.equal(p.treatmentDiameter,null);}
assert.equal(current.sag8Flat,1200);assert.throws(()=>outcomeKModels(measured,{...current,eye:'OS'}));
assert.throws(()=>outcomeKModels({...measured,after:{...measured.after,flatK:30,steepK:31}},current));
// Neither retention assumptions nor observed clinical outcomes deform the existing cornea.
near(corneaZ(1,2,record.input),corneaZ(1,2,saved.current.input));
console.log('Fitting effects passed: SI line forces, missing/signed measurements, eye/date checks, optical changes, K-only provenance, and v2 persistence.');
