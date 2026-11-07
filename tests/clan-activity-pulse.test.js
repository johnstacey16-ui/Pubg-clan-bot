'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {publicClanActivity,safeDay,parseDays,validDate}=require('../lib/web-clan-activity');
const {grouping,busiest,validateClient,metrics}=require('../assets/clan-activity-pulse');
const days=Array.from({length:7},(_,i)=>{
 const date=new Date(Date.UTC(2026,10,i+1)).toISOString().slice(0,10);
 const games=i===0?0:i+2;
 return{day:date,playerMatches:games*2,distinctMatches:games,
  activePlayers:games===0?0:2,killsObserved:games*2,kills:games*3,
  damageObserved:games*2,damage:games*125.5,
  knownPlacements:games*2,playerWins:games?1:0,
  playerTop10:games?Math.min(3,games*2):0};
});
const total=(key)=>days.reduce((sum,r)=>sum+r[key],0);
const payload={
 schemaVersion:1,periodDays:7,generatedAt:'2026-11-07T08:00:00Z',
 timeZone:'UTC',verifiedPlayers:50,observedPlayers:6,
 playerMatchObservations:total('playerMatches'),distinctMatches:total('distinctMatches'),
 firstMatchAt:'2026-11-02T12:00:00Z',lastMatchAt:'2026-11-07T02:50:00Z',
 days
};
test('only exact approved day windows can trigger Supabase queries',async()=>{
 const db={rpc(){throw Error('unexpected RPC')}};
 for(const value of [0,1,6,8,31,365,'7.0',' 7','007','7;drop','7e0',
  true,false,{},[],null,undefined===0?4:null]){
  const r=await publicClanActivity(db,value);
  assert.equal(r.status,400,String(value));
 }
 assert.equal(parseDays(undefined),30);
 assert.equal(parseDays('7'),7);
 assert.equal(parseDays(180),180);
});
test('one service-only RPC emits numbers and ISO UTC dates without match IDs',async()=>{
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return{data:payload,error:null}}};
 const r=await publicClanActivity(db,'7');
 assert.equal(r.status,200);
 assert.equal(r.body.kind,'clan-activity');
 assert.equal(r.body.timeZone,'UTC');
 assert.equal(r.body.periodDays,7);
 assert.equal(r.body.days.length,7);
 assert.equal(r.body.verifiedPlayers,50);
 assert.equal(r.body.distinctMatches,total('distinctMatches'));
 assert.equal(r.body.playerMatchObservations,total('playerMatches'));
 assert.deepEqual(calls,[{name:'get_clan_activity_pulse',args:{p_days:7}}]);
 assert.doesNotMatch(JSON.stringify(r.body),
  /match_id|player_id|pubg_account_id|secret|telemetryURL/);
 assert.deepEqual(Object.keys(r.body.days[0]).sort(),[
  'day','playerMatches','distinctMatches','activePlayers','killsObserved',
  'kills','damageObserved','damage','knownPlacements','playerWins',
  'playerTop10'].sort());
});
test('no-saved-match UTC days are explicit zeros, not dropped or guessed',()=>{
 const first=safeDay(days[0]);
 assert.equal(first.playerMatches,0);
 assert.equal(first.kills,0);
 assert.equal(first.playerWins,0);
 assert.equal(first.distinctMatches,0);
 assert.equal(validDate('2026-11-07'),true);
 assert.equal(validDate('2026-02-30'),false);
 assert.equal(validDate('yesterday'),false);
 assert.equal(safeDay({...days[1],day:'2026-11-31'}),null);
 assert.equal(safeDay({...days[1],killsObserved:1000}),null);
 assert.equal(safeDay({...days[1],activePlayers:100}),null);
 assert.equal(safeDay({...days[1],playerWins:500}),null);
 assert.equal(safeDay({...days[1],damage:-1}),null);
});
test('broken, duplicate or nonconsecutive archive dates are rejected',async()=>{
 for(const d of [
  {...payload,days:days.slice(1)},
  {...payload,days:[...days.slice(0,4),{...days[4],day:'2026-11-10'},...days.slice(5)]},
  {...payload,playerMatchObservations:1},
  {...payload,timeZone:'local'}
 ]){
  await assert.rejects(()=>publicClanActivity({rpc:async()=>({data:d,error:null})},7));
 }
});
test('30-day view uses individual UTC dates; 180-day view uses 7-day groups',()=>{
 const individual=grouping(days,30);
 assert.equal(individual.length,7);
 assert.equal(individual[1].distinctMatches,days[1].distinctMatches);
 assert.equal(individual[1].activePlayers,2);
 assert.equal(individual[1].activePlayerDays,2);
 const hundredEighty=Array.from({length:180},(_,i)=>({
  ...days[i%7],day:new Date(Date.UTC(2026,4,1+i)).toISOString().slice(0,10)
 }));
 const weekly=grouping(hundredEighty,180);
 assert.equal(weekly.length,26);
 assert.equal(weekly[0].rows.length,7);
 assert.equal(weekly[25].rows.length,5);
 assert.equal(weekly[0].distinctMatches,total('distinctMatches'));
 assert.equal(weekly[0].playerMatches,total('playerMatches'));
 assert.equal(weekly[0].activePlayerDays,12);
 assert.equal(weekly[0].activePlayers,undefined,
  'Do not misrepresent summed player-days as weekly unique players');
 assert.equal(weekly[0].kills,total('kills'));
 assert.equal(busiest(days).day,'2026-11-07');
 assert.deepEqual(Object.keys(metrics),[
  'distinctMatches','playerMatches','kills','playerWins']);
});
test('UI only accepts exact typed archive shape, not arbitrary public JSON',()=>{
 assert.equal(Boolean(validateClient({...payload,kind:'clan-activity'})),true);
 assert.equal(Boolean(validateClient({...payload,kind:'rival'})),false);
 assert.equal(Boolean(validateClient({...payload,timeZone:'America/New_York',
  kind:'clan-activity'})),false);
 assert.equal(Boolean(validateClient({...payload,days:[],kind:'clan-activity'})),false);
});
test('migration verifies actual matched clan membership and strictly revokes public RPC',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..',
  'supabase/migrations/20261107_clan_daily_activity_pulse.sql'),'utf8');
 assert.match(sql,/security invoker set search_path = ''/);
 assert.match(sql,/p_days in \(7,30,180\)/);
 assert.match(sql,/public\.clan_match_archive/);
 assert.match(sql,/q\.is_clan_member=true/);
 assert.match(sql,/count\(distinct match_id\)/);
 assert.match(sql,/count\(distinct player_id\)/);
 assert.match(sql,/from dates d left join per_day/);
 assert.match(sql,/revoke all on function public\.get_clan_activity_pulse\(integer\)/);
 assert.match(sql,/grant execute on function public\.get_clan_activity_pulse\(integer\)\s+to service_role/);
 assert.doesNotMatch(sql,/security definer|create table|drop table|http_get|pubg_api_key/i);
});
