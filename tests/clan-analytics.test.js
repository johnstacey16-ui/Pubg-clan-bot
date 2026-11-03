'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const a=require('../assets/clan-analytics.js');
const {shape,weeklyProgress}=require('../lib/clan-weekly-progress');
const make=(name,n=100,more={})=>({name,platform:'xbox',
 matches:n,kills:n*2,wins:Math.floor(n/10),
 updatedAt:'2026-11-03T12:00:00Z',
 advanced:{damage:n*150,assists:n/4,revives:n/10,top10:n/2},
 modes:{squad:{roundsPlayed:n,kills:n*2,wins:Math.floor(n/10),damageDealt:n*150,assists:n/4,revives:n/10,top10s:n/2}},
 ...more});
test('missing statistics remain unknown, never zero or fabricated percentile',()=>{
 assert.equal(a.number(null),null);
 assert.equal(a.number(''),null);
 assert.equal(a.features(make('A',0,{advanced:{damage:null}})).damagePerMatch,null);
 assert.equal(a.percentile([1],1),null);
 assert.equal(a.median([1,2,3,4]),2.5);
 assert.deepEqual(a.winsorise([1,2,3,100],0.75),[1,2,3,3]);
});
test('roles and sample-size-aware rating require real comparison pool',()=>{
 const players=Array.from({length:9},(_,i)=>make('A'+i,100+i*5,
   {kills:100+i*120,advanced:{damage:(100+i*5)*(80+i*10),
    assists:50,revives:16,top10:35}}));
 const rankings=a.score(players);
 assert.equal(rankings.length,9);
 assert.ok(rankings.some(p=>p.rating!==null));
 assert.ok(rankings.every(p=>p.rating===null||(p.rating>=0&&p.rating<=100)));
 const short=a.score([make('Only')]);
 assert.equal(short[0].rating,null);
 assert.equal(short[0].role,'Insufficient data');
 assert.equal(a.awards([make('Only',100)])[0].winner.name,'Only');
});
test('awards exclude low-sample players and unavailable source metrics',()=>{
 const players=[make('Small',1,{kills:9999}),make('Big',50)];
 const awards=a.awards(players);
 assert.equal(awards[0].winner.name,'Big');
 assert.equal(a.awards([make('Poor',40,{advanced:{}})])
  .find(p=>p.title==='Medic').winner,null);
});
test('quality detects missing fields and old last-checked timestamp',()=>{
 const errors=a.quality([make('One',0,{advanced:{},updatedAt:'2026-01-01T00:00:00Z'})],Date.parse('2026-11-03T20:00:00Z'));
 assert.ok(errors.some(p=>p.issue.includes('Advanced')));
 assert.ok(errors.some(p=>p.issue.includes('older than')));
});
test('genuine spaced snapshots yield change, baseline does not',()=>{
 const rows=a.progress([{
  name:'Good',platform:'psn',latestAt:'2026-11-03T20:00:00Z',
  previousAt:'2026-10-26T20:00:00Z',latestKills:110,previousKills:92,
  latestWins:5,previousWins:4,latestMatches:55,previousMatches:49
 },{
  name:'Baseline',platform:'xbox',latestAt:'2026-11-03T20:00:00Z',
  previousAt:null,latestKills:20,latestMatches:10
 }]);
 assert.equal(rows[0].deltaKills,18);
 assert.equal(rows[0].deltaKpr,3);
 assert.equal(rows[1].state,'baseline_only');
 assert.equal(rows[1].deltaKpr,null);
});
test('negative counters produce review flag, not fake decline',()=>{
 const rows=a.progress([{name:'Reset',platform:'xbox',
  latestAt:'2026-11-03T20:00:00Z',previousAt:'2026-10-26T20:00:00Z',
  latestKills:0,previousKills:200,latestMatches:1,previousMatches:100}]);
 assert.equal(rows[0].state,'counter_changed');
 assert.equal(rows[0].deltaKpr,null);
});
test('CSV strict numeric checks, duplicate blocks and local unverified bot source',()=>{
 const good=a.parseCSV('name,matches,kills,botPct\n"Player, One",10,12,50');
 assert.equal(good.rows.length,1);
 assert.equal(good.rows[0].name,'Player, One');
 assert.ok(good.warnings.length);
 assert.ok(a.parseCSV('name,matches,kills\nAlice,12abc,20').errors.length);
 assert.ok(a.parseCSV('name,matches,kills\nAlice,12,20\nalice,22,30').errors.length);
 assert.ok(a.parseCSV('name,matches,kills\nAlice,1,999').errors.length===0);
 const csv=a.exportCSV([make('D"Q')]);
 assert.match(csv, /"D""Q"/);
});
test('offline comparison labels missing members as unconfirmed, never departed',()=>{
 const prev=[{name:'One',kills:10,matches:8},{name:'Two',kills:8,matches:4}];
 const next=[{name:'One',kills:14,matches:10}];
 const comparison=a.compareSnapshots(prev,next);
 assert.equal(comparison[0].kills,4);
 assert.match(comparison[1].state,/unconfirmed/);
});
test('public history RPC only returns allowlisted player measures',async()=>{
 const rows=[{player_name:'Member',platform:'xbox',latest_at:'2026-11-03T12:00:00Z',
  previous_at:null,latest_kills:10,latest_matches:5,latest_wins:1,
  player_id:123,account_id:'secret'}];
 const db={rpc:async name=>{assert.equal(name,'get_clan_weekly_progress');
  return{data:rows,error:null};}};
 const r=await weeklyProgress(db);
 assert.equal(r.status,200);
 assert.deepEqual(r.body.rows[0].previousAt,null);
 assert.doesNotMatch(JSON.stringify(r.body),/account_id|player_id|secret/);
 assert.equal(shape(rows).rows.length,1);
});
