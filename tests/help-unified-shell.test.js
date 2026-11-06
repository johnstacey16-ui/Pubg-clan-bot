'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Clan Dashboard is a real first tool inside the original HELP Toolkit shell',()=>{
 const routes=JSON.parse(read('vercel.json')).routes;
 assert.equal(routes.find(x=>x.src==='/')?.dest,'/training/index.html');
 assert.equal(routes.find(x=>x.src==='/dashboard/')?.dest,'/training/index.html');
 const html=read('training/index.html');
 const nav=html.slice(html.indexOf('<nav id="app-toolnav"'),html.indexOf('</nav>',html.indexOf('<nav id="app-toolnav"')));
 assert.ok(nav.indexOf('data-open-panel="panel-clan"')<nav.indexOf('data-open-panel="panel-sensitivity"'));
 assert.match(html,/id="panel-clan" class="hub-main clan-workspace"/);
 assert.match(html,/data-return-tool aria-label="Back to Toolkit"/);
 assert.match(html,/id="clan-section-tabs"/);
 assert.equal((html.match(/class="page"/g)||[]).length,19);
 assert.match(html,/<base href="\/training\/"/);
 assert.doesNotMatch(html,/<iframe\b/);
 assert.doesNotMatch(html,/class="command-centre-bridge"/);
});
test('dashboard scripts load lazily inside the same DOM',()=>{
 const loader=read('training/js/clan-dashboard-loader.js');
 assert.match(loader,/help:panel-changed/);
 assert.match(loader,/detail\?\.id==='panel-clan'/);
 for(const script of ['site.js','clan-analytics.js','command-centre.js',
   'telemetry-view.js','survival-view.js','cache-health.js'])
   assert.ok(loader.includes('/assets/'+script),script);
 const nav=read('training/js/app-navigation.js');
 assert.match(nav,/lastToolkitPanel/);
 assert.match(nav,/selectPanel\(lastToolkitPanel/);
 assert.match(nav,/location\.pathname\.startsWith\('\/dashboard'\)/);
 assert.match(nav,/id\.startsWith\('player\/'\)/);
});
test('legacy player and match links target toolkit dashboard without a redirect loop',()=>{
 const script=read('training/legacy-dashboard-hashes.js');
 for(const [pathname,hash,expected] of [
   ['/','#player/xbox/Example','/dashboard/#player/xbox/Example'],
   ['/','#matches','/dashboard/#matches'],
   ['/','#panel-sensitivity',null],
   ['/dashboard/','#matches',null]]){
   let redirected=null;
   vm.runInNewContext(script,{window:{location:{
     pathname,hash,replace:x=>{redirected=x;}
   }}});
   assert.equal(redirected,expected);
 }
 const js=read('assets/site.js');
 const discord=read('lib/channel-dashboard-render.js');
 assert.match(js,/location\.origin\+'\/dashboard\/#player\//);
 assert.match(discord,/https:\/\/pubg-help-clan\.vercel\.app\/dashboard\//);
});
test('old dashboard CSS is isolated and inherits the real HELP trainer palette',()=>{
 const css=read('training/clan-dashboard-scoped.css');
 const theme=read('training/clan-dashboard-shell.css');
 assert.match(css,/#panel-clan \.hero/);
 assert.match(css,/#panel-clan \.page/);
 assert.match(css,/#panel-clan \.nav-link/);
 assert.match(theme,/Barlow Condensed/);
 assert.match(theme,/#e9bc77/);
 assert.match(theme,/clan-section-tabs/);
 assert.doesNotMatch(css,/(^|\n)\.sidebar\s*\{/);
});
test('production smoke verifies the shared toolkit shell on every entry route',()=>{
 const smoke=read('tests/production-http-smoke.js');
 assert.match(smoke,/toolkit shell/);
 assert.match(smoke,/clan-dashboard-scoped\.css/);
 assert.match(smoke,/Back to Toolkit/);
});
