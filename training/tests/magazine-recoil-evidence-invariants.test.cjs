// Keep known magazine capacities and private weapon recoil gaps honest.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const combat=fs.readFileSync(path.join(root,'src/combat/00-weapon-data-armor.part'),'utf8');
const part=fs.readFileSync(path.join(root,'src/calculators/40-attachments.part'),'utf8');
const before=(content,start,stop)=>{const a=content.indexOf(start),b=content.indexOf(stop,a);assert.ok(a!==-1&&b>a,start);return content.slice(a,b);};
const guns=vm.runInNewContext(before(combat,'const WEAPONS = [','// w[9]')+'\nWEAPONS');
const raw=vm.runInNewContext(before(combat,'const RECOIL_RAW = {','const RECOIL_DETAIL_43_2 = {')+'\nRECOIL_RAW');
const model=vm.runInNewContext(before(part,'const ATTACH_MOD = {','(function(){\n  const $ = id => document.getElementById(id);')+
  '\n({MAG_CAP_EVIDENCE,MAG_CAP_VERIFIED,extendedCapFor,slotsFor,DUAL_MAG_FAMILY})');
test('all 45 weapon records have honest whole-round magazine limits',()=>{
  assert.equal(guns.length,45);
  for(const gun of guns){
    const slots=model.slotsFor(gun);
    const max=model.extendedCapFor(gun,'extended');
    const quick=model.extendedCapFor(gun,'extquick');
    for(const [type,count] of [['Extended',max],['Extended QuickDraw',quick]]){
      if(count===null)continue;
      assert.ok(Number.isInteger(count)&&count>=gun.mag&&count>0,gun.name+' '+type+' invalid loaded count: '+count);
    }
    if(max!==null&&quick!==null)assert.ok(max>=quick,gun.name+' QuickDraw must not exceed Extended');
    if(!slots.magazine)assert.equal(max,null,gun.name+' cannot equip an extended mag');
  }
});
test('ACE reconciliation is not mislabelled direct verification',()=>{
  assert.equal(model.MAG_CAP_EVIDENCE['M416'],'official-15.1-weapon-example');
  assert.equal(model.MAG_CAP_EVIDENCE['ACE 32'],'cross-source-magazine-type-reconciliation');
  assert.equal(model.MAG_CAP_EVIDENCE['MK14 EBR'],'weapon-specific-family-tables');
  assert.equal(model.MAG_CAP_EVIDENCE['SVD Dragunov'],'unresolved-family-and-type');
  const named=n=>guns.find(w=>w.name===n);
  assert.equal(model.extendedCapFor(named('M416'),'extended'),42);
  assert.equal(model.extendedCapFor(named('M416'),'extquick'),40);
  assert.equal(model.extendedCapFor(named('ACE 32'),'extended'),42);
  assert.equal(model.extendedCapFor(named('ACE 32'),'extquick'),40);
  assert.equal(model.extendedCapFor(named('MK14 EBR'),'extended'),22);
  assert.equal(model.extendedCapFor(named('MK14 EBR'),'extquick'),20);
  assert.equal(model.extendedCapFor(named('MK14 EBR'),'extended_ar'),20);
  assert.equal(model.extendedCapFor(named('MK14 EBR'),'extquick_ar'),20);
  for(const kind of ['extended','extquick','extended_ar','extquick_ar'])
    assert.equal(model.extendedCapFor(named('SVD Dragunov'),kind),null,'Dragunov '+kind+' unresolved');
});
test('unknown SMG, shotgun, crate and pistol recoil fields stay null, never zero',()=>{
  assert.equal(Object.keys(raw).length,45);
  for(const name of guns.map(w=>w.name))assert.ok(Object.hasOwn(raw,name),name+' missing recoil record');
  for(const name of ['P90','MP5K','Vector','Micro Uzi','S686','DBS','Sawn-off','MG3','Desert Eagle']){
    const row=raw[name];assert.ok(row.some(v=>v===null),name+' must preserve unavailable recoil');
    assert.equal(row.length,8,name+' schema width');
  }
  assert.equal(raw.P90[0],null,'no source-backed vertical max for P90');
  assert.equal(raw['S686'][0],null,'no source-backed vertical max for S686');
  assert.equal(raw.MG3[0],null,'no source-backed vertical max for MG3');
  assert.equal(raw['Desert Eagle'][0],null,'no source-backed vertical max for Desert Eagle');
});
