'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path');
const {publicClanMatchRecords,sanitizeRecord,sanitizeCoverage,METRICS}=
 require('../lib/web-clan-records');
const {categories,collect,summarize,value}=require('../assets/clan-record-book');
const one=(metric,rank,n,player='Test Player')=>({
 metric,rank,value:n,name:player,platform:'xbox',
 map:'Baltic_Main',mode:'squad',playedAt:'2026-11-07T02:00:00Z',
 extraAccountId:'account.hidden',telemetry:'https://secret.example'
});
const payload={schemaVersion:1,periodDays:30,generatedAt:'2026-11-07T07:00:00Z',
 verifiedPlayers:50,observedPlayers:39,playerMatchObservations:1772,
 distinctMatches:1490,
 coverage:[
  {metric:'kills',observed:1772},
  {metric:'damage',observed:1742},
  {metric:'revives',observed:1100},
  {metric:'vehicleDestroys',observed:1200}
 ],
 records:[one('kills',1,35),one('kills',2,27,'Other'),
  one('damage',1,4241.46),one('timeSurvivedSeconds',1,1800),
  one('revives',1,1)]};
test('server reads one private SQL aggregation and returns only safe record fields',async()=>{
 const calls=[],db={rpc:async(name,args)=>{
  calls.push({name,args});return{data:payload,error:null};
 }};
 const result=await publicClanMatchRecords(db,'30');
 assert.equal(result.status,200);
 assert.equal(result.body.periodDays,30);
 assert.equal(result.body.verifiedPlayers,50);
 assert.equal(result.body.observedPlayers,39);
 assert.equal(result.body.playerMatchObservations,1772);
 assert.equal(result.body.records.length,5);
 assert.equal(result.body.coverage.length,4);
 assert.deepEqual(calls,[{name:'get_clan_match_record_book',args:{p_days:30}}]);
 assert.doesNotMatch(JSON.stringify(result.body),
  /account\.hidden|secret\.example|extraAccountId|match_id|pubg_account_id|telemetry/);
});
test('unsupported dates are blocked before touching Supabase',async()=>{
 const db={rpc(){throw Error('unexpected database access')}};
 for(const days of [0,1,8,31,365,'3',' 7','30.0','7e0','7;drop',
  null,false,{},['7']]){
  const result=await publicClanMatchRecords(db,days);
  assert.equal(result.status,400,String(days));
 }
 assert.equal((await publicClanMatchRecords({rpc:async()=>({data:{
  ...payload,periodDays:7
 },error:null})},7)).status,200);
});
test('allowlist rejects malformed, blank, nonpositive or fabricated winners',()=>{
 assert.equal(sanitizeRecord(one('unknown',1,4)),null);
 assert.equal(sanitizeRecord(one('kills',2,-1)),null);
 assert.equal(sanitizeRecord(one('kills',2,0)),null);
 assert.equal(sanitizeRecord({...one('kills',1,5),name:''}),null);
 assert.equal(sanitizeRecord({...one('kills',1,5),rank:0}),null);
 assert.equal(sanitizeRecord({...one('kills',1,5),platform:'pc'}),null);
 assert.equal(sanitizeRecord({...one('kills',1,5),playedAt:'not-a-date'}),null);
 assert.equal(sanitizeCoverage({metric:'other',observed:10}),null);
 assert.equal(sanitizeCoverage({metric:'kills',observed:-1}),null);
 assert.equal(sanitizeCoverage({metric:'kills',observed:5.5}),null);
 const r=sanitizeRecord(one('kills',1,5));
 assert.deepEqual(Object.keys(r),
  ['metric','rank','value','name','platform','map','mode','playedAt']);
});
test('same player can only hold one spot per metric when older records are duplicated',async()=>{
 const db={rpc:async()=>({data:{...payload,records:[
  one('kills',1,35,'Test Player'),
  one('kills',2,28,'TEST PLAYER'),
  one('kills',3,24,'Other'),
  one('damage',1,4000,'Test Player')
 ]},error:null})};
 const result=await publicClanMatchRecords(db,30);
 assert.deepEqual(result.body.records.map(x=>x.rank),[1,3,1]);
});
test('UI summary uses observed coverage, not inferred match counts',()=>{
 const t=summarize(payload);
 assert.equal(t.length,10);
 assert.equal(METRICS.length,10);
 assert.equal(categories.length,10);
 assert.equal(t[0].key,'kills');
 assert.equal(t[0].leader.value,35);
 assert.equal(t[0].observed,1772);
 assert.equal(t.find(x=>x.key==='headshots').leader,null);
 assert.equal(t.find(x=>x.key==='headshots').observed,0);
 assert.deepEqual(collect(payload.records,'kills').map(x=>x.value),[35,27]);
 assert.equal(value(1800,'duration'),'30m 00s');
 assert.equal(value(330.5,'meters'),'330.5 m');
 assert.equal(value(4241.46,'damage'),'4,241.5');
 assert.equal(value(null,'count'),'—');
});
test('migration only scans private verified match archive and restricts RPC grants',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..',
  'supabase/migrations/20261107_clan_match_record_book.sql'),'utf8');
 assert.match(sql,/security invoker/i);
 assert.match(sql,/q\.is_clan_member=true/);
 assert.match(sql,/s\.value>0/);
 assert.match(sql,/partition by s\.metric,s\.player_id/);
 assert.match(sql,/count\(distinct match_id\)/);
 assert.match(sql,/p_days in \(7,30,180\)/);
 assert.match(sql,/public\.optional_pubg_stat_number/);
 assert.match(sql,/revoke all on function public\.get_clan_match_record_book/i);
 assert.match(sql,/grant execute on function public\.get_clan_match_record_book\(integer\)\s+to service_role/i);
 assert.doesNotMatch(sql,/security definer|create table|pubg_api_key|http_get/i);
});
