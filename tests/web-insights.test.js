'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {publicInsights,weaponItems,survivalFields}=require('../lib/web-insights');
const id='account.TESTPLAYER0123456';
const weapon={data:{attributes:{weaponSummaries:{
  Item_Weapon_BerylM762_C:{
    LevelCurrent:35,TierCurrent:5,XPTotal:190114,
    StatsTotal:{Kills:1520,HeadShots:496,DamagePlayer:157173.07,
      MostDamagePlayerInAGame:1500,MostHeadShotsInAGame:8,
      MostGroggiesInAGame:9,MostDefeatsInAGame:10},
    OfficialStatsTotal:{Kills:1397,HeadShots:490,MostDefeatsInAGame:6},
    CompetitiveStatsTotal:{Kills:20,HeadShots:22,LongestKill:320},
    Medals:[{bad:'ignore'}],secretApiKey:'not-for-web'
  },
  Item_Weapon_M416_C:{LevelCurrent:20,XPTotal:45000,
    StatsTotal:{Kills:22},OfficialStatsTotal:{Kills:19}},
  secret:{StatsTotal:{Kills:999999}}
}}}};
function db(opts={}) {
 const calls=[];
 const source={
  player_import_queue:[{gamertag:'ClanTester',is_clan_member:opts.official!==false,status:opts.status||'matched'}],
  players:[{id:12,gamertag:'ClanTester',platform:'xbox',pubg_account_id:id}],
  clan_match_archive:[
   {match_id:'one',played_at:'2026-11-03T12:00:00Z',
    summary:{placement:1,squad:[
      {name:'ClanTester',isSelf:true,kills:7},
      {name:'Mate A',isSelf:false,kills:4,damage:350,assists:1,secretId:'account.OTHER'},
      {name:'Mate B',isSelf:false,kills:2,damage:180}
    ],telemetry:'https://unwanted.test'}},
   {match_id:'two',played_at:'2026-11-01T12:00:00Z',
    summary:{placement:2,squad:[
      {name:'ClanTester',isSelf:true,kills:3},
      {name:'mate a',isSelf:false,kills:3,damage:210,assists:2}
    ]}}
  ]
 };
 return {calls,from(table){calls.push(table);
  return {select(){return this},eq(){return this},ilike(){return this},order(){return this},
    async limit(){return{data:source[table]||[],error:null}},
    async maybeSingle(){return{data:opts.empty?null:{payload:weapon,fetched_at:'2026-11-03T17:00:00Z'},error:null}}
  };
 }};
}
test('weapon mastery maps actual PUBG field names without conflating categories',async()=>{
 const result=await publicInsights(db(),{name:'ClanTester',kind:'weapons'});
 assert.equal(result.status,200);
 assert.equal(result.body.count,2);
 assert.equal(result.body.items[0].name,'BerylM762');
 assert.equal(result.body.items[0].total.kills,1520);
 assert.equal(result.body.items[0].official.kills,1397);
 assert.equal(result.body.items[0].competitive.kills,20);
 assert.equal(result.body.items[0].total.mostDamageInGame,1500);
 assert.equal(result.body.items[0].total.mostHeadshotsInGame,8);
 assert.equal(result.body.items[0].total.mostKnocksInGame,9);
 assert.equal(result.body.items[0].total.mostDefeatsInGame,10);
 assert.equal(result.body.items[0].official.mostDefeatsInGame,6);
 assert.equal(result.body.items[0].competitive.longestKill,320);
 assert.equal(result.body.items[0].level,35);
 assert.equal(result.body.items[0].tier,5);
 assert.doesNotMatch(JSON.stringify(result.body),/secretApiKey|account\.|bad/);
});
test('missing mastery cache produces honest empty state',async()=>{
 const result=await publicInsights(db({empty:true}),{name:'ClanTester',kind:'weapons'});
 assert.equal(result.body.count,0);
 assert.match(result.body.note,/No saved weapon mastery/);
});
test('unavailable weapon fields stay unavailable, never invented zero',()=>{
 const r=weaponItems({data:{attributes:{weaponSummaries:{
  Item_Weapon_Test_C:{LevelCurrent:4,StatsTotal:{Kills:0}}
 }}}});
 assert.equal(r[0].total.kills,0);
 assert.equal(r[0].total.damage,undefined);
 assert.equal(r[0].official,null);
 assert.equal(r[0].xp,null);
});
test('teammate analysis groups recurring names without exposing archive internals',async()=>{
 const database=db();
 const result=await publicInsights(database,{name:'ClanTester',kind:'teammates'});
 assert.equal(result.status,200);
 assert.equal(result.body.archivedMatches,2);
 assert.equal(result.body.items.length,2);
 assert.equal(result.body.items[0].name,'Mate A');
 assert.equal(result.body.items[0].games,2);
 assert.equal(result.body.items[0].wins,1);
 assert.equal(result.body.items[0].kills,7);
 assert.equal(result.body.items[0].damage,560);
 assert.doesNotMatch(JSON.stringify(result.body),/account\.|telemetry|match_id|player_id|secretId/);
 assert.deepEqual(database.calls,['players','clan_match_archive']);
});
test('saved outside-clan and pending players can view existing insights',async()=>{
 for(const config of [{official:false},{status:'pending'}]){
  const database=db(config);
  const result=await publicInsights(database,{name:'ClanTester',kind:'teammates'});
  assert.equal(result.status,200);
  assert.deepEqual(database.calls,['players','clan_match_archive']);
 }
});
test('unknown type and invalid multi-name input cannot access stored data',async()=>{
 for(const query of [{name:'ClanTester',kind:'rivals'},
   {name:'ClanTester,Other',kind:'weapons'},{name:'',kind:'teammates'}]){
  const database=db();
  const result=await publicInsights(database,query);
  assert.equal(result.status,400);
  assert.equal(database.calls.length,0);
 }
});

