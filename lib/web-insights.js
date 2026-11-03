'use strict';
const { escapeLike } = require('./pubg-utils');

const WEAPON_LIMIT = 120;
const MATCH_LIMIT = 500;
const asText = value => String(value ?? '').slice(0,100);
const numberOrNull = value => {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return null;
  return Math.max(0,Math.min(1e10,Number(value)));
};
const num = value => numberOrNull(value) ?? 0;
const exact = (list,name) => (list||[]).find(row =>
  String(row.gamertag||'').toLowerCase()===name.toLowerCase());
async function read(query) {
  const result=await query;
  if(result.error)throw new Error('Saved console data unavailable');
  return result.data;
}
async function verifiedPlayer(db,submittedName) {
  const name=String(submittedName??'').trim();
  if(!name || name.length>100 || /[,\u0000-\u001f\u007f]/.test(name))
    return {status:400,body:{error:'Invalid gamertag'}};
  const people=await read(db.from('players')
    .select('id,gamertag,platform,pubg_account_id')
    .ilike('gamertag',escapeLike(name)).limit(10));
  const player=exact(people,name);
  if(!player || !['xbox','psn'].includes(player.platform) ||
      !/^[a-zA-Z0-9._-]{8,160}$/.test(String(player.pubg_account_id||'')))
    return {status:404,body:{error:'Saved console player not found'}};
  return {player};
}
function allowStats(input) {
  if(!input || typeof input!=='object')return null;
  const source={
    kills:'Kills',headshots:'HeadShots',damage:'DamagePlayer',
    defeats:'Defeats',knocks:'Groggies',longRangeDefeats:'LongRangeDefeats',
    longestDefeat:'LongestDefeat',longestKill:'LongestKill',
    mostKillsInGame:'MostKillsInAGame'
  };
  const row={};
  for(const [out,key] of Object.entries(source)) {
    const value=numberOrNull(input[key]);
    if(value!==null)row[out]=value;
  }
  return Object.keys(row).length ? row : null;
}
function weaponItems(payload) {
  const entries=payload?.data?.attributes?.weaponSummaries;
  if(!entries || typeof entries!=='object' || Array.isArray(entries))return [];
  return Object.entries(entries).filter(([id,value])=>
    /^Item_Weapon_[A-Za-z0-9_]{1,100}_C$/.test(id) && value && typeof value==='object')
    .map(([id,record])=>{
      const total=allowStats(record.StatsTotal);
      const official=allowStats(record.OfficialStatsTotal);
      const competitive=allowStats(record.CompetitiveStatsTotal);
      return {
        name:asText(id.replace(/^Item_Weapon_/,'').replace(/_C$/,'').replace(/_/g,' ')),
        level:numberOrNull(record.LevelCurrent),tier:numberOrNull(record.TierCurrent),
        xp:numberOrNull(record.XPTotal),
        medals:Array.isArray(record.Medals)?Math.min(record.Medals.length,10000):null,
        total,official,competitive
      };
    }).sort((a,b)=>(b.total?.kills??-1)-(a.total?.kills??-1) ||
      (b.official?.kills??-1)-(a.official?.kills??-1) ||
      (b.xp??-1)-(a.xp??-1) || a.name.localeCompare(b.name)).slice(0,WEAPON_LIMIT);
}
async function weaponInsights(db,player) {
  const cacheKey='pubg:v1:'+player.platform+'/players/'+player.pubg_account_id+'/weapon_mastery';
  const cached=await read(db.from('pubg_endpoint_cache')
    .select('payload,fetched_at').eq('cache_key',cacheKey).maybeSingle());
  const items=weaponItems(cached?.payload);
  return {status:200,body:{
    schemaVersion:1,kind:'weapons',name:player.gamertag,platform:player.platform,
    savedAt:cached?.fetched_at||null,count:items.length,
    note:cached?.payload
      ? 'Real cached PUBG weapon mastery. Total, Official and Competitive statistics are separate categories; missing fields are unavailable.'
      : 'No saved weapon mastery yet. Ask for /mastery gamertag in Discord to populate the existing cache.',
    items
  }};
}
async function teammateInsights(db,player) {
  const archived=await read(db.from('clan_match_archive')
    .select('match_id,played_at,summary')
    .eq('player_id',player.id).order('played_at',{ascending:false}).limit(MATCH_LIMIT));
  const teammates=new Map(),seen=new Set();
  for(const game of archived||[]) {
    if(typeof game.match_id!=='string'||seen.has(game.match_id))continue;
    seen.add(game.match_id);
    const unique=new Set();
    for(const teammate of (Array.isArray(game.summary?.squad)?game.summary.squad:[])) {
      if(teammate?.isSelf===true)continue;
      const name=asText(teammate?.name||'').trim();
      if(!name || name.toLowerCase()===player.gamertag.toLowerCase())continue;
      const key=name.toLowerCase();
      if(unique.has(key))continue;
      unique.add(key);
      const value=teammates.get(key)||{name,games:0,wins:0,kills:0,damage:0,assists:0,knocks:0,lastPlayedAt:null};
      value.games++;
      if(Number(game.summary?.placement)===1)value.wins++;
      value.kills+=num(teammate.kills);value.damage+=num(teammate.damage);
      value.assists+=num(teammate.assists);value.knocks+=num(teammate.knocks);
      const stamp=game.played_at;
      if(typeof stamp==='string' && Number.isFinite(Date.parse(stamp)) &&
        (!value.lastPlayedAt || stamp>value.lastPlayedAt))value.lastPlayedAt=stamp;
      teammates.set(key,value);
    }
  }
  const items=Array.from(teammates.values()).sort((a,b)=>b.games-a.games ||
    b.kills-a.kills || a.name.localeCompare(b.name)).slice(0,100);
  return {status:200,body:{
    schemaVersion:1,kind:'teammates',name:player.gamertag,platform:player.platform,
    archivedMatches:seen.size,count:items.length,
    note:'Based only on stored PUBG squad rosters for this saved console player. Outside-clan history may be incomplete; this is not a lifetime-wide tally.',
    items
  }};
}
async function publicInsights(db,{name,kind}) {
  if(kind!=='weapons'&&kind!=='teammates')
    return {status:400,body:{error:'Unknown insight type'}};
  const resolved=await verifiedPlayer(db,name);
  if(!resolved.player)return resolved;
  return kind==='weapons'
    ? weaponInsights(db,resolved.player)
    : teammateInsights(db,resolved.player);
}
module.exports={publicInsights,weaponItems,allowStats,teammateInsights,verifiedPlayer};
