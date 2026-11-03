'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getStats } = require('../lib/live-stats');

function fakeDatabase() {
  const tables = {
    players: [], player_import_queue: [], player_lifetime_details: []
  };
  const reservations = [];
  let callsAllowed = 8;
  let nextId = 1;
  function query(table) {
    const conditions = [];
    let mode = 'read', patch;
    return {
      select() { return this; },
      ilike(field, value) {
        const exact = value.replace(/\\_/g, '_').replace(/\\%/g, '%');
        conditions.push(row => String(row[field]).toLowerCase() === exact.toLowerCase());
        return this;
      },
      eq(field, value) {
        conditions.push(row => row[field] === value);
        return this;
      },
      limit(n) { return Promise.resolve(result(n)); },
      single() { return Promise.resolve(result(null, true)); },
      maybeSingle() { return Promise.resolve(result(null, true)); },
      insert(data) { mode = 'insert'; patch = data; return this; },
      update(data) { mode = 'update'; patch = data; return this; },
      upsert(data) { mode = 'upsert'; patch = data; return this; },
      then(ok, fail) { return Promise.resolve(result()).then(ok, fail); },
      result,
    };
    function result(limit = null, single = false) {
      let rows = tables[table].filter(row => conditions.every(condition => condition(row)));
      if (mode === 'update') rows.forEach(row => Object.assign(row, patch));
      if (mode === 'upsert' || mode === 'insert') {
        const conflictKey = table === 'players' ? 'gamertag'
          : table === 'player_lifetime_details' ? 'player_id' : 'gamertag';
        let row = mode === 'upsert'
          ? tables[table].find(item => item[conflictKey] === patch[conflictKey])
          : null;
        if (!row) {
          row = { id: nextId++ };
          tables[table].push(row);
        }
        Object.assign(row, patch);
        rows = [row];
      }
      if (limit !== null) rows = rows.slice(0, limit);
      return { data: single ? (rows[0] || null) : rows.map(row => ({ ...row })), error: null };
    }
  }
  return {
    tables,
    reservations,
    setAllowance(n) { callsAllowed = n; },
    from: query,
    rpc(name, options) {
      assert.equal(name, 'reserve_pubg_requests');
      reservations.push(options.p_count);
      const approved = options.p_count <= callsAllowed;
      if (approved) callsAllowed -= options.p_count;
      return Promise.resolve({ data: approved, error: null });
    }
  };
}

test('cached console stats avoid both the PUBG API and rate-budget calls', async () => {
  const db = fakeDatabase();
  db.tables.players.push({
    id: 2, gamertag: 'Mralex_00', platform: 'xbox', pubg_account_id: 'saved-id',
    total_kills: 3, total_wins: 1, matches_played: 2,
    last_checked: new Date().toISOString()
  });
  let requests = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => { requests++; throw Error('should not fetch'); };
  try {
    const result = await getStats(db, 'mralex_00');
    assert.equal(result.source, 'cache');
    assert.equal(requests, 0);
    assert.deepEqual(db.reservations, []);
  } finally { global.fetch = originalFetch; }
});

test('first console lookup reserves three calls, stores stats, then caches', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.PUBG_API_KEY;
  process.env.PUBG_API_KEY = 'unit-test-placeholder';
  const db = fakeDatabase();
  const urls = [];
  global.fetch = async url => {
    urls.push(String(url));
    if (String(url).includes('xbox/players?')) return {
      ok: true, json: async () => ({
        data: [{ id: 'account-11', attributes: { name: 'SomeNewPlayer' } }]
      })
    };
    if (String(url).includes('psn/players?')) return {
      ok: true, json: async () => ({ data: [] })
    };
    return {
      ok: true, json: async () => ({ data: { attributes: { gameModeStats: {
        squad: { roundsPlayed: 7, kills: 17, wins: 2 }
      } } } })
    };
  };
  try {
    const first = await getStats(db, 'SomeNewPlayer');
    const second = await getStats(db, 'SomeNewPlayer');
    assert.equal(first.source, 'live');
    assert.equal(second.source, 'cache');
    assert.deepEqual(db.reservations, [3]);
    assert.equal(urls.length, 3);
    assert.equal(db.tables.players[0].total_kills, 17);
    assert.equal(db.tables.player_lifetime_details.length, 1);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBG_API_KEY;
    else process.env.PUBG_API_KEY = originalKey;
  }
});

test('exhausted API budget queues a new player without calling PUBG', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.PUBG_API_KEY;
  process.env.PUBG_API_KEY = 'unit-test-placeholder';
  const db = fakeDatabase();
  db.setAllowance(1);
  let fetchCount = 0;
  global.fetch = async () => { fetchCount++; throw Error('must not fetch'); };
  try {
    const result = await getStats(db, 'WaitingPlayer');
    assert.equal(result.state, 'queued');
    assert.deepEqual(db.reservations, [3]);
    assert.equal(fetchCount, 0);
    assert.equal(db.tables.player_import_queue[0].status, 'pending');
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBG_API_KEY;
    else process.env.PUBG_API_KEY = originalKey;
  }
});
