// Official PUBG 2026 LMG reload baselines; no accidental second rebalance.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=require('./toolkit-test-source.cjs')();
const start=source.indexOf('const LMG_RELOAD_2026 = Object.freeze(');
const end=source.indexOf('function debounce(fn, ms)',start);
assert.ok(start>0&&end>start,'Official reload registry and shared calculator helper');
const data=vm.runInNewContext(source.slice(start,end)+';({LMG_RELOAD_2026,reloadSecondsForWeapon})');
const reload=data.reloadSecondsForWeapon;

test('PUBG developer-letter post-balance LMG base reloads are used once',()=>{
  assert.equal(reload({name:'RPD',reload:3.5}),5.2);
  assert.equal(reload({name:'M249',reload:3.5}),5.962);
  assert.equal(reload({name:'MG3',reload:3.5}),null);
  // Exact data must not silently inherit generic owner-authored placeholders.
  assert.equal(Object.keys(data.LMG_RELOAD_2026).length,3);
  assert.equal(data.LMG_RELOAD_2026.RPD,5.2);
  assert.equal(data.LMG_RELOAD_2026.M249,5.962);
  assert.equal(data.LMG_RELOAD_2026.MG3,null);
});
test('non-LMG owner-supplied reload inputs retain their previous behavior',()=>{
  for(const [name,value] of [['AKM',3.1],['Kar98k',2],['M416',3.1],['S686',2.3]]){
    assert.equal(reload({name,reload:value}),value);
  }
  assert.equal(reload({name:'Unknown',reload:null}),null);
  assert.equal(reload({name:'Unknown',reload:0}),null);
  assert.equal(reload({name:'Unknown',reload:NaN}),null);
});
test('TTK and attachment panels share one base-time function with no double 25% cut',()=>{
  assert.match(source,/function reloadSecondsFor\(w\)\{ return reloadSecondsForWeapon\(w\); \}/);
  assert.match(source,/const realBaseReload = reloadSecondsForWeapon\(w\)/);
  assert.match(source,/const reloadMult = 1 \/ reloadSpeedMultiplier;/);
  assert.match(source,/const finalReload = realBaseReload==null \? null : realBaseReload\*reloadMult;/);
  assert.match(source,/finalReload==null \? "No data"/);
  assert.doesNotMatch(source,/if\(LMG_PATCH_42_3\.has\(w.name\)\) base \*= 0\.75/);
  assert.doesNotMatch(source,/if\(isLmgPatched\) reloadMult \*= 0\.75/);
  assert.doesNotMatch(source,/RPD reload time is not verified/);
  assert.match(source,/MG3 real reload-animation time is not verified/);
  // Representative modeled quickdraw maths; 60% extra reload *speed*
  // means duration /1.6, not multiplying by 0.4 or by another 0.75.
  assert.equal(Math.round(reload({name:'M249',reload:3.5})/1.6*1000)/1000,3.726);
  assert.equal(reload({name:'RPD',reload:3.5}),5.2);
});
test('no change to user-supplied scope matcher or measured ballistics functions',()=>{
  for(const fn of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange','extendedCapFor']){
    assert.match(source,new RegExp('function '+fn+'\\('));
  }
  const scripts=[...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((script,i)=>assert.doesNotThrow(()=>new vm.Script(script),'script '+i));
});
