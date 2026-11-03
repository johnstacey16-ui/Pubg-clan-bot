'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {cachedEndpoint,playerEndpoint,matchEndpoint}=require('../lib/pubg-endpoints');
const ACCOUNT='account.CONFIRMEDPLAYER123';
function fakeDb({allowed=true,seed=true}={}){
 const calls=[],now=new Date().toISOString();
 const seedRow=seed?{payload:{data:{id:'old'}},
   expires_at:new Date(Date.now()+3600000).toISOString()}:null;
 return{
   calls,
   from(table){
     calls.push({table});
     return{
       select(){return this},eq(key,value){this.cacheKey=value;return this},
       async maybeSingle(){return{data:seedRow,error:null}},
       upsert(row){calls.push({saved:row});return{
         async select(){return{data:[{cache_key:row.cache_key}],error:null}}
       }}
     };
   },
   async rpc(name,args){calls.push({rpc:name,args});return{data:allowed,error:null}}
 };
}
test('ordinary cached masteries reuse current cache without PUBG requests',async()=>{
 const db=fakeDb(),original=global.fetch;
 global.fetch=async()=>{throw Error('Cached lookup should not contact PUBG')};
 try{
   const r=await playerEndpoint(db,{platform:'xbox',pubg_account_id:ACCOUNT},
     'weapon_mastery',3600);
   assert.equal(r.state,'cached');
   assert.equal(db.calls.some(x=>x.rpc),false);
 }finally{global.fetch=original}
});
test('explicit force refresh reserves shared API budget and replaces stale cache entry',async()=>{
 const db=fakeDb(),oldFetch=global.fetch,oldKey=process.env.PUBG_API_KEY;
 const calls=[];process.env.PUBG_API_KEY='TEST_NOT_A_REAL_SECRET';
 global.fetch=async(url)=>{
   calls.push(url);
   return{status:200,ok:true,json:async()=>({data:{id:'new'}})};
 };
 try{
   const r=await playerEndpoint(db,{platform:'psn',pubg_account_id:ACCOUNT},
     'weapon_mastery',3600,{force:true});
   assert.equal(r.state,'fresh');
   assert.equal(r.data.data.id,'new');
   assert.equal(db.calls.filter(x=>x.rpc==='reserve_pubg_requests').length,1);
   assert.equal(db.calls.find(x=>x.rpc==='reserve_pubg_requests').args.p_count,1);
   assert.ok(db.calls.some(x=>x.saved?.cache_key.endsWith('/weapon_mastery')));
   assert.equal(calls.length,1);
   assert.match(calls[0],/shards\/psn\/players\/account\.CONFIRMEDPLAYER123\/weapon_mastery/);
 }finally{
   global.fetch=oldFetch;
   if(oldKey===undefined)delete process.env.PUBG_API_KEY;
   else process.env.PUBG_API_KEY=oldKey;
 }
});
test('shared rate limit denies force re-fetch and retains existing data',async()=>{
 const db=fakeDb({allowed:false}),oldFetch=global.fetch,oldKey=process.env.PUBG_API_KEY;
 process.env.PUBG_API_KEY='TEST_NOT_A_REAL_SECRET';
 global.fetch=async()=>{throw Error('Rate-limit denial must not issue network call')};
 try{
   const r=await cachedEndpoint(db,'xbox','players/'+ACCOUNT+'/weapon_mastery',3600,{force:true});
   assert.equal(r.state,'stale');
   assert.equal(r.data.data.id,'old');
   assert.equal(db.calls.some(x=>x.saved),false);
 }finally{
   global.fetch=oldFetch;
   if(oldKey===undefined)delete process.env.PUBG_API_KEY;
   else process.env.PUBG_API_KEY=oldKey;
 }
});
test('console match detail requests do not consume PUBG API request slots',async()=>{
 const db=fakeDb({seed:false}),oldFetch=global.fetch;
 const uuid='00336e4b-d659-4497-bfc4-9f6dd705cc71';
 global.fetch=async url=>{
   assert.match(url,/shards\/console\/matches\//);
   return{ok:true,status:200,json:async()=>({data:{id:uuid,type:'match'}})};
 };
 try{
   const r=await matchEndpoint(db,uuid);
   assert.equal(r.state,'fresh');
   assert.equal(db.calls.some(x=>x.rpc),false);
   assert.ok(db.calls.some(x=>x.saved?.cache_key.endsWith(uuid)));
 }finally{global.fetch=oldFetch}
});
