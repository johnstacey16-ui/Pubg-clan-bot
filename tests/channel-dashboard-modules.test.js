'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dashboard = require('../lib/channel-dashboard');
const data = require('../lib/channel-dashboard-data');
const renderer = require('../lib/channel-dashboard-render');
const { MODES } = require('../lib/pubg-utils');

function fakeDb(tables, errorTable) {
  const queried = [];
  return {
    queried,
    from(table) {
      queried.push(table);
      return {
        select() { return this; },
        limit() {
          return Promise.resolve(errorTable===table
            ? {data:null,error:{message:'synthetic outage'}}
            : {data:tables[table]||[],error:null});
        }
      };
    }
  };
}

test('the old channel-dashboard interface still re-exports the extracted modules', () => {
  assert.strictEqual(dashboard.loadSnapshot, data.loadSnapshot);
  assert.strictEqual(dashboard.renderDashboard, renderer.renderDashboard);
  assert.strictEqual(dashboard.REFRESH_BUTTON, renderer.REFRESH_BUTTON);
  assert.strictEqual(dashboard.SECTIONS, renderer.SECTIONS);
  assert.equal(renderer.WEB_DASHBOARD_URL, 'https://pubg-help-clan.vercel.app/dashboard/');
});

test('snapshot aggregates only matched official console members and includes six modes', async () => {
  const rows = {
    player_import_queue: [
      {gamertag:'Official_One',is_clan_member:true,status:'matched',platform:'xbox'},
      {gamertag:'Pending_Two',is_clan_member:true,status:'pending',pubg_account_id:'account'},
      {gamertag:'Ambiguous_Three',is_clan_member:true,status:'ambiguous'},
      {gamertag:'Outsider',is_clan_member:false,status:'matched',platform:'psn'}
    ],
    players: [
      {id:1,gamertag:'official_one',platform:'xbox',total_kills:200,total_wins:12,matches_played:100,last_checked:'2026-11-03T12:00:00Z'},
      {id:2,gamertag:'Outsider',platform:'psn',total_kills:5000,total_wins:50,matches_played:800},
      {id:3,gamertag:'Ambiguous_Three',platform:'xbox',total_kills:999,total_wins:30,matches_played:100}
    ],
    player_lifetime_details: [
      {player_id:1,game_mode_stats:{solo:{roundsPlayed:40,kills:65,wins:4,damageDealt:2500,assists:7}}},
      {player_id:2,game_mode_stats:{solo:{roundsPlayed:500,kills:4000,wins:10}}},
      {player_id:3,game_mode_stats:{solo:{roundsPlayed:10,kills:500,wins:1}}}
    ],
    clan_records:[{record_name:'Highest kills',value:24,holder_gamertag:'Official_One'}]
  };
  const db=fakeDb(rows);
  const result=await data.loadSnapshot(db);
  assert.deepEqual(db.queried,[
    'player_import_queue','players','player_lifetime_details','clan_records'
  ]);
  assert.equal(result.clan.length,3);
  assert.equal(result.tracked,1);
  assert.equal(result.verified.length,1);
  assert.deepEqual(result.totals,{kills:200,wins:12,matches:100});
  assert.deepEqual(result.states,{pending:1,matched:1,ambiguous:1,not_found:0,error:0,identified:1});
  assert.deepEqual(Object.keys(result.breakdown),[...MODES]);
  assert.deepEqual(result.breakdown.solo,{rounds:40,kills:65,wins:4,damage:2500,assists:7});
  assert.deepEqual(result.breakdown.duo,{rounds:0,kills:0,wins:0,damage:0,assists:0});
  assert.equal(result.records.length,1);
  assert.equal(result.lastChecked,Date.parse('2026-11-03T12:00:00Z'));
});

test('a failed database read fails safely rather than publishing misleading zero totals', async () => {
  const db=fakeDb({},'players');
  await assert.rejects(data.loadSnapshot(db),/Dashboard players read failed: synthetic outage/);
});

test('pure renderer retains eight safely escaped Discord cards and stable action buttons',()=>{
  const roster=Array.from({length:41},(_,i)=>({
    gamertag:'Member_'+String(i+1).padStart(2,'0'),status:'pending'
  }));
  const saved={id:1,gamertag:'Member_01',platform:'xbox',
    total_kills:120,total_wins:5,matches_played:80,last_checked:'2026-11-03T12:00:00Z'};
  const snapshot={
    clan:roster,verified:[saved],tracked:2,
    states:{pending:40,matched:1,identified:0,ambiguous:0,not_found:0,error:0},
    totals:{kills:120,wins:5,matches:80},
    breakdown:Object.fromEntries(MODES.map(m=>[m,{rounds:0,kills:0,wins:0,damage:0,assists:0}])),
    records:[{record_name:'Top *Killer*',value:120,holder_gamertag:'Member_01'}],
    lastChecked:Date.parse(saved.last_checked)
  };
  const untouched=JSON.stringify(snapshot);
  const cards=renderer.renderDashboard(snapshot);
  assert.deepEqual(Object.keys(cards),dashboard.SECTIONS);
  assert.equal(JSON.stringify(snapshot),untouched,'Rendering must not mutate the snapshot');
  for(const item of Object.values(cards)){
    assert.equal(item.flags,32768);
    assert.equal(item.content,null);
    assert.deepEqual(item.embeds,[]);
    assert.equal(item.components[0].type,17);
    assert.ok(item.components[0].components.length<=10);
    for(const component of item.components[0].components)
      if(component.type===10)assert.ok(component.content.length<=3800);
    assert.equal(item.components[1].components[0].custom_id,dashboard.REFRESH_BUTTON);
    assert.equal(item.components[1].components[1].url,renderer.WEB_DASHBOARD_URL);
    assert.deepEqual(item.allowed_mentions,{parse:[]});
  }
  const content=key=>cards[key].components[0].components.map(x=>x.content||'').join('\n');
  assert.match(content('records'),/Top \\*Killer\\*/);
  assert.match(content('players1'),/Member_01/);
  assert.match(content('players2'),/Member_21/);
  assert.match(content('players3'),/Member_41/);
});
