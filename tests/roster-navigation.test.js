'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../assets/site.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const modes=['solo','duo','squad','solo-fpp','duo-fpp','squad-fpp'];
const entries=Array.from({length:55},(_,i)=>({
  name:'Member '+String(i+1).padStart(2,'0'),platform:'xbox',verified:true,status:'matched'
}));
const players=entries.map((r,i)=>({
  name:r.name,platform:'xbox',kills:55-i,wins:i,matches:100,kd:1,
  winRate:10,advanced:{},modes:{},updatedAt:'2026-11-03T20:00:00Z'
}));
const overview={
  schemaVersion:1,players,roster:{total:55,verified:55,entries,states:{}},
  totals:{kills:100,wins:10,matches:200},platforms:{xbox:55,psn:0},
  modeOrder:modes,modeTotals:Object.fromEntries(modes.map(m=>[m,{
    matches:0,kills:0,wins:0,damage:0,assists:0}])),
  lastSync:'2026-11-03T20:00:00Z'
};
async function app(stored={}) {
  const elements={},events={};
  const storage={
    getItem(key){return stored[key]??null;},
    setItem(key,value){stored[key]=value;}
  };
  function get(id) {
    if(elements[id])return elements[id];
    const defaults={sort:'kills','leader-console':'all','player-console':'all',
      'player-status':'all','roster-sort':'name','roster-page-size':'20',
      'compare-mode':'all','weapon-category':'total','weapon-search':'',
      'season-type':'ranked','console-platform':'auto'};
    return elements[id]={id,value:defaults[id]??'',checked:false,innerHTML:'',
      textContent:'',hidden:false,disabled:false,open:false,style:{},dataset:{},
      options:[],events:{},classList:{toggle(){}},setAttribute(){},
      removeAttribute(){},addEventListener(event,handler){this.events[event]=handler;},
      showModal(){this.open=true;},close(){this.open=false;}};
  }
  const document={getElementById:get,querySelectorAll(){return [];},
    addEventListener(event,handler){events[event]=handler;}};
  const context={document,window:{localStorage:storage,scrollTo(){},prompt(){}},
    location:{hash:'',origin:'https://pubg-help-clan.vercel.app'},
    history:{replaceState(){},pushState(){}},navigator:{clipboard:{}},
    fetch:async url=>{
      assert.equal(url,'/api/public-stats');
      return{ok:true,json:async()=>overview};
    },console:{error(){}}
  };
  vm.runInNewContext(script,context);
  for(let i=0;i<80;i++)await Promise.resolve();
  return{get,elements,events,stored};
}
const rows=app=>[...app.get('roster-table').innerHTML.matchAll(/<tr>/g)].length;
test('roster supports real 55-member pagination with stable page controls',async()=>{
  const a=await app();
  assert.equal(rows(a),20);
  assert.match(a.get('roster-count').textContent,/Showing 1–20 of 55/);
  assert.equal(a.get('roster-page-label').textContent,'Page 1 of 3');
  a.get('roster-next').events.click();
  assert.equal(rows(a),20);
  assert.match(a.get('roster-count').textContent,/21–40/);
  a.get('roster-next').events.click();
  assert.equal(rows(a),15);
  assert.equal(a.get('roster-next').disabled,true);
  a.get('search').value='Member 05';
  a.get('search').events.input();
  assert.equal(rows(a),1);
  assert.equal(a.get('roster-page-label').textContent,'Page 1 of 1');
  assert.equal(a.get('roster-prev').disabled,true);
  assert.equal(a.get('roster-next').disabled,true);
});
test('favourites persist locally, filter roster and are never sent upstream',async()=>{
  const saved={};
  const a=await app(saved);
  a.events.click({target:{closest(selector){
    return selector==='[data-favourite]'?{dataset:{favourite:'Member 01'}}:null;
  }}});
  assert.match(saved['pubg-clan-roster-favourites-v1'],/member 01/);
  a.get('roster-favs-only').checked=true;
  a.get('roster-favs-only').events.change();
  assert.equal(rows(a),1);
  assert.match(a.get('roster-table').innerHTML,/aria-pressed="true"/);
  const b=await app(saved);
  b.get('roster-favs-only').checked=true;
  b.get('roster-favs-only').events.change();
  assert.equal(rows(b),1);
  b.events.click({target:{closest(selector){
    return selector==='[data-favourite]'?{dataset:{favourite:'Member 01'}}:null;
  }}});
  assert.equal(rows(b),1); // The table deliberately renders one empty-state row.
  assert.match(b.get('roster-table').innerHTML,/No players match the chosen filters/);
  assert.match(b.get('roster-count').textContent,/No matching members/);
  assert.equal(JSON.parse(saved['pubg-clan-roster-favourites-v1']).length,0);
});
test('roster controls, labels and client-only storage are present',()=>{
  for(const id of ['roster-sort','roster-favs-only','roster-page-size',
    'roster-prev','roster-next','roster-page-label']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.doesNotMatch(script,/SUPABASE_SERVICE_KEY|PUBG_API_KEY|DISCORD_BOT_TOKEN/);
});
