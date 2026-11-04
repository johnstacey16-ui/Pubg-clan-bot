// Keep legacy Combat DB recoil values aligned with their game-file meanings.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const beg=html.indexOf('const RECOIL_RAW = {');
const end=html.indexOf('const RECOIL_DETAIL_43_2 = {',beg);
assert.ok(beg>=0&&end>beg);
const raw=vm.runInNewContext(html.slice(beg,end)+';RECOIL_RAW');

test('Mini 14 current max vertical recoil stays exactly 3.15',()=>{
  assert.equal(raw['Mini 14'][0],3.15);
  assert.equal(raw['Mini 14'][1],.75);
  assert.equal(raw['Mini 14'][4],.15);
  assert.equal(raw['Mini 14'][5],11.2);
  assert.equal(raw['Mini 14'][6],11);
  assert.equal(raw['Mini 14'][7],30);
});

test('raw game recoil values are not described as shot-by-shot movement',()=>{
  assert.match(html,/Maximum vertical recoil \(raw\)/);
  assert.match(html,/Max V\.Recoil/);
  assert.match(html,/Extracted maximum vertical recoil parameter\. NOT measured screen movement per shot/);
  assert.match(html,/Vertical recoil speed parameter in the gun configuration/);
  assert.match(html,/Horizontal recoil speed parameter in the gun configuration/);
  assert.match(html,/Signed horizontal tendency parameter from gun configuration/);
  assert.match(html,/Minimum horizontal recoil scalar expressed as a percentage/);
  assert.doesNotMatch(html,/Vertical kick per shot — how much the gun climbs/);
  assert.doesNotMatch(html,/How fast the gun snaps upward after each shot/);
  assert.doesNotMatch(html,/Higher means a more consistent spray/);
});

test('shot-by-shot curve remains explicitly unknown',()=>{
  assert.match(html,/simulated positions in curve units/);
  assert.match(html,/Per-Shot Recoil Analyzer/);
  assert.match(html,/w\.recoilDetail = RECOIL_DETAIL_43_2\[w.name\] \|\| null/);
});

test('scope conversions, ballistics, magazine and shotguns preserved',()=>{
  for(const fn of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange','extendedCapFor','minimumIdealFlightTime']){
    assert.match(html,new RegExp('function '+fn+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((script,i)=>assert.doesNotThrow(()=>new vm.Script(script),'script '+i));
});
