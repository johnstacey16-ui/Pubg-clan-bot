'use strict';
const { createClient } = require('@supabase/supabase-js');
const MAX_BATCH = 6; // 2 lookups + at most 6 lifetime calls = at most 8 rate-limited calls
const SHARDS = ['xbox', 'psn'];
const MODES = ['solo', 'duo', 'squad', 'solo-fpp', 'duo-fpp', 'squad-fpp'];
const HEADERS = () => ({
  Authorization: 'Bearer ' + process.env.PUBG_API_KEY,
  Accept: 'application/vnd.api+json'
});

async function pubg(path) {
  const result = await fetch('https://api.pubg.com/shards/' + path, {
    headers: HEADERS(),
    signal: AbortSignal.timeout(12000)
  });
  if (result.status === 404) return { data: [] };
  if (!result.ok) {
    const retry = result.headers.get('x-ratelimit-reset') || result.headers.get('retry-after');
    throw new Error('PUBG API HTTP ' + result.status + (retry ? ' (retry after/reset: ' + retry + ')' : ''));
  }
  return result.json();
}
function lifetimeSummary(payload) {
  const stats = payload?.data?.attributes?.gameModeStats || {};
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

  const summary = { status: 'ok', checked: 0, matched: 0, ambiguous: 0, not_found: 0 };
  let statusCode = 200;
  try {
    const pending = await checked(db.from('player_import_queue')
      .select('id,gamertag').eq('status', 'pending').order('id').limit(MAX_BATCH), 'Import queue');
    if (!pending?.length) {
      summary.status = 'completed';
    } else {
      const names = pending.map(p => p.gamertag);
      const matches = {};
      for (const platform of SHARDS) {
        const params = new URLSearchParams({ 'filter[playerNames]': names.join(',') });
        const result = await pubg(platform + '/players?' + params);
        matches[platform] = result.data || [];
      }
      for (const row of pending) {
        const options = SHARDS.map(platform => ({
          platform, player: exactPlayer(matches[platform], row.gamertag)
        })).filter(entry => entry.player);
        if (options.length > 1) {
          await checked(db.from('player_import_queue').update({
            status: 'ambiguous', note: 'Gamertag exists on Xbox and PlayStation; select the correct account',
            checked_at: new Date().toISOString()
          }).eq('id', row.id).select('id'), 'Mark ambiguous');
          summary.ambiguous++;
        } else if (!options.length) {
          await checked(db.from('player_import_queue').update({
            status: 'not_found', note: 'No exact match returned by either console shard',
            checked_at: new Date().toISOString()
          }).eq('id', row.id).select('id'), 'Mark not found');
          summary.not_found++;
        } else {
          const { platform, player } = options[0];
          const accountId = player.id;
          const lifetime = await pubg(platform + '/players/' + encodeURIComponent(accountId) + '/seasons/lifetime');
          const totals = lifetimeSummary(lifetime);
          await checked(db.from('players').upsert({
            gamertag: row.gamertag,
            platform,
            pubg_account_id: accountId,
            total_kills: totals.kills,
            total_wins: totals.wins,
            matches_played: totals.rounds,
            last_checked: new Date().toISOString()
          }, { onConflict: 'gamertag' }).select('id'), 'Save player');
          await checked(db.from('player_import_queue').update({
            status: 'matched', platform, pubg_account_id: accountId,
            checked_at: new Date().toISOString(), note: 'Lifetime stats imported'
          }).eq('id', row.id).select('id'), 'Finish import');
          summary.matched++;
        }
        summary.checked++;
      }
    }
  } catch (error) {
    console.error('PUBG sync error:', error.message);
    summary.status = 'error';
    summary.message = error.message;
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
