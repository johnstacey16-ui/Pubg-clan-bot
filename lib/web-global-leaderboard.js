'use strict';
const {cachedEndpoint}=require('./pubg-endpoints');
const {MODES}=require('./web-stats');
const {safeSource}=require('./web-source');
const SEASON=/^[a-zA-Z0-9._-]{4,128}$/;
const REGIONS={xbox:['as','eu','na','oc','sa'],psn:['as','eu','na','oc']};
async function read(query,label){
 const r=await query;if(r.error)throw Error(label+' unavailable');return r.data;
}
function shape(payload,{platform,region,mode,seasonId,state,fetchedAt}){
 const entries=Array.isArray(payload?.included)?payload.included:[];
 const players=entries.filter(x=>x?.type==='player').slice(0,500).map(x=>{
  const a=x.attributes||{},rank=Number(a.rank),name=a.name;
  if(typeof name!=='string'||!name.trim()||name.length>100||
   !Number.isInteger(rank)||rank<1||rank>10000)return null;
  const stats=safeSource(a.stats||{});
  return{name,rank,stats};
 }).filter(Boolean).sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name));
 const found=new Set(players.map(p=>p.rank));
 return{schemaVersion:1,platform,region,mode,seasonId,state,
  fetchedAt:fetchedAt||null,count:players.length,players,
  cutLines:[1,10,50,100,500].map(rank=>({rank,
   present:found.has(rank),
   player:players.find(x=>x.rank===rank)?.name||null})),
  note:'Official PUBG regional leaderboard only, not the clan leaderboard. Exact returned ranks; unavailable positions are not estimated. PUBG updates current leaderboards on its own schedule.'
 };
}
async function officialLeaderboard(db,params={},services={}){
 const {platform='xbox',region='eu',mode='squad',season}=params;
 if(!REGIONS[platform]?.includes(region)||!MODES.includes(mode)||
  (season!==undefined && (typeof season!=='string'||!SEASON.test(season))))
  return{status:400,body:{error:'Unsupported PUBG console region, mode or season'}};
 const shard=platform+'-'+region;
 let seasonId=season;
 if(!seasonId){
  const index=await read(db.from('pubg_endpoint_cache')
   .select('payload').eq('cache_key','pubg:v1:'+platform+'/seasons').maybeSingle(),
   'Saved season catalogue');
  const seasons=Array.isArray(index?.payload?.data)?index.payload.data:[];
  const current=seasons.find(x=>x?.attributes?.isCurrentSeason&&!x?.attributes?.isOffseason)||
   seasons.find(x=>x?.attributes?.isCurrentSeason);
  if(!SEASON.test(current?.id||''))
   return{status:404,body:{error:'No current season index saved for this console. Refresh a player season first, or enter a known season ID.'}};
  seasonId=current.id;
 }
 // PUBG removed required page filtering after Season 7; one response has the top 500.
 const path='leaderboards/'+seasonId+'/'+mode;
 const cacheKey='pubg:v1:'+shard+'/'+path;
 const entry=await read(db.from('pubg_endpoint_cache')
  .select('payload,expires_at,fetched_at')
  .eq('cache_key',cacheKey).maybeSingle(),'Saved official leaderboard');
 if(entry?.payload&&Date.parse(entry.expires_at)>Date.now())
  return{status:200,body:shape(entry.payload,{platform,region,mode,seasonId,
   fetchedAt:entry.fetched_at,state:'cached'})};
 const permitted=await read(db.rpc('reserve_web_refresh',{
  p_player_key:platform+':leaderboard:'+region+':'+mode
 }),'Shared public refresh cooldown');
 if(!permitted){
  if(entry?.payload)return{status:200,body:shape(entry.payload,{
   platform,region,mode,seasonId,fetchedAt:entry.fetched_at,state:'stale'})};
  return{status:429,body:{error:'Shared website refresh cooldown is active. Please retry later.',retryAfterSeconds:90}};
 }
 const result=await (services.cachedEndpoint||cachedEndpoint)(db,shard,path,7200);
 if(!result.data){
  return{status:result.state==='rate_limited'?429:result.state==='not_found'?404:503,
   body:{error:result.state==='rate_limited'?
    'Shared PUBG API budget exhausted; no leaderboard was invented.':
    'PUBG has no saved or available leaderboard for this selection.'}};
 }
 return{status:200,body:shape(result.data,{
  platform,region,mode,seasonId,state:result.state,
  fetchedAt:result.state==='fresh'?new Date().toISOString():entry?.fetched_at||null
 })};
}
module.exports={officialLeaderboard,shape,REGIONS};
