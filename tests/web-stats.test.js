'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {shapeWebStats,whitelistStats,MODES}=require('../lib/web-stats');

function fixture() {
 return {
  roster:[
    {gamertag:'Xbox Player',status:'matched',is_clan_member:true},
    {gamertag:'PS_Test',status:'matched',is_clan_member:true},
    {gamertag:'PendingName',status:'pending',is_clan_member:true,platform:'xbox'},
    {gamertag:'OutsideTracker',status:'matched',is_clan_member:false}
  ],
  players:[
    {id:1,gamertag:'Xbox Player',platform:'xbox',pubg_account_id:'account.SECRET1',
      total_kills:320,total_wins:21,matches_played:100,last_checked:'2026-11-03T15:00:00Z'},
    {id:2,gamertag:'PS_Test',platform:'psn',pubg_account_id:'account.SECRET2',
      total_kills:100,total_wins:12,matches_played:50,last_checked:'2026-11-03T14:00:00Z'},
    {id:3,gamertag:'OutsideTracker',platform:'xbox',pubg_account_id:'account.SECRET3',
      total_kills:99999,total_wins:9999,matches_played:100000,last_checked:'2026-11-03T17:00:00Z'}
  ],
  details:[
    {player_id:1,game_mode_stats:{squad:{roundsPlayed:100,kills:320,wins:21,assists:35,damageDealt:22000,secretToken:'never expose'}}},
    {player_id:2,game_mode_stats:{solo:{roundsPlayed:50,kills:100,wins:12,headshotKills:30}}},
    {player_id:3,game_mode_stats:{squad:{roundsPlayed:100000,kills:99999,wins:9999}}}
  ]
 };
}
test('public stats contain only verified official Xbox and PlayStation clan accounts',()=>{
 const d=shapeWebStats(fixture());
 assert.equal(d.schemaVersion,1);
 assert.deepEqual(d.players.map(p=>p.name),['Xbox Player','PS_Test']);
 assert.equal(d.roster.total,3);
 assert.equal(d.roster.verified,2);
 assert.equal(d.roster.states.pending,1);
 assert.equal(d.platforms.xbox,1);
 assert.equal(d.platforms.psn,1);
 assert.equal(d.totals.kills,420);
 assert.equal(d.totals.wins,33);
 assert.equal(d.totals.matches,150);
 assert.equal(d.modeTotals.squad.kills,320);
 assert.equal(d.modeTotals.solo.kills,100);
 assert.equal(d.lastSync,'2026-11-03T15:00:00Z');
});
test('browser response never includes database IDs, PUBG account IDs or arbitrary private fields',()=>{
 const d=shapeWebStats(fixture());
 const body=JSON.stringify(d);
 assert.doesNotMatch(body,/SECRET|secretToken|OutsideTracker|service_role|SUPABASE_SERVICE_KEY/);
 assert.equal(d.players[0].id,undefined);
 assert.equal(d.players[0].pubg_account_id,undefined);
 assert.equal(d.players[0].modes.squad.secretToken,undefined);
});
test('game mode fields are allowlisted and every documented lifetime mode is represented',()=>{
 const d=shapeWebStats(fixture());
 assert.deepEqual(d.modeOrder,MODES);
 assert.equal(d.modeOrder.length,6);
 assert.deepEqual(whitelistStats({kills:10,wins:1,example:{hello:1},secret:'none'}),{kills:10,wins:1});
 assert.equal(d.players[0].modes.squad.assists,35);
});
test('pending, ambiguous or missing roster names are never counted in verified totals',()=>{
 const f=fixture();
 f.roster[0].status='ambiguous';
 const d=shapeWebStats(f);
 assert.equal(d.roster.verified,1);
 assert.equal(d.totals.kills,100);
 assert.equal(d.roster.states.ambiguous,1);
});
