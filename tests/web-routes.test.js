'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('website and all existing bot endpoints share a single Vercel deployment',()=>{
 const v=JSON.parse(read('vercel.json'));
 const routes=Object.fromEntries(v.routes.map(x=>[x.src,x.dest]));
 assert.equal(routes['/'],'/index.html');
 assert.equal(routes['/interactions'],'api/index.js');
 assert.equal(routes['/api/sync'],'api/sync.js');
 assert.equal(routes['/api/health'],'api/health.js');
 assert.equal(routes['/api/public-stats'],'api/public-stats.js');
 assert.equal(routes['/api/player-history'],'api/player-history.js');
 assert.equal(routes['/api/player-lookup'],'api/player-lookup.js');
 assert.equal(routes['/api/player-refresh'],'api/player-refresh.js');
 assert.equal(routes['/api/public-season'],'api/public-season.js');
 assert.equal(routes['/api/public-season-leaderboard'],'api/public-season-leaderboard.js');
 assert.equal(routes['/api/public-progress'],'api/public-progress.js');
 assert.equal(routes['/api/public-matches'],'api/public-matches.js');
 assert.equal(routes['/api/public-insights'],'api/public-insights.js');
 assert.equal(routes['/api/public-source'],'api/public-source.js');
 assert.ok(v.builds.some(x=>x.src==='index.html'&&x.use==='@vercel/static'));
 assert.ok(v.builds.some(x=>x.src==='assets/**'&&x.use==='@vercel/static'));
 assert.equal(v.crons[0].path,'/api/sync');
});
test('static web app assets and original reference pictures are present',()=>{
 const index=read('index.html');
 assert.match(index,/assets\/site\.css/);
 assert.match(index,/assets\/site\.js/);
 for(const page of ['overview','leaderboard','players','modes','matches','weapons','season','teammates','compare','awards','analysis','data-tools','help','sources','roadmap'])
   assert.ok(index.includes('id="page-'+page+'"'),page);
 for(const f of ['assets/site.css','assets/site.js','assets/brand.svg',
  'design/overview-reference.svg','design/leaderboard-reference.svg','ROADMAP.md'])
   assert.ok(read(f).length>100,'Missing asset '+f);
 const js=read('assets/site.js');
 assert.match(js,/\/api\/public-stats/);
 assert.match(js,/\/api\/player-lookup/);
 assert.match(js,/\/api\/player-history/);
 assert.match(js,/\/api\/public-matches/);
 assert.match(js,/\/api\/public-insights/);
 assert.match(js,/\/api\/player-refresh/);
 assert.match(js,/\/api\/public-season/);
 assert.match(index,/id="match-refresh"/);
 assert.match(index,/id="weapons-refresh"/);
 assert.match(index,/id="season-refresh"/);
 assert.match(js,/#player\//);
 assert.doesNotMatch(js,/SUPABASE_SERVICE_KEY|PUBG_API_KEY|DISCORD_BOT_TOKEN/);
});

test('old command centre features are present without shipping fixtures or secrets',()=>{
 const html=read('index.html'),js=read('assets/command-centre.js'),math=read('assets/clan-analytics.js');
 for(const id of ['cc-awards-grid','cc-scores','cc-progress','cc-quality','compare-radar',
  'cc-export','cc-before-file','cc-after-file','cc-scatter','cc-min-matches','cc-team-weight'])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/clan-analytics\.js/);
 assert.match(html,/command-centre\.js/);
 assert.match(js,/\/api\/public-progress/);
 assert.match(js,/local-only|local-only|Local-only/i);
 assert.doesNotMatch(html+js+math,/SUPABASE_SERVICE_KEY|PUBG_API_KEY|DISCORD_BOT_TOKEN|window\.storage/);
 assert.doesNotMatch(math,/Big_SnakeAUG|PUBGClans.net|isBotFarmer/);
});
