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
 season_collection:{latest_result:null,last_finished_at:null}};
test('read-only panel shows actual budget, real cache counts and no upstream calls',async()=>{
 const b=browser(report);await b.client.show();
 assert.match(b.get('health-metrics').innerHTML,/2 \/ 8/);
 assert.match(b.get('health-metrics').innerHTML,/51/);
 assert.match(b.get('health-types').innerHTML,/Match details/);
 assert.match(b.get('health-status').textContent,/No PUBG requests/);
 await b.client.show();
 assert.equal(b.calls.length,1);
 assert.equal(b.calls[0].url,'/api/health');
 assert.equal(b.calls[0].opts.cache,'no-store');
 await b.get('health-refresh').events.click();
 assert.equal(b.calls.length,2);
});
test('unavailable aggregate is never presented as zero or healthy',async()=>{
 const b=browser({...report,cache_health:{status:'unavailable'}});
 await b.client.show();
 assert.match(b.get('health-status').textContent,/diagnostics unavailable/i);
 assert.equal(b.get('health-metrics').innerHTML,'');
});
