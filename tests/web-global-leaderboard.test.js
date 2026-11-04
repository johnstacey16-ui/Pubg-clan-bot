'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {officialLeaderboard,shape}=require('../lib/web-global-leaderboard');
const sample={included:[{
 type:'player',id:'account.secret',
 attributes:{name:'PlayerAlpha',rank:1,stats:{rankPoints:2590,
  tier:'Gold',kda:2.2,accountId:'account.secret'}}
},{
 type:'player',id:'account.other',
 attributes:{name:'PlayerBeta',rank:12,stats:{rankPoints:2001,kda:1.2}}
}]};
function db(cache={},allowed=true){
 const calls={rpc:0};
 return{calls,
  from(table){
   assert.equal(table,'pubg_endpoint_cache');
   return{key:null,select(){return this;},
    eq(_k,v){this.key=v;return this;},
    async maybeSingle(){return{data:cache[this.key]||null,error:null};}
   };
  },
  rpc:async(name,args)=>{assert.equal(name,'reserve_web_refresh');
   assert.match(args.p_player_key,/^xbox:leaderboard/);
   calls.rpc++;return{data:allowed,error:null};}
 };
}
test('official leaderboard ranks are exact with no account IDs or guessed cuts',()=>{
 const x=shape(sample,{platform:'xbox',region:'eu',mode:'squad',
  seasonId:'division.console-43',state:'fresh'});
 assert.equal(x.players[0].rank,1);
 assert.equal(x.players[0].stats.kda,2.2);
 assert.equal(x.cutLines.find(c=>c.rank===10).present,false);
 assert.equal(x.cutLines.find(c=>c.rank===12),undefined);
 assert.doesNotMatch(JSON.stringify(x),/account.secret|account.other/);
});
test('unsupported regional shards never hit Supabase',async()=>{
 const database={from(){throw Error('invalid')},rpc(){throw Error('invalid')}};
 assert.equal((await officialLeaderboard(database,{
  platform:'psn',region:'sa',mode:'squad'})).status,400);
 assert.equal((await officialLeaderboard(database,{
  platform:'xbox',region:'eu',mode:'invalid'})).status,400);
});
test('fresh saved leaderboard costs no extra PUBG or global web budget',async()=>{
 const season='division.bro.official.console-43';
 const key='pubg:v1:xbox-eu/leaderboards/'+season+'/squad';
 const database=db({[key]:{payload:sample,expires_at:'2099-01-01T00:00:00Z',
  fetched_at:'2026-11-03T10:00:00Z'}});
 const x=await officialLeaderboard(database,{season});
 assert.equal(x.status,200);
 assert.equal(x.body.state,'cached');
 assert.equal(database.calls.rpc,0);
});
test('first official leaderboard refresh must pass shared web gate',async()=>{
 const season='division.bro.official.console-43';
 const database=db({},false);
 let calls=0;
 const x=await officialLeaderboard(database,{season},{
  cachedEndpoint:async()=>{calls++;return{data:sample,state:'fresh'};}
 });
 assert.equal(x.status,429);
 assert.equal(calls,0);
});
test('allowed refresh uses one shared PUBG-cached endpoint with explicit season',async()=>{
 const season='division.bro.official.console-43';
 const database=db();
 let called=null;
 const x=await officialLeaderboard(database,{season},{
  cachedEndpoint:async(_db,shard,path,ttl)=>{
   called={shard,path,ttl};return{data:sample,state:'fresh'};
  }
 });
 assert.equal(x.status,200);
 assert.equal(called.shard,'xbox-eu');
 assert.match(called.path,/\/squad$/);
 assert.equal(called.ttl,7200);
 assert.equal(database.calls.rpc,1);
});
