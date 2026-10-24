import assert from 'node:assert/strict';
import {defaultParams,corneaZ,lensSag,sampleFit} from './dist/geometry.js';
import {modelParameters} from './dist/model-modes.js';

const measured=Object.freeze({...defaultParams,flatK:42,steepK:45,steepAxis:70,hvid:10.8,vvid:11.4,q:-.6,qFlat:-.15,qSteep:-.7,sag8Flat:1100,sag8Steep:1250,asymNT:80,asymSI:-30,pupilX:.4,offsetX:.6,tiltY:1,bc:8.9,diameter:11});
const simple={...defaultParams,flatK:42,steepK:45,steepAxis:70};
const basic=modelParameters(measured,'basic'),basicFit=modelParameters(measured,'basic-ok');
// Neither Advanced anatomy nor hidden lens parameters may alter the Basic cornea.
for(const [x,y] of [[0,0],[1,2],[-3,2],[4,0]]){
  assert.equal(corneaZ(x,y,basic),corneaZ(x,y,simple));
  assert.equal(corneaZ(x,y,basicFit),corneaZ(x,y,simple));
}
assert.equal(basic.hvid,11.8);assert.equal(basic.q,-.25);
assert.equal(basicFit.bc,8.9);assert.equal(basicFit.offsetX,.6);
assert.equal(basicFit.tiltY,1);assert.equal(basicFit.diameter,11);
assert.notEqual(corneaZ(4,0,modelParameters(measured,'advanced')),corneaZ(4,0,basic));
// Lens-only placement is independent of K, pupil, tilt, and auto seating.
const ok=modelParameters(measured,'ok'),okOther=modelParameters({...measured,flatK:50,steepK:51,offsetX:-1,tiltY:-3,autoSeat:false,clearance:.4},'ok');
assert.deepEqual(ok,okOther);assert.equal(ok.clearance,0);assert.equal(ok.autoSeat,false);
assert.equal(ok.offsetX,0);assert.equal(ok.tiltY,0);
assert.equal(lensSag(2,ok),2**2/(ok.bc+Math.sqrt(ok.bc**2-2**2)));
const placed=sampleFit(ok);assert.equal(placed.clearance,0);
const movedLens=modelParameters({...measured,bc:9.2,rzd:650,lza:35,diameter:10.5},'ok');
assert.notEqual(lensSag(4.5,ok),lensSag(4.5,movedLens));
// Returning to Advanced restores every input; projection never mutates the record.
assert.deepEqual(modelParameters(measured,'advanced'),measured);
assert.equal(measured.qFlat,-.15);assert.equal(measured.hvid,10.8);
assert.throws(()=>modelParameters(measured,'invalid'),RangeError);
console.log('Model selection: Basic independence, lens-only placement, Basic-OK geometry, and Advanced preservation passed.');
