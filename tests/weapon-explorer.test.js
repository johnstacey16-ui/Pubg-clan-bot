'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FIELDS,SOURCES,get,sortedWeapons,summarize,exportCsv,fmt}=
 require('../assets/weapon-explorer');
const weapons=[
 {name:'BerylM762',level:30,tier:3,xp:15000,
  total:{kills:300,headshots:90,mostDamageInGame:2000,longRangeDefeats:16},
  official:{kills:10,headshots:3,damage:500,knocks:5,defeats:7,longestKill:250},
  competitive:{kills:2,headshots:0,damage:80}},
 {name:'M416',level:20,tier:2,xp:30000,
  total:{kills:2},official:{kills:45,headshots:12,damage:4000,longestKill:210},
  competitive:{kills:20,headshots:5,damage:2200}},
 {name:'AKM',level:9,tier:1,xp:500,official:{damage:50},total:null,competitive:null}
];
test('weapon explorer exposes all 13 documented distinct source metrics',()=>{
 assert.equal(FIELDS.length,13);
 assert.equal(new Set(FIELDS.map(f=>f.key)).size,13);
 assert.deepEqual(SOURCES.map(s=>s.key),['official','competitive','total']);
 assert.ok(FIELDS.some(f=>f.key==='mostKnocksInGame'));
 assert.ok(FIELDS.some(f=>f.key==='mostDamageInGame'));
});
test('default sorting can follow current OfficialStatsTotal instead of frozen legacy totals',()=>{
 assert.deepEqual(sortedWeapons(weapons,'official','kills').map(w=>w.name),
  ['M416','BerylM762','AKM']);
 assert.deepEqual(sortedWeapons(weapons,'total','kills').map(w=>w.name),
  ['BerylM762','M416','AKM']);
 assert.deepEqual(sortedWeapons(weapons,'competitive','kills','M4').map(w=>w.name),['M416']);
 assert.equal(get(weapons[0],'official','longestKill'),250);
 assert.equal(get(weapons[0],'total','mostDamageInGame'),2000);
 assert.equal(get(weapons[0],'competitive','mostDamageInGame'),null);
});
test('source-specific summaries only add observed fields and preserve real zero',()=>{
 const current=summarize(weapons,'official');
 assert.equal(current.kills.value,55);
 assert.equal(current.kills.observed,2);
 assert.equal(current.kills.total,3);
 assert.equal(current.damage.value,4550);
 assert.equal(summarize(weapons,'competitive').headshots.value,5);
 assert.equal(summarize(weapons,'total').knocks.value,null);
 assert.equal(fmt(null),'—');
 assert.equal(fmt(245.25,'meters'),'245.25 m');
});
test('exports never mix sources, and neutralize formula-looking CSV cells',()=>{
 const csv=exportCsv(weapons,'official');
 assert.match(csv,/"BerylM762","30","3","15,000","10"/);
 assert.doesNotMatch(csv,/"300"/);
 assert.match(csv,/"45"/);
 const risky=exportCsv([{name:'=CMD()',official:{kills:3}}],'official');
 assert.match(risky,/"'=CMD\(\)"/);
 assert.doesNotMatch(risky,/account\./);
});
