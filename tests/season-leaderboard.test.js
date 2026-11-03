'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {shapeLeaderboard,savedLeaderboard}=require('../lib/web-season-leaderboard');
const script=fs.readFileSync(path.join(__dirname,'../assets/site.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const row=(name,points,date,season='division.bro.official.console-43')=>({
  season_id:season,player_name:name,platform:'xbox',
  captured_at:date,rank_points:points,matches:45,kills:10,wins:1,
  damage:2200,tier:'Gold',sub_tier:'2',player_id:9999,pubg_account_id:'secret'
});
test('shaped board exposes only safe fields and preserves missing genuine values',()=>{
  const shaped=shapeLeaderboard([
    row('Alpha',2489,'2026-11-03T16:00:00Z'),
    row('Bravo',null,'2026-11-03T15:00:00Z')
  ],'ranked','squad');
  assert.equal(shaped.entries.length,2);
  assert.equal(shaped.entries[1].rankPoints,null);
  assert.equal(shaped.seasons.length,1);
  assert.doesNotMatch(JSON.stringify(shaped),/secret|player_id|pubg_account_id/);
});
test('invalid input blocks database calls and server RPC is read-only',async()=>{
  const calls=[],db={rpc:async(name,args)=>{
    calls.push({name,args});
    return{data:[row('Alpha',2489,'2026-11-03T16:00:00Z')],error:null};
  }};
  assert.equal((await savedLeaderboard(db,{type:'invalid'})).status,400);
  assert.equal(calls.length,0);
  const good=await savedLeaderboard(db,{type:'ranked',mode:'squad'});
  assert.equal(good.status,200);
  assert.equal(good.body.entries.length,1);
  assert.equal(calls[0].name,'get_clan_season_leaderboard');
  assert.deepEqual(calls[0].args,{p_kind:'ranked',p_mode:'squad'});
});
test('historical leaderboard UI uses actual returned metrics and handles sparse observations',async()=>{
  const elements={},requests=[];
  function get(id) {
    if(elements[id])return elements[id];
    const defaults={'season-board-type':'ranked','season-board-mode':'squad',
      'season-board-metric':'rankPoints','sort':'kills','leader-console':'all',
      'player-console':'all','player-status':'all','roster-sort':'name',
      'roster-page-size':'20','compare-mode':'all','weapon-category':'total',
      'weapon-search':'','console-platform':'auto'};
    return elements[id]={id,value:defaults[id]??'',innerHTML:'',textContent:'',
      checked:false,disabled:false,hidden:false,style:{},dataset:{},options:[],
      classList:{toggle(){}},setAttribute(){},removeAttribute(){},
      addEventListener(event,handler){this.events[event]=handler;},
      events:{},showModal(){this.open=true;},close(){this.open=false;}};
  }
  const list=['solo','duo','squad','solo-fpp','duo-fpp','squad-fpp'];
  const player={name:'Alpha',platform:'xbox',kills:12,wins:1,matches:20,
    kd:0.6,winRate:5,advanced:{},modes:{}};
  const overview={schemaVersion:1,players:[player],roster:{
    total:1,verified:1,entries:[{name:'Alpha',platform:'xbox',status:'matched',verified:true}],states:{}},
    totals:{kills:12,wins:1,matches:20},platforms:{xbox:1,psn:0},modeOrder:list,
    modeTotals:Object.fromEntries(list.map(m=>[m,{matches:0,kills:0,wins:0,damage:0,assists:0}])),
    lastSync:'2026-11-03T16:00:00Z'};
  const board=shapeLeaderboard([
    row('Alpha',2489,'2026-11-03T16:00:00Z'),
    row('Bravo',null,'2026-11-03T15:00:00Z')
  ],'ranked','squad');
  const document={getElementById:get,querySelectorAll(){return[];},addEventListener(){}};
  const ctx={document,window:{scrollTo(){},localStorage:{getItem(){return null;}},prompt(){}},
    location:{hash:'#season',origin:'https://pubg-clan-bot.vercel.app'},
    history:{replaceState(){},pushState(){}},navigator:{clipboard:{}},
    fetch:async(url)=>{
      requests.push(url);
      if(url==='/api/public-stats')return{ok:true,json:async()=>overview};
      if(url.startsWith('/api/public-season-leaderboard'))return{ok:true,json:async()=>board};
      if(url.startsWith('/api/public-season'))return{ok:true,json:async()=>({
        schemaVersion:1,type:'season',seasonId:null,archivedSeasons:[],history:[],
        modes:[],note:'No season stats yet'
      })};
      throw Error('Unexpected request '+url);
    },console:{error(){}}
  };
  vm.runInNewContext(script,ctx);
  for(let i=0;i<80;i++)await Promise.resolve();
  assert.match(get('season-board-table').innerHTML,/2,489/);
  assert.doesNotMatch(get('season-board-table').innerHTML,/Bravo/);
  assert.match(get('season-board-note').textContent,/1 missing that metric/);
  get('season-board-metric').value='kills';
  get('season-board-metric').events.change();
  assert.match(get('season-board-table').innerHTML,/Bravo/);
  assert.ok(requests.every(url=>url.startsWith('/api/')));
});
test('season leaderboard controls are included and protected from secret leakage',()=>{
  for(const id of ['season-board-type','season-board-mode','season-board-season',
    'season-board-metric','season-board-table','season-board-reload']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.doesNotMatch(script,/SUPABASE_SERVICE_KEY|PUBG_API_KEY|DISCORD_BOT_TOKEN/);
});
