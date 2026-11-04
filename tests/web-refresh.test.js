'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {refreshScopedData,validRefresh}=require('../lib/web-refresh');
const {savedSeason,shapeRanked,shapeSeasonPayload,safeHistory}=require('../lib/web-season');
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
   players: [{id:12,gamertag:'OtherPlayer',platform:'psn',pubg_account_id:ACCOUNT}],
   pubg_endpoint_cache: [],
   player_season_snapshots: opts.history||[]
 };
 const database={
  calls,
  from(table){
   calls.push({table});
   const q={
    select(){return this},eq(k,v){this.k=v;return this},ilike(){return this},order(){return this},
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

test('saved ranked history is allowlisted and preserves separate genuine observations',async()=>{
 const history=[
  {season_id:'division.bro.official.console-43',kind:'ranked',mode:'squad',
   captured_at:'2026-11-03T17:00:00Z',matches:46,kills:124,wins:3,
   damage:21700,rank_points:2450,tier:'Platinum',sub_tier:'2',
   pubg_account_id:'account.PRIVATE',private_field:'secret'},
  {season_id:'division.bro.official.console-43',kind:'ranked',mode:'squad',
   captured_at:'2026-11-03T13:00:00Z',matches:45,kills:120,wins:3,
   damage:21300,rank_points:2319,tier:'Platinum',sub_tier:'2'},
  {season_id:'division.bro.official.console-42',kind:'ranked',mode:'squad',
   captured_at:'2026-10-03T17:00:00Z',matches:100,kills:260,wins:10,
   damage:53000,rank_points:2700,tier:'Diamond',sub_tier:'4'}
 ];
 const r=await savedSeason(db({history}),{name:'OtherPlayer',type:'ranked'});
 assert.equal(r.status,200);
 assert.equal(r.body.historyCount,3);
 assert.deepEqual(r.body.archivedSeasons,[
  'division.bro.official.console-43','division.bro.official.console-42'
 ]);
 assert.equal(r.body.history[0].rankPoints,2450);
 assert.equal(r.body.history[1].rankPoints,2319);
 assert.equal(r.body.history[2].seasonId,'division.bro.official.console-42');
 assert.doesNotMatch(JSON.stringify(r.body),/account\.PRIVATE|pubg_account_id|private_field|secret/);
});
test('history stays available even if active current-season index is missing',async()=>{
 const h=[{season_id:'division.bro.official.console-42',kind:'season',mode:'duo',
   captured_at:'2026-10-30T12:00:00Z',matches:8,kills:19,wins:2,damage:3500}];
 const r=await savedSeason(db({noCache:true,history:h}),{name:'OtherPlayer',type:'season'});
 assert.equal(r.status,200);
 assert.equal(r.body.count,0);
 assert.equal(r.body.historyCount,1);
 assert.equal(r.body.archivedSeasons[0],'division.bro.official.console-42');
});
test('history allowlist refuses invented timestamps, modes, and hidden identifiers',()=>{
 assert.equal(safeHistory({season_id:'bad/../../other',kind:'ranked',
   mode:'squad',captured_at:'2026-11-03T12:00:00Z'}),null);
 assert.equal(safeHistory({season_id:'division.bro.official.console-43',
   kind:'ranked',mode:'custom',captured_at:'2026-11-03T12:00:00Z'}),null);
 assert.equal(safeHistory({season_id:'division.bro.official.console-43',
   kind:'ranked',mode:'squad',captured_at:'NOT_A_DATE'}),null);
 const r=safeHistory({season_id:'division.bro.official.console-43',
   kind:'ranked',mode:'squad',captured_at:'2026-11-03T12:00:00Z',
   matches:0,kills:0,rank_points:100,tier:'Gold',sub_tier:'3',
   pubg_account_id:'account.PRIVATE',telemetry:'https://private.test'});
 assert.equal(r.kills,0);
 assert.equal(r.rankPoints,100);
 assert.equal(r.damage,null);
 assert.doesNotMatch(JSON.stringify(r),/account\.PRIVATE|telemetry|private\.test/);
});

test('survival mastery refresh uses existing atomic budget and real PUBG endpoint',async()=>{
 const database=db(),calls=[];
 const result=await refreshScopedData(database,{
  name:'OtherPlayer',platform:'auto',scope:'survival'
 },{
  playerEndpoint:async(_db,player,suffix,ttl,opts)=>{
   calls.push({player,suffix,ttl,opts});
   return{state:'fresh',data:{data:{attributes:{
    level:50,xp:14000,tier:1,totalMatchesPlayed:140
   }}}};
  }
 });
 assert.equal(result.status,200);
 assert.equal(result.body.scope,'survival');
 assert.equal(calls.length,1);
 assert.equal(calls[0].suffix,'survival_mastery');
 assert.equal(calls[0].opts.force,true);
 assert.deepEqual(database.calls.find(x=>x.rpc==='reserve_web_refresh').args,
   {p_player_key:'psn:survival:otherplayer'});
 assert.doesNotMatch(JSON.stringify(result.body),/account.TESTPLAYER|pubg_account_id/);
});
