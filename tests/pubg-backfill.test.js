'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {collectClanExtras,MAX_JOBS,MAX_MATCHES}=require('../lib/clan-backfill');
const MATCHES=Array.from({length:8},(_,i)=>
  (String(i).padStart(8,'0')+'-abcd-4def-8abc-123456789abc'));
function db(jobs){
 const writes=[],calls=[];
 const database={writes,calls,rpc(name,args){
  calls.push({name,args});
  if(name==='seed_pubg_backfill_jobs')return Promise.resolve({data:jobs.length,error:null});
  if(name==='claim_pubg_backfill_jobs')return Promise.resolve({data:jobs,error:null});
  if(name==='get_pubg_backfill_status')return Promise.resolve({data:{
    total:jobs.length,done:writes.filter(x=>x.patch.state==='done').length,
    pending:writes.filter(x=>x.patch.state==='pending').length,
    leased:0,unavailable:writes.filter(x=>x.patch.state==='unavailable').length
  },error:null});
  throw Error('Unexpected RPC '+name);
 },from(table){
   assert.equal(table,'pubg_backfill_jobs');
   const q={patch:null,filters:[],update(p){this.patch=p;return this;},
     eq(key,value){this.filters.push([key,value]);return this;},
     select(){writes.push({patch:this.patch,filters:this.filters});return Promise.resolve({
       data:[{player_id:1}],error:null});}};
   return q;
 }};
 return database;
}
const job=(scope,i=1,attempts=1)=>({player_id:i,gamertag:'Member'+i,
  platform:'xbox',pubg_account_id:'account.valid000001',scope,attempts});
test('finite backfill uses background rate lane, reuses cached resources, and fetches at most five unmetered match details',async()=>{
 const database=db([job('profile'),job('weapons',2)]);
 const calls=[],matchIds=[];
 const result=await collectClanExtras(database,{
   playerEndpoint:async(_db,person,suffix,ttl,options)=>{
     calls.push({suffix,ttl,options});
     return person.scope==='profile'?{state:'fresh',data:{
       data:{relationships:{matches:{data:MATCHES.map(id=>({id}))}}}
     }}:{state:'cached',data:{data:{}}};
   },
   matchEndpoint:async(_db,id)=>{matchIds.push(id);return{state:'fresh',data:{id}};}
 });
 assert.equal(result.claimed,2);
 assert.equal(result.saved,1);
 assert.equal(result.cached,1);
 assert.equal(result.done,2);
 assert.equal(result.freeMatchDetails,MAX_MATCHES);
 assert.equal(matchIds.length,5);
 assert.ok(calls.every(x=>x.options.background===true));
 assert.ok(database.writes.every(x=>x.patch.state==='done'));
 assert.equal(MAX_JOBS,6);
});
test('shared quota exhaustion does not mark missing data fetched and releases its job for retry',async()=>{
 const database=db([job('survival')]);
 const result=await collectClanExtras(database,{
   playerEndpoint:async()=>({state:'rate_limited'})
 });
 assert.equal(result.rateLimited,1);
 assert.equal(result.status,'rate_limited');
 assert.equal(result.done,0);
 assert.equal(database.writes[0].patch.state,'pending');
 assert.match(database.writes[0].patch.next_attempt_at,/Z$/);
});
test('unavailable resources pause and become visible instead of repeatedly starving the queue',async()=>{
 const database=db([job('weapons',1,3)]);
 const result=await collectClanExtras(database,{
   playerEndpoint:async()=>({state:'not_found'})
 });
 assert.equal(result.unavailable,1);
 assert.equal(result.unavailableTotal,1);
 assert.equal(database.writes[0].patch.state,'unavailable');
});
test('database migration gives real players priority and rejects anonymous API access',()=>{
 const sql=fs.readFileSync(path.join(__dirname,
   '../supabase/migrations/20261104_maximum_pubg_priority_and_backfill.sql'),'utf8');
 assert.match(sql,/used_count\+p_count > 10/);
 assert.match(sql,/used_count\+p_count > 8/);
 assert.match(sql,/reserve_pubg_background_requests/);
 assert.match(sql,/pg_advisory_xact_lock\(551167711\)/);
 assert.match(sql,/pg_advisory_xact_lock\(87119521\)/);
 assert.match(sql,/interval '65 seconds'/);
 assert.match(sql,/interval '2 minutes'/);
 assert.doesNotMatch(sql,/next_global/);
 assert.match(sql,/for update of j skip locked/i);
 for(const name of ['reserve_pubg_requests','reserve_pubg_background_requests',
   'reserve_web_refresh','claim_pubg_backfill_jobs','get_pubg_backfill_status'])
   assert.match(sql,new RegExp('revoke all on function public\\.'+name+'\\('));
});
test('runner uses only authenticated requests and caps retry cycles',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../scripts/collect-pubg-backfill.js'),'utf8');
 assert.match(src,/PUBG_SYNC_CRON_SECRET/);
 assert.match(src,/Math\.min\(25/);
 assert.match(src,/sleep\(66000\)/);
 assert.match(src,/redirect:'error'/);
 assert.doesNotMatch(src,/PUBG_API_KEY|SUPABASE_SERVICE_KEY/);
});


test('lifetime backfill uses the background reservation lane, not live-search slots',async()=>{
 const database=db([job('lifetime')]);
 const calls=[];
 const result=await collectClanExtras(database,{
   getStats:async(_db,name,opts)=>{calls.push({name,opts});
     return{state:'player',source:'live',player:{gamertag:name}};},
   playerEndpoint:async()=>{throw Error('Lifetime uses getStats');}
 });
 assert.equal(result.saved,1);
 assert.equal(result.done,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.background,true);
 assert.equal(calls[0].opts.refreshRequested,true);
});
