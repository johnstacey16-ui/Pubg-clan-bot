'use strict';
// A strict server-side projection of on-demand service-role-only collector health.
// No player identities, PUBG account IDs, match IDs, job diagnostics or raw keys.
const SCOPES=Object.freeze(['lifetime','profile','weapons','survival']);
function whole(v,max=1e8){
 return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;
}
function timestamp(v){
 if(typeof v!=='string'||!v.trim())return null;
 const t=Date.parse(v);
 return Number.isFinite(t)?new Date(t).toISOString():null;
}
function counts(obj,keys,limit=1e8){
 if(!obj||typeof obj!=='object')return null;
 const result={};
 for(const k of keys){
  const n=whole(obj[k],limit);
  if(n===null)return null;
  result[k]=n;
 }
 return result;
}
function shapeCollectionHealth(source){
 if(!source||source.schemaVersion!==1||!Array.isArray(source.scopes)||
    source.scopes.length!==SCOPES.length)return null;
 const p=counts(source.players,
  ['verified','checked','checkedWithin24h','checkedWithin48h','checkedOlderThan48h'],10000);
 const a=counts(source.archive,
  ['playerMatchObservations','observedPlayers','distinctMatches','writesWithin24h']);
 const season=counts(source.season,
  ['tracked','attemptedWithin24h','completedWithin24h'],10000);
 const checkedAt=timestamp(source.checkedAt);
 if(!p||!a||!season||!checkedAt||p.checked>p.verified||
   p.checkedWithin24h>p.checkedWithin48h||p.checkedWithin48h>p.checked||
   p.checkedOlderThan48h>p.checked-p.checkedWithin48h||
   a.observedPlayers>p.verified||
   a.distinctMatches>a.playerMatchObservations||
   a.writesWithin24h>a.playerMatchObservations||
   season.attemptedWithin24h>season.tracked||
   season.completedWithin24h>season.tracked)return null;
 const seen=new Set(),scopes=[];
 for(const r of source.scopes){
  if(!r||!SCOPES.includes(r.scope)||seen.has(r.scope))return null;
  seen.add(r.scope);
  const stats=counts(r,
   ['total','done','pending','leased','unavailable','readyForRetry','pendingOlderThan48h'],
   10000);
  if(!stats||stats.total>p.verified||stats.done+stats.pending+
     stats.leased+stats.unavailable!==stats.total||
     stats.readyForRetry>stats.pending||stats.pendingOlderThan48h>stats.pending)
   return null;
  scopes.push({
   scope:r.scope,...stats,lastAttemptAt:timestamp(r.lastAttemptAt),
   lastCompletedAt:timestamp(r.lastCompletedAt)
  });
 }
 if(seen.size!==SCOPES.length)return null;
 scopes.sort((a,b)=>SCOPES.indexOf(a.scope)-SCOPES.indexOf(b.scope));
 return{
  schemaVersion:1,checkedAt,
  players:{...p,
   neverChecked:p.verified-p.checked,
   latestCheckedAt:timestamp(source.players.latestCheckedAt),
   oldestCheckedAt:timestamp(source.players.oldestCheckedAt)},
  archive:{...a,
   lastWrittenAt:timestamp(source.archive.lastWrittenAt),
   lastMatchPlayedAt:timestamp(source.archive.lastMatchPlayedAt)},
  scopes,
  season:{...season,
   lastAttemptAt:timestamp(source.season.lastAttemptAt),
   lastCompletedAt:timestamp(source.season.lastCompletedAt)},
  note:'Last player check does not prove a fresh PUBG response. A completed task can use cached data. Archive write time differs from match event time. Ready-for-retry work is not a failed collector. No background polling or upstream PUBG requests.'
 };
}
async function getCollectionHealth(db){
 try{
  const r=await db.rpc('get_clan_collection_health');
  if(r.error)return null;
  return shapeCollectionHealth(r.data);
 }catch(error){return null;}
}
module.exports={SCOPES,whole,timestamp,shapeCollectionHealth,getCollectionHealth};
