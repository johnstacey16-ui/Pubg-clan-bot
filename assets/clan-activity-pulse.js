'use strict';
// Tiny, archived-only clan activity timeline: no canvas, map textures,
// telemetry downloads, timers, background polling or PUBG API requests.
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)root.ClanActivityPulse=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[ch]);
 const numeric=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
 const fmt=n=>numeric(n).toLocaleString('en-GB',{maximumFractionDigits:1});
 const dayLabel=date=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))return 'Unknown date';
  return new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{
   day:'numeric',month:'short',timeZone:'UTC'
  });
 };
 const DAY_FIELDS=['playerMatches','distinctMatches','kills','killsObserved',
  'damage','damageObserved','knownPlacements','playerWins','playerTop10'];
 const count=(rows,metric)=>rows.reduce((sum,r)=>sum+numeric(r[metric]),0);
 function grouping(rows,periodDays){
  if(!Array.isArray(rows))return[];
  const isWeekly=periodDays===180;
  const groups=[];
  const block=isWeekly?7:1;
  for(let i=0;i<rows.length;i+=block){
   const bucket=rows.slice(i,i+block);
   if(!bucket.length)continue;
   const stats={
    from:bucket[0].day,to:bucket[bucket.length-1].day,
    label:isWeekly?dayLabel(bucket[0].day)+' – '+dayLabel(bucket[bucket.length-1].day):
      dayLabel(bucket[0].day),
    rows:bucket,activePlayerDays:count(bucket,'activePlayers')
   };
   for(const field of DAY_FIELDS)stats[field]=count(bucket,field);
   // The same player across two days contributes two player-days, not
   // one unique player for the week. Never label weekly count "players".
   if(!isWeekly)stats.activePlayers=numeric(bucket[0].activePlayers);
   groups.push(stats);
  }
  return groups;
 }
 function busiest(rows){
  const list=(Array.isArray(rows)?rows:[]).filter(r=>r&&numeric(r.distinctMatches)>0);
  return list.slice().sort((a,b)=>b.distinctMatches-a.distinctMatches||
    b.day.localeCompare(a.day))[0]||null;
 }
 function validateClient(data){
  return data&&data.schemaVersion===1&&data.kind==='clan-activity'&&
   data.timeZone==='UTC'&&[7,30,180].includes(data.periodDays)&&
   Array.isArray(data.days)&&data.days.length===data.periodDays;
 }
 let current=null,cached=new Map(),selected=new Map(),requestId=0,ready=false;
 const metrics={distinctMatches:'Distinct saved games',
  playerMatches:'Player-match observations',
  kills:'Observed kills',playerWins:'Player wins'};
 function render(data){
  if(!validateClient(data)||!$('clan-pulse-chart'))return;
  current=data;
  const days=data.periodDays,groups=grouping(data.days,days);
  const initial=days===180?groups.length-1:Math.max(0,groups.length-2);
  const index=Math.max(0,Math.min(groups.length-1,selected.get(days)??initial));
  selected.set(days,index);
  const end=data.days[data.days.length-1]?.day;
  const most=busiest(data.days);
  $('clan-pulse-kpis').innerHTML=[
   ['Verified clan members',data.verifiedPlayers],
   ['Players in saved matches',data.observedPlayers],
   ['Distinct saved games',data.distinctMatches],
   ['Player-match observations',data.playerMatchObservations]
  ].map(([title,n])=>'<div class="clan-pulse-kpi"><small>'+esc(title)+
   '</small><strong>'+fmt(n)+'</strong></div>').join('');
  const age=data.lastMatchAt&&Number.isFinite(Date.parse(data.lastMatchAt))?
   new Date(data.lastMatchAt).toLocaleString('en-GB',{
    dateStyle:'medium',timeStyle:'short',timeZone:'UTC'
   })+' UTC':'Not recorded';
  $('clan-pulse-coverage').textContent=days+' UTC calendar dates including the current partial day · '+
   groups.filter(g=>g.playerMatches>0).length+
   ' chart periods with archived data · last recorded match '+age+'. '+
   (most?'Busiest saved day: '+dayLabel(most.day)+' ('+
    fmt(most.distinctMatches)+' distinct games).':
    'No saved games in this window.');
  const metric=$('clan-pulse-metric').value in metrics?
   $('clan-pulse-metric').value:'distinctMatches';
  const max=Math.max(1,...groups.map(g=>numeric(g[metric])));
  $('clan-pulse-chart').innerHTML=groups.map((g,i)=>{
   const height=Math.max(2,Math.round(numeric(g[metric])/max*100));
   const isLast=g.to===end;
   const label=g.label+(days===180?' (UTC week group)':' (UTC)')+
    ' · '+fmt(g[metric])+' '+metrics[metric].toLowerCase();
   return '<div class="clan-pulse-slot">'+
    '<button type="button" class="clan-pulse-column'+
    (i===index?' selected':'')+'" aria-pressed="'+(i===index)+
    '" aria-label="'+esc(label)+'" title="'+esc(label)+'" data-pulse-index="'+i+'">'+
    '<span class="clan-pulse-fill" data-pulse-height="'+height+'"></span></button>'+
    '<span class="clan-pulse-tick">'+
    (days===7||days===180||i%5===0||isLast?esc(days===180?
      dayLabel(g.from):dayLabel(g.to)):'')+'</span></div>';
  }).join('');
  $('clan-pulse-chart').querySelectorAll('[data-pulse-height]').forEach(el=>{
   el.style.height=el.dataset.pulseHeight+'%';
  });
  const g=groups[index];
  if(!g)return;
  const part=g.to===end;
  const isWeekly=days===180;
  $('clan-pulse-detail').innerHTML=
   '<strong>'+esc(g.label)+(isWeekly?' (group of UTC days)':' UTC')+'</strong>'+
   (part?'<small class="clan-pulse-partial">Includes today, which is incomplete</small>':'')+
   '<div class="clan-pulse-detail-grid">'+[
    ['Distinct saved games',g.distinctMatches],
    ['Player-match observations',g.playerMatches],
    [isWeekly?'Active player-days':'Distinct active clan players',
      isWeekly?g.activePlayerDays:g.activePlayers],
    ['Observed player wins',g.playerWins],
    ['Reported kills',g.kills],
    ['Kills with recorded values',g.killsObserved],
    ['Top-10 player finishes',g.playerTop10],
    ['Known placements',g.knownPlacements]
   ].map(([label,n])=>'<span><small>'+esc(label)+'</small><b>'+fmt(n)+
    '</b></span>').join('')+'</div>';
  const listing=isWeekly?g.rows:data.days;
  $('clan-pulse-table').innerHTML=listing.slice().reverse().map(row=>
   '<tr><td>'+esc(dayLabel(row.day))+(row.day===end?' *':'')+'</td>'+
   '<td>'+fmt(row.distinctMatches)+'</td><td>'+fmt(row.playerMatches)+'</td>'+
   '<td>'+fmt(row.activePlayers)+'</td><td>'+fmt(row.playerWins)+'</td>'+
   '<td>'+fmt(row.kills)+'</td><td>'+fmt(row.killsObserved)+'</td></tr>'
  ).join('');
  $('clan-pulse-table-note').textContent=isWeekly?
   'Showing the '+g.rows.length+' daily UTC records in the selected group. '+
    'A player appearing on multiple days contributes multiple player-days.':
   'Showing all '+listing.length+' UTC calendar dates in this window. '+
    'An empty archived date is not proof that nobody played.';
 }
 async function load(force=false){
  if(!$('clan-pulse-days'))return;
  const days=Number($('clan-pulse-days').value)||30;
  const local=cached.get(days);
  if(!force&&local&&Date.now()-local.cachedAt<90000){
   $('clan-pulse-status').textContent='Saved activity ready · '+
    days+' UTC calendar days (cached). No PUBG API requests.';
   render(local.data);return;
  }
  const token=++requestId;
  $('clan-pulse-reload').disabled=true;
  $('clan-pulse-status').textContent='Reading '+days+' UTC dates from the saved match archive…';
  try{
   const response=await fetch('/api/public-matches?route=clan-activity&days='+days,
    {cache:'no-store',headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('Archive unavailable');
   const data=await response.json();
   if(!validateClient(data)||data.periodDays!==days)
    throw Error('Unexpected archived date series');
   if(token!==requestId)return;
   cached.set(days,{data,cachedAt:Date.now()});
   $('clan-pulse-status').textContent='Saved activity ready · '+
    days+' UTC calendar days. No PUBG API requests.';
   render(data);
  }catch(error){
   if(token!==requestId)return;
   $('clan-pulse-status').textContent=
    'Saved daily activity is temporarily unavailable. No upstream PUBG refresh was attempted.';
  }finally{
   if(token===requestId)$('clan-pulse-reload').disabled=false;
  }
 }
 function init(){
  if(ready||!$('clan-pulse-days'))return;
  ready=true;
  $('clan-pulse-days').addEventListener('change',()=>{void load(false)});
  $('clan-pulse-reload').addEventListener('click',()=>{void load(true)});
  $('clan-pulse-metric').addEventListener('change',()=>{
   if(current)render(current);
  });
  $('clan-pulse-chart').addEventListener('click',event=>{
   const item=event.target.closest?.('[data-pulse-index]');
   if(!item||!current)return;
   selected.set(current.periodDays,Number(item.dataset.pulseIndex));
   render(current);
  });
 }
 return{grouping,busiest,validateClient,render,load,init,metrics};
});
