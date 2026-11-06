'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {
 rows,filter,summary,groups,recentTrend,squadStats,fmt,pct
}=require('../assets/match-lab');
const items=[
 {id:'one',map:'Baltic_Main',mode:'squad',playedAt:'2026-11-02T10:00:00Z',
  placement:1,kills:5,damage:800,assists:2,knocks:3,squad:[
   {name:'Me',isSelf:true,kills:5,damage:800,assists:2},
   {name:'Friend',isSelf:false,kills:3,damage:150,assists:1},
   {name:'FRIEND',isSelf:false,kills:99,damage:9999,assists:99}]},
 {id:'two',map:'Baltic_Main',mode:'squad',playedAt:'2026-11-03T10:00:00Z',
  placement:12,kills:0,damage:50,assists:0,knocks:0,
  squad:[{name:'Me',isSelf:true,kills:0},{name:'Friend',kills:0}]},
 {id:'three',map:'Desert_Main',mode:'solo',playedAt:'2026-11-05T10:00:00Z',
  placement:7,kills:3,damage:400,assists:0,knocks:1},
 {id:'four',map:'Desert_Main',mode:'duo',playedAt:'2026-11-06T10:00:00Z',
  placement:null,kills:null,damage:null,assists:null},
 {id:'two',map:'Baltic_Main',mode:'squad',playedAt:'2026-11-03T10:00:00Z',
  placement:12,kills:50000,damage:50000}
];
test('deduplicates source match IDs and honours observed zero',()=>{
 assert.equal(rows(items).length,4);
 assert.equal(summary(rows(items)).count,4);
 assert.equal(summary(rows(items)).wins,1);
 assert.equal(summary(rows(items)).ranked,3);
 assert.equal(summary(rows(items)).kills,8);
 assert.equal(summary(rows(items)).killsObserved,3);
 assert.equal(summary(rows(items)).killsPerMatch,8/3);
 assert.equal(summary(rows(items)).damageObserved,3);
 assert.equal(summary(rows(items)).avgPlace,20/3);
 assert.equal(summary(rows(items)).top10Rate,200/3);
 assert.equal(summary([{id:'x',placement:null}]).winRate,null);
 assert.equal(summary([]).damagePerMatch,null);
});
test('map mode and placements filter only real saved records',()=>{
 assert.deepEqual(filter(items,{map:'Baltic_Main'}).map(m=>m.id),['two','one']);
 assert.deepEqual(filter(items,{mode:'solo'}).map(m=>m.id),['three']);
 assert.deepEqual(filter(items,{outcome:'win'}).map(m=>m.id),['one']);
 assert.deepEqual(filter(items,{outcome:'top10'}).map(m=>m.id),['three','one']);
 assert.deepEqual(filter(items,{outcome:'other'}).map(m=>m.id),['two']);
 assert.deepEqual(filter(items,{outcome:'unknown'}).map(m=>m.id),['four']);
 assert.deepEqual(filter(items,{order:'kills'}).map(m=>m.id),['one','three','two','four']);
 assert.deepEqual(filter(items,{order:'oldest'}).map(m=>m.id),['one','two','three','four']);
 assert.deepEqual(filter(items,{order:'placement'}).map(m=>m.id),['one','three','two','four']);
});
test('per-map and per-mode analysis is bounded to the visible match sample',()=>{
 const byMap=groups(filter(items,{mode:'squad'}),'map');
 assert.equal(byMap.length,1);
 assert.equal(byMap[0].count,2);
 assert.equal(byMap[0].winRate,50);
 assert.equal(byMap[0].killsPerMatch,2.5);
 const byMode=groups(rows(items),'mode');
 assert.deepEqual(byMode.map(m=>m.name),['squad','duo','solo']);
 assert.equal(byMode.find(m=>m.name==='duo').winRate,null);
});
test('recorded squad share ignores duplicate names and absent squad fields',()=>{
 const result=squadStats(items[0]);
 assert.equal(result.members,2);
 assert.equal(result.teamKills,8);
 assert.equal(result.teamDamage,950);
 assert.equal(result.share,62.5);
 assert.equal(squadStats(items[2]),null);
 assert.equal(squadStats(items[1]).share,null);
});
test('recent chart shows only real matches in chronological order and does not mutate input',()=>{
 const before=items.slice();
 assert.deepEqual(recentTrend(items,'damage',3).map(x=>x.id),['two','three','four']);
 assert.equal(recentTrend(items,'damage',3)[2].value,null);
 assert.deepEqual(items,before);
 assert.equal(fmt(null),'—');
 assert.equal(pct(null),'—');
 assert.equal(pct(50),'50%');
});
