'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=fs.readFileSync(path.join(__dirname,'../assets/telemetry-view.js'),'utf8');
function browser(){
 const nodes={},calls=[];
 function $(id){
  if(nodes[id])return nodes[id];
  return nodes[id]={id,value:id==='telemetry-zoom'?'1':'',
   innerHTML:'',textContent:'',disabled:false,dataset:{},events:{},
   addEventListener(type,callback){this.events[type]=callback;}};
 }
 const fakeReport={
  schemaVersion:1,matchId:'e7ff11aa-2222-3333-4444-555555555555',
  player:'Hero',cache:'saved',note:'Actual observed PUBG matches',
  sourceEvents:950,
  combatSummary:{kills:1,deaths:0,damageDealt:40,damageTaken:null,
   knocks:1,revives:0},rivals:[{name:'Opponent',kills:1,deaths:0,
    damageDealt:40,damageTaken:null}],
  weapons:[{name:'WeapAK47_C',damage:40}],
  playerEvents:[{sourceIndex:10,type:'LogPlayerTakeDamage',
    timestamp:'2026-11-03T12:00:07Z',actor:'Hero',subject:'Opponent',
    timeSeconds:7,damage:40},
    {sourceIndex:25,type:'LogPlayerKillV2',
     timestamp:'2026-11-03T12:00:12Z',actor:'Hero',subject:'Opponent',
     timeSeconds:12,damage:null}],
  activityCoverage:{observed:2,returned:2,truncated:false},
  replay:{duration:90,mapName:'Erangel_Main',origin:'2026-11-03T12:00:00Z',
   bounds:{x:0,y:0,size:816000},circles:[],combat:[],
   tracks:[{key:'t0',name:'Hero',isSelected:true,
    samples:[{t:0,x:0,y:0,health:100},{t:10,x:20000,y:30000,health:50}]}]}
 };
 const window={
  requestAnimationFrame(){return 1;},cancelAnimationFrame(){},
  URL:{createObjectURL(){return'blob:fake';},revokeObjectURL(){}}
 };
 const ctx={window,document:{getElementById:$,hidden:false,
   createElement(){return{click(){},set href(v){this._href=v;}}}},
   fetch:async url=>{
    calls.push(url);
    assert.match(url,/\/api\/public-matches\?/);
    assert.match(url,/route=rivals/);
    return{ok:true,json:async()=>({
     schemaVersion:1,matchesAnalysed:2,
     rivals:[{name:'Opponent',matchesSampled:2,kills:1,deaths:1,
      damageDealt:50,damageTaken:20,lastMatchAt:'2026-11-03T12:00:00Z'}]
    })};
   },
   console,URL:window.URL,Blob:class Blob{constructor(parts){this.parts=parts;}},
   URLSearchParams};
 vm.runInNewContext(code,ctx);
 return{get:$,view:window.TelemetryView,report:fakeReport,calls};
}
test('event explorer controls, replay player tracks and saved rivals exist',()=>{
 for(const id of ['telemetry-event-type','telemetry-event-search',
  'telemetry-event-list','telemetry-event-next','telemetry-event-prev',
  'telemetry-event-count','telemetry-event-export','telemetry-rivals-refresh',
  'telemetry-rivals-table']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
});
test('source-indexed event filtering, exact jumps and replay position render',()=>{
 const b=browser();
 b.view.matchesChanged('Hero',[{id:b.report.matchId,map:'Erangel_Main'}]);
 b.view.renderForTest(b.report);
 assert.match(b.get('telemetry-event-list').innerHTML,/LogPlayerKillV2/);
 assert.match(b.get('telemetry-event-list').innerHTML,/data-telemetry-jump="12"/);
 assert.match(b.get('telemetry-map').innerHTML,/<svg/);
 b.get('telemetry-event-type').value='LogPlayerKillV2';
 b.get('telemetry-event-type').events.change();
 assert.doesNotMatch(b.get('telemetry-event-list').innerHTML,/LogPlayerTakeDamage/);
 assert.match(b.get('telemetry-event-list').innerHTML,/LogPlayerKillV2/);
 b.view.jumpToEvent(12);
 assert.equal(b.get('telemetry-time').value,'12');
 assert.match(b.get('telemetry-position').textContent,/sampled 2\.0s ago/);
 assert.equal(b.calls.length,0);
});
test('source event search avoids showing missing or invented entries',()=>{
 const b=browser();b.view.renderForTest(b.report);
 b.get('telemetry-event-search').value='unrelated-name';
 b.get('telemetry-event-search').events.input();
 assert.match(b.get('telemetry-event-list').innerHTML,/No real event rows/);
 assert.match(b.get('telemetry-event-count').textContent,/0 matching/);
});
test('observed cross-match rival trends request only cached derived report route',async()=>{
 const b=browser();
 b.view.matchesChanged('Hero',[{id:b.report.matchId,map:'Erangel_Main'}]);
 await b.get('telemetry-rivals-refresh').events.click();
 assert.equal(b.calls.length,1);
 assert.match(b.calls[0],/route=rivals/);
 assert.match(b.get('telemetry-rivals-table').innerHTML,/Opponent/);
 assert.match(b.get('telemetry-rivals-table').innerHTML,/50/);
 assert.match(b.get('telemetry-rivals-note').textContent,/2 distinct/);
});
