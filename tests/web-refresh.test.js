'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {refreshScopedData,validRefresh}=require('../lib/web-refresh');
const {savedSeason,shapeRanked,shapeSeasonPayload}=require('../lib/web-season');
const MATCHES=[
  '00336e4b-d659-4497-bfc4-9f6dd705cc71',
  '01336e4b-d659-4497-bfc4-9f6dd705cc71',
  '02336e4b-d659-4497-bfc4-9f6dd705cc71',
  '03336e4b-d659-4497-bfc4-9f6dd705cc71',
  '04336e4b-d659-4497-bfc4-9f6dd705cc71',
  '05336e4b-d659-4497-bfc4-9f6dd705cc71'
];
const ACCOUNT='account.TESTPLAYER0123456';
function db(opts={}) {
 const calls=[];
 const source={
   players: [{gamertag:'OtherPlayer',platform:'psn',pubg_account_id:ACCOUNT}],
   pubg_endpoint_cache: []
 };
 const database={
  calls,
  from(table){
   calls.push({table});
   const q={
    select(){return this},eq(k,v){this.k=v;return this},ilike(){return this},
    async limit(){return{data:source[table]||[],error:null}},
    async maybeSingle(){
      if(table!=='pubg_endpoint_cache')return{data:null,error:null};
      if(opts.noCache)return{data:null,error:null};
      if(this.k==='pubg:v1:psn/seasons')
        return{data:{payload:{data:[{id:'division.bro.official.console-43',
          attributes:{isCurrentSeason:true,isOffseason:false}}]},fetched_at:'2026-11-03T12:00:00Z'},error:null};
      return{data:{payload:{data:{attributes:{
        rankedGameModeStats:{squad:{roundsPlayed:45,kills:120,wins:3,
          currentRankPoint:2319,currentTier:{tier:'Platinum',subTier:'2'},
          accountId:'hidden',secret:'private'}},
        gameModeStats:{solo:{roundsPlayed:8,kills:22,wins:2,damageDealt:2500,
          secret:'hidden'}}
      }}},fetched_at:'2026-11-03T12:10:00Z'},error:null};
    }
   };return q;
  },
  async rpc(name,args){
   calls.push({rpc:name,args});
   return{data:opts.limit!==false,error:null};
  }
 };
 return database;
}
test('scope allowlist rejects forged paths and invalid gamertags before any DB work',async()=>{
 for(const params of [
  {name:'A,B',platform:'psn',scope:'weapons'},
  {name:'OtherPlayer',platform:'steam',scope:'weapons'},
  {name:'OtherPlayer',platform:'psn',scope:'../../../secret'},
  {name:'OtherPlayer',platform:'psn',scope:'matches\n'},
  {name:'',platform:'auto',scope:'ranked'}
 ]) {
   const database=db();
   const r=await refreshScopedData(database,params);
   assert.equal(r.status,400);
   assert.equal(database.calls.length,0);
 }
 assert.equal(validRefresh({name:'OtherPlayer',scope:'weapons'}),true);
});
test('mastery refresh for non-clan PSN player uses saved platform and one scoped budget',async()=>{
 const database=db(),requests=[];
 const result=await refreshScopedData(database,{name:'OtherPlayer',platform:'auto',scope:'weapons'},{
  playerEndpoint:async(_db,player,suffix,ttl,options)=>{
   requests.push({player,suffix,ttl,options});
   return{state:'fresh',data:{data:{attributes:{weaponSummaries:{}}}}};
  }
 });
 assert.equal(result.status,200);
 assert.equal(result.body.platform,'psn');
 assert.equal(result.body.state,'fresh');
 assert.equal(requests.length,1);
 assert.equal(requests[0].suffix,'weapon_mastery');
 assert.equal(requests[0].options.force,true);
 assert.deepEqual(database.calls.find(x=>x.rpc==='reserve_web_refresh').args,
   {p_player_key:'psn:weapons:otherplayer'});
 assert.doesNotMatch(JSON.stringify(result.body),/account\.TESTPLAYER|pubg_account_id|weaponSummaries/);
});
test('recent matches refreshes one index then at most five valid unique detail IDs',async()=>{
 const database=db(),calls=[];
 const r=await refreshScopedData(database,{name:'OtherPlayer',platform:'psn',scope:'matches'},{
  playerEndpoint:async(db,player,path,ttl,options)=>{
   calls.push({type:'index',path,force:options.force});
   return{state:'fresh',data:{data:{relationships:{matches:{data:[
    ...MATCHES.map(id=>({id})),{id:MATCHES[0]},{id:'../../attacker'},{}
   ]}}}}};
  },
  matchEndpoint:async(db,id)=>{calls.push({type:'match',id});return{state:'fresh',data:{data:{id}}}}
 });
 assert.equal(r.status,200);
 assert.equal(r.body.indexedMatches,5);
 assert.equal(r.body.savedDetails,5);
 assert.equal(calls.filter(x=>x.type==='index').length,1);
 assert.equal(calls.filter(x=>x.type==='match').length,5);
 assert.doesNotMatch(JSON.stringify(r.body),/00336e4b|account\.|relationships/);
});
test('season refresh revalidates current season and player season via shared budget',async()=>{
 const database=db(),calls=[];
 const r=await refreshScopedData(database,{name:'OtherPlayer',scope:'season'},{
  cachedEndpoint:async(db,shard,path,ttl,opts)=>{
   calls.push({shard,path,ttl,force:opts.force});
   return{state:'fresh',data:{data:[{id:'division.bro.official.console-43',
    attributes:{isCurrentSeason:true,isOffseason:false}}]}};
  },
  playerEndpoint:async(db,p,path,ttl,opts)=>{
   calls.push({platform:p.platform,path,force:opts.force});
   return{state:'fresh',data:{data:{attributes:{gameModeStats:{squad:{kills:12}}}}}};
  }
 });
 assert.equal(r.status,200);
 assert.equal(r.body.seasonId,'division.bro.official.console-43');
 assert.equal(calls.length,2);
 assert.equal(calls[0].force,true);
 assert.equal(calls[1].force,true);
 assert.equal(calls[1].path,'seasons/division.bro.official.console-43');
});
test('ranked refresh uses ranked endpoint, never a generated season ID',async()=>{
 const database=db(),calls=[];
 const r=await refreshScopedData(database,{name:'OtherPlayer',scope:'ranked'},{
  cachedEndpoint:async()=>({state:'cached',data:{data:[
    {id:'../other',attributes:{isCurrentSeason:true}},
    {id:'division.bro.official.console-43',attributes:{isCurrentSeason:false}}]}}),
  playerEndpoint:async()=>{calls.push(1);return{state:'fresh',data:{}};}
 });
 assert.equal(r.status,404);
 assert.equal(calls.length,0);
});
test('website cooldown preserves existing data when another refresh is active',async()=>{
 const database=db({limit:false});
 const r=await refreshScopedData(database,{name:'OtherPlayer',scope:'ranked'});
 assert.equal(r.status,429);
 assert.equal(r.body.retryAfterSeconds,90);
 assert.equal(database.calls.filter(x=>x.rpc).length,1);
});
test('mismatched console is rejected before reserving any API budget',async()=>{
 const database=db();
 const r=await refreshScopedData(database,{name:'OtherPlayer',scope:'weapons',platform:'xbox'});
 assert.equal(r.status,409);
 assert.equal(r.body.suggestedPlatform,'psn');
 assert.equal(database.calls.some(x=>x.rpc),false);
});
test('cached season GET returns limited ranked stats without private keys',async()=>{
 const r=await savedSeason(db(),{name:'OtherPlayer',type:'ranked'});
 assert.equal(r.status,200);
 assert.equal(r.body.seasonId,'division.bro.official.console-43');
 assert.equal(r.body.modes[0].stats.kills,120);
 assert.equal(r.body.modes[0].stats.currentTier.tier,'Platinum');
 assert.doesNotMatch(JSON.stringify(r.body),/account\.TEST|accountId|hidden|secret|cache_key|pubg_account_id/);
});
test('missing cached seasons remain an honest empty state',async()=>{
 const r=await savedSeason(db({noCache:true}),{name:'OtherPlayer',type:'season'});
 assert.equal(r.status,200);
 assert.equal(r.body.count,0);
 assert.equal(r.body.seasonId,null);
 assert.match(r.body.note,/No saved current-season index/);
});
test('ranked stat output rejects unknown fields and carries no bogus numbers',()=>{
 const shaped=shapeRanked({currentTier:{tier:'Gold',subTier:'4'},kills:0,
  secretAccount:'account.private',currentRankPoint:'bad'});
 assert.equal(shaped.kills,0);
 assert.equal(shaped.currentRankPoint,undefined);
 assert.equal(shaped.currentTier.tier,'Gold');
 assert.doesNotMatch(JSON.stringify(shaped),/secretAccount|account\.private/);
 const modes=shapeSeasonPayload({data:{attributes:{gameModeStats:{squad:{
  roundsPlayed:10,kills:4,accountId:'hidden'}}}}},'season');
 assert.equal(modes[0].stats.roundsPlayed,10);
 assert.equal(modes[0].stats.accountId,undefined);
});

test('one unavailable match detail does not erase other saved details',async()=>{
 const database=db();
 const r=await refreshScopedData(database,{name:'OtherPlayer',scope:'matches'},{
  playerEndpoint:async()=>({state:'fresh',data:{data:{relationships:{matches:{data:[
    {id:MATCHES[0]},{id:MATCHES[1]}]}}}}}),
  matchEndpoint:async(_db,id)=>{
    if(id===MATCHES[0])throw Error('One expired PUBG match');
    return{state:'fresh',data:{data:{id}}};
  }
 });
 assert.equal(r.status,200);
 assert.equal(r.body.indexedMatches,2);
 assert.equal(r.body.savedDetails,1);
});
