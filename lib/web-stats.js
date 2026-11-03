'use strict';
const MODES = Object.freeze(['solo','duo','squad','solo-fpp','duo-fpp','squad-fpp']);
const asNumber = n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
const asText = s => String(s ?? '').slice(0,100);
const whitelistStats = s => {
  const o = {};
  const fields = [
    'roundsPlayed','kills','wins','top10s','assists','headshotKills',
    'damageDealt','revives','dBNOs','longestKill','walkDistance',
    'rideDistance','timeSurvived','heals','boosts'
  ];
  for(const f of fields) if(s && s[f] !== null && s[f] !== undefined) o[f]=asNumber(s[f]);
  return o;
};
function shapeWebStats({ roster = [], players = [], details = [] }) {
  const membership = new Map(
    roster.filter(x=>x.is_clan_member).map(x=>[asText(x.gamertag).toLowerCase(),x])
  );
  const raw = players.filter(p=>membership.get(asText(p.gamertag).toLowerCase())?.status==='matched' &&
    ['xbox','psn'].includes(p.platform));
  const detailsById = new Map(details.map(d=>[d.player_id,d.game_mode_stats||{}]));
  const verified = raw.map(p => {
    const modes = {};
    const source = detailsById.get(p.id)||{};
    for(const m of MODES) if(source[m]) modes[m]=whitelistStats(source[m]);
    const games=asNumber(p.matches_played),kills=asNumber(p.total_kills),wins=asNumber(p.total_wins);
    return {
      name:asText(p.gamertag),platform:p.platform,
      kills,wins,matches:games,
      kd:games?Number((kills/games).toFixed(3)):null,
      winRate:games?Number((wins/games*100).toFixed(2)):null,
      updatedAt:p.last_checked || null,modes
    };
  }).sort((a,b)=>b.kills-a.kills||a.name.localeCompare(b.name));
  const byName = new Map(verified.map(p=>[p.name.toLowerCase(),p]));
  const rosterList = [...membership.values()].map(r=>{
    const p=byName.get(asText(r.gamertag).toLowerCase());
    return {name:asText(r.gamertag),status:asText(r.status),
      platform:p?.platform || (['xbox','psn'].includes(r.platform)?r.platform:null),
      verified:Boolean(p)};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  const totals = verified.reduce((t,p)=>{
    t.kills+=p.kills;t.wins+=p.wins;t.matches+=p.matches;return t;
  },{kills:0,wins:0,matches:0});
  const byMode = Object.fromEntries(MODES.map(mode=>[mode,{matches:0,kills:0,wins:0,damage:0,assists:0}]));
  for(const p of verified) for(const mode of MODES){
    const s=p.modes[mode]||{},a=byMode[mode];
    a.matches+=s.roundsPlayed||0;a.kills+=s.kills||0;a.wins+=s.wins||0;
    a.damage+=s.damageDealt||0;a.assists+=s.assists||0;
  }
  const states = {matched:0,pending:0,not_found:0,ambiguous:0,other:0};
  for(const r of rosterList){
    if(Object.hasOwn(states,r.status))states[r.status]++;
    else states.other++;
  }
  const lastSync = verified.map(x=>x.updatedAt).filter(Boolean).sort().at(-1)||null;
  return {
    schemaVersion:1,generatedAt:new Date().toISOString(),
    origin:'Supabase verified console statistics',
    roster:{total:rosterList.length,verified:verified.length,states,entries:rosterList},
    totals,platforms:{xbox:verified.filter(x=>x.platform==='xbox').length,
      psn:verified.filter(x=>x.platform==='psn').length},
    lastSync,modeOrder:MODES,modeTotals:byMode,players:verified
  };
}
module.exports = {MODES,shapeWebStats,whitelistStats};
