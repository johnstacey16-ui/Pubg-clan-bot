// PUBG 43.2 item-space and 28.2 capacity regression.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'src/calculators/50-backpack.part'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=code.indexOf('const CHARACTER_BASE_CAPACITY = '),end=code.indexOf('(function(){',start);
assert.ok(start>=0 && end>start);
const d=vm.runInNewContext(code.slice(start,end)+'\n({CHARACTER_BASE_CAPACITY,VEST_CAPACITY_BONUS,BACKPACKS,BP_AMMO,BP_HEAL,BP_THROW})');
const weight=(rows,k)=>rows.find(row=>row[0]===k)?.[2];
test('vest capacity stays separate from base and both backpack bonuses',()=>{
  assert.equal(d.CHARACTER_BASE_CAPACITY,70);assert.equal(d.VEST_CAPACITY_BONUS,50);
  for(const [level,bonus] of [[1,150],[2,200],[3,250]]){
    assert.equal(d.BACKPACKS.standard[level],70+bonus);
    assert.equal(d.BACKPACKS.jammer[level],70+bonus);
    assert.equal(d.BACKPACKS.standard[level]+d.VEST_CAPACITY_BONUS,120+bonus);
  }
  assert.match(page,/id="bp_vest"/);
  assert.match(code,/VEST_CAPACITY_BONUS : 0/);
  assert.match(code,/#panel-backpack select#bp_vest/);
});
test('standard PUBG item weights exclude one-space event duplicates',()=>{
  for(const [key,val] of Object.entries({frag:27,smoke:14,stun:12,molotov:16,c4:35,bz:23,decoy:12,sticky:20,spike:18,minismoke:10,coverflare:27,supportflare:35}))
    assert.equal(weight(d.BP_THROW,key),val,key);
  for(const [key,val] of Object.entries({'50cal':1,'9mm':.3,'57':.35,'.45acp':.4,'556':.5,'762':.6,'300mag':1,'12g':1.25,'bolt':2}))
    assert.equal(weight(d.BP_AMMO,key),val,key);
  for(const [key,val] of Object.entries({bandage:2,firstaid:10,medkit:15,energy:4,pain:6,adren:10}))
    assert.equal(weight(d.BP_HEAL,key),val,key);
});
