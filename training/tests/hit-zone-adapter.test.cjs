// P1 hit-zone explorer regression tests. Exercises the production calculator
// source, not a reimplementation of class/region/armour mathematics.
// Run: node --test tests/hit-zone-adapter.test.cjs
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src/calculators/00-damage-ballistics.part'),'utf8');
const start=src.indexOf('const BODY_PARTS = {');
const end=src.indexOf("// PUBG's 2026 Dev Letter",start);
assert.ok(start!==-1 && end>start,'Damage model and hit-zone adapter source boundaries are present');
const context=vm.createContext({});
vm.runInContext(src.slice(start,end)+
  '\nthis.model={BODY_PARTS,DETAILED_PARTS,CLASS_MULT_DETAILED,WEAPON_HEAD_MULT,'+
  'getAllZoneDamageForWeapon,armorLevelForHitZone,hitZoneEquipmentType,finalDamageAt,shotgunMinShellsAt,htkFor};',context);
const m=context.model;
const weapon=(name,cls)=>({name,cls});
const asMap=rows=>Object.fromEntries(rows.map(row=>[row.id,row]));
const profile=(gun='M416',cls='AR',range=0,helmet=0,vest=0)=>
  asMap(m.getAllZoneDamageForWeapon(weapon(gun,cls),range,helmet,vest));
const near=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-9,
  label+' expected '+expected+' received '+actual);

test('the explorer returns exactly thirteen existing detailed body regions, with all fields',()=>{
  const rows=m.getAllZoneDamageForWeapon(weapon('M416','AR'),0,0,0);
  assert.equal(rows.length,13);
  assert.equal(rows.map(row=>row.id).join(','),m.DETAILED_PARTS.join(','));
  for(const row of rows){
    assert.ok(row.label && Number.isFinite(row.hitAreaMultiplier));
    assert.ok(Number.isFinite(row.classMultiplier));
    assert.equal(row.armorMultiplier,1);
    assert.equal(row.armorLevel,0);
    assert.equal(row.armorSource,'None');
    assert.equal(row.sourceStatus,'measured-checkpoint');
    assert.ok(row.damage>0 && Number.isInteger(row.htk));
  }
});
test('M416 chest 0 m uses the documented real checkpoint and class/hit multipliers',()=>{
  const bare=profile();
  const vestTwo=profile('M416','AR',0,0,2);
  near(bare.chest.damage,44,'bare M416 chest');
  near(vestTwo.chest.damage,26.4,'level 2 vest M416 chest');
  near(vestTwo.chest.hitAreaMultiplier,1.1,'chest hit-area factor');
  near(vestTwo.chest.classMultiplier,1,'AR torso class factor');
  near(vestTwo.chest.armorMultiplier,0.60,'level 2 vest factor');
  assert.equal(vestTwo.chest.htk,4);
  assert.equal(vestTwo.chest.armorSource,'Vest');
});
test('trajectory projectile hit damage is not confused with distinct gun-config BaseDamage',()=>{
  // PUBG 43.2 files expose WeaponGunConfig.BaseDamage and a separate
  // TrajectoryConfig.HitDamage. The latter matches the independent 0m
  // recorded damage table for these five checked weapons; see
  // docs/hit-zone-damage-field-audit.md for versioned references.
  const checked=[
    ['M416','AR',39,40],
    ['AKM','AR',40,48],
    ['AUG A3','AR',20,40],
    ['SVD Dragunov','DMR',46,53],
    ['RPD','MG',67,43]
  ];
  for(const [name,cls,gunConfigBase,projectileHitDamage] of checked){
    const rows=profile(name,cls,0,0,0);
    const clsFactor=m.CLASS_MULT_DETAILED[cls].torso;
    near(rows.chest.damage,projectileHitDamage*1.1*clsFactor,name+' 0m chest uses trajectory damage');
    assert.notEqual(rows.chest.damage,gunConfigBase*1.1*clsFactor,
      name+' must not mistakenly import gun-config BaseDamage');
    assert.equal(rows.chest.sourceStatus,'measured-checkpoint');
    assert.equal(rows.chest.armorSource,'None');
  }
  near(profile('SVD Dragunov','DMR',0).head.damage,53*2.8,
    'Source-listed special Dragunov head value retained provisionally');
});

