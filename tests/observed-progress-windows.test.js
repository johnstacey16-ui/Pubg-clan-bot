'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {shape,observedProgress,WINDOWS}=require('../lib/clan-weekly-progress');
const E=require('../assets/clan-analytics');
const newest='2026-11-07T12:00:00Z';
const before='2026-11-04T12:00:00Z';
const row=(name,now,prior,extra={})=>({
 player_name:name,platform:'xbox',latest_at:newest,previous_at:before,
 latest_kills:now.kills,latest_wins:now.wins,latest_matches:now.matches,
 previous_kills:prior?.kills??null,previous_wins:prior?.wins??null,
 previous_matches:prior?.matches??null,account_id:'private.account',
 telemetry_url:'https://example-secret.test',...extra
});
const rows=[
 row('Alpha',{kills:120,wins:9,matches:62},{kills:100,wins:7,matches:55}),
 row('Beta',{kills:80,wins:4,matches:54},{kills:68,wins:4,matches:50}),
 row('Reset',{kills:1,wins:1,matches:2},{kills:100,wins:8,matches:51}),
 row('Baseline',{kills:10,wins:1,matches:10},null,{previous_at:null}),
 row('NoGames',{kills:77,wins:3,matches:45},{kills:77,wins:3,matches:45}),
 row('Tiny',{kills:85,wins:8,matches:48},{kills:80,wins:7,matches:47}),
 row('MissingWins',{kills:90,wins:5,matches:65},{kills:84,wins:null,matches:61})
];
test('1/3/7/14-day comparisons require exact window selectors',async()=>{
 const db={rpc(){throw Error('Unexpected database query')}};
 for(const days of [0,2,4,6,8,15,30,365,'1.0','3 days',' 3','07',
  '1; DROP','',null,false,{},[],['3']]){
  assert.equal((await observedProgress(db,days)).status,400,String(days));
 }
 assert.deepEqual(Object.keys(WINDOWS).map(Number),[1,3,7,14]);
});
test('server issues exactly one service-only RPC for real sample and hides internals',async()=>{
 const calls=[],db={rpc:async(name,args)=>{
  calls.push({name,args});return{data:rows,error:null};
 }};
 const result=await observedProgress(db,'3');
 assert.equal(result.status,200);
 assert.equal(result.body.windowDays,3);
 assert.equal(result.body.minDays,2);
 assert.equal(result.body.maxDays,4);
 assert.equal(result.body.count,7);
 assert.equal(result.body.comparedPlayers,6);
 assert.equal(result.body.awaitingComparison,1);
 assert.deepEqual(calls,[{name:'get_clan_observed_progress',args:{p_days:3}}]);
 assert.doesNotMatch(JSON.stringify(result.body),
  /private.account|telemetry_url|example-secret|account_id|player_id/);
 assert.equal(result.body.rows[0].latestWins,9);
 assert.equal(result.body.rows[0].previousWins,7);
});
test('invalid or out-of-window timestamps discard false comparison without inventing data',()=>{
 const shaped=shape([
  row('Stale',{kills:20,wins:3,matches:10},{kills:10,wins:1,matches:7},
    {previous_at:'2026-10-01T12:00:00Z'}),
  row('Future',{kills:20,wins:3,matches:10},{kills:10,wins:1,matches:7},
    {previous_at:'2026-11-08T12:00:00Z'}),
  row('Zero',{kills:0,wins:0,matches:0},{kills:0,wins:0,matches:0})
 ],{windowDays:3});
 assert.equal(shaped.rows[0].previousAt,null);
 assert.equal(shaped.rows[0].previousKills,null);
 assert.equal(shaped.rows[1].previousAt,null);
 assert.equal(shaped.rows[2].latestKills,0);
 assert.equal(shaped.rows[2].previousKills,0);
});
test('real delta calculations do not reward a reset or missing earlier wins',()=>{
 const analysed=E.progress(shape(rows,{windowDays:3}).rows);
 const alpha=analysed.find(r=>r.name==='Alpha');
 assert.equal(alpha.deltaKills,20);
 assert.equal(alpha.deltaWins,2);
 assert.equal(alpha.deltaMatches,7);
 assert.equal(alpha.deltaKpr,20/7);
 assert.equal(analysed.find(r=>r.name==='Reset').state,'counter_changed');
 assert.equal(analysed.find(r=>r.name==='Baseline').state,'baseline_only');
 assert.equal(analysed.find(r=>r.name==='NoGames').state,'no_new_matches');
 assert.equal(analysed.find(r=>r.name==='Tiny').state,'observed');
 const missing=analysed.find(r=>r.name==='MissingWins');
 assert.equal(missing.deltaWins,null);
 const awards=E.progressAwards(analysed,3);
 assert.equal(awards.length,4);
 assert.ok(awards.every(a=>a.eligiblePlayers===2));
 assert.deepEqual(awards.map(a=>a.winner?.name),['Alpha','Alpha','Alpha','Alpha']);
 assert.equal(awards[0].winner.deltaKills,20);
 assert.equal(awards[1].winner.deltaKpr,20/7);
 assert.equal(awards[2].winner.deltaWins,2);
 assert.equal(awards[3].winner.deltaMatches,7);
});
test('no eligible observed pairs means four explicit empty momentum awards',()=>{
 const snapshots=E.progress(shape(rows.map(r=>({...r,previous_at:null})),
  {windowDays:7}).rows);
 const awards=E.progressAwards(snapshots,3);
 assert.equal(awards.length,4);
 assert.equal(awards.every(a=>a.winner===null&&a.eligiblePlayers===0),true);
});
test('SQL function does not interpolate or expose raw snapshot IDs',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..',
  'supabase/migrations/20261107_clan_observed_progress_windows.sql'),'utf8');
 assert.match(sql,/security invoker/i);
 assert.match(sql,/p_days in \(1,3,7,14\)/);
 assert.match(sql,/public\.player_stat_snapshots/);
 assert.match(sql,/q\.is_clan_member=true/i);
 assert.match(sql,/order by pg_catalog\.abs/i);
 assert.match(sql,/revoke all on function public\.get_clan_observed_progress/);
 assert.match(sql,/grant execute on function public\.get_clan_observed_progress\(integer\)\s+to service_role/);
 assert.doesNotMatch(sql,/create table|drop table|security definer|pubg_api_key|http_get/i);
});
