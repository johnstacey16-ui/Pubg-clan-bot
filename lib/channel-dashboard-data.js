'use strict';
// Supabase access and clan-only aggregation. No Discord HTTP or rendering.
const { MODES } = require('./pubg-utils');
const int = n => Number(n) || 0;

async function checked(query, description) {
  const r = await query;
  if (r.error) throw new Error(description + ': ' + r.error.message);
  return r.data;
}
async function loadSnapshot(db) {
  const [roster, players, details, records] = await Promise.all([
    db.from('player_import_queue')
      .select('gamertag,is_clan_member,status,platform,pubg_account_id').limit(1000),
    db.from('players')
      .select('id,gamertag,platform,total_kills,total_wins,matches_played,last_checked').limit(1000),
    db.from('player_lifetime_details')
      .select('player_id,game_mode_stats').limit(1000),
    db.from('clan_records')
      .select('record_name,value,holder_gamertag,achieved_date').limit(30)
  ]);
  for (const [name, response] of [['roster',roster],['players',players],['mode stats',details],['records',records]])
    if (response.error) throw new Error('Dashboard '+name+' read failed: '+response.error.message);
  const clan = (roster.data || []).filter(x => x.is_clan_member);
  const verifiedNames = new Set(clan.filter(x => x.status === 'matched')
    .map(x => x.gamertag.toLowerCase()));
  const verified = (players.data || [])
    .filter(p => ['xbox','psn'].includes(p.platform) &&
      verifiedNames.has(p.gamertag.toLowerCase()));
  const ids = new Set(verified.map(x => x.id));
  const totals = verified.reduce((o,p)=>({
    kills:o.kills+int(p.total_kills),
    wins:o.wins+int(p.total_wins),
    matches:o.matches+int(p.matches_played)
  }),{kills:0,wins:0,matches:0});
  const breakdown = Object.fromEntries(MODES.map(m => [m,{rounds:0,kills:0,wins:0,damage:0,assists:0}]));
  for (const row of details.data || []) {
    if (!ids.has(row.player_id)) continue;
    for (const mode of MODES) {
      const m = row.game_mode_stats?.[mode];
      if (!m) continue;
      const total = breakdown[mode];
      total.rounds+=int(m.roundsPlayed);
      total.kills+=int(m.kills);
      total.wins+=int(m.wins);
      total.damage+=int(m.damageDealt);
      total.assists+=int(m.assists);
    }
  }
  const states = clan.reduce((o,row) => {
    o[row.status] = (o[row.status]||0)+1;
    if (row.status === 'pending' && row.pubg_account_id) o.identified++;
    return o;
  },{pending:0,matched:0,ambiguous:0,not_found:0,error:0,identified:0});
  const lastChecked = verified.map(p => Date.parse(p.last_checked||'')).filter(Number.isFinite);
  return {
    clan, verified, tracked:(roster.data||[]).filter(x=>!x.is_clan_member).length,
    states, totals, breakdown, records:records.data||[],
    lastChecked:lastChecked.length?Math.max(...lastChecked):null
  };
}
module.exports = { checked, loadSnapshot };
