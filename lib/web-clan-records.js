'use strict';
// Public response for real, server-aggregated clan match personal bests.
// No PUBG API call, match identifier, opponent or account identifier escapes.
const METRICS=Object.freeze([
 'kills','damage','headshots','assists','knocks','revives',
 'longestKillMeters','timeSurvivedSeconds','roadKills','vehicleDestroys'
]);
const metricSet=new Set(METRICS);
const DAYS=new Set([7,30,180]);
const numeric=(value,max=1e9)=>
 typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max
   ?value:null;
const text=(value)=>typeof value==='string'?value.slice(0,100):'';
function sanitizeRecord(row){
 if(!row||typeof row!=='object'||!metricSet.has(row.metric)||
   !['xbox','psn'].includes(row.platform)||
   !text(row.name).trim()||
   !Number.isInteger(row.rank)||row.rank<1||row.rank>5||
   numeric(row.value)===null||row.value===0||
   typeof row.playedAt!=='string'||
   !Number.isFinite(Date.parse(row.playedAt)))return null;
 return{
  metric:row.metric,rank:row.rank,value:row.value,
  name:text(row.name),platform:row.platform,
  map:text(row.map)||'Unknown map',mode:text(row.mode)||'Unknown mode',
  playedAt:row.playedAt
 };
}
function sanitizeCoverage(row){
 if(!row||!metricSet.has(row.metric)||
   !Number.isInteger(row.observed)||numeric(row.observed,1e7)===null)
   return null;
 return{metric:row.metric,observed:row.observed};
}
async function publicClanMatchRecords(db,daysInput){
 const days=daysInput===undefined?30:daysInput;
 const valid=typeof days==='number'?DAYS.has(days):
   typeof days==='string'&&/^(7|30|180)$/.test(days);
 if(!valid)return{status:400,body:{
  error:'Choose an observed match history window of 7, 30 or 180 days'
 }};
 const periodDays=Number(days);
 const result=await db.rpc('get_clan_match_record_book',{p_days:periodDays});
 if(result.error)throw Error('Archived clan records unavailable');
 const payload=result.data;
 if(!payload||payload.schemaVersion!==1||payload.periodDays!==periodDays||
  !Array.isArray(payload.records)||!Array.isArray(payload.coverage))
  throw Error('Invalid private record archive response');
 const seen=new Set();
 const records=payload.records.slice(0,100).map(sanitizeRecord).filter(row=>{
  if(!row)return false;
  const key=row.metric+':'+row.platform+':'+row.name.toLowerCase();
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 });
 const coverage=payload.coverage.slice(0,30).map(sanitizeCoverage).filter(Boolean);
 return{status:200,body:{
  schemaVersion:1,kind:'clan-match-records',periodDays,
  generatedAt:typeof payload.generatedAt==='string'?payload.generatedAt:null,
  verifiedPlayers:numeric(payload.verifiedPlayers,1e4)??0,
  observedPlayers:numeric(payload.observedPlayers,1e4)??0,
  playerMatchObservations:numeric(payload.playerMatchObservations,1e7)??0,
  distinctMatches:numeric(payload.distinctMatches,1e7)??0,
  coverage,records,
  note:'Unofficial personal bests from recorded PUBG clan-player matches in this rolling window. Each player appears at most once per metric. Missing and zero-only metrics have no record winner; available record counts include genuine zeros. This is not lifetime history or a verified global leaderboard.'
 }};
}
module.exports={publicClanMatchRecords,sanitizeRecord,sanitizeCoverage,METRICS,DAYS};
