'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../assets/site.js'),'utf8');
const active='division.bro.official.console-43';
const prior='division.bro.official.console-42';
const modes=['solo','duo','squad','solo-fpp','duo-fpp','squad-fpp'];
const snapshot=(seasonId,capturedAt,rankPoints,kills=20)=>({
  seasonId,capturedAt,mode:'squad',rankPoints,kills,
  matches:10,wins:1,damage:2200,tier:'Gold',subTier:'4'
});
const player={
  name:'HistoryTester',platform:'xbox',kills:30,wins:2,matches:12,kd:2.5,
  winRate:16.67,updatedAt:'2026-11-03T18:00:00Z',advanced:{},modes:{}
};
const overview={schemaVersion:1,players:[player],
  roster:{total:1,verified:1,entries:[{name:'HistoryTester',platform:'xbox',
    status:'matched',verified:true}],states:{}},
  totals:{kills:30,wins:2,matches:12},platforms:{xbox:1,psn:0},
  modeOrder:modes,modeTotals:Object.fromEntries(modes.map(m=>[m,{
    matches:0,kills:0,wins:0,damage:0,assists:0}])),
  lastSync:'2026-11-03T18:00:00Z'};
async function app(history,type='ranked'){
  const elements={},requests=[];
  function get(id){
    if(elements[id])return elements[id];
    const defaults={sort:'kills','leader-console':'all','player-console':'all',
      'player-status':'all','compare-mode':'all','weapon-category':'total',
      'weapon-search':'','season-type':type,'season-history-mode':'squad',
      'console-platform':'auto','console-gamertag':'HistoryTester'};
    return elements[id]={id,innerHTML:'',textContent:'',value:defaults[id]??'',
      hidden:false,disabled:false,open:false,style:{},dataset:{},events:{},
      classList:{toggle(){}},setAttribute(){},removeAttribute(){},
      addEventListener(event,fn){this.events[event]=fn},
      showModal(){this.open=true},close(){this.open=false}};
  }
  const document={
    getElementById:get,
    querySelectorAll(query){return query==='.page'?
      ['overview','leaderboard','players','modes','matches','weapons','season',
       'teammates','compare','roadmap'].map(n=>get('page-'+n)):[]},
    addEventListener(){}};
  const fetch=async url=>{
    requests.push(url);
    if(url.startsWith('/api/public-stats'))return{ok:true,json:async()=>overview};
    if(url.startsWith('/api/public-season'))return{ok:true,json:async()=>({
      schemaVersion:1,type,seasonId:active,archivedSeasons:[active,prior],
      history,historyCount:history.length,note:'Saved real PUBG season observations',
      savedAt:'2026-11-03T19:00:00Z',count:1,modes:[{
        mode:'squad',stats:type==='ranked'?
          {roundsPlayed:12,kills:20,currentRankPoint:2450,
           currentTier:{tier:'Gold',subTier:'4'}}:
          {roundsPlayed:12,kills:20,wins:2}}]})};
    throw Error('Unexpected external request: '+url);
  };
  const context={
    document,window:{scrollTo(){},prompt(){}},
    location:{hash:'#season',origin:'https://pubg-clan-bot.vercel.app'},
    history:{replaceState(){},pushState(){}},navigator:{clipboard:{}},
    fetch,console:{error(){}}
  };
  vm.runInNewContext(code,context);
  for(let i=0;i<60;i++)await Promise.resolve();
  return{elements,requests};
}
test('one real ranked observation produces baseline note, no fake trend',async()=>{
  const result=await app([snapshot(active,'2026-11-03T16:00:00Z',2319)]);
  const chart=result.elements['season-history-chart'].innerHTML;
  assert.match(chart,/Only one real PUBG observation/);
  assert.doesNotMatch(chart,/<svg/);
  assert.match(result.elements['season-history-summary'].innerHTML,/2,319/);
});
test('two observed RP values produce a truthful progression SVG and delta',async()=>{
  const result=await app([
    snapshot(active,'2026-11-03T16:00:00Z',2319),
    snapshot(active,'2026-11-03T19:00:00Z',2450),
    snapshot(prior,'2026-10-03T13:00:00Z',2030)
  ]);
  assert.match(result.elements['season-history-chart'].innerHTML,/<svg/);
  assert.match(result.elements['season-history-chart'].innerHTML,/trend-line/);
  assert.match(result.elements['season-history-summary'].innerHTML,/2,450/);
  assert.match(result.elements['season-history-summary'].innerHTML,/\+131/);
  assert.ok(result.requests.every(u=>u.startsWith('/api/')));
  const season=result.elements['season-history-season'];
  season.value=prior;season.events.change();
  assert.match(result.elements['season-history-chart'].innerHTML,/Only one real PUBG observation/);
});
test('season kills chart uses observed kills, never ranked points',async()=>{
  const result=await app([
    snapshot(active,'2026-11-03T12:00:00Z',9999,20),
    snapshot(active,'2026-11-03T16:00:00Z',200,33)
  ],'season');
  assert.match(result.elements['season-history-note'].textContent,/Season kills/);
  assert.match(result.elements['season-history-summary'].innerHTML,/\+13/);
  assert.doesNotMatch(result.elements['season-history-summary'].innerHTML,/9,999/);
});
