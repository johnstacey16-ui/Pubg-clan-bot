'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('HELP toolkit owns the root with clan as the first unified navigation entry',()=>{
  const routes=JSON.parse(read('vercel.json')).routes;
  assert.equal(routes.find(x=>x.src==='/')?.dest,'/training/index.html');
  assert.equal(routes.find(x=>x.src==='/dashboard/')?.dest,'/index.html');
  const toolkit=read('training/index.html');
  const nav=toolkit.slice(toolkit.indexOf('<nav id="app-toolnav"'),toolkit.indexOf('</nav>',toolkit.indexOf('<nav id="app-toolnav"')));
  assert.ok(nav.indexOf('href="/dashboard/"')<nav.indexOf('data-open-panel="panel-sensitivity"'));
  assert.match(toolkit,/<base href="\/training\/">/);
  assert.match(read('index.html'),/href="\/assets\/toolkit-theme\.css"/);
  assert.match(read('index.html'),/class="nav-link suite-current" href="\/dashboard\/"/);
  assert.match(read('assets/toolkit-theme.css'),/--mint:#e9bc77/);
});
test('root legacy clan hashes redirect without interrupting toolkit anchor links',()=>{
  const script=read('training/legacy-dashboard-hashes.js');
  for(const [hash,expected] of [
    ['#player/xbox/Example','/dashboard/#player/xbox/Example'],
    ['#matches','/dashboard/#matches'],['#panel-sensitivity',null],['#panel-combat',null]
  ]){
    let to=null;
    const location={hash,replace:x=>{to=x;}};
    vm.runInNewContext(script,{window:{location}});
    assert.equal(to,expected);
  }
});
test('dashboard player history and Discord links remain under /dashboard/',()=>{
  const js=read('assets/site.js'),discord=read('lib/channel-dashboard-render.js');
  assert.match(js,/location\.origin\+'\/dashboard\/#player\//);
  assert.match(discord,/https:\/\/pubg-help-clan\.vercel\.app\/dashboard\//);
  assert.doesNotMatch(js,/location\.origin\+'\/#player\//);
});


test('shared HELP navigation counts the dashboard as tool one and avoids redundant toolkit links',()=>{
  const toolkit=read('training/index.html');
  const nav=read('training/js/app-navigation.js');
  const dashboard=read('index.html');
  assert.match(toolkit,/aria-label="Tool 2 of 7">02 <i>\/<\/i> 07/);
  assert.match(nav,/const toolCount = panelIds.length \+ externalToolCount/);
  assert.match(dashboard,/href="\/#panel-sensitivity">Open Sensitivity Studio/);
  assert.doesNotMatch(dashboard,/Training toolkit ↗/);
  assert.match(read('training/command-centre-bridge.css'),/#e9bc77/);
});


test('production smoke validates the new dashboard links rather than removed legacy navigation',()=>{
  const smoke=read('tests/production-http-smoke.js');
  const dashboard=read('index.html');
  assert.match(smoke,/Dashboard must link to the unified HELP training navigation/);
  assert.match(smoke,/Toolkit must number Clan Dashboard as the first tool/);
  assert.match(smoke,/legacy player-link compatibility/);
  assert.match(dashboard,/href="\/#panel-sensitivity"/);
  assert.doesNotMatch(dashboard,/href="\/training\/"/);
  assert.doesNotMatch(smoke,/Clan homepage must link into training/);
});
