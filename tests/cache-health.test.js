'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {shapeCacheHealth,getCacheHealth,CATEGORIES}=require('../lib/cache-health');
const data={
 schemaVersion:1,checkedAt:'2026-11-04T00:15:00Z',
 cache:{total:8,fresh:4,expired:4,newestFetchedAt:'2026-11-03T21:00:00Z',
  byCategory:{matches:3,player_profiles:1,other:4,accountId:'account.hidden'}},
 budget:{reserved:2,reservationLimit:8,rollingWindowSeconds:65,
  remaining:6,lastReservedAt:'2026-11-04T00:13:00Z',rawKey:'secret'},
 observations:{lifetimePlayers:51,seasonPlayers:1,seasonAttempts:0,
  player_id:123}
};
test('safe health projection preserves actual zero and aggregate counts only',()=>{
 const r=shapeCacheHealth(data);
 assert.equal(r.cache.total,8);
 assert.equal(r.budget.remaining,6);
 assert.equal(r.budget.windowSeconds,65);
 assert.equal(r.observations.seasonAttempts,0);
 assert.deepEqual(Object.keys(r.cache.byCategory),['player_profiles','matches','other']);
 assert.doesNotMatch(JSON.stringify(r),/accountId|account\.hidden|rawKey|secret|player_id/);
 assert.ok(Object.isFrozen(CATEGORIES));
});
test('health refuses unsupported versions and never fabricates absent metrics',()=>{
 assert.equal(shapeCacheHealth({...data,schemaVersion:2}),null);
 const r=shapeCacheHealth({...data,cache:{total:null,fresh:-1,expired:'3'}});
 assert.equal(r.cache.total,null);
 assert.equal(r.cache.fresh,null);
 assert.equal(r.cache.expired,null);
});
test('rate-limit panel derives remaining reservations from observed used slots',()=>{
 const r=shapeCacheHealth({...data,budget:{...data.budget,reserved:12,remaining:999}});
 assert.equal(r.budget.remaining,0);
 assert.equal(r.budget.reservations,12);
 assert.equal(shapeCacheHealth({...data,budget:{...data.budget,reservationLimit:10}}).budget.limit,null);
});
test('service-role RPC errors degrade cache-health only, not the existing status page',async()=>{
 const failure={rpc:async()=>({error:{message:'not installed'}})};
 assert.equal(await getCacheHealth(failure),null);
 const db={rpc:async(name)=>{
  assert.equal(name,'get_public_pubg_cache_health');
  return{data,error:null};
 }};
 assert.deepEqual(await getCacheHealth(db),shapeCacheHealth(data));
});
test('SQL migration is server-only and aggregates data rather than returning keys',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const sql=fs.readFileSync(path.join(__dirname,
  '../supabase/migrations/20261104_public_pubg_aggregate_cache_health.sql'),'utf8');
 assert.match(sql,/security invoker/);
 assert.match(sql,/revoke all on function public\.get_public_pubg_cache_health\(\)/);
 assert.match(sql,/to service_role/);
 assert.match(sql,/jsonb_build_object/);
});
