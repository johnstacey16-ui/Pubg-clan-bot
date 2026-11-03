'use strict';
const { escapeLike, exactPlayer, lifetimeSummary, gameModeStats } = require('./pubg-utils');

const FRESH_MS = 2 * 60 * 60 * 1000;
const CONSOLE_SHARDS = ['xbox', 'psn'];
const COOLDOWN_MS = 90 * 1000; // shared with the scheduled importer and its rate limit
const LEASE_MS = 65 * 1000;

async function checked(query, label) {
  const result = await query;
  if (result.error) throw new Error(label + ': ' + result.error.message);
  return result.data;
}

async function loadSaved(db, name) {
  const rows = await checked(db.from('players')
    .select('id,gamertag,platform,pubg_account_id,total_kills,total_wins,matches_played,last_checked')
    .ilike('gamertag', escapeLike(name)).limit(20), 'Read saved player');
  return (rows || []).find(p =>
    p.gamertag.toLowerCase() === name.toLowerCase() &&
    CONSOLE_SHARDS.includes(p.platform)) || null;
}

async function readModes(db, id) {
  const data = await checked(db.from('player_lifetime_details')
    .select('game_mode_stats').eq('player_id', id).maybeSingle(), 'Read game modes');
  return data?.game_mode_stats || {};
}

async function findQueue(db, name) {
  const rows = await checked(db.from('player_import_queue')
    .select('id,gamertag,status,checked_at')
    .ilike('gamertag', escapeLike(name)).limit(20), 'Read import queue');
  return (rows || []).find(row => row.gamertag.toLowerCase() === name.toLowerCase()) || null;
}

async function markQueue(db, name, status, platform, accountId, note) {
  const existing = await findQueue(db, name);
  const patch = {
    status, platform: platform || null, pubg_account_id: accountId || null,
    checked_at: new Date().toISOString(), note: note || null
  };
  if (existing) {
    await checked(db.from('player_import_queue').update(patch)
      .eq('id', existing.id).select('id'), 'Update queue');
  } else {
    const result = await db.from('player_import_queue')
      .insert({ gamertag: name, ...patch }).select('id');
    if (result.error && result.error.code !== '23505') throw result.error;
  }
}

async function reserveSlot(db) {
  const now = Date.now();
  const lease = await checked(db.from('pubg_sync_control').update({
    locked_until: new Date(now + LEASE_MS).toISOString(),
    next_run_after: new Date(now + COOLDOWN_MS).toISOString(),
    last_run_at: new Date(now).toISOString()
  }).eq('id', 1)
    .lt('locked_until', new Date(now).toISOString())
    .lt('next_run_after', new Date(now).toISOString())
    .select('id').maybeSingle(), 'Acquire PUBG API slot');
  return Boolean(lease);
}

async function pubg(platform, path, optionalMissing = false) {
  const result = await fetch(
    'https://api.pubg.com/shards/' + platform + '/' + path, {
      headers: { Authorization: 'Bearer ' + process.env.PUBG_API_KEY,
        Accept: 'application/vnd.api+json' },
      signal: AbortSignal.timeout(10000)
    });
  if (result.status === 404 && optionalMissing) return { data: [] };
  if (!result.ok) throw new Error('PUBG API returned HTTP ' + result.status);
  return result.json();
}

async function saveLifetime(db, existing, name, platform, accountId, payload) {
  const totals = lifetimeSummary(payload);
  const timestamp = new Date().toISOString();
  const saved = await checked(db.from('players').upsert({
    gamertag: existing?.gamertag || name, platform, pubg_account_id: accountId,
    total_kills: totals.kills, total_wins: totals.wins,
    matches_played: totals.rounds, last_checked: timestamp
  }, { onConflict: 'gamertag' })
    .select('id,gamertag,platform,pubg_account_id,total_kills,total_wins,matches_played,last_checked')
    .single(), 'Store player stats');
  await checked(db.from('player_lifetime_details').upsert({
    player_id: saved.id, platform,
    game_mode_stats: gameModeStats(payload), updated_at: timestamp
  }, { onConflict: 'player_id' }).select('player_id'), 'Store lifetime modes');
  await markQueue(db, name, 'matched', platform, accountId, 'Saved verified lifetime statistics');
  return saved;
}

