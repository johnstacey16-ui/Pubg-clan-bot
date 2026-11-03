'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { squadForMatch, squadLines, aggregateTeammates } = require('../lib/squad-analysis');

const participant = (id, playerId, name, kills, damage, winPlace = 2) =>
  ({ id, type: 'participant', attributes: {
    stats: { playerId, name, kills, damageDealt: damage, assists: 1, DBNOs: 2, winPlace }
  } });
function fixture() {
  return {
    data: { id: 'match-1234567', attributes: { mapName: 'Baltic_Main', gameMode: 'squad-fpp' } },
    included: [
      participant('p1', 'account.self', 'TestPlayer', 5, 500),
      participant('p2', 'account.friend', 'SquadMate_1', 3, 300),
      participant('p3', 'account.opponent', 'EnemyName', 11, 1100, 1),
      { id: 'roster-1', type: 'roster',
        relationships: { participants: { data: [{ id: 'p1' }, { id: 'p2' }] } } },
      { id: 'roster-2', type: 'roster',
        relationships: { participants: { data: [{ id: 'p3' }] } } }
    ]
  };
}
test('squad resolves only members of the queried player roster', () => {
  const team = squadForMatch(fixture(), 'account.self');
  assert.equal(team.state, 'ok');
  assert.equal(team.mode, 'squad-fpp');
  assert.deepEqual(team.members.map(p => p.name), ['TestPlayer', 'SquadMate_1']);
  assert.equal(team.members[0].isSelf, true);
  assert.equal(team.members[1].kills, 3);
  assert.doesNotMatch(squadLines(team), /EnemyName/);
});
test('player must be a participant; absent roster returns no fabricated squad', () => {
  assert.equal(squadForMatch(fixture(), 'account.not-there').state, 'player_missing');
  const payload = fixture();
  payload.included = payload.included.filter(item => item.type !== 'roster');
  const result = squadForMatch(payload, 'account.self');
  assert.equal(result.state, 'roster_missing');
  assert.equal(result.members.length, 0);
});
test('teammate aggregation counts each account only once per match', () => {
  const one = squadForMatch(fixture(), 'account.self');
  const two = squadForMatch(fixture(), 'account.self');
  const rows = aggregateTeammates([one, two], 'account.self');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'SquadMate_1');
  assert.equal(rows[0].matches, 2);
  assert.equal(rows[0].kills, 6);
  assert.equal(rows[0].damage, 600);
});
