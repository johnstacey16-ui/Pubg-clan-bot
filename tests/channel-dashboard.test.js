'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canManage,renderDashboard,REFRESH_BUTTON,SECTIONS } = require('../lib/channel-dashboard');
const { commands } = require('../lib/command-definitions');

function fixture() {
  const p={id:1,gamertag:'Official_One',platform:'xbox',
    total_kills:200,total_wins:12,matches_played:100,last_checked:'2026-11-03T12:00:00Z'};
  return {
    clan:[{gamertag:'Official_One',is_clan_member:true,status:'matched'},
      {gamertag:'PendingTwo',is_clan_member:true,status:'pending'}],
    tracked:1,verified:[p],
    states:{pending:1,matched:1,ambiguous:0,not_found:0,error:0,identified:0},
    totals:{kills:200,wins:12,matches:100},
    breakdown:{
      solo:{rounds:10,kills:15,wins:1},
      duo:{rounds:30,kills:70,wins:3},
      squad:{rounds:60,kills:115,wins:8},
      'solo-fpp':{rounds:0,kills:0,wins:0},
      'duo-fpp':{rounds:0,kills:0,wins:0},
      'squad-fpp':{rounds:0,kills:0,wins:0}
    },
    records:[],lastChecked:Date.parse(p.last_checked)
  };
}
test('dashboard setup requires channel-management privileges', () => {
  assert.equal(canManage({member:{permissions:'0'}}),false);
  assert.equal(canManage({member:{permissions:'16'}}),true);
  assert.equal(canManage({member:{permissions:'8'}}),true);
  assert.equal(canManage({member:{permissions:'1024'}}),false);
});
test('dashboard renders five reusable Supabase-powered cards with refresh button', () => {
  const rendered=renderDashboard(fixture());
  assert.deepEqual(Object.keys(rendered),SECTIONS);
  for(const card of Object.values(rendered)) {
    assert.equal(card.embeds.length,1);
    assert.equal(card.components[0].components[0].custom_id,REFRESH_BUTTON);
    assert.equal(card.components[0].components[0].style,1);
    assert.deepEqual(card.allowed_mentions,{parse:[]});
  }
  assert.match(rendered.overview.embeds[0].description,/200/);
  assert.match(rendered.leaderboard.embeds[0].description,/Official\\_One/);
  assert.match(rendered.roster.embeds[0].description,/1/);
  assert.match(rendered.players1.embeds[0].description,/Official\\_One/);
  assert.match(rendered.players1.embeds[0].description,/PendingTwo/);
  assert.match(rendered.players1.embeds[0].description,/200 kills/);
});
test('dashboard command uses restricted slash-command subcommands', () => {
  const command=commands.find(c=>c.name==='dashboard');
  assert.equal(command.default_member_permissions,'16');
  assert.deepEqual(command.options.map(x=>x.name),['setup','refresh','status']);
  assert.equal(command.options.every(x=>x.type===1),true);
});
