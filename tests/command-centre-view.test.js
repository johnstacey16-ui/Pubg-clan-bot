'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Engine=require('../assets/clan-analytics.js');
const code=fs.readFileSync(path.join(__dirname,'../assets/command-centre.js'),'utf8');
const players=Array.from({length:8},(_,i)=>{
 const matches=60+i*20;
 return{
  name:'Member'+i,platform:i%2?'psn':'xbox',
  matches,kills:(60+i*22)*2,wins:i+3,updatedAt:'2026-11-03T20:00:00Z',
  advanced:{damage:20000+i*2500,assists:25+i*2,revives:12+i,top10:15+i},
  modes:{squad:{roundsPlayed:matches,kills:80+i*15,wins:4+i,
   damageDealt:20000+i*2500,assists:25+i*2,revives:12+i,top10s:15+i}}
 };
});
function app(){
 const nodes={};
 function get(id){
  if(nodes[id])return nodes[id];
  return nodes[id]={id,innerHTML:'',textContent:'',value:
   id==='cc-min-matches'?'30':id==='cc-team-weight'?'100':'',
   events:{},addEventListener(name,fn){this.events[name]=fn;},files:[]};
 }
 const window={ClanAnalytics:Engine};
 const document={getElementById:get,createElement(){return{click(){}}}};
 const fetch=async url=>{
  assert.equal(url,'/api/public-progress?days=3');
  return{ok:true,json:async()=>({schemaVersion:1,kind:'observed-progress',windowDays:3,minDays:2,maxDays:4,rows:[
   {name:'Member0',platform:'xbox',
    latestAt:'2026-11-07T12:00:00Z',previousAt:'2026-11-04T12:00:00Z',
    latestKills:110,previousKills:100,latestMatches:60,previousMatches:55,
    latestWins:5,previousWins:4}
  ]})};
 };
 vm.runInNewContext(code,{window,document,fetch,console});
 return{get,render:window.CommandCentre.render,radar:window.CommandCentre.radar};
}
test('awards, roles and real observed historical improvements render',async()=>{
 const a=app(),data={players};
 a.render('awards',data);
 assert.match(a.get('cc-awards-grid').innerHTML,/Sharpshooter/);
 assert.match(a.get('cc-awards-grid').innerHTML,/Member/);
 a.render('analysis',data);
 for(let i=0;i<35;i++)await Promise.resolve();
 assert.match(a.get('cc-scores').innerHTML,/Member0/);
 assert.match(a.get('cc-score-note').textContent,/rated players/);
 assert.match(a.get('cc-progress').innerHTML,/Member0/);
 assert.match(a.get('cc-quality-note').textContent,/checks identified/);
});
test('what-if controls update locally without PUBG requests',()=>{
 const a=app(),data={players};
 a.render('analysis',data);
 const prev=a.get('cc-score-note').textContent;
 a.get('cc-min-matches').value='150';
 a.get('cc-min-matches').events.input();
 assert.equal(a.get('cc-min-output').textContent,150);
 assert.notEqual(a.get('cc-score-note').textContent,prev);
});
test('comparison radar is generated only from shared real mode statistics',()=>{
 const a=app();
 a.radar('compare-radar',players[0],players[1],'squad',players);
 assert.match(a.get('compare-radar').innerHTML,/<svg/);
 assert.match(a.get('compare-radar').innerHTML,/Percentiles within/);
});
test('local historical CSVs compare without any write endpoint',async()=>{
 const a=app(),data={players};
 a.render('data-tools',data);
 assert.match(a.get('cc-local-comparison').innerHTML,/without changing/);
 const older={name:'before.csv',size:55,text:async()=>'name,matches,kills\nMember0,20,35'};
 const newer={name:'after.csv',size:55,text:async()=>'name,matches,kills\nMember0,25,42'};
 a.get('cc-before-file').events.change.call({files:[older]});
 a.get('cc-after-file').events.change.call({files:[newer]});
 for(let i=0;i<45;i++)await Promise.resolve();
 assert.match(a.get('cc-local-comparison').innerHTML,/Member0/);
 assert.match(a.get('cc-local-comparison').innerHTML,/>7</);
});
