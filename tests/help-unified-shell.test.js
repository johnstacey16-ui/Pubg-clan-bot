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
  const js=read('assets/site.js'),discord=read('lib/channel-dashboard.js');
  assert.match(js,/location\.origin\+'\/dashboard\/#player\//);
  assert.match(discord,/https:\/\/pubg-help-clan\.vercel\.app\/dashboard\//);
  assert.doesNotMatch(js,/location\.origin\+'\/#player\//);
});
