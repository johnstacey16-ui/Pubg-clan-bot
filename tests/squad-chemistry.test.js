'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {teammateChemistry}=require('../lib/web-insights');
const {filter,coverage,range,number,percent}=require('../assets/squad-chemistry');
const games=[
 {match_id:'one',played_at:'2026-11-05T12:00:00Z',summary:{
   map:'Baltic_Main',mode:'squad',placement:1,
   squad:[{name:'Me',isSelf:true,kills:6},
    {name:'Mate A',kills:4,damage:500,assists:1,knocks:2},
    {name:'Mate B',kills:0,damage:75,assists:0,knocks:0}]}},
 {match_id:'two',played_at:'2026-11-06T12:00:00Z',summary:{
   map:'Desert_Main',mode:'duo',placement:11,
   squad:[{name:'Me',isSelf:true,kills:null},
    {name:'mate a',kills:1,damage:125,assists:0,knocks:null},
    {name:'MATE A',kills:999,damage:999}]}},
 {match_id:'three',played_at:'2026-11-07T12:00:00Z',summary:{
   map:'Baltic_Main',mode:'squad',placement:null,
   squad:[{name:'Me',isSelf:true,kills:0},
    {name:'Mate A',kills:null,damage:null,assists:null,knocks:null}]}},
 {match_id:'one',played_at:'2026-11-05T12:00:00Z',summary:{
   map:'Baltic_Main',mode:'squad',placement:1,
   squad:[{name:'Me',isSelf:true,kills:999},
    {name:'Mate A',kills:9999}]}},
 {match_id:'four',played_at:'2026-11-07T13:00:00Z',summary:{
   map:'Unknown',mode:'squad',placement:3,
   squad:[{name:'Me',isSelf:true,kills:2}]}},
];
test('known placement denominator never treats missing placement as loss',()=>{
 const r=teammateChemistry(games,'Me');
 assert.equal(r.archivedMatches,4);
 assert.equal(r.items.length,2);
 const a=r.items.find(x=>x.name==='Mate A');
 assert.equal(a.games,3);
 assert.equal(a.knownPlacements,2);
 assert.equal(a.wins,1);
 assert.equal(a.top10,1);
 assert.equal(a.winRate,50);
 assert.equal(a.top10Rate,50);
 assert.equal(a.lastPlayedAt,'2026-11-07T12:00:00Z');
 assert.deepEqual(a.maps.map(x=>[x.name,x.games]),[['Baltic_Main',2],['Desert_Main',1]]);
 assert.deepEqual(a.modes.map(x=>[x.name,x.games]),[['squad',2],['duo',1]]);
});
test('only real pair-kill observations contribute to combined pair average',()=>{
 const a=teammateChemistry(games,'Me').items[0];
 assert.equal(a.kills,5);
 assert.equal(a.killsObserved,2);
 assert.equal(a.damage,625);
 assert.equal(a.damageObserved,2);
 assert.equal(a.assists,1);
 assert.equal(a.knocks,2);
 assert.equal(a.knocksObserved,1);
 assert.equal(a.myKills,6);
 assert.equal(a.myKillsObserved,2);
 assert.equal(a.pairedKills,10);
 assert.equal(a.pairedObserved,1);
 assert.equal(a.pairKillsPerMatch,10);
 const b=teammateChemistry(games,'Me').items.find(x=>x.name==='Mate B');
 assert.equal(b.kills,0);
 assert.equal(b.pairedKills,6);
});
test('missing kill records remain unavailable instead of becoming zero',()=>{
 const r=teammateChemistry([{match_id:'xyz',summary:{placement:null,
  squad:[{name:'Me',isSelf:true,kills:null},{name:'Mate C',kills:null,damage:null}]}}],'Me');
 const p=r.items[0];
 assert.equal(p.kills,null);
 assert.equal(p.myKills,null);
 assert.equal(p.damage,null);
 assert.equal(p.pairKillsPerMatch,null);
 assert.equal(p.winRate,null);
 assert.equal(p.knownPlacements,0);
 assert.equal(p.games,1);
});
test('filters and rank ordering never mutate actual source data',()=>{
 const rows=teammateChemistry(games,'Me').items;
 assert.deepEqual(filter(rows,{text:'mate',minGames:2,sort:'games'}).map(x=>x.name),['Mate A']);
 assert.deepEqual(filter(rows,{minGames:1,sort:'wins'}).map(x=>x.name),['Mate A','Mate B']);
 assert.deepEqual(range(rows).map(x=>x.games),[3,1]);
 assert.equal(coverage(rows).partners,2);
 assert.equal(coverage(rows).repeatPartners,1);
 assert.equal(coverage(rows).pairObservations,2);
 assert.equal(number(null),'—');
 assert.equal(percent(null),'—');
 assert.equal(percent(50),'50%');
});
test('squad history is compact, source-only and never leaks raw match or account data',()=>{
 const r=teammateChemistry([{match_id:'secret-match',played_at:'2026-11-07T12:00:00Z',
  summary:{map:'Baltic_Main',mode:'squad',placement:1,telemetryURL:'https://secret.example',
   squad:[{name:'Me',isSelf:true,kills:2,pubg_account_id:'account.SECRET'},
   {name:'Mate A',kills:3,unknownPrivate:'hidden'}]}}],'Me');
 assert.doesNotMatch(JSON.stringify(r),/secret-match|account\.|hidden|telemetryURL|secret\.example/);
});
