'use strict';
// Player-selected, genuinely sampled PUBG telemetry. Browser never sees API keys.
(function(){
 const $=id=>document.getElementById(id);
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
 const n=v=>typeof v==='number'&&Number.isFinite(v)?
  v.toLocaleString('en-GB',{maximumFractionDigits:2}):'—';
 let person=null,matches=[],report=null,play=false,frame=null,lastFrame=0;
 let center=null,selectedTime=0,eventPage=0,rivalsRequest=0;
 function stop(){
  play=false;
  $('telemetry-play').textContent='▶ Play';
  if(frame!==null&&window.cancelAnimationFrame)window.cancelAnimationFrame(frame);
  frame=null;lastFrame=0;
 }
 function matchesChanged(name,items){
  stop();person=name;matches=Array.isArray(items)?items.filter(m=>
   typeof m.id==='string'&&/^[\da-f-]{36}$/i.test(m.id)):[];
  report=null;center=null;selectedTime=0;
  const select=$('telemetry-match'),previous=select.value;
  select.innerHTML=matches.map(m=>
   '<option value="'+escape(m.id)+'">'+escape(m.map||'Unknown map')+
   ' · '+escape(m.playedAt||'saved match')+' · '+escape(m.id.slice(0,8))+'</option>'
  ).join('');
  if(matches.some(m=>m.id===previous))select.value=previous;
  else select.value=matches[0]?.id||'';
  $('telemetry-load').disabled=!matches.length;
  $('telemetry-status').textContent=matches.length?
   'Select a saved match, then analyse its real telemetry. First retrieval uses the shared web cooldown; saved analyses reuse Supabase.':
   'No detailed saved matches for this player yet. Refresh recent matches first.';
  $('telemetry-report').innerHTML='';
  $('telemetry-map').innerHTML='';
  $('telemetry-track').innerHTML='';
  $('telemetry-event-list').innerHTML='';
  $('telemetry-event-count').textContent='Load real match telemetry to explore events.';
  $('telemetry-rivals-table').innerHTML='';
  $('telemetry-rivals-note').textContent='Select a player and read previously analysed matches.';
  $('telemetry-rivals-refresh').disabled=!person;
  rivalsRequest++;
 }
 function point(samples,t){
  let start=0,end=samples.length-1,result=null;
  while(start<=end){
   const mid=(start+end)>>1;
   if(samples[mid].t<=t){result=samples[mid];start=mid+1;}
   else end=mid-1;
  }
  return result;
 }
 function viewport(bounds,zoom){
  const scale=[1,2,4,8].includes(zoom)?zoom:1,size=bounds.size/scale;
  const mid=center||{x:bounds.x+bounds.size/2,y:bounds.y+bounds.size/2};
  return{
   x:Math.max(bounds.x,Math.min(bounds.x+bounds.size-size,mid.x-size/2)),
   y:Math.max(bounds.y,Math.min(bounds.y+bounds.size-size,mid.y-size/2)),
   size
  };
 }
 function draw(){
  const r=report?.replay,box=$('telemetry-map');
  if(!r||!r.bounds||!Number.isFinite(r.bounds.size)||r.bounds.size<=0)return;
  const t=selectedTime,zoom=Number($('telemetry-zoom').value)||1;
  const v=viewport(r.bounds,zoom),size=590,scale=size/v.size,pad=40;
  const xy=p=>[pad+(p.x-v.x)*scale,pad+(p.y-v.y)*scale];
  const [tracks,circles,combat]=[r.tracks||[],r.circles||[],r.combat||[]];
  const chosen=$('telemetry-track').value;
  let svg='<svg viewBox="0 0 670 670" role="img" aria-label="PUBG recorded positions and circles, not interpolated movement">'+
   '<defs><clipPath id="telemetry-map-clip"><rect x="40" y="40" width="590" height="590"/></clipPath></defs>'+
   '<rect x="40" y="40" width="590" height="590" fill="#101b2d" stroke="#5f7390"/>';
  for(let i=0;i<=10;i++){
   const pos=pad+i*size/10;
   svg+='<line x1="'+pos+'" x2="'+pos+'" y1="40" y2="630" stroke="#263d58"/>'+
    '<line x1="40" x2="630" y1="'+pos+'" y2="'+pos+'" stroke="#263d58"/>';
  }
  svg+='<g clip-path="url(#telemetry-map-clip)">';
  const circle=circles.filter(c=>c.t<=t).at(-1);
  const zoneColors={safetyZone:'#57c5ff',poisonGasWarning:'#fff',
   redZone:'#ff6d85',blackZone:'#bb87ff'};
  for(const z of circle?.zones||[]){
   const [x,y]=xy(z),radius=z.radius*scale;
   if(radius>=0&&radius<=250000)
    svg+='<circle cx="'+x+'" cy="'+y+'" r="'+radius+'" fill="none" stroke="'+
     (zoneColors[z.key]||'#ccc')+'" stroke-width="2"/>';
  }
  const selected=tracks.find(x=>x.key===chosen);
  if(selected){
   let sections=[],section=[],last=null;
   for(const p of selected.samples||[]){
    if(p.t>t)break;
    if(p.t<t-120)continue;
    if(last!==null&&p.t-last>30){if(section.length)sections.push(section);section=[];}
    section.push(xy(p).map(n=>n.toFixed(2)).join(','));last=p.t;
   }
   if(section.length)sections.push(section);
   for(const points of sections)if(points.length>1)
    svg+='<polyline points="'+points.join(' ')+'" fill="none" stroke="#ffcc66" stroke-width="2.5"/>';
  }
  let fresh=0,stale=0;
  for(let i=0;i<tracks.length;i++){
   const track=tracks[i],p=point(track.samples||[],t);
   if(!p)continue;
   const [x,y]=xy(p),age=t-p.t,isSelected=track.key===chosen;
   if(age>30)stale++;else fresh++;
   svg+='<circle cx="'+x+'" cy="'+y+'" r="'+(isSelected?5.5:3)+
    '" fill="'+(isSelected?'#ffcc66':track.isSelected?'#44e5c2':'#8fa8e7')+
    '" fill-opacity="'+(age>30?'.2':'1')+'" stroke="'+
    (isSelected?'#ffcc66':'#597ba8')+'" stroke-width="1"><title>'+
    escape(track.name)+' · sampled '+age.toFixed(1)+' seconds ago</title></circle>';
  }
  for(const c of combat)if(c.location&&c.t<=t&&t-c.t<=12){
   const [x,y]=xy(c.location);
   svg+='<rect x="'+(x-4)+'" y="'+(y-4)+'" width="8" height="8" fill="none" stroke="#ff758e" stroke-width="2"><title>'+
     escape(c.actor)+' → '+escape(c.victim)+'</title></rect>';
  }
  svg+='</g><text x="40" y="20" fill="#d0dff2" font-size="13">'+
   'Recorded PUBG coordinates · '+Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+
   ' / '+Math.floor(r.duration/60)+':'+String(Math.floor(r.duration%60)).padStart(2,'0')+
   '</text><text x="40" y="656" fill="#a9bad1" font-size="12">'+
   fresh+' recent tracks · '+stale+' stale samples · '+zoom+'× zoom</text></svg>';
  box.innerHTML=svg;
  $('telemetry-timer').textContent='Time '+t.toFixed(1)+'s of '+Number(r.duration).toFixed(1)+'s';
  const current=selected&&point(selected.samples||[],t);
  $('telemetry-position').textContent=current?
   selected.name+' at '+(current.x/100).toFixed(1)+'m E, '+
   (current.y/100).toFixed(1)+'m S · last sampled '+(t-current.t).toFixed(1)+'s ago':
   'Choose a player with real recorded positions. No missing positions are interpolated.';
 }
 function renderEventBrowser(){
  const events=Array.isArray(report?.playerEvents)?report.playerEvents:[];
  const kind=$('telemetry-event-type').value;
  const search=$('telemetry-event-search').value.trim().toLowerCase();
  const filtered=events.filter(row=>
   (!kind||row.type===kind)&&
   (!search||[row.type,row.actor,row.subject,row.sourceIndex,row.timestamp].some(value=>
    String(value??'').toLowerCase().includes(search))));
  const size=40,pages=Math.max(1,Math.ceil(filtered.length/size));
  eventPage=Math.min(Math.max(0,eventPage),pages-1);
  $('telemetry-event-prev').disabled=eventPage===0;
  $('telemetry-event-next').disabled=eventPage>=pages-1;
  const coverage=report?.activityCoverage;
  $('telemetry-event-count').textContent=filtered.length+' matching player events · '+
   'page '+(eventPage+1)+' of '+pages+' · '+
   (coverage?(coverage.returned||events.length)+' of '+coverage.observed+
    ' meaningful events retained'+(coverage.truncated?' (bounded sample)':''):
    events.length+' stored event rows (older saved report)')+
   ' · '+(report?.sourceEvents||0)+' total PUBG match source events.';
  $('telemetry-event-list').innerHTML=filtered.slice(eventPage*size,(eventPage+1)*size)
   .map(row=>{
    const canJump=typeof row.timeSeconds==='number'&&
      Number.isFinite(row.timeSeconds)&&row.timeSeconds>=0;
    const action=canJump?'<button type="button" class="secondary telemetry-jump" data-telemetry-jump="'+
     row.timeSeconds+'" aria-label="Jump replay to event '+row.sourceIndex+'">Jump to '+row.timeSeconds.toFixed(1)+'s</button>':
     'No timestamp';
    return '<tr><td>'+n(row.sourceIndex)+'</td><td>'+escape(row.timestamp||'—')+
     '</td><td>'+escape(row.type)+'</td><td>'+escape(row.actor)+'</td><td>'+
     escape(row.subject)+'</td><td>'+action+'</td></tr>';
   }).join('')||'<tr><td colspan="6">No real event rows match this filter.</td></tr>';
 }
 function chooseEvent(t){
  if(!report?.replay||!Number.isFinite(t))return;
  stop();
  selectedTime=Math.max(0,Math.min(Number(report.replay.duration)||0,t));
  $('telemetry-time').value=String(selectedTime);
  draw();
 }
 function exportEvents(){
  if(!report)return;
  const payload={
   matchId:report.matchId,player:report.player,
   source:'Sanitized selected-player event references from a genuine PUBG match',
   activityCoverage:report.activityCoverage||null,
   events:Array.isArray(report.playerEvents)?report.playerEvents:[]
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  try{
   const a=document.createElement('a');
   a.href=url;a.download='pubg-player-events-'+String(report.matchId||'match').slice(0,36)+'.json';
   a.click();
  }finally{URL.revokeObjectURL(url);}
 }
 async function readRivals(){
  if(!person)return;
  const request=++rivalsRequest,selectedName=person;
  const button=$('telemetry-rivals-refresh');
  button.disabled=true;
  $('telemetry-rivals-note').textContent='Reading previously analysed match reports…';
  try{
   const params=new URLSearchParams({name:selectedName,route:'rivals'});
   const response=await fetch('/api/public-matches?'+params.toString(),
    {cache:'no-store',headers:{Accept:'application/json'}});
   const data=await response.json();
   if(!response.ok||data.schemaVersion!==1||!Array.isArray(data.rivals))
    throw Error(data.error||'Saved rival reports unavailable');
   if(request!==rivalsRequest||selectedName!==person)return;
   $('telemetry-rivals-note').textContent=data.matchesAnalysed+
    ' distinct, previously analysed matches · '+data.rivals.length+
    ' visible opponent names. Names can be shared between accounts; this is not a verified cross-match identity or career total.';
   $('telemetry-rivals-table').innerHTML=data.rivals.map(row=>
    '<tr><td>'+escape(row.name)+'</td><td>'+n(row.matchesSampled)+'</td><td>'+
     n(row.kills)+'</td><td>'+n(row.deaths)+'</td><td>'+
     n(row.damageDealt)+'</td><td>'+n(row.damageTaken)+'</td><td>'+
     escape(row.lastMatchAt||'—')+'</td></tr>'
   ).join('')||'<tr><td colspan="7">No saved opponent encounters yet. Analyse one of the actual saved matches first.</td></tr>';
  }catch(error){
   if(request!==rivalsRequest)return;
   $('telemetry-rivals-note').textContent='Rival reports unavailable: '+error.message;
   $('telemetry-rivals-table').innerHTML='';
  }finally{
   if(request===rivalsRequest)button.disabled=false;
  }
 }

 function render(){
  if(!report)return;
  const summary=report.combatSummary||{},rows=report.rivals||[];
  $('telemetry-report').innerHTML='<div class="stats cc-telemetry-stats">'+
   [['Kills (sampled)',summary.kills],['Deaths (sampled)',summary.deaths],
    ['Damage dealt (sampled)',summary.damageDealt],['Damage taken (sampled)',summary.damageTaken],
    ['Knocks (sampled)',summary.knocks],['Revives (sampled)',summary.revives]
   ].map(([title,value])=>'<div class="card metric"><small>'+escape(title)+
    '</small><strong>'+n(value)+'</strong></div>').join('')+'</div>'+
   '<h3>Confirmed opponents in this match</h3>'+
   '<div class="scroll-table"><table><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>DAMAGE DEALT</th><th>DAMAGE TAKEN</th></tr></thead><tbody>'+
   (rows.map(x=>'<tr><td>'+escape(x.name)+'</td><td>'+n(x.kills)+'</td><td>'+
    n(x.deaths)+'</td><td>'+n(x.damageDealt)+'</td><td>'+n(x.damageTaken)+
    '</td></tr>').join('')||'<tr><td colspan="5">No attributable opponents in this telemetry sample.</td></tr>')+
   '</tbody></table></div>'+
   '<details><summary>Weapon damage in this match</summary>'+
   '<div class="scroll-table"><table><thead><tr><th>WEAPON / CAUSE</th><th>DAMAGE</th></tr></thead><tbody>'+
   (report.weapons||[]).map(x=>'<tr><td>'+escape(x.name)+'</td><td>'+n(x.damage)+'</td></tr>').join('')+
   '</tbody></table></div></details>'+

   '<p class="small muted">'+escape(report.note)+'</p>';
  const r=report.replay;
  $('telemetry-track').innerHTML=(r?.tracks||[]).map(x=>
   '<option value="'+escape(x.key)+'"'+(x.isSelected?' selected':'')+'>'+
    escape(x.name)+'</option>').join('');
  $('telemetry-track').value=(r?.tracks||[]).find(x=>x.isSelected)?.key||
   r?.tracks?.[0]?.key||'';
  $('telemetry-time').max=String(r?.duration||0);
  $('telemetry-time').value='0';
  selectedTime=0;center=null;
  $('telemetry-zoom').value='1';
  $('telemetry-event-type').innerHTML='<option value="">All recorded player events</option>'+
   [...new Set((report.playerEvents||[]).map(e=>e.type))].sort().map(type=>
    '<option value="'+escape(type)+'">'+escape(type)+'</option>').join('');
  $('telemetry-event-search').value='';eventPage=0;
  renderEventBrowser();
  draw();
 }
 async function load(){
  if(!person||!$('telemetry-match').value)return;
  stop();
  $('telemetry-load').disabled=true;
  $('telemetry-status').textContent='Reading real PUBG telemetry or a stored analysis…';
  $('telemetry-report').innerHTML='';
  $('telemetry-map').innerHTML='';
  try{
   const params=new URLSearchParams({name:person,match:$('telemetry-match').value,route:'telemetry'});
   const res=await fetch('/api/public-telemetry?'+params.toString(),{cache:'no-store'});
   const body=await res.json();
   if(!res.ok)throw Error((body.error||'Telemetry unavailable')+
    (body.retryAfterSeconds?' · Retry after '+body.retryAfterSeconds+'s':''));
   if(body.schemaVersion!==1||!body.replay)throw Error('Unexpected telemetry result');
   report=body;render();
   $('telemetry-status').textContent='Actual '+n(body.sourceEvents)+
    ' PUBG events from '+n(body.playerEvents?.length||0)+
    ' saved player activity references · '+body.cache+' derived report · '+
    (body.analysedAt||'')+
    '. Player and opponent values are match-local; positions are samples only.';
  }catch(error){
   report=null;
   $('telemetry-status').textContent=error.message;
  }finally{$('telemetry-load').disabled=false;}
 }
 function tick(now){
  if(!play)return;
  if(document.hidden||!report){stop();return;}
  if(lastFrame)selectedTime=Math.min(Number(report.replay.duration),
   selectedTime+(now-lastFrame)/1000*(Number($('telemetry-speed').value)||5));
  lastFrame=now;
  $('telemetry-time').value=String(selectedTime);
  draw();
  if(selectedTime>=Number(report.replay.duration)){stop();return;}
  frame=window.requestAnimationFrame(tick);
 }
 function pan(dx,dy){
  const b=report?.replay?.bounds;
  if(!b)return;
  const zoom=Number($('telemetry-zoom').value)||1;
  const now=viewport(b,zoom);
  center={x:now.x+now.size/2+dx*now.size/4,y:now.y+now.size/2+dy*now.size/4};
  draw();
 }
 function init(){
  $('telemetry-load').addEventListener('click',load);
  $('telemetry-rivals-refresh').addEventListener('click',readRivals);
  $('telemetry-event-type').addEventListener('change',function(){eventPage=0;renderEventBrowser();});
  $('telemetry-event-search').addEventListener('input',function(){eventPage=0;renderEventBrowser();});
  $('telemetry-event-prev').addEventListener('click',function(){eventPage--;renderEventBrowser();});
  $('telemetry-event-next').addEventListener('click',function(){eventPage++;renderEventBrowser();});
  $('telemetry-event-export').addEventListener('click',exportEvents);
  $('telemetry-event-list').addEventListener('click',function(event){
   const action=event.target.closest&&event.target.closest('[data-telemetry-jump]');
   if(action)chooseEvent(Number(action.dataset.telemetryJump));
  });
  $('telemetry-track').addEventListener('change',draw);
  $('telemetry-time').addEventListener('input',function(){
   selectedTime=Number(this.value)||0;draw();
  });
  $('telemetry-speed').addEventListener('change',draw);
  $('telemetry-zoom').addEventListener('change',draw);
  $('telemetry-play').addEventListener('click',function(){
   if(play){stop();return;}
   if(!report)return;
   if(selectedTime>=report.replay.duration)selectedTime=0;
   play=true;this.textContent='Ⅱ Pause';lastFrame=0;
   frame=window.requestAnimationFrame(tick);
  });
  for(const [key,dx,dy]of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]])
   $('telemetry-pan-'+key).addEventListener('click',()=>pan(dx,dy));
  $('telemetry-center').addEventListener('click',function(){
   const chosen=report?.replay?.tracks?.find(x=>x.key===$('telemetry-track').value);
   const sample=chosen&&point(chosen.samples||[],selectedTime);
   if(sample){center={x:sample.x,y:sample.y};draw();}
  });
  $('telemetry-reset').addEventListener('click',function(){
   center=null;$('telemetry-zoom').value='1';draw();
  });
 }
 init();
 window.TelemetryView={matchesChanged,renderForTest:data=>{report=data;render();},
  jumpToEvent:chooseEvent,renderEventBrowser};
})();
