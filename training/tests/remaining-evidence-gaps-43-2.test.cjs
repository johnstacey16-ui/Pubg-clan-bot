const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const combat=fs.readFileSync(path.join(root,'src/combat/00-weapon-data-armor.part'),'utf8');
const ballistic=fs.readFileSync(path.join(root,'src/calculators/00-damage-ballistics.part'),'utf8');
const r=vm.runInNewContext(combat.slice(combat.indexOf('const RECOIL_RAW = {'),combat.indexOf('const RECOIL_DETAIL_43_2 = {'))+'RECOIL_RAW');
const d=vm.runInNewContext(ballistic.slice(ballistic.indexOf('const DROP_TABLES = {'),ballistic.indexOf('const MEASURED_MUZZLE_VEL'))+'DROP_TABLES');
const guns=vm.runInNewContext(combat.slice(combat.indexOf('const WEAPONS = ['),combat.indexOf('// w[9]'))+'WEAPONS');
test('preserve unknown recoil as null until weapon-specific evidence exists',()=>{
  assert.equal(Object.keys(r).length,45);
  assert.equal(Object.values(r).filter(v=>v.some(x=>x===null)).length,28);
  assert.equal(r.G18C[0],null);
  assert.equal(r.MG3[0],null);
  assert.equal(r.RPD[3],null);
  assert.equal(r['Sawn-off'][7],null);
});
test('published gravity estimates keep 15 weapons unavailable instead of fabricating data',()=>{
  assert.equal(Object.keys(d).length,30);
  assert.equal(guns.length,45);
  assert.equal(guns.filter(w=>!(w.name in d)).length,15);
  for(const name of ['S686','G18C','Sawn-off','DBS'])assert.equal(d[name],undefined,name);
});
