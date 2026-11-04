const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const a=html.indexOf('const MEASURED_MUZZLE_VEL = '),b=html.indexOf('function hasDropData(w)',a);
assert.ok(a>0&&b>a);
const data=vm.runInNewContext(html.slice(a,b)+
  ';({MEASURED_MUZZLE_VEL,GAME_MUZZLE_VEL_43_2,knownMuzzleVelocity})');
const allNames=[...html.slice(html.indexOf('const WEAPONS = ['),html.indexOf('];',html.indexOf('const WEAPONS = ['))+2).matchAll(/^\["([^"]+)"/gm)].map(m=>m[1]);

test('every toolkit weapon has a sourced muzzle velocity except Vector with observed fallback',()=>{
  assert.equal(allNames.length,45);
  assert.equal(Object.keys(data.GAME_MUZZLE_VEL_43_2).length,44);
  assert.deepEqual(allNames.filter(n=>!(n in data.GAME_MUZZLE_VEL_43_2)),['Vector']);
  for(const name of allNames){
    const velocity=data.knownMuzzleVelocity({name});
    assert.ok(Number.isFinite(velocity)&&velocity>100&&velocity<=1500,name+' velocity');
  }
  assert.equal(data.knownMuzzleVelocity({name:'Vector'}),389);
  assert.equal(data.knownMuzzleVelocity({name:'not a weapon'}),null);
});

test('43.2 game-file velocities override stale telemetry without changing drop',()=>{
  for(const [name,velocity] of [['AKM',715],['M416',880],['Lynx AMR',1200],['O12',625],['RPD',735],['G18C',375],['S686',370],['S12K',350],['Sawn-off',330]]){
    assert.equal(data.knownMuzzleVelocity({name}),velocity,name);
  }
  assert.match(html,/const data=DROP_TABLES\[w.name\],velocity=knownMuzzleVelocity\(w\);/);
  assert.match(html,/const point=dropAtRange\(w,range\)/);
  assert.match(html,/if\(point==null\)\{/);
  assert.match(html,/"No gravity-drop estimate for "/);
  const start=html.indexOf('const DROP_TABLES = {');
  const stop=html.indexOf('const MEASURED_MUZZLE_VEL',start);
  const drop=vm.runInNewContext(html.slice(start,stop)+';DROP_TABLES');
  assert.equal(Object.keys(drop).length,30,'Only sourced gravity-estimate bins; no extrapolated data');
});

test('scope matcher, shotgun and recoil maths remain unchanged and parse',()=>{
  for(const fn of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange']){
    assert.match(html,new RegExp('function '+fn+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach(s=>assert.doesNotThrow(()=>new vm.Script(s)));
});
