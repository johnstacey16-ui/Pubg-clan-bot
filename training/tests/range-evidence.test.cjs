// Evidence-only weapon range regression tests.
// Run with: node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=require('./toolkit-test-source.cjs')();

function section(a,b){
  const start=html.indexOf(a),end=html.indexOf(b,start);
  assert.ok(start>=0&&end>start,'Source boundaries must exist: '+a+' ... '+b);
  return html.slice(start,end);
}
const source=[
  section('const FALLOFF_TABLES = {','// Bullet drop, sourced'),
  section('const DROP_TABLES = {','const MEASURED_MUZZLE_VEL'),
  section('function dropAtRange(w, range){','function hasExactFalloff(w)'),
  section('const SHOTGUN_PELLETS = {','function armorMultFor(part, level){')
].join('\n');
const ctx=vm.createContext({});
vm.runInContext(source+
  '\nthis.evidence={FALLOFF_TABLES,PELLET_FALLOFF,SHOTGUN_PELLETS,sourcedRangeRows,measuredValueAt,dropAtRange,baseDamageAtRange};',
  ctx);
const e=ctx.evidence;
const weapon=name=>({name});

test('shotguns stop exactly at their last sourced measurement, never flatline',()=>{
  for(const [name,max] of [['DBS',70],['S686',80],['S12K',70],['Sawn-off',50]]){
    const rows=e.PELLET_FALLOFF[name];
    assert.equal(rows.at(-1)[0],max);
    assert.ok(e.measuredValueAt(rows,max)>0,'last measured pellet point should be available');
    assert.equal(e.measuredValueAt(rows,max+1),null,'no invented numbers after '+max+'m for '+name);
    assert.equal(e.baseDamageAtRange(weapon(name),0),null,
      'per-pellet measurement cannot be treated as whole-shot damage');
    assert.equal(e.baseDamageAtRange(weapon(name),max),null);
  }
});

test('other weapons have no fabricated falloff beyond or between source checkpoints',()=>{
  for(const [name,rows] of Object.entries(e.FALLOFF_TABLES)){
    const lo=rows[0][0],hi=rows.at(-1)[0];
    assert.ok(e.baseDamageAtRange(weapon(name),hi)>0);
    assert.equal(e.baseDamageAtRange(weapon(name),hi+1),null,name+' beyond '+hi+'m');
    if(lo>0)assert.equal(e.baseDamageAtRange(weapon(name),0),null,name+' before first recorded point');
    for(let k=1;k<rows.length;k++){
      const x=(rows[k-1][0]+rows[k][0])/2;
      if(x!==rows[k-1][0]&&x!==rows[k][0])
        assert.equal(e.baseDamageAtRange(weapon(name),x),null,name+' unsampled '+x+'m');
    }
  }
  assert.equal(e.baseDamageAtRange(weapon('AKM'),250),37);
  assert.equal(e.baseDamageAtRange(weapon('O12'),0),null);
  assert.equal(e.baseDamageAtRange(weapon('O12'),2),98.7);
});

test('drop is known only at recorded telemetry checkpoints',()=>{
  assert.equal(e.dropAtRange(weapon('AKM'),200),66);
  assert.equal(e.dropAtRange(weapon('AKM'),150),null);
  assert.equal(e.dropAtRange(weapon('AKM'),401),null);
  assert.equal(e.dropAtRange(weapon('S12K'),200),null);
});

test('range UI uses source indexes, not a fake 0–500m model',()=>{
  assert.match(html,/id="rg_range" min="0" max="1" step="1"/);
  assert.match(html,/id="rg_rangeEvidence"/);
  assert.match(html,/Available range: /);
  assert.match(html,/Minimum shells assume all /);
  assert.match(html,/shotgunMinShellsAt\(w,range,hitbox,armor\)/);
  assert.match(html,/Shots?gun/);
  assert.match(html,/<th>Minimum shells \(all pellets hit\)<\/th>/);
  assert.match(html,/shotgunMinShellsAt\(w,range,hitbox,armor\)/);
  assert.doesNotMatch(html,/GENERIC_FALLOFF_FACTOR|interpolateFalloff|PELLET_SPREAD|pelletHitFraction|TARGET_WIDTH_M/);
});

test('both browser calculators remain parseable and missing damage is handled safely',()=>{
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((code,i)=>assert.doesNotThrow(()=>new vm.Script(code),'script '+i));
  assert.match(html,/function htkFor\(dmg\)\{ return dmg == null \? null/);
  assert.match(html,/if\(dmg==null\)\{\s*return \{dmg:null,htk:null,pure:null,withReload:null,reloads:null\}/);
  assert.match(html,/if\(SHOTGUN_PELLETS\[w.name\]\)/);
  assert.match(html,/return reloadSecondsForWeapon\(w\)/);
});
