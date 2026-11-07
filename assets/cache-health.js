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
 const stageNames={lifetime:'Lifetime statistics',profile:'Recent-match index',
  weapons:'Weapon mastery',survival:'Survival mastery'};
 function renderCollection(data){
  const h=data?.collection_health;
  if(!h||h.schemaVersion!==1||!Array.isArray(h.scopes)){
   $('health-collection-note').textContent=
    'Collector details unavailable. This does not mean the collector has failed.';
   for(const id of ['health-freshness-metrics','health-backfill-table'])
    $(id).innerHTML='';
   for(const id of ['health-archive-note','health-backfill-note',
     'health-season-collector'])$(id).textContent='';
   return;
  }
  const p=h.players||{},a=h.archive||{},season=h.season||{};
  const label=x=>typeof x==='number'&&Number.isFinite(x)?num(x):'—';
  $('health-freshness-metrics').innerHTML=[
   card('Clan players checked in 24h',label(p.checkedWithin24h)+' / '+label(p.verified),
    'Last-check timestamps, not guaranteed fresh PUBG responses'),
   card('Clan players checked in 48h',label(p.checkedWithin48h)+' / '+label(p.verified),
    'Age of the saved last-check timestamp'),
   card('Older than 48h / never checked',label(p.checkedOlderThan48h)+' / '+label(p.neverChecked),
    'Observed stale checks and missing check dates'),
   card('Recent archive writes',label(a.writesWithin24h),
    'Stored player-match records written during the last 24 hours'),
   card('Saved distinct clan matches',label(a.distinctMatches),
    'Deduplicated across clan teammates'),
   card('Players with archived games',label(a.observedPlayers)+' / '+label(p.verified),
    'Archived membership coverage, not clan participation rate')
  ].join('');
  const attention=[];
  if(typeof p.checkedOlderThan48h==='number'&&p.checkedOlderThan48h>0)
   attention.push(label(p.checkedOlderThan48h)+' player checks older than 48h');
  if(typeof p.neverChecked==='number'&&p.neverChecked>0)
   attention.push(label(p.neverChecked)+' players without a checked timestamp');
  const aged=h.scopes.reduce((n,row)=>n+(
   typeof row.pendingOlderThan48h==='number'?row.pendingOlderThan48h:0),0);
  if(aged)attention.push(label(aged)+' retries last attempted over 48h ago');
  $('health-collection-note').textContent=
   'Saved collector snapshot '+stamp(h.checkedAt)+'. '+
   (attention.length?'Needs review: '+attention.join(' · ')+'.':
    'No stale player-check or aged-retry flags in this snapshot.')+
   ' Task completion does not certify a live PUBG response.';
  $('health-archive-note').textContent='Archive last written: '+stamp(a.lastWrittenAt)+
   ' · newest match played: '+stamp(a.lastMatchPlayedAt)+
   ' · '+label(a.playerMatchObservations)+
   ' archived clan-player observations. A game may be saved later than it was played; '+
   'no new writes does not prove that nobody played.';
  const stageOrder=['lifetime','profile','weapons','survival'];
  const byStage=new Map(h.scopes.filter(s=>stageNames[s?.scope])
   .map(item=>[item.scope,item]));
  $('health-backfill-table').innerHTML=stageOrder.map(scope=>{
   const row=byStage.get(scope);
   if(!row)return '<tr><td>'+escape(stageNames[scope])+
    '</td><td colspan="6">No recorded stage status</td></tr>';
   return '<tr><td>'+escape(stageNames[scope])+'</td>'+
    '<td>'+label(row.done)+' / '+label(row.total)+'</td>'+
    '<td>'+label(row.pending)+'</td>'+
    '<td>'+label(row.readyForRetry)+'</td>'+
    '<td>'+label(row.leased)+'</td>'+
    '<td>'+label(row.unavailable)+'</td>'+
    '<td>'+escape(stamp(row.lastCompletedAt))+'</td></tr>';
  }).join('');
  const pending=h.scopes.reduce((n,row)=>n+(Number(row.pending)||0),0);
  const ready=h.scopes.reduce((n,row)=>n+(Number(row.readyForRetry)||0),0);
  $('health-backfill-note').textContent=label(pending)+
   ' clan tasks are pending; '+label(ready)+
   ' are ready for the next permitted collector run. Queued work and shared API '+
   'budget backoff are normal and are not necessarily outages. Collector jobs never run from this page.';
  $('health-season-collector').textContent=
   'Season collection state: '+label(season.tracked)+' tracked clan players · '+
   label(season.attemptedWithin24h)+' attempts in 24h · '+
   label(season.completedWithin24h)+' completions in 24h · '+
   'last recorded attempt '+stamp(season.lastAttemptAt)+
   '. No recorded state does not establish success or failure.';
  $('health-collection-source').textContent=h.note||
   'Only verified clan aggregates are displayed; no PUBG requests were made.';
 }
 function render(data){
  renderCollection(data);
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
   const r=await fetch('/api/health?collection=1',{cache:'no-store',
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
