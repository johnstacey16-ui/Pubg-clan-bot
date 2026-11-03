'use strict';
const {escapeLike}=require('./pubg-utils');
const {MODES,whitelistStats}=require('./web-stats');
const ID=/^[a-zA-Z0-9._-]{4,128}$/;
const PLATFORM=new Set(['xbox','psn']);
const asNumber=x=>x===undefined||x===null||!Number.isFinite(Number(x))?null:Math.max(0,Number(x));
const asString=s=>String(s??'').slice(0,100);
async function read(query) {
  const r=await query;
  if(r.error)throw Error('Saved PUBG season data cannot be read');
  return r.data;
}
function shapeRanked(s) {
  if(!s||typeof s!=='object')return null;
  const result={};
  for(const key of ['roundsPlayed','wins','kills','assists','dBNOs','revives',
    'damageDealt','currentRankPoint','bestRankPoint','avgRank','kda','kdr',
    'deaths','top10Ratio','winRatio']){
    const n=asNumber(s[key]);
    if(n!==null)result[key]=n;
  }
  const tier=t=>{
    if(!t||typeof t!=='object')return null;
    return{tier:asString(t.tier||t.name||'Unranked'),subTier:asString(t.subTier||'')};
  };
  if(s.currentTier)result.currentTier=tier(s.currentTier);
  if(s.bestTier)result.bestTier=tier(s.bestTier);
  return result;
}
function shapeSeasonPayload(payload,type) {
  const attr=payload?.data?.attributes;
  const source=type==='ranked'?attr?.rankedGameModeStats:attr?.gameModeStats;
  if(!source||typeof source!=='object'||Array.isArray(source))return[];
  return MODES.filter(mode=>source[mode]&&typeof source[mode]==='object')
    .map(mode=>({mode,stats:type==='ranked'?shapeRanked(source[mode]):whitelistStats(source[mode])}));
}
async function savedSeason(db,{name,platform='auto',type='season'}={}) {
  if(!['season','ranked'].includes(type)||!['auto','xbox','psn'].includes(platform)||
      typeof name!=='string'||name.trim()!==name||name.length>100||
      !name||/[,\u0000-\u001f\u007f]/.test(name))
    return{status:400,body:{error:'Invalid console player or season type'}};
  const players=await read(db.from('players')
    .select('gamertag,platform,pubg_account_id')
    .ilike('gamertag',escapeLike(name)).limit(10));
  const player=(players||[]).find(p=>p.gamertag?.toLowerCase()===name.toLowerCase()
    &&PLATFORM.has(p.platform)&&/^[a-zA-Z0-9._-]{8,160}$/.test(p.pubg_account_id||''));
  if(!player)return{status:404,body:{error:'Player not saved. Refresh lifetime data first.'}};
  if(platform!=='auto'&&player.platform!==platform)
    return{status:409,body:{error:'Player belongs to a different console',suggestedPlatform:player.platform}};
  const prefix='pubg:v1:'+player.platform+'/';
  const seasons=await read(db.from('pubg_endpoint_cache')
    .select('payload,fetched_at').eq('cache_key',prefix+'seasons').maybeSingle());
  const list=Array.isArray(seasons?.payload?.data)?seasons.payload.data:[];
  const active=list.find(s=>s?.attributes?.isCurrentSeason&&!s?.attributes?.isOffseason) ||
    list.find(s=>s?.attributes?.isCurrentSeason);
  const seasonId=ID.test(active?.id||'')?active.id:null;
  let result=null;
  if(seasonId) {
    const key=prefix+'players/'+player.pubg_account_id+'/seasons/'+seasonId+
      (type==='ranked'?'/ranked':'');
    result=await read(db.from('pubg_endpoint_cache')
      .select('payload,fetched_at').eq('cache_key',key).maybeSingle());
  }
  const modes=shapeSeasonPayload(result?.payload,type);
  return{status:200,body:{
    schemaVersion:1,type,name:player.gamertag,platform:player.platform,
    seasonId,savedAt:result?.fetched_at||null,count:modes.length,modes,
    note:!seasonId
      ? 'No saved current-season index. Use Refresh from PUBG to populate it.'
      : !result?.payload
        ? 'Season identified but no saved player statistics. Select Refresh from PUBG.'
        : 'PUBG season statistics saved in Supabase; missing fields are not estimated.'
  }};
}
module.exports={savedSeason,shapeSeasonPayload,shapeRanked};