test('helmet alone affects head and neck, and does not change torso or limbs',()=>{
  const a=profile('M416','AR',0,0,0);
  const b=profile('M416','AR',0,3,0);
  for(const id of m.DETAILED_PARTS){
    const shouldChange=id==='head'||id==='neck';
    if(shouldChange){
      near(b[id].damage,a[id].damage*.45,id+' helmet protection');
      assert.equal(b[id].armorSlot,'Helmet');
      assert.equal(b[id].armorSource,'Helmet');
      assert.equal(b[id].armorLevel,3);
    }else{
      near(b[id].damage,a[id].damage,id+' helmet must not change other zones');
      assert.equal(b[id].armorSource,'None');
    }
  }
  near(a.head.damage,94,'M416 unarmoured head');
  near(b.head.damage,42.3,'M416 level 3 helmet head');
});
test('vest only affects clavicle, chest, both stomach zones and pelvis; never limbs',()=>{
  const original=profile('M416','AR',0,0,0);
  const equipped=profile('M416','AR',0,0,3);
  const protectedZones=new Set(['clavicle','chest','upperStomach','lowerStomach','pelvis']);
  for(const id of m.DETAILED_PARTS){
    if(protectedZones.has(id)){
      near(equipped[id].damage,original[id].damage*.45,id+' vest protection');
      assert.equal(equipped[id].armorSource,'Vest');
    }else{
      near(equipped[id].damage,original[id].damage,id+' vest should not change zone');
      assert.equal(equipped[id].armorSource,'None');
    }
  }
  for(const id of ['upperArm','forearm','hand','thigh','calf','foot']){
    assert.equal(equipped[id].armorSlot,'None',id+' must never be vest protected');
  }
});
test('separate helmet and vest levels apply together without crossing over',()=>{
  const rows=profile('M416','AR',0,1,2);
  near(rows.head.damage,94*.70,'helmet level 1');
  near(rows.chest.damage,44*.60,'vest level 2');
  near(rows.thigh.damage,40*.60*.90,'leg with no armour');
  assert.equal(rows.neck.armorLevel,1);
  assert.equal(rows.pelvis.armorLevel,2);
  assert.equal(rows.upperArm.armorLevel,0);
});
test('known weapon overrides and class-specific pelvis factors remain intact',()=>{
  const dragunov=profile('SVD Dragunov','DMR',0);
  near(dragunov.head.damage,53*2.80,'Dragunov head override');
  near(dragunov.neck.damage,53*.75*2.80,'Dragunov neck override');
  const lmg=profile('M249','MG',0);
  near(lmg.pelvis.damage,41,'LMG pelvis bucket');
  near(lmg.chest.damage,41*1.10*1.05,'LMG torso bucket');
  near(profile('Vector','SMG',0).upperArm.damage,31*.60*1.30,'SMG limb factor');
});
test('only exact published distances provide numerical output, never invented in-between damage',()=>{
  near(profile('M416','AR',100).chest.damage,39*1.1,'M416 100m published');
  for(const metres of [75,451,-1,NaN,Infinity]){
    const rows=profile('M416','AR',metres,2,3);
    assert.equal(rows.chest.damage,null);
    assert.equal(rows.head.htk,null);
    assert.equal(rows.upperArm.sourceStatus,'no-data');
  }
  const slugUnknown=profile('O12','SG',0);
  const slugAtTwo=profile('O12','SG',2);
  assert.equal(slugUnknown.chest.damage,null,'O12 0m is unrecorded');
  near(slugAtTwo.chest.damage,98.7*1.1*.90,'O12 2m recorded slug');
});
test('pellet shotguns never show per-pellet numbers as actual shell damage or HTK',()=>{
  for(const [gun,range] of [['DBS',0],['S12K',25],['S686',80],['Sawn-off',50]]){
    const rows=profile(gun,'SG',range,3,3);
    for(const id of m.DETAILED_PARTS){
      assert.equal(rows[id].damage,null,gun+' '+id);
      assert.equal(rows[id].htk,null,gun+' '+id);
      assert.equal(rows[id].sourceStatus,'per-pellet-only');
    }
  }
  assert.equal(profile('DBS','SG',71).head.sourceStatus,'no-data');
  assert.equal(profile('DBS','SG',71).head.idealMinShells,null);
});
test('shotgun ideal minimum shells are sourced only from recorded per-pellet data and do not masquerade as actual damage',()=>{
  const w=weapon('S12K','SG');
  const zero=profile('S12K','SG',25,0,0);
  const vestTwo=profile('S12K','SG',25,0,2);
  const helmetThree=profile('S12K','SG',25,3,2);
  assert.equal(zero.chest.idealMinShells,m.shotgunMinShellsAt(w,25,'chest',0));
  assert.equal(vestTwo.chest.idealMinShells,m.shotgunMinShellsAt(w,25,'chest',2));
  assert.equal(helmetThree.head.idealMinShells,m.shotgunMinShellsAt(w,25,'head',3));
  assert.equal(zero.chest.idealMinShells,2);
  assert.equal(vestTwo.chest.idealMinShells,2);
  assert.equal(helmetThree.thigh.idealMinShells,zero.thigh.idealMinShells);
  assert.equal(vestTwo.head.idealMinShells,zero.head.idealMinShells);
  assert.equal(vestTwo.chest.damage,null);
  assert.equal(vestTwo.chest.htk,null);
  assert.equal(profile('M416','AR').chest.idealMinShells,null);
  for(const id of m.DETAILED_PARTS){
    assert.equal(profile('S12K','SG',25,3,2)[id].sourceStatus,'per-pellet-only');
  }
});
test('out-of-range equipment inputs cannot silently become no-armour readings',()=>{
  for(const value of [-1,4,1.5,NaN,Infinity,'2',null]){
    assert.throws(()=>m.getAllZoneDamageForWeapon(weapon('M416','AR'),0,value,0),
      {name:'RangeError'},'invalid helmet '+value);
    assert.throws(()=>m.getAllZoneDamageForWeapon(weapon('M416','AR'),0,0,value),
      {name:'RangeError'},'invalid vest '+value);
  }
  assert.throws(()=>m.getAllZoneDamageForWeapon(weapon('Unknown','X'),0,0,0),
    {name:'TypeError'});
});
test('calculator bundle contains adapter and live panel is wired to UI',()=>{
  const sourceBundle=fs.readFileSync(path.join(root,'js/toolkit-calculators.js'),'utf8');
  assert.match(sourceBundle,/function getAllZoneDamageForWeapon\(/);
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(index,/id="panel-hit-zone"/);
});
