// PUBG 43.2 source-mapped weapon attachment compatibility and outputs.
// Run with: node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const start=html.indexOf('const ATTACH_MOD = {');
const end=html.indexOf('(function(){\n  const $ = id => document.getElementById(id);',start);
assert.ok(start>0&&end>start);
const data=vm.runInNewContext(html.slice(start,end)+'\n;({ATTACH_MOD,slotsFor,attachmentChoicesFor,compensatorFor})');
const {ATTACH_MOD,slotsFor,attachmentChoicesFor,compensatorFor}=data;
const gun=(name,cls)=>({name,cls});
const options=(name,cls,group)=>Array.from(attachmentChoicesFor(gun(name,cls),group));

test('AR/DMR/SMG and pistol muzzle options follow game-file fit lists',()=>{
  assert.deepEqual(options('M416','AR','muzzle'),['none','compensator','flash','suppressor','brake']);
  assert.deepEqual(options('AKM','AR','muzzle'),['none','compensator','flash','suppressor','brake']);
  assert.deepEqual(options('SKS','DMR','muzzle'),['none','compensator','flash','suppressor','compensator_ar','brake']);
  assert.deepEqual(options('AWM','SR','muzzle'),['none','compensator','flash','suppressor']);
  assert.deepEqual(options('Vector','SMG','muzzle'),['none','compensator','flash','suppressor']);
  assert.deepEqual(options('G18C','Pistol','muzzle'),['none','suppressor']);
  assert.deepEqual(options('Skorpion','SMG','muzzle'),['none','suppressor']);
  assert.deepEqual(options('R1895','Pistol','muzzle'),['none','suppressor']);
  for(const [name,cls] of [['VSS Vintorez','DMR'],['RPD','MG'],['M249','MG'],['MP9','SMG'],['P90','SMG'],['Lynx AMR','SR']]){
    assert.deepEqual(options(name,cls,'muzzle'),['none'],name+' must not offer an incompatible muzzle');
  }
});

test('shotgun choke and duckbill modify pellet spread, not invented pellet hit counts',()=>{
  assert.deepEqual(options('S686','SG','muzzle'),['none','choke']);
  assert.deepEqual(options('Sawn-off','SG','muzzle'),['none','choke']);
  assert.deepEqual(options('S12K','SG','muzzle'),['none','compensator','flash','suppressor','brake','duckbill']);
  assert.deepEqual(options('DBS','SG','muzzle'),['none']);
  assert.deepEqual(options('O12','SG','muzzle'),['none','compensator','flash','suppressor','brake']);
  assert.equal(ATTACH_MOD.muzzle.choke.v,0);
  assert.equal(ATTACH_MOD.muzzle.duckbill.h,0);
  assert.match(html,/Choke tightens pellet spread by 13%; no hit probability is modeled/);
  assert.match(html,/simulated positions in curve units/);
  assert.match(html,/function shotgunMinShellsAt\(/);
});

test('stocks match gun tags: folding, cheek pad, bullet loops and tactical',()=>{
  assert.deepEqual(options('MP9','SMG','stock'),['none','tactical','folding']);
  assert.deepEqual(options('Micro Uzi','SMG','stock'),['none','folding']);
  assert.deepEqual(options('Skorpion','SMG','stock'),['none','folding']);
  assert.deepEqual(options('M416','AR','stock'),['none','tactical','heavy']);
  assert.deepEqual(options('RPD','MG','stock'),['none','tactical','heavy']);
  assert.deepEqual(options('AWM','SR','stock'),['none','cheek']);
  assert.deepEqual(options('VSS Vintorez','DMR','stock'),['none','cheek']);
  assert.deepEqual(options('S686','SG','stock'),['none','loops']);
  assert.deepEqual(options('Kar98k','SR','stock'),['none','cheek','loops']);
  assert.deepEqual(options('M24','SR','stock'),['none','cheek']);
  assert.deepEqual(options('AKM','AR','stock'),['none']);
  assert.deepEqual(options('G18C','Pistol','stock'),['none']);
  assert.equal(slotsFor(gun('Micro Uzi','SMG')).stock,'folding');
  assert.equal(slotsFor(gun('AWM','SR')).stock,'cheek');
  assert.equal(slotsFor(gun('Kar98k','SR')).stock,'cheek');
});

test('current 43.2 attachment tooltips are modelled only where applicable',()=>{
  assert.equal(ATTACH_MOD.muzzle.brake.v,-.10);
  assert.equal(ATTACH_MOD.muzzle.brake.h,-.08);
  assert.equal(ATTACH_MOD.stock.folding.v,-.20);
  assert.equal(ATTACH_MOD.stock.folding.recov,.15);
  assert.equal(ATTACH_MOD.stock.cheek.v,-.20);
  assert.equal(ATTACH_MOD.stock.loops.v,0);
  assert.equal(ATTACH_MOD.muzzle.compensator_ar.h,-.10);
  assert.equal(compensatorFor(gun('SKS','DMR')).h,-.20);
  assert.deepEqual(options('M416','AR','grip'),['none','vertical','half','light','thumb','laser','tilted']);
  assert.deepEqual(options('AKM','AR','grip'),['none']);
  assert.ok(!options('M416','AR','grip').includes('angled'),'retired Angled Foregrip should not appear in selectable items');
  assert.match(html,/selectedStock==="loops" && w.name==="Kar98k"\) reloadSpeedMultiplier \*= 1\.30/);
});

test('all attachment dropdowns depend on selected weapon without changing core calculators',()=>{
  assert.match(html,/const choices = attachmentChoicesFor\(w,group\)/);
  assert.match(html,/const selected = choices.includes\(defaultKey\) \? defaultKey : "none"/);
  assert.match(html,/populateSlot\("at_muzzle","muzzle", w,/);
  for(const fn of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange','extendedCapFor']){
    assert.match(html,new RegExp('function '+fn+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((source,i)=>assert.doesNotThrow(()=>new vm.Script(source),'script '+i));
});
