'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {getStats}=require('../lib/live-stats');

function savedDb(existing=null){
 const state={calls:[],writes:[],players:existing?[existing]:[],queue:[]};
 const db={...state,
   rpc(name,args){state.calls.push({name,args});return Promise.resolve({data:true,error:null});},
   from(table){
     state.calls.push({table});
     const q={
       select(){return this},ilike(){return this},eq(){return this},limit(){
         return Promise.resolve({data:table==='players'?state.players:table==='player_import_queue'?state.queue:[],error:null});
       },
       upsert(row){
         state.writes.push({table,row});
         return{select(){return this},single(){
           const player={id:41,...row};if(table==='players')state.players=[player];
           return Promise.resolve({data:player,error:null});
         }};
       },
       insert(row){
         state.writes.push({table,row});
         return{select(){return Promise.resolve({data:[{id:99}],error:null})}};
       },
       async maybeSingle(){return{data:null,error:null}}
     };
     return q;
   }
 };
 return db;
}
test('selected Xbox player search reserves only two calls and stores as non-clan',async()=>{
 const old=global.fetch,oldKey=process.env.PUBG_API_KEY;
 process.env.PUBG_API_KEY='TEST_ONLY_NOT_A_REAL_KEY';
 const paths=[];
 global.fetch=async url=>{
   paths.push(url);
   return{ok:true,status:200,json:async()=>url.includes('/seasons/lifetime')?
     {data:{attributes:{gameModeStats:{squad:{roundsPlayed:10,kills:22,wins:2}}}}}:
     {data:[{id:'account.EXTERNAL01234567',attributes:{name:'ExternalPlayer'}}]}};
 };
 try{
   const db=savedDb(),result=await getStats(db,'ExternalPlayer',{platform:'xbox',refreshRequested:true});
   assert.equal(result.state,'player');
   assert.equal(result.source,'live');
   assert.equal(result.player.total_kills,22);
   assert.equal(db.calls.find(x=>x.name==='reserve_pubg_requests').args.p_count,2);
   assert.equal(paths.length,2);
   assert.ok(paths.every(x=>x.includes('/shards/xbox/')));
   assert.ok(db.writes.some(x=>x.table==='player_import_queue' && !x.row.is_clan_member));
 }finally{
   global.fetch=old;
   if(oldKey===undefined)delete process.env.PUBG_API_KEY;
   else process.env.PUBG_API_KEY=oldKey;
 }
});
test('different console with identical gamertag cannot overwrite saved identity',async()=>{
 const db=savedDb({id:3,gamertag:'SameName',platform:'xbox',
   pubg_account_id:'account.EXISTING',total_kills:88,total_wins:4,matches_played:25,
   last_checked:'2026-01-01T00:00:00Z'});
 const result=await getStats(db,'SameName',{platform:'psn',refreshRequested:true});
 assert.equal(result.state,'platform_conflict');
 assert.equal(db.writes.length,0);
 assert.equal(db.calls.some(x=>x.name==='reserve_pubg_requests'),false);
});
test('invalid console selection fails before reading or calling PUBG',async()=>{
 const db=savedDb();
 const result=await getStats(db,'ExternalPlayer',{platform:'steam',refreshRequested:true});
 assert.equal(result.state,'invalid');
 assert.equal(db.calls.length,0);
});
