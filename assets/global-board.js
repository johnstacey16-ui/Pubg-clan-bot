'use strict';
// Real regional console leaderboard, separate from the official clan roster.
(function(){
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
 let result=null;
 function regions(){
  const ps=$('global-platform').value==='psn';
  const selected=$('global-region').value;
  const values=ps?['eu','na','as','oc']:['eu','na','as','oc','sa'];
  $('global-region').innerHTML=values.map(k=>'<option value="'+k+'">'+k.toUpperCase()+'</option>').join('');
  $('global-region').value=values.includes(selected)?selected:'eu';
 }
 function render(){
  const data=result;
  if(!data)return;
  const text=$('global-filter').value.trim().toLowerCase();
  const players=(data.players||[]).filter(x=>
   !text||x.name.toLowerCase().includes(text)||String(x.rank).includes(text));
  const keys=[...new Set(players.flatMap(x=>Object.keys(x.stats||{})))].sort().slice(0,32);
  $('global-table-head').innerHTML='<tr><th>RANK</th><th>PLAYER</th>'+
   keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr>';
  $('global-table').innerHTML=players.slice(0,500).map(p=>
   '<tr><td>'+p.rank+'</td><td><strong>'+esc(p.name)+'</strong></td>'+
   keys.map(k=>'<td>'+esc(p.stats?.[k]===null||p.stats?.[k]===undefined?
    '—':typeof p.stats[k]==='object'?JSON.stringify(p.stats[k]):p.stats[k])+
    '</td>').join('')+'</tr>').join('')||
   '<tr><td colspan="'+(keys.length+2)+'">No returned rankings match this filter.</td></tr>';
  $('global-count').textContent=players.length+' of '+data.count+
   ' actual returned player records · '+data.platform.toUpperCase()+
   ' '+data.region.toUpperCase()+' · season '+data.seasonId+
   ' · state '+data.state+' · fetched '+(data.fetchedAt||'unknown time');
  $('global-cutlines').textContent=(data.cutLines||[]).map(c=>
   '#'+c.rank+': '+(c.present?c.player:'not in response')).join(' · ');
 }
 async function load(){
  $('global-load').disabled=true;
  $('global-status').textContent='Reading official PUBG regional rankings using the shared cache and rate budget…';
  try{
   const params=new URLSearchParams({
    platform:$('global-platform').value,region:$('global-region').value,
    mode:$('global-mode').value
   });
   const season=$('global-season').value.trim();
   if(season)params.set('season',season);
   const response=await fetch('/api/public-global-leaderboard?'+params.toString(),
    {cache:'no-store',headers:{Accept:'application/json'}});
   const payload=await response.json();
   if(!response.ok)throw Error((payload.error||'Leaderboard unavailable')+
    (payload.retryAfterSeconds?' · Retry after '+payload.retryAfterSeconds+'s':''));
   if(payload.schemaVersion!==1||!Array.isArray(payload.players))
    throw Error('Unexpected leaderboard response');
   result=payload;render();
   $('global-status').textContent='Official regional PUBG leaderboard. This is not an official clan ranking. Unknown ranks, metrics and incomplete regions are never guessed.';
  }catch(error){
   result=null;
   $('global-status').textContent=error.message;
   $('global-table').innerHTML='';
   $('global-count').textContent='';
  }finally{$('global-load').disabled=false;}
 }
 function download(){
  if(!result)return;
  const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  try{
   const a=document.createElement('a');a.href=url;
   a.download='pubg-official-regional-leaderboard.json';a.click();
  }finally{URL.revokeObjectURL(url);}
 }
 $('global-platform').addEventListener('change',regions);
 $('global-load').addEventListener('click',load);
 $('global-filter').addEventListener('input',render);
 $('global-download').addEventListener('click',download);
 regions();
})();
