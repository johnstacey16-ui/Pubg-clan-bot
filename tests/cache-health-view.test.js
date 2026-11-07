'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../assets/cache-health.js'),'utf8');
function browser(report){
 const elements={},calls=[],window={};
 function get(id){return elements[id]||(elements[id]={
  id,textContent:'',innerHTML:'',disabled:false,events:{},
  addEventListener(type,fn){this.events[type]=fn;}
 });}
 const fetch=async(url,opts)=>{calls.push({url,opts});return{
  ok:true,json:async()=>report
 };};
 vm.runInNewContext(script,{window,document:{getElementById:get},fetch});
 return{get,calls,client:window.CacheHealth};
}
const report={status:'ok',last_sync_attempt:'2026-11-03T12:00:00Z',
 cache_health:{schemaVersion:1,checkedAt:'2026-11-04T00:30:00Z',
  cache:{total:8,fresh:4,expired:4,newestFetchedAt:'2026-11-03T21:00:00Z',
   byCategory:{matches:3,ranked:1}},
  budget:{reservations:2,limit:8,windowSeconds:65,lastReservedAt:null},
  observations:{lifetimePlayers:51,seasonPlayers:1,seasonAttempts:0}},
 season_collection:{latest_result:null,last_finished_at:null},
 collection_health:{
  schemaVersion:1,checkedAt:'2026-11-07T09:30:00Z',
  players:{verified:50,checked:50,checkedWithin24h:50,checkedWithin48h:50,
   checkedOlderThan48h:0,neverChecked:0,
   latestCheckedAt:'2026-11-07T03:28:13Z',oldestCheckedAt:'2026-11-07T03:18:48Z'},
  archive:{playerMatchObservations:1772,observedPlayers:39,distinctMatches:1497,
   writesWithin24h:1772,lastWrittenAt:'2026-11-07T05:47:25Z',
   lastMatchPlayedAt:'2026-11-07T02:56:18Z'},
  scopes:[
   {scope:'lifetime',total:50,done:50,pending:0,leased:0,unavailable:0,
    readyForRetry:0,pendingOlderThan48h:0,lastCompletedAt:'2026-11-07T03:28:14Z'},
   {scope:'profile',total:50,done:48,pending:2,leased:0,unavailable:0,
    readyForRetry:2,pendingOlderThan48h:0,lastCompletedAt:'2026-11-07T05:47:25Z'},
   {scope:'weapons',total:50,done:50,pending:0,leased:0,unavailable:0,
    readyForRetry:0,pendingOlderThan48h:0,lastCompletedAt:'2026-11-05T03:16:53Z'},
   {scope:'survival',total:50,done:50,pending:0,leased:0,unavailable:0,
    readyForRetry:0,pendingOlderThan48h:0,lastCompletedAt:'2026-11-05T03:26:14Z'}
  ],
  season:{tracked:0,attemptedWithin24h:0,completedWithin24h:0,
   lastAttemptAt:null,lastCompletedAt:null},
  note:'Confirmed check timestamps; not proof of fresh PUBG.'
 }};
test('read-only panel shows actual budget, real cache counts and no upstream calls',async()=>{
 const b=browser(report);await b.client.show();
 assert.match(b.get('health-metrics').innerHTML,/2 \/ 8/);
 assert.match(b.get('health-metrics').innerHTML,/51/);
 assert.match(b.get('health-types').innerHTML,/Match details/);
 assert.match(b.get('health-status').textContent,/No PUBG requests/);
 await b.client.show();
 assert.equal(b.calls.length,1);
 assert.equal(b.calls[0].url,'/api/health?collection=1');
 assert.equal(b.calls[0].opts.cache,'no-store');
 await b.get('health-refresh').events.click();
 assert.equal(b.calls.length,2);
});
test('Data Health renders actual collector stage counts and distinct archive clocks',async()=>{
 const b=browser(report);await b.client.show();
 assert.match(b.get('health-freshness-metrics').innerHTML,/50 \/ 50/);
 assert.match(b.get('health-freshness-metrics').innerHTML,/1,497/);
 assert.match(b.get('health-backfill-table').innerHTML,/Recent-match index/);
 assert.match(b.get('health-backfill-table').innerHTML,/48 \/ 50/);
 assert.match(b.get('health-backfill-note').textContent,/2 clan tasks are pending/);
 assert.match(b.get('health-backfill-note').textContent,/2 are ready/);
 assert.match(b.get('health-archive-note').textContent,/newest match played/);
 assert.match(b.get('health-collection-note').textContent,/No stale player-check/);
 assert.match(b.get('health-season-collector').textContent,/0 tracked clan players/);
 assert.match(b.get('health-collection-source').textContent,/not proof of fresh PUBG/);
});
test('missing collector health is an unknown source, never a fabricated healthy state',async()=>{
 const b=browser({...report,collection_health:{status:'unavailable'}});
 await b.client.show();
 assert.match(b.get('health-collection-note').textContent,/details unavailable/i);
 assert.equal(b.get('health-freshness-metrics').innerHTML,'');
 assert.equal(b.get('health-backfill-table').innerHTML,'');
 assert.match(b.get('health-metrics').innerHTML,/2 \/ 8/);
});
test('unavailable aggregate is never presented as zero or healthy',async()=>{
 const b=browser({...report,cache_health:{status:'unavailable'}});
 await b.client.show();
 assert.match(b.get('health-status').textContent,/diagnostics unavailable/i);
 assert.equal(b.get('health-metrics').innerHTML,'');
});
