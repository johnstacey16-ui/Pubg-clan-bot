'use strict';
const { createClient } = require('@supabase/supabase-js');
const MAX_BATCH = 6; // 2 lookups + at most 6 lifetime calls = at most 8 rate-limited calls
const SHARDS = ['xbox', 'psn'];
const MODES = ['solo', 'duo', 'squad', 'solo-fpp', 'duo-fpp', 'squad-fpp'];
const HEADERS = () => ({
  Authorization: 'Bearer ' + process.env.PUBG_API_KEY,
  Accept: 'application/vnd.api+json'
});

async function pubg(path, allowNotFound = false) {
  const result = await fetch('https://api.pubg.com/shards/' + path, {
    headers: HEADERS(),
    signal: AbortSignal.timeout(12000)
  });
  if (result.status === 404 && allowNotFound) return { data: [] };
  if (!result.ok) {
    const retry = result.headers.get('x-ratelimit-reset') || result.headers.get('retry-after');
    throw new Error('PUBG API HTTP ' + result.status + (retry ? ' (retry after/reset: ' + retry + ')' : ''));
  }
  return result.json();
}
function lifetimeSummary(payload) {
  const stats = payload?.data?.attributes?.gameModeStats;
  if (!stats || typeof stats !== 'object') throw new Error('PUBG lifetime statistics unavailable');
  return MODES.reduce((totals, mode) => {
    const item = stats[mode] || {};
    totals.kills += Number(item.kills) || 0;
    totals.wins += Number(item.wins) || 0;
    totals.rounds += Number(item.roundsPlayed) || 0;
    return totals;
  }, { kills: 0, wins: 0, rounds: 0 });
}
function dbClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
async function checked(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(label + ': ' + result.error.message);
  return result.data;
}
async function saveLifetimeDetails(db, playerId, platform, lifetime) {
  const modes = lifetime?.data?.attributes?.gameModeStats;
  if (!modes || typeof modes !== 'object' || Array.isArray(modes))
    throw new Error('Invalid PUBG lifetime game-mode response');
  await checked(db.from('player_lifetime_details').upsert({
    player_id: playerId,
    platform,
    game_mode_stats: modes,
    updated_at: new Date().toISOString()
  }, { onConflict: 'player_id' }).select('player_id'), 'Save game-mode details');
}
function exactPlayer(list, gamertag) {
  return (list || []).find(item => item?.attributes?.name?.toLowerCase() === gamertag.toLowerCase());
}
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  if (!secret || !process.env.PUBG_API_KEY || !process.env.SUPABASE_SERVICE_KEY || !process.env.SUPABASE_URL)
    return res.status(503).json({ error: 'Sync environment is not configured' });
  if (req.headers.authorization !== 'Bearer ' + secret)
    return res.status(401).json({ error: 'Unauthorized' });

  const db = dbClient();
  const now = Date.now();
  // Atomic database lease: separate function instances cannot claim simultaneously,
  // and back-to-back runs must wait at least 90 seconds to respect the PUBG API budget.
  let lease;
  try {
    lease = await checked(db.from('pubg_sync_control').update({
      locked_until: new Date(now + 3 * 60_000).toISOString(),
      next_run_after: new Date(now + 90_000).toISOString(),
      last_run_at: new Date(now).toISOString()
    }).eq('id', 1).lt('locked_until', new Date(now).toISOString())
      .lt('next_run_after', new Date(now).toISOString()).select('id').maybeSingle(), 'Sync lease');
  } catch (error) {
    console.error('Sync lease failed:', error.message);
    return res.status(500).json({ error: 'Could not acquire sync lease' });
  }
  if (!lease) return res.status(200).json({ status: 'throttled', message: 'Another sync is active or the 90-second cooldown has not elapsed' });

  const summary = { status: 'ok', checked: 0, matched: 0, ambiguous: 0, not_found: 0, errors: 0, refreshed: 0 };
  let statusCode = 200;
  try {
    let pending = await checked(db.from('player_import_queue')
      .select('id,gamertag').eq('status', 'pending').order('id').limit(MAX_BATCH), 'Import queue');
    if (!pending?.length) {
      // Retry temporary failures only after a full day. Avoid continually retrying
      // the same failed account inside one invocation or starving new players.
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      pending = await checked(db.from('player_import_queue')
        .select('id,gamertag').eq('status', 'error')
        .lt('checked_at', cutoff).order('checked_at').limit(MAX_BATCH), 'Failed import retries');
    }
    if (!pending?.length) {
      // Once the initial import finishes, refresh the oldest verified accounts daily.
      const old = await checked(db.from('players')
        .select('id,platform,pubg_account_id,last_checked')
        .not('pubg_account_id', 'is', null)
        .order('last_checked', { ascending: true, nullsFirst: true })
        .limit(MAX_BATCH), 'Refresh candidates');
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const player of old || []) {
        if (player.last_checked && new Date(player.last_checked).getTime() > cutoff) continue;
        if (!SHARDS.includes(player.platform)) continue;
        try {
          const data = await pubg(player.platform + '/players/' +
            encodeURIComponent(player.pubg_account_id) + '/seasons/lifetime');
          const totals = lifetimeSummary(data);
          await checked(db.from('players').update({
            total_kills: totals.kills, total_wins: totals.wins,
            matches_played: totals.rounds, last_checked: new Date().toISOString()
          }).eq('id', player.id).select('id'), 'Refresh player');
          await saveLifetimeDetails(db, player.id, player.platform, data);
          summary.refreshed++;
        } catch (error) {
          if (/HTTP 429/.test(error.message)) throw error;
          console.error('Player refresh failed:', player.id, error.message);
          summary.errors++;
        }
      }
      summary.status = summary.errors ? 'partial' : 'completed';
    } else {
      const names = pending.map(p => p.gamertag);
      const matches = {};
      for (const platform of SHARDS) {
        const params = new URLSearchParams({ 'filter[playerNames]': names.join(',') });
        const result = await pubg(platform + '/players?' + params, true);
        matches[platform] = result.data || [];
      }
      for (const row of pending) {
        try {
          const options = SHARDS.map(platform => ({
            platform, player: exactPlayer(matches[platform], row.gamertag)
          })).filter(entry => entry.player);
          if (options.length > 1) {
            await checked(db.from('player_import_queue').update({
              status: 'ambiguous',
              note: 'Exact gamertag found on Xbox and PlayStation; manual selection required',
              checked_at: new Date().toISOString()
            }).eq('id', row.id).select('id'), 'Mark ambiguous');
            summary.ambiguous++;
          } else if (!options.length) {
            await checked(db.from('player_import_queue').update({
              status: 'not_found', note: 'No exact match returned by Xbox or PlayStation',
              checked_at: new Date().toISOString()
            }).eq('id', row.id).select('id'), 'Mark not found');
            summary.not_found++;
          } else {
            const { platform, player } = options[0];
            const lifetime = await pubg(platform + '/players/' +
              encodeURIComponent(player.id) + '/seasons/lifetime');
            const totals = lifetimeSummary(lifetime);
            const saved = await checked(db.from('players').upsert({
              gamertag: row.gamertag, platform,
              pubg_account_id: player.id,
              total_kills: totals.kills, total_wins: totals.wins,
              matches_played: totals.rounds,
              last_checked: new Date().toISOString()
            }, { onConflict: 'gamertag' }).select('id').single(), 'Save player');
            await saveLifetimeDetails(db, saved.id, platform, lifetime);
            await checked(db.from('player_import_queue').update({
              status: 'matched', platform, pubg_account_id: player.id,
              checked_at: new Date().toISOString(), note: 'Lifetime stats imported'
            }).eq('id', row.id).select('id'), 'Finish import');
            summary.matched++;
          }
        } catch (error) {
          if (/HTTP 429/.test(error.message)) throw error;
          console.error('Player import failed:', row.id, error.message);
          summary.errors++;
          try {
            await checked(db.from('player_import_queue').update({
              status: 'error', note: String(error.message).slice(0, 300),
              checked_at: new Date().toISOString()
            }).eq('id', row.id).select('id'), 'Mark failed');
          } catch (markError) { console.error('Could not mark import failure:', markError.message); }
        }
        summary.checked++;
      }
      if (summary.errors) summary.status = 'partial';
    }
  } catch (error) {
    console.error('PUBG sync error:', error.message);
    summary.status = 'error';
    summary.message = String(error.message).slice(0, 250);
    statusCode = 502;
  } finally {
    try {
      await checked(db.from('pubg_sync_control').update({
        locked_until: new Date().toISOString(), last_result: summary
      }).eq('id', 1).select('id'), 'Release lease');
    } catch (error) { console.error('Sync lease release failed:', error.message); }
  }
  return res.status(statusCode).json(summary);
};
