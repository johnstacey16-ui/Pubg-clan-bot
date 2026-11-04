// Muzzle velocity and conservative ideal flight-time evidence; no fake drop.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
function segment(a,b){
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,a+" -> "+b);
  return html.slice(i,j);
}
const data=vm.runInNewContext(
  segment('const MEASURED_MUZZLE_VEL =','function hasDropData(w)')+
  '\n;({GAME_MUZZLE_VEL_43_2,MEASURED_MUZZLE_VEL,knownMuzzleVelocity,minimumIdealFlightTime})'
);

test('ideal travel time is a lower bound derived only from initial speed',()=>{
  const flight=data.minimumIdealFlightTime;
  assert.equal(flight({name:'M416'},100),100/880);
  assert.equal(flight({name:'AKM'},150),150/715);
  assert.equal(flight({name:'Lynx AMR'},200),200/1200);
  assert.equal(flight({name:'Sawn-off'},50),50/330);
  assert.equal(flight({name:'Vector'},100),100/389,'Vector uses historical measured speed');
  assert.equal(flight({name:'M416'},0),0);
  assert.equal(flight({name:'M416'},-1),null);
  assert.equal(flight({name:'M416'},Number.NaN),null);
  assert.equal(flight({name:'M416'},Infinity),null);
  assert.equal(flight({name:'unknown'},100),null);
});

test('all 45 weapons have ideal flight bounds without pretending drop is measured',()=>{
  const guns=[...segment('const WEAPONS = [','].map(w=>').matchAll(/^\["([^"]+)"/gm)].map(m=>m[1]);
  assert.equal(guns.length,45);
  for(const name of guns){
    const seconds=data.minimumIdealFlightTime({name},100);
    assert.ok(Number.isFinite(seconds)&&seconds>0&&seconds<1,name+' duration');
  }
  assert.equal(Object.keys(data.GAME_MUZZLE_VEL_43_2).length,44);
  assert.match(html,/const data=DROP_TABLES\[w.name\],velocity=knownMuzzleVelocity\(w\)/);
  assert.match(html,/const point=dropAtRange\(w,range\)/);
  assert.match(html,/"No gravity-drop estimates for this weapon\."/);
  assert.match(html,/const idealFlight=range==null \? null : minimumIdealFlightTime\(w,range\)/);
  assert.match(html,/idealFlight\.toFixed\(3\)\+" s"/);
});

test('user sees honest provenance and the no-drag caveat',()=>{
  assert.match(html,/Minimum flight time \(ideal\)/);
  assert.match(html,/distance ÷ muzzle velocity, assuming no drag/);
  assert.match(html,/Actual projectile travel time is longer/);
  assert.match(html,/Muzzle velocity \(43\.2 game files\)/);
  assert.match(html,/Muzzle velocity \(historical measurement\)/);
  assert.doesNotMatch(html,/Muzzle velocity \(measured\)/);
  assert.doesNotMatch(html,/Flight time \(not measured\)/);
});

test('Sawn-off 9-pellet 43.2 record remains intact, contradictory old note removed',()=>{
  const code=segment('const SHOTGUN_PELLETS = {','const PELLET_FALLOFF =');
  const pellets=vm.runInNewContext(code+';SHOTGUN_PELLETS');
  assert.equal(pellets['Sawn-off'].count,9);
  assert.equal(pellets['Sawn-off'].dmgPerPellet,21);
  assert.match(html,/Current 43\.2 game-file extract says Sawn-off fires NINE pellets/);
  assert.doesNotMatch(html,/so this uses 8/);
});

test('calculation formulas and JS scripts unchanged and valid',()=>{
  for(const f of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange','extendedCapFor']){
    assert.match(html,new RegExp('function '+f+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((script,i)=>assert.doesNotThrow(()=>new vm.Script(script),'script '+i));
});
