'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {cachedPlayerMatches,summarizeMatch}=require('../lib/web-match-intel');
const ID='00336e4b-d659-4497-bfc4-9f6dd705cc71';
const account='account.TESTPLAYER01';
const payload={
  data:{id:ID,attributes:{mapName:'Baltic_Main',gameMode:'squad',
    duration:1900,createdAt:'2026-11-02T14:00:00Z'}},
  included:[
    {id:'p1',type:'participant',attributes:{stats:{
      name:'ClanTester',playerId:account,kills:7,damageDealt:645.3,winPlace:2,
      assists:3,headshotKills:2,revives:1,DBNOs:4,heals:5,boosts:6}}},
    {id:'p2',type:'participant',attributes:{stats:{
      name:'Teammate',playerId:'account.TEAM',kills:3,damageDealt:210,winPlace:2}}},
    {id:'p3',type:'participant',attributes:{stats:{
      name:'Enemy',playerId:'account.ENEMY',kills:90,damageDealt:9999,winPlace:1}}},
    {id:'r1',type:'roster',relationships:{participants:{data:[{id:'p1'},{id:'p2'}]}}},
    {id:'r2',type:'roster',relationships:{participants:{data:[{id:'p3'}]}}},
    {id:'asset1',type:'asset',attributes:{URL:'https://private-telemetry-link.example'}}
  ]
};
function fakeDb(opts={}) {
 const calls=[];
 const db={
  calls,
  from(table){
    calls.push(table);
    const query={
      select(){return this},eq(){return this},ilike(){return this},in(){return this},
      async limit(){
        if(table==='player_import_queue')return{data:[{gamertag:'ClanTester',status:opts.status||'matched',is_clan_member:opts.official!==false}],error:null};
        if(table==='players')return{data:[{gamertag:'ClanTester',platform:'xbox',pubg_account_id:account}],error:null};
        return{data:opts.missing?[]:[{cache_key:'pubg:v1:console/matches/'+ID,payload,fetched_at:'2026-11-03T10:00:00Z'}],error:null};
      },
      async maybeSingle(){
        if(opts.noIndex)return{data:null,error:null};
        return{data:{payload:{data:{relationships:{matches:{data:[{id:ID},{id:'invalid-match'}]}}}},fetched_at:'2026-11-03T10:00:00Z'},error:null};
      }
    };
    return query;
  }
 };
 return db;
}
test('correctly summarises PUBG roster, placement and performance',()=>{
 const r=summarizeMatch(payload,account);
 assert.equal(r.kills,7);
 assert.equal(r.placement,2);
 assert.equal(r.damage,645.3);
 assert.deepEqual(r.squad.map(x=>x.name),['ClanTester','Teammate']);
 assert.equal(r.squad[0].isSelf,true);
 assert.doesNotMatch(JSON.stringify(r),/account\.|telemetry-link|Enemy/);
});
test('only verified clan players can fetch saved matches',async()=>{
 const db=fakeDb({official:false});
 const r=await cachedPlayerMatches(db,'ClanTester');
 assert.equal(r.status,404);
 assert.deepEqual(db.calls,['player_import_queue']);
});
test('saved matches contain no internal IDs, URLs or opponent accounts',async()=>{
 const db=fakeDb();
 const r=await cachedPlayerMatches(db,'ClanTester');
 assert.equal(r.status,200);
 assert.equal(r.body.availableCount,1);
 assert.equal(r.body.indexedCount,1);
 assert.deepEqual(db.calls,['player_import_queue','players','pubg_endpoint_cache','pubg_endpoint_cache']);
 assert.doesNotMatch(JSON.stringify(r.body),/account\.|private-telemetry|Enemy|cache_key|pubg_account_id/);
});
test('missing cache shows an honest empty state without PUBG requests',async()=>{
 const db=fakeDb({noIndex:true});
 const r=await cachedPlayerMatches(db,'ClanTester');
 assert.equal(r.status,200);
 assert.equal(r.body.availableCount,0);
 assert.match(r.body.note,/No saved recent-match index/);
 assert.deepEqual(db.calls,['player_import_queue','players','pubg_endpoint_cache']);
});
test('known indexed matches are not invented when detail cache is absent',async()=>{
 const db=fakeDb({missing:true});
 const r=await cachedPlayerMatches(db,'ClanTester');
 assert.equal(r.body.indexedCount,1);
 assert.equal(r.body.availableCount,0);
});
test('invalid multi-account and control inputs are rejected before database reads',async()=>{
 for(const name of ['','Fred,Other','foo\nbar','x'.repeat(101)]){
   const db=fakeDb();
   const r=await cachedPlayerMatches(db,name);
   assert.equal(r.status,400);
   assert.equal(db.calls.length,0);
 }
});
