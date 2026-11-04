'use strict';
// Read-only aggregate health; no timers, credentials or PUBG requests.
(function(){
 const $=id=>document.getElementById(id);
 const labels={
  player_profiles:'Player profiles',season_catalogues:'Season catalogues',
  season:'Season statistics',ranked:'Ranked statistics',weapons:'Weapon mastery',
  survival:'Survival mastery',matches:'Match details',
  regional_leaderboards:'Regional leaderboards',
  telemetry_reports:'Saved telemetry reports',other:'Other saved responses'
 };
 let last=null,lastLoaded=0,pending=false;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
 const num=n=>typeof n==='number'&&Number.isFinite(n)?
  n.toLocaleString('en-GB'):'—';
 const stamp=s=>s&&Number.isFinite(Date.parse(s))?
  new Date(s).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):
  'Not observed';
 function card(label,value,note){
  return '<article class="cc-award"><p class="small muted">'+escape(label)+'</p>'+
   '<strong>'+escape(value)+'</strong><p class="small muted">'+escape(note)+'</p></article>';
 }
 function render(data){
  const health=data.cache_health;
  if(!health||health.schemaVersion!==1){
   $('health-status').textContent='Cache diagnostics unavailable in this deployment. Existing Discord and player statistics remain separate.';
   $('health-metrics').innerHTML='';$('health-types').innerHTML='';
   return;
  }
  const c=health.cache||{},b=health.budget||{},o=health.observations||{};
  const total=typeof c.total==='number'?c.total:null;
  const fresh=typeof c.fresh==='number'?c.fresh:null;
  const used=typeof b.reservations==='number'?b.reservations:null;
  const limit=typeof b.limit==='number'?b.limit:null;
  $('health-metrics').innerHTML=[
   card('Shared PUBG reservations',num(used)+(limit===null?'':' / '+num(limit)),
    'Actual shared website + Discord budget over '+num(b.windowSeconds)+' seconds'),
   card('Fresh cached responses',num(fresh)+(total===null?'':' / '+num(total)),
    'Expired: '+num(c.expired)+' · cached reads need no PUBG request'),
   card('Lifetime historical players',num(o.lifetimePlayers),
    'Unique players with real saved lifetime observations'),
   card('Season historical players',num(o.seasonPlayers),
    'Unique players with genuine saved season/ranked history'),
   card('Daily season collection attempts',num(o.seasonAttempts),
    'Verified clan players recorded in the rotation queue'),
   card('Last scheduled sync attempt',stamp(data.last_sync_attempt),
    'An attempt is not proof of a successful upstream request')
  ].join('');
  const counts=c.byCategory||{};
  $('health-types').innerHTML=Object.entries(labels).map(([key,label])=>
   '<tr><td>'+escape(label)+'</td><td>'+num(counts[key]??0)+'</td></tr>'
  ).join('');
  $('health-status').textContent='Database snapshot at '+stamp(health.checkedAt)+
   ' · latest saved PUBG response '+stamp(c.newestFetchedAt)+
   ' · last API reservation '+stamp(b.lastReservedAt)+
   '. No PUBG requests were made to display this report.';
  const collection=data.season_collection||{};
  $('health-season-note').textContent='Last daily season collection result: '+
   (collection.latest_result||'not observed')+' · finished '+stamp(collection.last_finished_at)+
   '. New observations must be verified separately.';
  $('health-source-note').textContent=health.notice||
   'Reservations are not guaranteed successful PUBG API responses.';
 }
 async function load(force=false){
  if(pending)return;
  if(!force&&last&&Date.now()-lastLoaded<30000){render(last);return;}
  pending=true;
  $('health-refresh').disabled=true;
  $('health-status').textContent='Reading aggregate cache and budget health from Supabase…';
  try{
   const r=await fetch('/api/health',{cache:'no-store',
    headers:{Accept:'application/json'}});
   const body=await r.json();
   if(!r.ok||body.status!=='ok')throw Error('Health unavailable');
   last=body;lastLoaded=Date.now();render(body);
  }catch(error){
   $('health-status').textContent='Data health temporarily unavailable; this read did not request PUBG.';
  }finally{
   pending=false;$('health-refresh').disabled=false;
  }
 }
 $('health-refresh').addEventListener('click',()=>load(true));
 window.CacheHealth={show:()=>load(),refresh:()=>load(true)};
})();
