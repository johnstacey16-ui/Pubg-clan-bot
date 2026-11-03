'use strict';
const { escapeLike } = require('./pubg-utils');

// This is a cache-only public view. Neither this file nor its API handler
// makes a PUBG request or calls the shared rate-budget RPC.
const INDEX_LIMIT = 8;
const MATCH_ID = /^[a-zA-Z0-9-]{12,90}$/;
const asText = value => String(value == null ? '' : value).slice(0,100);
const asNum = value => Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : 0;
const exact = (rows, name) => (rows||[]).find(row =>
  row.gamertag?.toLowerCase() === name.toLowerCase());
async function read(query) {
  const result = await query;
  if (result.error) throw new Error('Saved match data temporarily unavailable');
  return result.data;
}
function summarizeMatch(payload, accountId) {
  const root = payload?.data;
  const attr = root?.attributes || {};
  const included = Array.isArray(payload?.included) ? payload.included : [];
  if (!root || typeof root.id !== 'string') return null;
  const participants = included.filter(p => p.type === 'participant');
  const found = participants.find(p => p.attributes?.stats?.playerId === accountId);
  if (!found) return null;
  const s = found.attributes?.stats || {};
  const roster = included.find(r => r.type === 'roster' &&
    Array.isArray(r.relationships?.participants?.data) &&
    r.relationships.participants.data.some(p => p.id === found.id));
  const memberIds = new Set(roster?.relationships?.participants?.data?.map(x => x.id) || []);
  const teammates = participants.filter(p => memberIds.has(p.id)).map(p => {
    const t = p.attributes?.stats || {};
    return {
      name: asText(t.name), isSelf: p.id === found.id,
      kills: asNum(t.kills), damage: asNum(t.damageDealt),
      assists: asNum(t.assists), knocks: asNum(t.DBNOs)
    };
  });
  const team = teammates.length ? teammates : [{
    name:asText(s.name), isSelf:true, kills:asNum(s.kills),
    damage:asNum(s.damageDealt), assists:asNum(s.assists), knocks:asNum(s.DBNOs)
  }];
  return {
    id: root.id,
    map: asText(attr.mapName || 'Unknown map'),
    mode: asText(attr.gameMode || 'Unknown mode'),
    playedAt: typeof attr.createdAt === 'string' ? attr.createdAt : null,
    durationSeconds: asNum(attr.duration),
    placement: Number(s.winPlace)>0 ? Number(s.winPlace) : null,
    kills: asNum(s.kills), damage: asNum(s.damageDealt),
    assists: asNum(s.assists), knocks: asNum(s.DBNOs),
    headshots: asNum(s.headshotKills), revives: asNum(s.revives),
    heals: asNum(s.heals), boosts: asNum(s.boosts),
    longestKillMeters: asNum(s.longestKill),
    walkMeters: asNum(s.walkDistance), driveMeters: asNum(s.rideDistance),
    squad: team.slice(0,8)
  };
}
async function cachedPlayerMatches(db, suppliedName) {
  const name=String(suppliedName||'').trim();
  if (!name || name.length>100 || /[,\u0000-\u001f\u007f]/.test(name))
    return { status:400, body:{error:'Invalid PUBG gamertag'} };
  const roster=await read(db.from('player_import_queue')
    .select('gamertag,status,is_clan_member').eq('is_clan_member',true)
    .ilike('gamertag',escapeLike(name)).limit(10));
  const member=exact(roster,name);
  if (!member || member.is_clan_member!==true || member.status!=='matched')
    return {status:404,body:{error:'Verified clan player not found'}};
  const players=await read(db.from('players')
    .select('gamertag,platform,pubg_account_id')
    .ilike('gamertag',escapeLike(name)).limit(10));
  const player=exact(players,name);
  if (!player || !['xbox','psn'].includes(player.platform) ||
      !/^[a-zA-Z0-9._-]{8,160}$/.test(String(player.pubg_account_id||'')))
    return {status:404,body:{error:'Verified console player not found'}};
  const key='pubg:v1:'+player.platform+'/players/'+player.pubg_account_id;
  const index=await read(db.from('pubg_endpoint_cache')
    .select('payload,fetched_at').eq('cache_key',key).maybeSingle());
  const requested=(index?.payload?.data?.relationships?.matches?.data||[]);
  const ids=[...new Set(Array.isArray(requested)?requested.map(x=>x.id)
    .filter(x=>typeof x==='string'&&MATCH_ID.test(x)):[])].slice(0,INDEX_LIMIT);
  let items=[];
  if(ids.length) {
    const rows=await read(db.from('pubg_endpoint_cache')
      .select('cache_key,payload,fetched_at')
      .in('cache_key',ids.map(id=>'pubg:v1:console/matches/'+id)).limit(INDEX_LIMIT));
    const byKey=new Map((rows||[]).map(row=>[row.cache_key,row]));
    items=ids.map(id=>{
      const row=byKey.get('pubg:v1:console/matches/'+id);
      const summary=row&&summarizeMatch(row.payload,player.pubg_account_id);
      return summary && summary.id===id
        ? {...summary,savedAt:row.fetched_at||null} : null;
    }).filter(Boolean);
  }
  return {status:200,body:{
    schemaVersion:1,name:player.gamertag,platform:player.platform,
    indexSavedAt:index?.fetched_at||null,
    indexedCount:ids.length,availableCount:items.length,
    source:'Saved PUBG match cache; no live PUBG requests',
    note:index?.payload
      ? 'Only matches previously retrieved by the Discord bot appear. Match records are normally available from PUBG for about 14 days.'
      : 'No saved recent-match index yet. Use /recent in Discord to populate the shared cache.',
    matches:items
  }};
}
module.exports={cachedPlayerMatches,summarizeMatch,INDEX_LIMIT};
