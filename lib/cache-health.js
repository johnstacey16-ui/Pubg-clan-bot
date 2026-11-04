'use strict';
// Public projection of the service-role-only aggregate Supabase health RPC.
// Never expose internal cache keys, account IDs, payloads or any request logs.
const CATEGORIES=Object.freeze([
 'player_profiles','season_catalogues','season','ranked','weapons',
 'survival','matches','regional_leaderboards','telemetry_reports','other'
]);
function count(value){
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
}
function timestamp(value){
 return typeof value==='string'&&Number.isFinite(Date.parse(value))?
  new Date(value).toISOString():null;
}
function shapeCacheHealth(source){
 if(!source||source.schemaVersion!==1||typeof source.cache!=='object'||
  !source.budget||!source.observations)return null;
 const cache=source.cache,budget=source.budget,o=source.observations;
 const grouped={};
 for(const key of CATEGORIES){
  const value=count(cache.byCategory?.[key]);
  if(value!==null)grouped[key]=value;
 }
 const reserved=count(budget.reserved),limit=count(budget.reservationLimit);
 const safeLimit=[8,10].includes(limit)?limit:null,windowSeconds=count(budget.rollingWindowSeconds);
 return{
  schemaVersion:1,checkedAt:timestamp(source.checkedAt),
  cache:{
   total:count(cache.total),fresh:count(cache.fresh),expired:count(cache.expired),
   newestFetchedAt:timestamp(cache.newestFetchedAt),byCategory:grouped
  },
  budget:{
   reservations:reserved,limit:safeLimit,
   windowSeconds:windowSeconds===65?65:null,
   remaining:reserved!==null&&safeLimit!==null?Math.max(0,safeLimit-reserved):null,
   lastReservedAt:timestamp(budget.lastReservedAt)
  },
  observations:{
   lifetimePlayers:count(o.lifetimePlayers),seasonPlayers:count(o.seasonPlayers),
   seasonAttempts:count(o.seasonAttempts)
  },
  notice:'Reservations count shared PUBG API capacity, not successful HTTP responses. Cached reads use no upstream slots. Expired entries remain usable as labelled fallbacks.'
 };
}
async function getCacheHealth(db){
 try{
  const result=await db.rpc('get_public_pubg_cache_health');
  if(result.error)return null;
  return shapeCacheHealth(result.data);
 }catch(error){return null;}
}
module.exports={shapeCacheHealth,getCacheHealth,CATEGORIES};
