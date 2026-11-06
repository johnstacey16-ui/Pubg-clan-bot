'use strict';
// Actual Chrome smoke for /dashboard/, not the older embedded training dashboard.
// Uses synthetic responses; it never spends PUBG API calls or needs credentials.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const modes=['solo','duo','squad','solo-fpp','duo-fpp','squad-fpp'];
const person={name:'Sample Member',platform:'xbox',kills:7,wins:1,matches:15,
 kd:7/15,winRate:100/15,updatedAt:'2026-11-05T12:00:00Z',
 modes:{solo:{roundsPlayed:5,kills:2,wins:0,damageDealt:800,longestKill:380,dailyKills:1,headshotKills:1},
 squad:{roundsPlayed:10,kills:5,wins:1,damageDealt:2000,longestKill:220,dailyKills:3,headshotKills:2}}};
const outsider={...person,name:'Outside Player',platform:'psn',kills:9,wins:2,
 modes:{squad:{roundsPlayed:12,kills:9,wins:2,dailyKills:4,longestKill:90}}};
const summary={schemaVersion:1,players:[person],modeOrder:modes,
 roster:{total:1,verified:1,entries:[{name:person.name,platform:'xbox',verified:true,status:'matched'}],
  states:{matched:1}},totals:{kills:7,wins:1,matches:15},
 platforms:{xbox:1,psn:0},lastSync:person.updatedAt,
 modeTotals:Object.fromEntries(modes.map(m=>[m,{matches:0,kills:0,wins:0,damage:0,assists:0}]))};
