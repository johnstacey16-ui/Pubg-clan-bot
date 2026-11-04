'use strict';
const { exactPlayer, lifetimeSummary, gameModeStats } = require('./pubg-utils');

const SHARDS = ['xbox', 'psn'];
const MAX_NAMES = 10;
const MAX_STATS = 6;
const MAX_LEASE_MS = 60 * 1000;

async function checked(query, label) {
  const result = await query;
  if (result.error) throw new Error(label + ': ' + result.error.message);
  return result.data;
}

async function pubg(platform, path, allowNotFound = false) {
  const response = await fetch('https://api.pubg.com/shards/' + platform + '/' + path, {
    headers: {
      Authorization: 'Bearer ' + process.env.PUBG_API_KEY,
      Accept: 'application/vnd.api+json'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (response.status === 404 && allowNotFound) return { data: [] };
  if (!response.ok) throw new Error('PUBG API returned HTTP ' + response.status);
  return response.json();
}

async function markQueue(db, row, patch) {
  await checked(db.from('player_import_queue').update({
    ...patch, checked_at: new Date().toISOString()
  }).eq('id', row.id).select('id'), 'Save roster import state');
}

async function reserveBudget(db, requested) {
  // Leave room for /stats. Reserve only actual requests, not one request
  // for every name returned by a batch query.
  for (let n = Math.min(requested, 8); n >= 1; n--) {
    if (await checked(db.rpc('reserve_pubg_background_requests', { p_count: n }),
      'Check shared PUBG request budget')) return n;
  }
  return 0;
}

async function identifyAccounts(db, summary, limit) {
  const rows = await checked(db.from('player_import_queue')
    .select('id,gamertag').eq('status', 'pending').eq('is_clan_member', true)
    .is('pubg_account_id', null)
    .order('id', { ascending: true }).limit(Math.min(MAX_NAMES, limit)),
  'Read unverified roster names');
  if (!rows?.length) return false;
  if (!await checked(db.rpc('reserve_pubg_background_requests', { p_count: 2 }),
    'Reserve two console lookup requests')) {
    summary.rate_limited = true;
    return false;
  }

  let matches;
  try {
    const names = rows.map(row => row.gamertag).join(',');
    const results = await Promise.all(SHARDS.map(platform => {
      const query = new URLSearchParams({ 'filter[playerNames]': names });
      return pubg(platform, 'players?' + query.toString(), true);
    }));
    matches = SHARDS.map((platform, i) => ({
      platform, data: results[i].data || []
    }));
  } catch (error) {
    summary.errors++;
    summary.lookup_error = true;
    console.error('PUBG batch account lookup failed:', error.message);
    return false; // Keep names pending; never convert an API failure into "not found".
  }

  for (const row of rows) {
    try {
      const options = matches.map(m => ({
        platform: m.platform, player: exactPlayer(m.data, row.gamertag)
      })).filter(option => option.player);
      if (options.length > 1) {
        await markQueue(db, row, {
          status: 'ambiguous', note: 'Name exists on both Xbox and PlayStation'
        });
        summary.ambiguous++;
      } else if (!options.length) {
        await markQueue(db, row, {
          status: 'not_found', note: 'No exact Xbox or PlayStation name match'
        });
        summary.not_found++;
      } else {
        const account = options[0];
        await markQueue(db, row, {
          status: 'pending', platform: account.platform,
          pubg_account_id: account.player.id,
          note: 'Console account identified; lifetime stats pending'
        });
        summary.identified++;
      }
    } catch (error) {
      console.error('Cannot save account identity:', row.id, error.message);
      summary.errors++;
    }
  }
  summary.names_checked += rows.length;
  return true;
}

async function getLifetime(db, row) {
  const lifetime = await pubg(row.platform,
    'players/' + encodeURIComponent(row.pubg_account_id) + '/seasons/lifetime');
  const totals = lifetimeSummary(lifetime);
  const savedAt = new Date().toISOString();

  // Do not fabricate zeros or add unfinished accounts to the ranked table.
  // A failed stats request stays pending with its verified PUBG account ID.
  const saved = await checked(db.from('players').upsert({
    gamertag: row.gamertag, platform: row.platform,
    pubg_account_id: row.pubg_account_id,
    total_kills: totals.kills, total_wins: totals.wins,
    matches_played: totals.rounds, last_checked: savedAt
  }, { onConflict: 'gamertag' }).select('id').single(), 'Save player lifetime stats');
  await checked(db.from('player_lifetime_details').upsert({
    player_id: saved.id, platform: row.platform,
    game_mode_stats: gameModeStats(lifetime),
    updated_at: savedAt
  }, { onConflict: 'player_id' }).select('player_id'), 'Save detailed lifetime stats');
  await markQueue(db, row, {
    status: 'matched', note: 'Verified Xbox/PSN lifetime statistics saved'
  });
}

async function hydrateAccounts(db, summary) {
  const rows = await checked(db.from('player_import_queue')
    .select('id,gamertag,platform,pubg_account_id')
    .eq('status', 'pending').eq('is_clan_member', true).not('pubg_account_id', 'is', null)
    .order('id', { ascending: true }).limit(MAX_STATS),
  'Read identified accounts awaiting statistics');
  if (!rows?.length) return;
  const budget = await reserveBudget(db, rows.length);
  if (!budget) {
    summary.rate_limited = true;
    return;
  }
  const attempted = rows.slice(0, budget);
  const results = await Promise.all(attempted.map(async row => {
    if (!SHARDS.includes(row.platform) || !row.pubg_account_id) return 'skipped';
    try {
      await getLifetime(db, row);
      return 'matched';
    } catch (error) {
      console.error('Could not import player lifetime stats:', row.id, error.message);
      return 'error';
    }
  }));
  summary.stats_attempted += attempted.length;
  for (const status of results) {
    if (status === 'matched') summary.matched++;
    else if (status === 'error') summary.errors++;
  }
}

async function importPendingBatch(db, limit = MAX_NAMES) {
  const summary = {
    status: 'no_work', names_checked: 0, identified: 0,
    stats_attempted: 0, matched: 0,
    ambiguous: 0, not_found: 0, errors: 0
  };
  if (!process.env.PUBG_API_KEY) {
    summary.status = 'api_unconfigured';
    return summary;
  }

  const now = Date.now();
  // Prevent two Discord leaderboard invocations importing the same queue rows.
  // /stats remains independent but shares the same atomic request budget.
  const lock = await checked(db.from('pubg_sync_control').update({
    locked_until: new Date(now + MAX_LEASE_MS).toISOString()
  }).eq('id', 1)
    .lt('locked_until', new Date(now).toISOString())
    .select('id').maybeSingle(), 'Claim roster import');
  if (!lock) {
    summary.status = 'busy';
    return summary;
  }

  try {
    await identifyAccounts(db, summary,
      Math.min(MAX_NAMES, Math.max(1, Number(limit) || MAX_NAMES)));
    await hydrateAccounts(db, summary);
    summary.status = summary.errors ? 'partial' :
      summary.rate_limited ? 'rate_limited' :
      summary.identified || summary.matched || summary.ambiguous || summary.not_found ?
        'processed' : 'no_work';
    return summary;
  } finally {
    try {
      await checked(db.from('pubg_sync_control').update({
        locked_until: new Date(0).toISOString(),
        last_result: summary, last_run_at: new Date().toISOString()
      }).eq('id', 1).select('id'), 'Release roster import');
    } catch (error) {
      console.error('Could not release roster import lock:', error.message);
    }
  }
}

module.exports = { importPendingBatch };
