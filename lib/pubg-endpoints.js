'use strict';

// API cache shared between all Vercel function instances.
// The SQL rate budget is atomic across /stats, /leaderboard and new commands.
const SHARDS = new Set(['xbox', 'psn']);
const REGION_SHARDS=new Set([
 'xbox-as','xbox-eu','xbox-na','xbox-oc','xbox-sa',
 'psn-as','psn-eu','psn-na','psn-oc'
]);
async function checked(q, name) {
  const r = await q;
  if (r.error) throw new Error(name + ': ' + r.error.message);
  return r.data;
}
async function fetchJson(shard, path, free = false) {
  if (!SHARDS.has(shard) && !REGION_SHARDS.has(shard) && !(free && shard === 'console'))
    throw new Error('Unsupported PUBG shard');
  const response = await fetch('https://api.pubg.com/shards/' + shard + '/' + path, {
    headers: {
      Accept: 'application/vnd.api+json',
      ...(free ? {} : { Authorization: 'Bearer ' + process.env.PUBG_API_KEY })
    },
    signal: AbortSignal.timeout(10000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('PUBG API HTTP ' + response.status);
  return response.json();
}
async function cachedEndpoint(db, shard, path, seconds, opts = {}) {
  const key = 'pubg:v1:' + shard + '/' + path;
  if (key.length > 320) throw new Error('Invalid cache key');
  const cached = await checked(db.from('pubg_endpoint_cache')
    .select('payload,expires_at').eq('cache_key', key).maybeSingle(), 'Read cached PUBG endpoint');
  if (cached && !opts.force && Date.parse(cached.expires_at) > Date.now())
    return { state: 'cached', data: cached.payload };
  if (!opts.free) {
    if (!process.env.PUBG_API_KEY) return cached
      ? { state: 'stale', data: cached.payload }
      : { state: 'unavailable' };
    const budgetRpc = opts.background ? 'reserve_pubg_background_requests' : 'reserve_pubg_requests';
    const allowed = await checked(db.rpc(budgetRpc, { p_count: 1 }),
      'Reserve PUBG API request');
    if (!allowed) return cached
      ? { state: 'stale', data: cached.payload }
      : { state: 'rate_limited' };
  }
  try {
    const data = await fetchJson(shard, path, opts.free);
    if (!data) return { state: 'not_found' };
    // The cache is for real PUBG responses, not synthetic stats.
    await checked(db.from('pubg_endpoint_cache').upsert({
      cache_key: key, payload: data,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + seconds * 1000).toISOString()
    }, { onConflict: 'cache_key' }).select('cache_key'), 'Store PUBG API cache');
    return { state: 'fresh', data };
  } catch (error) {
    console.error('PUBG request failed:', shard, path.split('?')[0], error.message);
    if (cached) return { state: 'stale', data: cached.payload };
    return { state: 'unavailable' };
  }
}
const validId = id => /^[a-zA-Z0-9._-]{8,160}$/.test(String(id));
function playerEndpoint(db, player, suffix, ttl = 2 * 60 * 60, opts = {}) {
  if (!player || !SHARDS.has(player.platform) || !validId(player.pubg_account_id))
    return Promise.resolve({ state: 'invalid' });
  return cachedEndpoint(db, player.platform,
    'players/' + encodeURIComponent(player.pubg_account_id) + (suffix ? '/' + suffix : ''), ttl, opts);
}
async function currentSeason(db, platform) {
  const seasons = await cachedEndpoint(db, platform, 'seasons', 30 * 24 * 3600);
  if (!seasons.data) return seasons;
  const current = (seasons.data.data || []).find(x => x?.attributes?.isCurrentSeason &&
    !x?.attributes?.isOffseason) ||
    (seasons.data.data || []).find(x => x?.attributes?.isCurrentSeason);
  if (!current?.id) return { state: 'not_found' };
  return { state: seasons.state, seasonId: current.id };
}
function matchEndpoint(db, id) {
  if (!/^[a-zA-Z0-9-]{12,90}$/.test(String(id))) return Promise.resolve({ state: 'invalid' });
  // Matches use the combined console shard and are not counted against PUBG's API limit.
  // Completed match records do not change; persist cache for a month.
  return cachedEndpoint(db, 'console', 'matches/' + encodeURIComponent(id), 30 * 24 * 3600, { free: true });
}
module.exports = { cachedEndpoint, playerEndpoint, currentSeason, matchEndpoint };