test('survival mastery reads real saved XP, tier, level and matches independently',async()=>{
 const source=survivalFields({data:{attributes:{
  xp:123400,tier:2,level:140,totalMatchesPlayed:380,
  accountId:'account.private',lobbyId:'secret'
 }}});
 assert.deepEqual(source,{xp:123400,tier:2,level:140,totalMatchesPlayed:380});
 assert.doesNotMatch(JSON.stringify(source),/account|lobby|secret/);
 const onlySome=survivalFields({data:{attributes:{xp:0,level:4}}});
 assert.equal(onlySome.xp,0);
 assert.equal(onlySome.tier,null);
 assert.equal(onlySome.totalMatchesPlayed,null);
 assert.equal(survivalFields({data:{attributes:null}}),null);
});
test('Survival Mastery is accessible to saved console players without clan dependency',async()=>{
 const database=db({official:false});
 const result=await publicInsights(database,{name:'ClanTester',kind:'survival'});
 assert.equal(result.status,200);
 assert.equal(result.body.kind,'survival');
 assert.equal(result.body.stats.level,null);
 assert.equal(result.body.savedAt,'2026-11-03T17:00:00Z');
 assert.doesNotMatch(JSON.stringify(result.body),/account.TESTPLAYER/);
});

test('weapon parser rejects invalid numeric fields rather than inventing zero',()=>{
 const r=weaponItems({data:{attributes:{weaponSummaries:{
  Item_Weapon_Test_C:{
   StatsTotal:{Kills:-10,HeadShots:true,MostDamagePlayerInAGame:'bad',
    DamagePlayer:0,MostGroggiesInAGame:2}
  }
 }}}});
 assert.equal(r[0].total.kills,undefined);
 assert.equal(r[0].total.headshots,undefined);
 assert.equal(r[0].total.damage,0);
 assert.equal(r[0].total.mostKnocksInGame,2);
 assert.equal(r[0].total.mostDamageInGame,undefined);
});
