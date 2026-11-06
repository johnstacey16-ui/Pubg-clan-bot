'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {summarizeMatch,safeArchivedSummary,ARCHIVE_LIMIT}=
 require('../lib/web-match-intel');
const {summary,duration,deathText,EXTRA_FIELDS}=require('../assets/match-lab');
const id='00336e4b-d659-4497-bfc4-9f6dd705cc71',account='account.TEST9999';
function source(stats){
 return{data:{id,attributes:{mapName:'Baltic_Main',gameMode:'squad',
  createdAt:'2026-11-05T12:00:00Z',duration:1900}},included:[
  {id:'one',type:'participant',attributes:{stats:{
   name:'My Member',playerId:account,kills:8,damageDealt:750,...stats}}},
  {id:'other',type:'participant',attributes:{stats:{
   name:'Friend',playerId:'account.PRIVATE123',headshotKills:1,
   revives:2,timeSurvived:1432,deathType:'byplayer'}}},
  {id:'enemy',type:'participant',attributes:{stats:{
   name:'Enemy',playerId:'account.ENEMY',kills:99}}},
  {id:'roster',type:'roster',relationships:{participants:{data:[{id:'one'},{id:'other'}]}}},
  {id:'telemetry',type:'asset',attributes:{URL:'https://secret.example/path'}}
 ]};
}
test('official participant values and approved death types are mapped exactly',()=>{
 const s=summarizeMatch(source({
  winPlace:2,timeSurvived:1851,swimDistance:187.6,
  killPlace:3,killStreaks:2,roadKills:1,teamKills:0,
  vehicleDestroys:2,weaponsAcquired:14,deathType:'byzone',
  privateOther:'never expose'
 }),account);
 assert.equal(s.timeSurvivedSeconds,1851);
 assert.equal(s.swimMeters,187.6);
 assert.equal(s.killPlace,3);
 assert.equal(s.killStreaks,2);
 assert.equal(s.roadKills,1);
 assert.equal(s.teamKills,0);
 assert.equal(s.vehicleDestroys,2);
 assert.equal(s.weaponsAcquired,14);
 assert.equal(s.deathType,'byzone');
 assert.equal(s.squad.length,2);
 assert.equal(s.squad[1].headshots,1);
 assert.equal(s.squad[1].revives,2);
 assert.equal(s.squad[1].timeSurvivedSeconds,1432);
 assert.equal(s.squad[1].deathType,'byplayer');
 assert.doesNotMatch(JSON.stringify(s),/account\.|never expose|secret\.example|Enemy|privateOther/);
});
test('optional fields never turn missing invalid negative values into zero',()=>{
 const s=summarizeMatch(source({
  winPlace:0,swimDistance:-10,timeSurvived:'',killStreaks:'not a number',
  roadKills:0,teamKills:null,weaponsAcquired:Infinity,deathType:'other'
 }),account);
 for(const key of ['swimMeters','timeSurvivedSeconds','killStreaks',
  'teamKills','weaponsAcquired'])assert.equal(s[key],null,key);
 assert.equal(s.roadKills,0);
 assert.equal(s.deathType,null);
 assert.equal(s.placement,null);
});
test('archive returns only supported fields with nullable older records',()=>{
 const row=safeArchivedSummary({match_id:id,played_at:'2026-11-03T11:00:00Z',
  summary:{id,map:'Baltic_Main',kills:3,timeSurvivedSeconds:1834,
   swimMeters:0,roadKills:1,teamKills:0,killPlace:5,killStreaks:2,
   weaponsAcquired:12,vehicleDestroys:3,deathType:'alive',
   secretUrl:'https://hidden.example',pubgAccount:account,
   squad:[{name:'Friend',isSelf:false,kills:1,timeSurvivedSeconds:1200,
    headshots:0,revives:2,deathType:'byplayer',accountId:account}]}});
 assert.equal(row.kills,3);
 assert.equal(row.timeSurvivedSeconds,1834);
 assert.equal(row.swimMeters,0);
 assert.equal(row.killPlace,5);
 assert.equal(row.vehicleDestroys,3);
 assert.equal(row.weaponsAcquired,12);
 assert.equal(row.deathType,'alive');
 assert.equal(row.squad[0].headshots,0);
 assert.equal(row.squad[0].deathType,'byplayer');
 assert.doesNotMatch(JSON.stringify(row),/pubgAccount|hidden\.example|account\.|secretUrl|accountId/);
 const old=safeArchivedSummary({match_id:id,played_at:'2026-11-03T11:00:00Z',
  summary:{id,kills:0}});
 assert.equal(old.kills,0);
 assert.equal(old.swimMeters,null);
 assert.equal(old.deathType,null);
 assert.ok(ARCHIVE_LIMIT>=90);
});
test('match-lab summaries use only observed survival times',()=>{
 const s=summary([
  {id:'1',timeSurvivedSeconds:1200,roadKills:0,vehicleDestroys:1},
  {id:'2',timeSurvivedSeconds:null,roadKills:null,vehicleDestroys:null},
  {id:'3',timeSurvivedSeconds:600,roadKills:2,vehicleDestroys:0}
 ]);
 assert.equal(s.survivalObserved,2);
 assert.equal(s.averageSurvivalSeconds,900);
 assert.equal(s.roadKills,2);
 assert.equal(s.vehicleDestroys,1);
 assert.equal(duration(900),'15m 00s');
 assert.equal(duration(null),'—');
 assert.equal(deathText('byzone'),'Died to zone');
 assert.equal(deathText('invented'),'—');
 assert.equal(EXTRA_FIELDS.length,9);
});
test('stored SQL extraction is restricted, nullable and includes every approved metric',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..',
  'supabase/migrations/20261106_extend_saved_match_participants.sql'),'utf8');
 for(const key of ['timeSurvivedSeconds','swimMeters','killPlace','killStreaks',
  'roadKills','teamKills','vehicleDestroys','weaponsAcquired','deathType'])
  assert.ok(sql.includes("'"+key+"'"),key);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.optional_pubg_stat_number/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.archive_verified_clan_match/);
 assert.match(sql,/ELSE NULL END/);
 assert.doesNotMatch(sql,/SECURITY DEFINER/i);
});
