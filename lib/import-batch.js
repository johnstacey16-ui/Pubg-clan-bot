'use strict';
const { exactPlayer, lifetimeSummary, gameModeStats } = require('./pubg-utils');

const SHARDS = ['xbox', 'psn'];
const MAX_BATCH = 6; // Two name lookups + at most six lifetime reads = eight API calls.
async function checked(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(label + ': ' + result.error.message);
  return result.data;
}
async function pubg(shard, path, optional404 = false) {
  const response = await fetch('https://api.pubg.com/shards/' + shard + '/' + path, {
    headers: {
      Authorization: 'Bearer ' + process.env.PUBG_API_KEY,
      Accept: 'application/vnd.api+json'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (response.status === 404 && optional404) return { data: [] };
  if (!response.ok) throw new Error('PUBG API returned HTTP ' + response.status);
  return response.json();
}
async function markQueue(db, row, fields) {
  await checked(db.from('player_import_queue').update({
    ...fields, checked_at: new Date().toISOString()
  }).eq('id', row.id).select('id'), 'Update player import');
}
async function importOne(db, row, accounts) {
  const choices = SHARDS.map(platform => ({
    platform, player: exactPlayer(accounts[platform], row.gamertag)
  })).filter(choice => choice.player);
  if (choices.length !== 1) {
    const state = choices.length ? 'ambiguous' : 'not_found';
    await markQueue(db, row, {
      status: state,
      note: choices.length ? 'Found on both Xbox and PlayStation; select a platform'
        : 'No exact Xbox or PlayStation player returned'
    });
    return state;
  }
  const { platform, player } = choices[0];
  const lifetime = await pubg(platform,
    'players/' + encodeURIComponent(player.id) + '/seasons/lifetime');
  const totals = lifetimeSummary(lifetime);
  const modes = gameModeStats(lifetime);
  const lastChecked = new Date().toISOString();
  // A manually searched account may already exist. Do not replace its identity
  // without resolving a collision; upsert only the exact supplied gamertag.
  const saved = await checked(db.from('players').upsert({
    gamertag: row.gamertag, platform, pubg_account_id: player.id,
    total_kills: totals.kills, total_wins: totals.wins,
    matches_played: totals.rounds, last_checked: lastChecked
  }, { onConflict: 'gamertag' }).select('id').single(), 'Save verified player');
  await checked(db.from('player_lifetime_details').upsert({
    player_id: saved.id, platform, game_mode_stats: modes,
    updated_at: lastChecked
  }, { onConflict: 'player_id' }).select('player_id'), 'Save lifetime details');
  await markQueue(db, row, {
    status: 'matched', platform, pubg_account_id: player.id,
    note: 'Verified console account and lifetime stats imported'
  });
  return 'matched';
}
async function importPendingBatch(db, limit = MAX_BATCH) {
  const result = {
    status: 'no_work', attempted: 0, matched: 0,
    ambiguous: 0, not_found: 0, errors: 0
  };
  if (!process.env.PUBG_API_KEY) {
    result.status = 'api_unconfigured';
    return result;
  }
  const batchSize = Math.min(MAX_BATCH, Math.max(1, Number(limit) || MAX_BATCH));
  const rows = await checked(db.from('player_import_queue')
    .select('id,gamertag').eq('status', 'pending')
    .order('id', { ascending: true }).limit(batchSize), 'Read pending players');
  if (!rows?.length) return result;

  // Atomically reserve enough budget for the worst-case number of API calls.
  // Other Discord searches and the cron use the same Supabase reservation RPC.
  const allowed = await checked(db.rpc('reserve_pubg_requests', {
    p_count: rows.length + SHARDS.length
  }), 'Reserve PUBG API capacity');
  if (!allowed) {
    result.status = 'rate_limited';
    return result;
  }

  result.status = 'processed';
  const names = rows.map(row => row.gamertag);
  let accounts;
  try {
    const outputs = await Promise.all(SHARDS.map(shard => {
      const params = new URLSearchParams({ 'filter[playerNames]': names.join(',') });
      return pubg(shard, 'players?' + params.toString(), true);
    }));
    accounts = Object.fromEntries(SHARDS.map((shard, i) => [shard, outputs[i].data || []]));
  } catch (error) {
    console.error('Console batch search failed:', error.message);
    result.status = 'lookup_failed';
    return result; // keep pending for retry; no false "not found" results
  }

  // Run the individual lifetime requests concurrently to finish well within
  // Discord's deferred-interaction window. Errors are isolated per player.
  const statuses = await Promise.all(rows.map(async row => {
    try {
      return await importOne(db, row, accounts);
    } catch (error) {
      console.error('Could not import console player:', row.id, error.message);
      // Keep the account pending after a temporary API/database failure.
      return 'error';
    }
  }));
  result.attempted = rows.length;
  for (const state of statuses) {
    if (state === 'error') result.errors++;
    else result[state]++;
  }
  if (result.errors) result.status = 'partial';
  return result;
}
module.exports = { importPendingBatch };
