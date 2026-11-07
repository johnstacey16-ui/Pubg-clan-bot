'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {publicClanMatchBoard,sanitizeRow}=require('../lib/web-clan-match-board');
const {aggregate,orderRows,listMaps,exportCsv,pct,duration}=
 require('../assets/clan-match-board');
const row=(name,platform,map,mode,stats={})=>({
 name,platform,map,mode,latest:'2026-11-07T00:00:00Z',
 games:4,placed:4,wins:1,top10:2,killsObserved:4,kills:12,
 damageObserved:4,damage:1400,assistsObserved:4,assists:4,
 knocksObserved:4,knocks:5,survivalObserved:4,survivalSeconds:4800,
 placementTotal:28,...stats
});
const data=[
 row('Alpha','xbox','Baltic_Main','squad'),
 row('Beta','psn','Baltic_Main','squad',{games:5,placed:5,wins:1,
  top10:4,killsObserved:5,kills:10,damageObserved:5,damage:1000,
  assistsObserved:5,assists:2,knocksObserved:5,knocks:4,
  survivalObserved:5,survivalSeconds:4000,placementTotal:22}),
 row('Alpha','xbox','Desert_Main','solo',{games:2,placed:2,wins:0,
  top10:1,killsObserved:2,kills:2,damageObserved:2,damage:200,
  assistsObserved:2,assists:0,knocksObserved:2,knocks:0,
  survivalObserved:0,survivalSeconds:0,placementTotal:20}),
 row('NoSample','xbox','Desert_Main','duo',{games:1,placed:0,wins:0,
  top10:0,killsObserved:0,kills:0,damageObserved:0,damage:0,
  assistsObserved:0,assists:0,knocksObserved:0,knocks:0,
  survivalObserved:0,survivalSeconds:0,placementTotal:0})
];
test('server uses one service-role aggregation and preserves source coverage',async()=>{
 const calls=[];
 const db={rpc:async(name,params)=>{
  calls.push({name,params});
  return{data:{schemaVersion:1,periodDays:30,clanPlayers:50,
    observedPlayers:3,playerMatchObservations:12,distinctMatches:9,
    generatedAt:'2026-11-07T07:00:00Z',rows:data},error:null};
 }};
 const result=await publicClanMatchBoard(db,'30');
 assert.equal(result.status,200);
 assert.equal(result.body.rows.length,4);
 assert.equal(result.body.distinctMatches,9);
 assert.equal(result.body.playerMatchObservations,12);
 assert.equal(result.body.clanPlayers,50);
 assert.equal(result.body.rows[0].name,'Alpha');
 assert.deepEqual(calls,[{name:'get_clan_match_history_board',params:{p_days:30}}]);
 assert.doesNotMatch(JSON.stringify(result.body),/account\.|pubg_account_id|player_id|summary|match_id/);
});
test('rejects malformed periods without any database queries',async()=>{
 const db={rpc:()=>{throw Error('must not query')}};
 for(const days of ['1','0','365','7.5','-7','30 or 1=1',{},null]){
  const res=await publicClanMatchBoard(db,days);
  assert.equal(res.status,400,String(days));
 }
});
test('allowlist drops impossible wins and makes no opponent/account data public',()=>{
 assert.equal(sanitizeRow({...data[0],wins:5}),null);
 assert.equal(sanitizeRow({...data[0],platform:'pc'}),null);
 assert.equal(sanitizeRow({...data[0],games:-2}),null);
 const safe=sanitizeRow({...data[0],pubg_account_id:'account.SECRET',
   privateTelemetry:'https://secret.example',match_id:'secret'});
 assert.equal(safe.name,'Alpha');
 assert.doesNotMatch(JSON.stringify(safe),/SECRET|secret\.example|match_id/);
});
test('aggregates genuine map and mode observations, not imaginary career games',()=>{
 const all=aggregate(data);
 assert.equal(all.length,3);
 const a=all.find(x=>x.name==='Alpha');
 assert.equal(a.games,6);
 assert.equal(a.placed,6);
 assert.equal(a.winRate,100/6);
 assert.equal(a.killsPerGame,14/6);
 assert.equal(a.damagePerGame,1600/6);
 assert.equal(a.averageSurvival,1200);
 const baltic=aggregate(data,{map:'Baltic_Main'});
 assert.equal(baltic.length,2);
 assert.equal(baltic.find(x=>x.name==='Alpha').winRate,25);
 assert.deepEqual(aggregate(data,{mode:'solo'}).map(x=>x.name),['Alpha']);
 assert.deepEqual(listMaps(data).map(x=>x.name),['Baltic_Main','Desert_Main']);
 assert.deepEqual(orderRows(baltic,'killsPerGame').map(x=>x.name),['Alpha','Beta']);
 assert.deepEqual(orderRows(baltic,'winRate').map(x=>x.name),['Alpha','Beta']);
 assert.equal(all.find(x=>x.name==='NoSample').winRate,null);
 assert.equal(all.find(x=>x.name==='NoSample').killsPerGame,null);
 assert.equal(pct(null),'—');
 assert.equal(duration(125),'2m 05s');
});
test('CSV exports only filtered, formula-safe observed aggregates',()=>{
 const exported=exportCsv(aggregate(data),30,'','');
 assert.match(exported,/"periodDays","mapFilter","modeFilter"/);
 assert.match(exported,/Alpha/);
 assert.match(exported,/NoSample/);
 assert.doesNotMatch(exported,/match_id|pubg_account_id|privateTelemetry/);
 const tainted=exportCsv([{
  ...aggregate(data)[0],name:'=HYPERLINK("https://bad.example")'
 }],7,'','');
 assert.match(tainted,/"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
});
test('SQL RPC is service-role-only and includes deduplicated match counts',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..',
  'supabase/migrations/20261107_clan_match_history_board.sql'),'utf8');
 assert.match(sql,/security invoker/i);
 assert.match(sql,/count\(distinct match_id\)/i);
 assert.match(sql,/q\.is_clan_member=true/i);
 assert.match(sql,/p_days in \(7,30,180\)/);
 assert.match(sql,/revoke all on function public\.get_clan_match_history_board/);
 assert.match(sql,/grant execute on function public\.get_clan_match_history_board/);
 assert.doesNotMatch(sql,/security definer|create table|pubg_api_key/i);
});