function respond(res,status,payload){
 res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(payload));
}
const server=http.createServer(async(req,res)=>{
 const uri=new URL(req.url,'http://127.0.0.1');
 if(uri.pathname==='/api/public-stats')return respond(res,200,summary);
 if(uri.pathname==='/api/player-lookup')return respond(res,200,{
  schemaVersion:1,found:true,isClanMember:false,player:outsider});
 if(uri.pathname==='/api/public-matches')return respond(res,200,{
  schemaVersion:1,name:'Sample Member',platform:'xbox',
  source:'Private 180-day archive',archivedCount:4,availableCount:4,
  note:'Synthetic saved matches for browser testing',
  matches:[
   {id:'00336e4b-d659-4497-bfc4-9f6dd705cc71',map:'Baltic_Main',
    mode:'squad',playedAt:'2026-11-05T14:00:00Z',placement:1,
    kills:5,damage:800,headshots:2,knocks:4,assists:2,
    timeSurvivedSeconds:1851,swimMeters:187.6,killPlace:3,
    killStreaks:2,roadKills:1,teamKills:0,vehicleDestroys:2,
    weaponsAcquired:14,deathType:'byzone',
    squad:[{name:'Sample Member',isSelf:true,kills:5,damage:800,assists:2,
      timeSurvivedSeconds:1851,headshots:2,revives:1},
     {name:'Friend',kills:3,damage:250,assists:1,headshots:1,revives:2}]},
   {id:'00336e4b-d659-4497-bfc4-9f6dd705cc72',map:'Baltic_Main',
    mode:'squad',playedAt:'2026-11-04T14:00:00Z',placement:12,kills:0,damage:50,
    squad:[{name:'Sample Member',isSelf:true,kills:0}]},
   {id:'00336e4b-d659-4497-bfc4-9f6dd705cc73',map:'Desert_Main',
    mode:'solo',playedAt:'2026-11-03T14:00:00Z',placement:7,kills:3,damage:450},
   {id:'00336e4b-d659-4497-bfc4-9f6dd705cc74',map:'Desert_Main',
    mode:'duo',playedAt:'2026-11-02T14:00:00Z',placement:null,
    kills:null,damage:null}
  ]});
 if(uri.pathname==='/api/public-insights'&&uri.searchParams.get('kind')==='weapons')
  return respond(res,200,{schemaVersion:1,kind:'weapons',name:'Sample Member',
   platform:'xbox',savedAt:'2026-11-05T12:00:00Z',count:2,
   note:'Saved genuine PUBG mastery — separate source fields',
   items:[
    {name:'BerylM762',level:34,tier:4,xp:8000,
     official:{kills:8,headshots:3,damage:800,longestKill:295,
      mostDefeatsInGame:5},competitive:{kills:2},
     total:{kills:550,damage:65000,mostDamageInGame:2400,
      mostHeadshotsInGame:8,mostKnocksInGame:7,longRangeDefeats:12}},
    {name:'M416',level:22,tier:3,xp:30000,
     official:{kills:31,headshots:12,damage:3000,longestKill:210},
     competitive:{kills:5},total:{kills:3,damage:500}}
   ]});
 if(uri.pathname.startsWith('/api/'))return respond(res,200,{
  schemaVersion:1,items:[],history:[],matches:[],rows:[],points:[]});
 if(uri.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 let file;
 if(uri.pathname==='/dashboard/'||uri.pathname==='/dashboard')file='index.html';
 else if(/^\/assets\/[\w./-]+$/.test(uri.pathname)&&
  !uri.pathname.includes('..'))file=uri.pathname.slice(1);
 else return respond(res,404,{error:'No matching static fixture'});
 try{
  const buf=await fs.readFile(path.join(root,file));
  const ext=path.extname(file),mime={'.html':'text/html','.js':'text/javascript',
   '.css':'text/css','.svg':'image/svg+xml'};
  res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream'});
  res.end(buf);
 }catch(e){respond(res,404,{error:'Static fixture missing'});}
});
async function run(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,
   args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:850}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
   page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:'))
    errors.push('HTTP '+r.status()+' '+r.url());});
   const response=await page.goto('http://127.0.0.1:'+server.address().port+
    '/dashboard/',{waitUntil:'networkidle'});
   assert.equal(response.status(),200);
   await page.locator('#notice').waitFor({state:'hidden',timeout:12000});
   await page.locator('[data-page="full-stats"]').click();
   await page.locator('#page-full-stats').waitFor({state:'visible'});
   assert.equal(await page.locator('#full-player option').count(),1);
   assert.match(await page.locator('#full-source').innerText(),/Sample Member/);
   await page.locator('[data-page="matches"]').click();
   await page.locator('#page-matches').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.getElementById('match-map-table')?.
    textContent.includes('Baltic_Main'),{timeout:12000});
   assert.equal(await page.locator('#match-results article').count(),4);
   assert.match(await page.locator('#match-lab-coverage').innerText(),/4 of 4/);
   assert.match(await page.locator('#match-lab-coverage').innerText(),/NOT lifetime totals/);
   assert.match(await page.locator('#match-map-table').innerText(),/Baltic_Main/);
   assert.match(await page.locator('#match-map-table').innerText(),/50%/);
   await page.locator('#match-map-filter').selectOption('Baltic_Main');
   assert.equal(await page.locator('#match-results article').count(),2);
   assert.match(await page.locator('#match-lab-coverage').innerText(),/2 of 4/);
   await page.locator('#match-outcome-filter').selectOption('win');
   assert.equal(await page.locator('#match-results article').count(),1);
   assert.match(await page.locator('#match-results').innerText(),/62.5%/);
   await page.locator('#match-results article').first().locator('.match-detail summary').click();
   const detail=await page.locator('#match-results article').first().locator('.match-detail').innerText();
   assert.match(detail,/30m 51s/);
   assert.match(detail,/Died to zone/);
   assert.match(detail,/187\.6 m/);
   assert.match(detail,/Weapons acquired/);
   assert.match(detail,/Vehicles destroyed/);
   assert.match(await page.locator('#match-lab-coverage').innerText(),/match survival records/);
   await page.locator('#match-trend-metric').selectOption('timeSurvivedSeconds');
   assert.match(await page.locator('#match-trend').innerText(),/1,851/);
   await page.locator('#match-trend-metric').selectOption('damage');
   assert.equal(await page.locator('#match-trend .match-trend-item').count(),1);
   const chartHeight=await page.locator('#match-trend [data-height]').first().evaluate(
    el=>parseFloat(el.style.height));
   assert.ok(chartHeight>0,'Saved match trend bars must have actual CSSOM heights');
   await page.locator('#match-results [data-replay-match]').first().click();
   assert.equal(await page.locator('#telemetry-match').inputValue(),
    '00336e4b-d659-4497-bfc4-9f6dd705cc71');
   await page.locator('#match-map-filter').selectOption('');
   await page.locator('#match-outcome-filter').selectOption('unknown');
   assert.equal(await page.locator('#match-results article').count(),1);
   assert.match(await page.locator('#match-lab-summary').innerText(),/—/);
   await page.locator('#match-outcome-filter').selectOption('all');
   await page.locator('[data-page="full-stats"]').click();

   assert.match(await page.locator('#full-summary').innerText(),/7/);
   assert.match(await page.locator('#full-results').innerText(),/Longest kill/);
   await page.locator('#full-category').selectOption('Recent activity');
   assert.match(await page.locator('#full-results').innerText(),/Recent-day kills/);
   // Day/week counters must be unavailable in the all-mode view.
   assert.equal((await page.locator('tr').filter({has:page.locator('code', {hasText:'dailyKills'})})
    .locator('.full-stat-value').first().innerText()).trim(),'—');
   await page.locator('#full-mode').selectOption('squad');
   assert.equal((await page.locator('tr').filter({has:page.locator('code', {hasText:'dailyKills'})})
    .locator('.full-stat-value').first().innerText()).trim(),'3');
   await page.locator('#full-category').selectOption('Combat');
   await page.locator('#full-query').fill('longest');
   assert.match(await page.locator('#full-results').innerText(),/220 m/);
   await page.locator('#full-mode').selectOption('all');
   assert.match(await page.locator('#full-results').innerText(),/380 m/);
   await page.locator('#full-query').fill('');
   await page.locator('[data-page="players"]').click();
   await page.locator('#page-players [data-profile="Sample Member"]').click();
   await page.locator('#profile[open]').waitFor({state:'visible'});
   await page.locator('[data-full-stats]').click();
   await page.locator('#page-full-stats').waitFor({state:'visible'});
   assert.equal(await page.locator('#full-player').inputValue(),'Sample Member');
   await page.locator('[data-page="overview"]').click();
   await page.locator('#console-gamertag').fill('Outside Player');
   await page.locator('#console-search').click();
   await page.locator('#console-search-result [data-profile="Outside Player"]')
    .waitFor({state:'visible'});
   await page.locator('[data-page="full-stats"]').click();
   assert.equal(await page.locator('#full-player option').count(),2);
   await page.locator('#full-player').selectOption('Outside Player');
   assert.match(await page.locator('#full-source').innerText(),/PlayStation/);
   // Confirm the actual Weapon Mastery tab uses post-18.2 Official figures by default.
   await page.locator('[data-page="weapons"]').click();
   await page.locator('#page-weapons').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.getElementById('weapon-detail')?.
    textContent.includes('Most kills in a match'),{timeout:12000});
   assert.equal(await page.locator('#weapon-category').inputValue(),'official');
   assert.match(await page.locator('#weapons-table tr').first().innerText(),/M416/);
   assert.match(await page.locator('#weapon-coverage').innerText(),/Official \(post-18\.2\)/);
   await page.locator('[data-weapon-select="BerylM762"]').click();
   assert.match(await page.locator('#weapon-detail').innerText(),/2,400/);
   assert.match(await page.locator('#weapon-detail').textContent(),/Legacy \(frozen at 18\.2\)/);
   await page.locator('#weapon-category').selectOption('total');
   assert.match(await page.locator('#weapons-table tr').first().innerText(),/BerylM762/);
   await page.locator('#weapon-sort').selectOption('xp');
   assert.match(await page.locator('#weapons-table tr').first().innerText(),/M416/);
   await page.locator('#weapon-search').fill('Beryl');
   assert.equal(await page.locator('#weapons-table tr').count(),1);
   assert.match(await page.locator('#weapon-summary').innerText(),/Weapons returned/);
   assert.deepEqual(errors,[],'Browser console errors at '+width+'px');
   console.log('FULL STATS CHROME PASS: '+width+'px; lifetime and source-correct mastery explorer');
   await page.close();
  }
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
