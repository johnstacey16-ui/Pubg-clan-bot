// Update 43.2 data migration checks. No browser/npm dependencies needed.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();

const excerpt=(a,b)=>{
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'Missing code boundaries '+a+'/'+b);
  return html.slice(i,j);
};
const bp=vm.runInNewContext(
  excerpt('const CHARACTER_BASE_CAPACITY = 70','(function(){')+
  ';({CHARACTER_BASE_CAPACITY,BACKPACK_CAPACITY_BONUS,BACKPACKS,JAMMER_PROTECTION,BP_AMMO,BP_HEAL,BP_THROW})'
);
const recoil=vm.runInNewContext(
  excerpt('const RECOIL_RAW = {','WEAPONS.forEach(')+';RECOIL_RAW'
);
const at=vm.runInNewContext(
  excerpt('const ATTACH_MOD = {','(function(){\n  const $ = id => document.getElementById(id);')+
  ';({ATTACH_MOD,STOCK_LIST,GRIP_LIST,HEAVY_STOCK_LIST,compensatorFor,slotsFor,extendedCapFor})'
);
const value=(items,key)=>{const row=items.find(r=>r[0]===key);assert.ok(row,'missing '+key);return row[2];};

test('standard and jammer packs have equal total capacity at every level',()=>{
  assert.equal(bp.CHARACTER_BASE_CAPACITY,70);
  for(const [level,bonus,protection] of [[1,150,'Low'],[2,200,'Medium'],[3,250,'High']]){
    assert.equal(bp.BACKPACK_CAPACITY_BONUS[level],bonus);
    assert.equal(bp.BACKPACKS.standard[level],70+bonus);
    assert.equal(bp.BACKPACKS.jammer[level],bp.BACKPACKS.standard[level]);
    assert.equal(bp.JAMMER_PROTECTION[level],protection);
  }
});

test('ammo and healing space matches PUBG 33.1, 34.1 and 42.1 updates',()=>{
  assert.equal(value(bp.BP_AMMO,'9mm'),.3);
  assert.equal(value(bp.BP_AMMO,'57'),.35);
  assert.equal(value(bp.BP_AMMO,'762'),.6);
  assert.equal(value(bp.BP_AMMO,'556'),.5);
  assert.equal(value(bp.BP_HEAL,'medkit'),15);
  assert.equal(value(bp.BP_HEAL,'pain'),6);
  assert.equal(value(bp.BP_HEAL,'adren'),10);
  assert.equal(value(bp.BP_HEAL,'firstaid'),10);
  assert.equal(value(bp.BP_HEAL,'bandage'),2);
});

test('standard-mode grenade space matches current game-file inventory tables',()=>{
  for(const [k,expected] of [['frag',27],['molotov',16],['c4',35],['smoke',14],['stun',12]]){
    assert.equal(value(bp.BP_THROW,k),expected,k);
  }
});

test('RPD and G18C/P18C mapped recoil fields are filled without invented headings',()=>{
  assert.equal(recoil.RPD[0],7.5);
  assert.equal(recoil.RPD[1],.7);
  assert.equal(recoil.RPD[5],15.5);
  assert.equal(recoil.RPD[6],11);
  assert.equal(recoil.RPD[7],25);
  assert.equal(recoil.RPD[3],null);
  assert.equal(recoil.G18C[5],15);
  assert.equal(recoil.G18C[6],12);
  assert.equal(recoil.G18C[7],15);
  assert.equal(recoil.G18C[3],null);
  assert.equal(recoil.G18C[0],null);
});

test('weapon-specific foregrip and stock slots improve the old class defaults',()=>{
  assert.equal(at.slotsFor({name:'AKM',cls:'AR'}).grip,null);
  assert.equal(at.slotsFor({name:'Groza',cls:'AR'}).grip,null);
  assert.equal(at.slotsFor({name:'M416',cls:'AR'}).grip,'FOREGRIP');
  assert.equal(at.slotsFor({name:'G18C',cls:'Pistol'}).grip,'FOREGRIP');
  assert.equal(at.slotsFor({name:'O12',cls:'SG'}).grip,'FOREGRIP');
  assert.equal(at.slotsFor({name:'RPD',cls:'LMG'}).grip,null);
  assert.equal(at.slotsFor({name:'P90',cls:'SMG'}).magazine,null);
  assert.equal(at.slotsFor({name:'Lynx AMR',cls:'SR'}).muzzle,null);
  assert.equal(at.slotsFor({name:'Lynx AMR',cls:'SR'}).magazine,null);
  assert.equal(at.slotsFor({name:'MP9',cls:'SMG'}).stock,'tactical');
  assert.equal(at.HEAVY_STOCK_LIST.has('MP9'),false);
  assert.equal(at.HEAVY_STOCK_LIST.has('RPD'),true);
});

test('recoil modifiers use class-specific compensators and correct grip tooltips',()=>{
  const c=at.compensatorFor;
  for(const [weapon,cls,v,h] of [['M416','AR',-.15,-.10],['S12K','SG',-.15,-.10],['Vector','SMG',-.25,-.20],['M24','SR',-.20,-.20],['SLR','DMR',-.20,-.20]]){
    const mod=c({name:weapon,cls});
    assert.equal(mod.v,v,weapon);
    assert.equal(mod.h,h,weapon);
  }
  assert.equal(at.ATTACH_MOD.grip.vertical.v,-.15);
  assert.equal(at.ATTACH_MOD.grip.thumb.v,-.10);
  assert.equal(at.ATTACH_MOD.grip.laser.h,0);
  assert.equal(at.ATTACH_MOD.grip.light.recov,.20);
  assert.equal(at.ATTACH_MOD.stock.tactical.recov,.05);
  assert.equal(at.ATTACH_MOD.stock.heavy.h,-.10);
  assert.equal(at.ATTACH_MOD.muzzle.suppressor.v,0);
  assert.equal(at.ATTACH_MOD.muzzle.flash.h,-.10);
});

test('updated magazine reload speeds are converted to durations, not copied as duration discounts',()=>{
  assert.match(html,/reloadSpeedMultiplier = 1\.60/);
  assert.match(html,/reloadSpeedMultiplier = 1\.15/);
  assert.match(html,/reloadMult = 1 \/ reloadSpeedMultiplier/);
  assert.ok(Math.abs(3/1.6-1.875)<1e-9);
  assert.ok(Math.abs(3/1.15-2.608695652)<1e-8);
});

test('user scope sensitivity maths and original range safety remain present',()=>{
  for(const method of ['pixelSpeed','matchedSens','shotgunMinShellsAt','measuredValueAt','dropAtRange']){
    assert.match(html,new RegExp('function '+method+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s),'script '+i));
});
