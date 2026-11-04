'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('../recoil-model.js'),{weapons,PT,data,audit}=require('../scripts/recoil-audit.cjs');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' != '+b);
const profile=name=>model.resolve(PT.WBYNAME[name],data.weapons[name]);
test('all 27 imported numeric curve sets map to exact existing weapon names',()=>{
 assert.equal(Object.keys(data.weapons).length,27);
 const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../recoil-reference.js'),'utf8'),ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.HELP_RECOIL_REFERENCE)),data);
 assert.match(data.source.sha256,/^[a-f0-9]{64}$/);
 for(const [name,reference] of Object.entries(data.weapons)){
  assert.ok(PT.WBYNAME[name],name);assert.ok(reference.v.length&&reference.h.length);
  for(const axis of ['v','h','r'])for(const key of reference[axis])for(const field of ['t','v','at','lt'])assert.ok(Number.isFinite(key[field]),name+' '+field);
 }
 assert.equal(data.weapons.M416.referenceName,'HK416');assert.equal(data.weapons['Tommy Gun'].referenceName,'Thompson');
});
test('constant, linear, cubic and held-tail sampling follows the recorded key modes',()=>{
 const keys=[{t:0,v:0,lt:3,at:0,mode:'Cubic'},{t:1,v:1,lt:0,at:0,mode:'Linear'}];
 close(model.sample(keys,.5),.875);close(model.sample(keys,-1),0);close(model.sample(keys,100),1);
 close(model.sample([{...keys[0],mode:'Linear'},keys[1]],.5),.5);
 close(model.sample([{...keys[0],mode:'Constant'},keys[1]],.9),0);
 assert.equal(model.sample([],0),null);
});
test('sampler agrees with independent Bezier control-point evaluation across every imported segment',()=>{
 for(const reference of Object.values(data.weapons))for(const axis of ['v','h','r']){
  const keys=reference[axis];for(let i=0;i<keys.length-1;i++){
   const a=keys[i],b=keys[i+1],dt=b.t-a.t;
   for(const u of [.1,.25,.5,.9]){
    const p1=a.v+a.lt*dt/3,p2=b.v-b.at*dt/3;
    const expected=a.mode==='Constant'?a.v:a.mode==='Linear'?a.v+(b.v-a.v)*u:(1-u)**3*a.v+3*(1-u)**2*u*p1+3*(1-u)*u*u*p2+u**3*b.v;
    close(model.sample(keys,a.t+dt*u),expected);
   }
  }
 }
});
test('existing values win all documented conflicts without mutating either dataset',()=>{
 const before=JSON.stringify(weapons),referenceBefore=JSON.stringify(data);
 assert.equal(audit.fieldConflicts.length,2);assert.equal(audit.attachmentConflicts.length,28);
 for(const [name,rpm,dps] of [["MP5K",901,481],["Vector",1101,569]]){
  assert.equal(PT.WBYNAME[name].rpm,rpm);assert.equal(PT.WBYNAME[name].dps,dps);
  assert.equal(profile(name).rpm,rpm);close(profile(name).tbs,60/rpm);
  assert.match(PT.WBYNAME[name].rpmNote,/Extracted reference rate/);
 }
 assert.equal(PT.WBYNAME.MG3.rpmDisputed,true);assert.match(PT.WBYNAME.MG3.rpmNote,/660\/990/);
 for(const conflict of audit.fieldConflicts)assert.equal(conflict.used,conflict.help);
 assert.equal(profile('MG3').rpm,700);assert.equal(profile('SLR').tendency,-.05);
 assert.equal(profile('AKM').stance.prone,null);assert.equal(profile('M249').stance.prone,.32);
 assert.deepEqual(profile('MG3').rates,[700,990]);
 assert.equal(model.atRate(profile('MG3'),990).rpm,990);assert.equal(model.atRate(profile('MG3'),1).rpm,700);
 for(const weapon of weapons)model.resolve(weapon,data.weapons[weapon.name]);
 assert.equal(JSON.stringify(weapons),before);assert.equal(JSON.stringify(data),referenceBefore);
 assert.equal(model.resolve(PT.WBYNAME.AWM,data.weapons.AWM),null);
});
test('all per-shot and stage comparisons use a fixed first-30-shot normalization',()=>{
 for(const name of Object.keys(data.weapons)){
  const p=profile(name),baseline=model.analyze(p),build=model.analyze(p,{v:.5,h:.75});
  assert.equal(baseline.shots.length,30);assert.equal(baseline.stages.length,3);
  assert.deepEqual(baseline.stages.map(s=>s.label),['1–10','11–20','21–30']);
  close(baseline.shots[0].time,0);close(baseline.shots[29].time,29*60/p.rpm);
  for(let i=0;i<3;i++){
   const a=baseline.stages[i],b=build.stages[i];close(b.buildV,a.v*.5);close(b.buildH,a.h*.75);close(b.buildVPercent,a.baseVPercent*.5);
   assert.equal(a.estimated,baseline.shots.slice(i*10,i*10+10).some(s=>s.heldV||s.heldH));
  }
 }
 const analysis=model.analyze(profile('AKM'));assert.ok(analysis.stages[2].estimated);
});
test('recoil attachment adapter preserves the existing compatible choices and additive math',()=>{
 const a=PT.RECOIL_ATTACHMENTS;
 const gear={muzzle:'compensator',grip:'vertical',stock:'heavy'};
 close(a.combine('M416',gear).v,.6);close(a.combine('M416',gear).h,.8);
 close(a.choices('JS9','muzzle').find(o=>o.value==='compensator').v,-.25);
 assert.deepEqual(Array.from(a.choices('AKM','grip'),o=>o.value),['none']);
 assert.deepEqual(JSON.parse(JSON.stringify(a.combine('AKM',{muzzle:'invalid',grip:'heavy',stock:'unknown'}))),{v:1,h:1});
});
test('random sprays place the first bullet at the crosshair and gear scales subsequent kick',()=>{
 const p=profile('AKM'),a=model.spray(p,30,{v:1,h:1},()=>0),b=model.spray(p,30,{v:.5,h:.5},()=>0);
 assert.deepEqual(a[0],{x:0,y:0,time:0,shot:1});close(a[1].y,.55*.9);close(a[1].x,-.13*.42);
 for(let i=0;i<30;i++){close(b[i].x,a[i].x*.5);close(b[i].y,a[i].y*.5);}
 const other=model.spray(p,30,{v:1,h:1},()=>.99);assert.notDeepEqual(a,other);
 assert.throws(()=>model.spray(p,0),/Spray length/);
 const bounds=model.bounds(p,30);assert.ok(a.every(pt=>Math.abs(pt.x)<=bounds.horizontal&&pt.y<=bounds.vertical));
});
test('elapsed-time shot count matches firing cadence and stops at the last bullet',()=>{
 const p=model.atRate(profile('MG3'),990);assert.equal(model.visibleShots(0,p,30),1);
 assert.equal(model.visibleShots(p.tbs-1e-6,p,30),1);assert.equal(model.visibleShots(p.tbs,p,30),2);
 assert.equal(model.visibleShots(29*p.tbs,p,30),30);assert.equal(model.visibleShots(100,p,30),30);
});
