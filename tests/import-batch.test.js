'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { importPendingBatch } = require('../lib/import-batch');

function fakeDatabase(size = 10) {
  const dbRows = {
    players: [],
    player_lifetime_details: [],
    player_import_queue: Array.from({ length: size }, (_, i) => ({
      id: i + 1, gamertag: 'Mock' + i, status: 'pending', is_clan_member: true,
      pubg_account_id: null, platform: null
    })),
    pubg_sync_control: [{ id: 1, locked_until: '1970-01-01T00:00:00.000Z' }]
  };
  const reservations = [];
  let remaining = 8;
  let nextId = 1000;
  const db = {
    tables: dbRows,
    reservations,
    refill(value = 8) { remaining = value; },
    rpc(name, args) {
      assert.equal(name, 'reserve_pubg_background_requests');
      const count = args.p_count;
      const allowed = count <= remaining;
      reservations.push({ count, allowed });
      if (allowed) remaining -= count;
      return Promise.resolve({ data: allowed, error: null });
    },
    from(table) {
      const conditions = [];
      let mode = 'read', patch = null;
      const chain = {
        select() { return this; },
        eq(key, value) {
          conditions.push(row => row[key] === value);
          return this;
        },
        is(key, value) {
          conditions.push(row => (row[key] ?? null) === value);
          return this;
        },
        not(key, op, value) {
          assert.equal(op, 'is');
          conditions.push(row => (row[key] ?? null) !== value);
          return this;
        },
        lt(key, value) {
          conditions.push(row => row[key] < value);
          return this;
        },
        order() { return this; },
        limit(sizeLimit) { return Promise.resolve(run(false, sizeLimit)); },
        update(next) { mode = 'update'; patch = next; return this; },
        upsert(next) { mode = 'upsert'; patch = next; return this; },
        single() { return Promise.resolve(run(true)); },
        maybeSingle() { return Promise.resolve(run(true)); },
        then(ok, fail) { return Promise.resolve(run()).then(ok, fail); }
      };
      function run(one = false, limit = null) {
        let rows = dbRows[table].filter(row => conditions.every(check => check(row)));
        if (limit !== null) rows = rows.slice(0, limit);
        if (mode === 'update') rows.forEach(row => Object.assign(row, patch));
        if (mode === 'upsert') {
          const key = table === 'players' ? 'gamertag' : 'player_id';
          let row = dbRows[table].find(item => item[key] === patch[key]);
          if (!row) {
            row = { id: nextId++ };
            dbRows[table].push(row);
          }
          Object.assign(row, patch);
          rows = [row];
        }
        return {
          data: one ? (rows[0] || null) : rows.map(row => ({ ...row })),
          error: null
        };
      }
      return chain;
    }
  };
  return db;
}

test('ten mixed-unknown names use two platform searches and save six lifetime records', async () => {
  const db = fakeDatabase();
  const requests = [];
  const originalFetch = global.fetch;
  const originalKey = process.env.PUBG_API_KEY;
  process.env.PUBG_API_KEY = 'test-placeholder';
  global.fetch = async url => {
    requests.push(String(url));
    if (String(url).includes('/players?')) {
      return {
        ok: true, json: async () => ({
          data: String(url).includes('/xbox/')
            ? Array.from({ length: 10 }, (_, i) => ({
                id: 'acc' + i, attributes: { name: 'Mock' + i }
              })) : []
        })
      };
    }
    return {
      ok: true, json: async () => ({
        data: { attributes: { gameModeStats: {
          squad: { kills: 25, wins: 2, roundsPlayed: 12 }
        } } }
      })
    };
  };

  try {
    const first = await importPendingBatch(db);
    assert.equal(first.identified, 10);
    assert.equal(first.matched, 6);
    assert.equal(first.names_checked, 10);
    assert.equal(requests.filter(u => u.includes('/players?')).length, 2);
    assert.equal(requests.length, 8);
    assert.equal(db.tables.players.length, 6);
    assert.equal(db.tables.player_import_queue.filter(r =>
      r.status === 'pending' && r.pubg_account_id).length, 4);
    db.refill();
    const second = await importPendingBatch(db);
    assert.equal(second.matched, 4);
    assert.equal(second.identified, 0);
    assert.equal(db.tables.players.length, 10);
    assert.equal(requests.length, 12);
    assert.equal(db.tables.player_lifetime_details.length, 10);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBG_API_KEY;
    else process.env.PUBG_API_KEY = originalKey;
  }
});

test('a duplicate name on both consoles is never attributed to the wrong player', async () => {
  const db = fakeDatabase(2);
  const originalFetch = global.fetch;
  const originalKey = process.env.PUBG_API_KEY;
  process.env.PUBG_API_KEY = 'test-placeholder';
  global.fetch = async url => ({
    ok: true, json: async () => ({
      data: url.includes('/players?') ? [
        { id: url.includes('/psn/') ? 'ps-0' : 'xb-0',
          attributes: { name: 'Mock0' } }
      ] : []
    })
  });
  try {
    const result = await importPendingBatch(db);
    assert.equal(result.ambiguous, 1);
    assert.equal(result.not_found, 1);
    assert.equal(db.tables.players.length, 0);
    assert.equal(db.tables.player_import_queue[0].status, 'ambiguous');
    assert.equal(db.tables.player_import_queue[1].status, 'not_found');
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBG_API_KEY;
    else process.env.PUBG_API_KEY = originalKey;
  }
});

test('a failed platform lookup keeps every account pending for retry', async () => {
  const db = fakeDatabase();
  const originalFetch = global.fetch;
  const originalKey = process.env.PUBG_API_KEY;
  process.env.PUBG_API_KEY = 'test-placeholder';
  global.fetch = async () => ({ ok: false, status: 429 });
  try {
    const result = await importPendingBatch(db);
    assert.equal(result.lookup_error, true);
    assert.equal(db.tables.player_import_queue.filter(p => p.status === 'pending').length, 10);
    assert.equal(db.tables.players.length, 0);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBG_API_KEY;
    else process.env.PUBG_API_KEY = originalKey;
  }
});
