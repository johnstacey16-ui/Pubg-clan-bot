const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const start=html.indexOf('const RECOIL_RAW = {');
const stop=html.indexOf('WEAPONS.forEach(w=>',start);
assert.ok(start>=0&&stop>start);
const recoil=vm.runInNewContext(html.slice(start,stop)+';RECOIL_RAW');

test('2026 LMG crouch multipliers replace pre-43.1 records',()=>{
  for(const [name,expected] of [['M249',.70],['MG3',.60],['RPD',.70]]){
    assert.equal(recoil[name][1],expected,name+' crouch factor');
    assert.equal(recoil[name][2],Math.round((expected-1)*100),name+' displayed change');
  }
  assert.equal(recoil.M249[7],20);
  assert.equal(recoil.MG3[7],25);
  assert.equal(recoil.RPD[7],25);
});

test('LGMs continue to show source-backed parameters, never made-up shot-by-shot curves',()=>{
  assert.match(html,/const fields = \[/);
  assert.match(html,/simulated positions in curve units/);
  assert.match(html,/Per-Shot Recoil Analyzer/);
  assert.doesNotMatch(html,/const rawV = w\.vRecoil\*/);
});

test('no impact on sensitivity, ranged damage or weapon database structure',()=>{
  for(const name of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange']){
    assert.match(html,new RegExp('function '+name+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s),'inline '+i));
});
