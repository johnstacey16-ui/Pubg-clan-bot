'use strict';
const {MODES}=require('./web-stats');
const TYPES=['season','ranked'];
const SEASON=/^[a-zA-Z0-9._-]{4,128}$/;
const asNumber=n=>n===null||n===undefined||n===''||!Number.isFinite(Number(n))?
  null:Math.max(0,Number(n));
const asText=(s,limit)=>String(s??'').slice(0,limit);
function shapeLeaderboard(rows,type,mode){
  const seen=new Set(),seasons=new Map(),entries=[];
  for(const row of rows||[]){
    if(!row||!SEASON.test(row.season_id||'')||
      !['xbox','psn'].includes(row.platform)||
      typeof row.player_name!=='string'||!row.player_name.trim()||
      row.player_name.length>100||
      !row.captured_at||!Number.isFinite(Date.parse(row.captured_at)))continue;
    const seasonId=row.season_id;
    const record={
      seasonId,name:asText(row.player_name,100),platform:row.platform,
      capturedAt:row.captured_at,
      matches:asNumber(row.matches),kills:asNumber(row.kills),
      wins:asNumber(row.wins),damage:asNumber(row.damage),
      rankPoints:type==='ranked'?asNumber(row.rank_points):null,
      tier:type==='ranked'&&row.tier!=null?asText(row.tier,50):null,
      subTier:type==='ranked'&&row.sub_tier!=null?asText(row.sub_tier,16):null
    };
    const unique=seasonId+'\0'+record.platform+'\0'+record.name.toLowerCase();
    if(seen.has(unique))continue;
    seen.add(unique);
    entries.push(record);
    if(!seasons.has(seasonId)||Date.parse(seasons.get(seasonId))<Date.parse(record.capturedAt))
      seasons.set(seasonId,record.capturedAt);
  }
  const seasonIds=[...seasons.keys()].sort((a,b)=>
    Date.parse(seasons.get(b))-Date.parse(seasons.get(a))||a.localeCompare(b));
  return{
    schemaVersion:1,type,mode,seasons:seasonIds,entries,
    count:entries.length,
    note:'Latest real observation per official clan player, mode and season. Snapshots can be from different dates; missing values are not estimated.'
  };
}
async function savedLeaderboard(db,{type='ranked',mode='squad'}={}){
  if(!TYPES.includes(type)||!MODES.includes(mode))
    return{status:400,body:{error:'Invalid season leaderboard selection'}};
  const result=await db.rpc('get_clan_season_leaderboard',{p_kind:type,p_mode:mode});
  if(result.error)throw Error('Clan season leaderboard unavailable');
  if(!Array.isArray(result.data))throw Error('Invalid saved leaderboard response');
  // The RPC returns one row per player per season, never raw player IDs.
  if(result.data.length>2000)throw Error('Clan season leaderboard exceeds safe response capacity');
  return{status:200,body:shapeLeaderboard(result.data,type,mode)};
}
module.exports={shapeLeaderboard,savedLeaderboard};