async function getStats(db, suppliedName) {
  const name = String(suppliedName || '').trim();
  // A comma would unintentionally turn the playerNames parameter into a multi-account search.
  if (!name || name.length > 100 || name.includes(','))
    return { state: 'invalid', message: 'Enter a valid single PUBG gamertag.' };

  let saved = await loadSaved(db, name);
  const lastCheck = saved?.last_checked ? new Date(saved.last_checked).getTime() : 0;
  if (saved && Date.now() - lastCheck < FRESH_MS) {
    return { state: 'player', source: 'cache', player: saved,
      modes: await readModes(db, saved.id) };
  }

  let queue = await findQueue(db, name);
  const lastTry = queue?.checked_at ? new Date(queue.checked_at).getTime() : 0;
  if (!saved && lastTry && Date.now() - lastTry < FRESH_MS
    && ['ambiguous', 'not_found'].includes(queue.status)) {
    return { state: queue.status };
  }

  if (!process.env.PUBG_API_KEY) {
    if (saved) return { state: 'player', source: 'stale', player: saved,
      modes: await readModes(db, saved.id), message: 'Live refresh is not configured' };
    return { state: 'unavailable', message: 'PUBG API is not configured.' };
  }

  // An atomic Supabase lease means two serverless functions cannot spend the
  // same PUBG rate-limit allowance. The scheduled importer uses the same lease.
  const acquired = await reserveSlot(db);
  if (!acquired) {
    if (saved) return { state: 'player', source: 'stale', player: saved,
      modes: await readModes(db, saved.id), message: 'Live refresh currently rate-limited' };
    if (!queue) await markQueue(db, name, 'pending', null, null, 'Queued for API availability');
    return { state: 'queued' };
  }

  const result = { kind: 'on_demand', name: name.slice(0, 100) };
  try {
    let platform = saved?.platform;
    let id = saved?.pubg_account_id;
    if (!platform || !id) {
      const matches = [];
      for (const shard of CONSOLE_SHARDS) {
        const filter = new URLSearchParams({ 'filter[playerNames]': name });
        const response = await pubg(shard, 'players?' + filter.toString(), true);
        const account = exactPlayer(response.data, name);
        if (account) matches.push({ platform: shard, id: account.id });
      }
      if (matches.length !== 1) {
        const state = matches.length > 1 ? 'ambiguous' : 'not_found';
        await markQueue(db, name, state, null, null, state === 'ambiguous'
          ? 'Name exists on both consoles; platform confirmation required'
          : 'No exact Xbox or PlayStation match');
        result.state = state;
        return { state };
      }
      platform = matches[0].platform;
      id = matches[0].id;
    }

    const lifetime = await pubg(platform,
      'players/' + encodeURIComponent(id) + '/seasons/lifetime');
    const player = await saveLifetime(db, saved, name, platform, id, lifetime);
    result.state = 'refreshed';
    return { state: 'player', source: 'live', player,
      modes: gameModeStats(lifetime) };
  } catch (error) {
    console.error('PUBG live lookup failed:', error.message);
    result.state = 'error';
    if (saved) return { state: 'player', source: 'stale', player: saved,
      modes: await readModes(db, saved.id), message: 'Live refresh failed' };
    await markQueue(db, name, 'error', null, null, 'Retry after temporary PUBG API error');
    return { state: 'unavailable', message: 'PUBG lookup was unsuccessful. It is queued for retry.' };
  } finally {
    await db.from('pubg_sync_control').update({
      locked_until: new Date().toISOString(), last_result: result
    }).eq('id', 1);
  }
}
module.exports = { getStats, FRESH_MS };
