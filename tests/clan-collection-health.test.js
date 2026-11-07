'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {shapeCollectionHealth,getCollectionHealth,SCOPES}=
 require('../lib/clan-collection-health');
const source={
 schemaVersion:1,checkedAt:'2026-11-07T09:30:00Z',
 players:{verified:50,checked:50,checkedWithin24h:50,
  checkedWithin48h:50,checkedOlderThan48h:0,
  latestCheckedAt:'2026-11-07T03:28:13Z',
  oldestCheckedAt:'2026-11-07T03:18:48Z',
  player_id:334,accountId:'pubg.private'},
 archive:{playerMatchObservations:1772,observedPlayers:39,distinctMatches:1497,
  writesWithin24h:1772,lastWrittenAt:'2026-11-07T05:47:25Z',
  lastMatchPlayedAt:'2026-11-07T02:56:18Z',match_ids:['abc-secret']},
 scopes:[
  {scope:'lifetime',total:50,done:50,pending:0,leased:0,unavailable:0,
   readyForRetry:0,pendingOlderThan48h:0,
   lastAttemptAt:'2026-11-07T03:28:12Z',lastCompletedAt:'2026-11-07T03:28:14Z'},
  {scope:'profile',total:50,done:48,pending:2,leased:0,unavailable:0,
   readyForRetry:2,pendingOlderThan48h:0,
   lastAttemptAt:'2026-11-07T05:47:23Z',lastCompletedAt:'2026-11-07T05:47:25Z',
   last_outcome:'budget_full',pubg_account_id:'secret'},
  {scope:'weapons',total:50,done:50,pending:0,leased:0,unavailable:0,
   readyForRetry:0,pendingOlderThan48h:0,
   lastAttemptAt:'2026-11-05T03:16:52Z',lastCompletedAt:'2026-11-05T03:16:53Z'},
  {scope:'survival',total:50,done:50,pending:0,leased:0,unavailable:0,
   readyForRetry:0,pendingOlderThan48h:0,
   lastAttemptAt:'2026-11-05T03:26:13Z',lastCompletedAt:'2026-11-05T03:26:14Z'}
 ],
 season:{tracked:0,attemptedWithin24h:0,completedWithin24h:0,
  lastAttemptAt:null,lastCompletedAt:null,raw_token:'secret'}
};
test('private collector status projects only verified aggregate numbers and dates',()=>{
 const p=shapeCollectionHealth(source);
 assert.equal(p.schemaVersion,1);
 assert.equal(p.players.verified,50);
 assert.equal(p.players.checkedWithin24h,50);
 assert.equal(p.players.neverChecked,0);
 assert.equal(p.archive.distinctMatches,1497);
 assert.equal(p.archive.writesWithin24h,1772);
 assert.equal(p.scopes[1].scope,'profile');
 assert.equal(p.scopes[1].done,48);
 assert.equal(p.scopes[1].readyForRetry,2);
 assert.equal(p.season.tracked,0);
 assert.deepEqual(SCOPES,['lifetime','profile','weapons','survival']);
 assert.doesNotMatch(JSON.stringify(p),
  /private|secret|accountId|match_ids|last_outcome|pubg_account_id|player_id|raw_token/);
});
test('null and missing details are unknown, not invented zero health',()=>{
 const a=shapeCollectionHealth({...source,players:{
  ...source.players,checked:48,checkedWithin24h:45,
  checkedWithin48h:47,checkedOlderThan48h:1}});
 assert.equal(a.players.neverChecked,2);
 assert.equal(a.players.checkedOlderThan48h,1);
 assert.equal(shapeCollectionHealth({...source,scopes:source.scopes.slice(1)}),null);
 assert.equal(shapeCollectionHealth({...source,players:{...source.players,
  checkedWithin24h:null}}),null);
 assert.equal(shapeCollectionHealth({...source,archive:{...source.archive,
  distinctMatches:2000}}),null);
 assert.equal(shapeCollectionHealth({...source,season:{...source.season,
  tracked:0,attemptedWithin24h:1}}),null);
 assert.equal(shapeCollectionHealth({...source,scopes:[
  ...source.scopes.slice(0,3),source.scopes[0]]}),null);
 assert.equal(shapeCollectionHealth({...source,scopes:[
  {...source.scopes[0],readyForRetry:1},...source.scopes.slice(1)]}),null);
 assert.equal(shapeCollectionHealth({...source,scopes:[
  {...source.scopes[0],done:100},...source.scopes.slice(1)]}),null);
});
test('RPC failure is optional: ordinary health and Discord bot are never blocked',async()=>{
 assert.equal(await getCollectionHealth({rpc:async()=>({error:{message:'missing'}})}),null);
 assert.equal(await getCollectionHealth({rpc:async()=>{throw Error('offline')}}),null);
 const calls=[];
 const shaped=await getCollectionHealth({rpc:async(name)=>{
  calls.push(name);return{data:source,error:null};
 }});
 assert.deepEqual(calls,['get_clan_collection_health']);
 assert.deepEqual(shaped,shapeCollectionHealth(source));
});
test('collector health migration is private, aggregate-only, and fully source-based',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..',
  'supabase/migrations/20261107_clan_collection_freshness_health.sql'),'utf8');
 assert.match(sql,/language sql stable security invoker set search_path = ''/);
 assert.match(sql,/public\.clan_match_archive/);
 assert.match(sql,/public\.pubg_backfill_jobs/);
 assert.match(sql,/q\.is_clan_member=true/);
 assert.match(sql,/a\.recorded_at/);
 assert.match(sql,/a\.played_at/);
 assert.match(sql,/j\.state='pending'/);
 assert.match(sql,/revoke all on function public\.get_clan_collection_health\(\)/);
 assert.match(sql,/grant execute on function public\.get_clan_collection_health\(\)\s+to service_role/);
 assert.doesNotMatch(sql,/security definer|create table|drop table|http_get|pubg_api_key/i);
 const api=fs.readFileSync(path.join(__dirname,'../api/health.js'),'utf8');
 assert.match(api,/req\.query\?\.collection === '1'/);
 assert.match(api,/includeCollection \? getCollectionHealth\(db\) : Promise\.resolve\(null\)/);
 assert.match(api,/collection_health:collectionHealth/);
});
