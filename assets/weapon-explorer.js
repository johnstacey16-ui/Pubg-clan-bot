'use strict';
/* Saved PUBG Weapon Mastery Explorer. All values come from the allowlisted API.
 * Keep OfficialStatsTotal, CompetitiveStatsTotal and frozen StatsTotal separate.
 */
(function(root,make) {
 const api=make();
 if(typeof module==='object' && module.exports)module.exports=api;
 if(root && root.document)root.WeaponExplorer=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 const FIELDS=Object.freeze([
  ['kills','Kills','Combat totals','count','Kills recorded with the selected weapon'],
  ['headshots','Headshot kills','Combat totals','count','Kills recorded as headshots'],
  ['knocks','Knockdowns / groggies','Combat totals','count','Enemies knocked (DBNO)'],
  ['damage','Player damage','Combat totals','number','Total player damage dealt'],
  ['defeats','Defeats','Combat totals','count','Defeats as defined by PUBG Weapon Mastery'],
  ['longRangeDefeats','Long-range defeats','Legacy-only records','count','Older defeated players recorded at long range'],
  ['mostKillsInGame','Most kills in a match','Single-match records','count','Highest kills with this weapon in one match'],
  ['mostDefeatsInGame','Most defeats in a match','Single-match records','count','Highest defeats with this weapon in one match'],
  ['mostDamageInGame','Most damage in a match','Legacy-only records','number','Legacy record for player damage in one match'],
  ['mostHeadshotsInGame','Most headshots in a match','Legacy-only records','count','Legacy record for headshots in one match'],
  ['mostKnocksInGame','Most knocks in a match','Legacy-only records','count','Legacy maximum groggies in one match'],
  ['longestKill','Longest kill','Distance records','meters','Longest kill measured in metres'],
  ['longestDefeat','Longest defeat','Legacy-only records','meters','Legacy maximum defeat distance']
 ].map(r=>Object.freeze({key:r[0],label:r[1],group:r[2],unit:r[3],help:r[4]})));
 const SOURCES=Object.freeze([
  {key:'official',label:'Official (post-18.2)'},
  {key:'competitive',label:'Competitive (post-18.2)'},
  {key:'total',label:'Legacy (frozen at 18.2)'}
 ]);
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
 function safeNumber(x){
  if(x===null||x===undefined||x===''||typeof x==='boolean')return null;
  if(typeof x!=='number'&&typeof x!=='string')return null;
  const v=Number(x);return Number.isFinite(v)&&v>=0&&v<=1e10?v:null;
 }
 function get(w,category,key){
  if(!w)return null;
  if(key==='level'||key==='tier'||key==='xp')return safeNumber(w[key]);
  return safeNumber(w[category]?.[key]);
 }
 function sortedWeapons(items,category,sort='kills',query=''){
  const q=String(query??'').trim().toLowerCase();
  return (Array.isArray(items)?items:[]).filter(w=>w&&typeof w.name==='string'&&
   (!q||w.name.toLowerCase().includes(q))).slice().sort((a,b)=>{
    const av=get(a,category,sort),bv=get(b,category,sort);
    if(av===null&&bv!==null)return 1;
    if(bv===null&&av!==null)return -1;
    const diff=(bv??0)-(av??0);
    return diff||((get(b,'official','kills')??-1)-(get(a,'official','kills')??-1))||
     a.name.localeCompare(b.name);
   });
 }
 function fmt(x,unit='count'){
  const value=safeNumber(x);
  if(value===null)return '—';
  return value.toLocaleString('en-GB',{maximumFractionDigits:unit==='count'?0:2})+
   (unit==='meters'?' m':'');
 }
 function summarize(items,category){
  const keys=['kills','headshots','knocks','damage'];
  const out={};
  for(const key of keys){
   const values=items.map(w=>get(w,category,key)).filter(n=>n!==null);
   out[key]={value:values.length?values.reduce((a,b)=>a+b,0):null,
    observed:values.length,total:items.length};
  }
  return out;
 }
 function sourceTitle(key){return SOURCES.find(s=>s.key===key)?.label||'Official';}
 // Prevent spreadsheet formula evaluation in the intentionally local download.
 function csvCell(value){
  let s=value===null||value===undefined?'':String(value);
  if(/^[\s]*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 }
 function exportCsv(items,category){
  const columns=['name','level','tier','xp',...FIELDS.map(f=>f.key)];
  const rows=[['Weapon','Level','Tier','XP',...FIELDS.map(f=>f.label)]];
  for(const w of items){
   rows.push([w.name, ...columns.slice(1).map(key=>get(w,category,key))]);
  }
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
 }
 let selected=null,selectedPlayer=null,latestSource=null,clickReady=false;
 function render(source){
  if(!$('weapons-table'))return;
  latestSource=source||null;
  const category=$('weapon-category').value,sort=$('weapon-sort').value,
   query=$('weapon-search').value;
  const original=Array.isArray(source?.items)?source.items:[];
  const rows=sortedWeapons(original,category,sort,query);
  const identity=String(source?.platform||'')+':'+String(source?.name||'');
  if(selectedPlayer!==identity){selectedPlayer=identity;selected=null;}
  if(!rows.some(w=>w.name===selected))selected=rows[0]?.name||null;
  const summary=summarize(original,category);
  $('weapon-summary').innerHTML=[
   ['Weapons returned',original.length,''],
   ['Weapons with source data',original.filter(w=>w[category]&&
    Object.keys(w[category]).length).length,''],
   ['Kills observed',summary.kills.value,'count'],
   ['Headshots observed',summary.headshots.value,'count'],
   ['Knockdowns observed',summary.knocks.value,'count'],
   ['Damage observed',summary.damage.value,'number']
  ].map(r=>'<article class="weapon-kpi"><small>'+esc(r[0])+'</small><strong>'+
   fmt(r[1],r[2])+'</strong></article>').join('');
  const observedCounts=['kills','headshots','knocks','damage'].map(key=>
   summary[key].observed+' of '+summary[key].total+' weapons have '+key+' data').join(' · ');
  $('weapon-coverage').textContent=sourceTitle(category)+' · '+rows.length+
   ' weapons match the search · '+observedCounts+
   '. Summed values cover only weapons with this field present; missing values are not zero.';
  $('weapons-table').innerHTML=rows.map((w,i)=>{
   const active=w.name===selected;
   return '<tr class="'+(active?'weapon-active':'')+'"><td>'+
    '<button type="button" class="weapon-pick" data-weapon-select="'+esc(w.name)+
    '" aria-pressed="'+active+'">'+esc(w.name)+'</button></td>'+
    '<td>'+fmt(w.level)+' / '+fmt(w.tier)+'</td>'+
    '<td><strong>'+fmt(get(w,category,'kills'))+'</strong></td>'+
    '<td>'+fmt(get(w,category,'headshots'))+'</td>'+
    '<td>'+fmt(get(w,category,'knocks'))+'</td>'+
    '<td>'+fmt(get(w,category,'damage'),'number')+'</td>'+
    '<td>'+fmt(get(w,category,'defeats'))+'</td>'+
    '<td>'+fmt(get(w,category,'longestKill'),'meters')+'</td>'+
    '<td>'+fmt(w.xp)+'</td></tr>';
  }).join('')||'<tr><td colspan="9" class="empty">No saved weapons match this search or no mastery has been saved.</td></tr>';
  const barRows=sortedWeapons(original,category,'kills',query).filter(w=>
   (get(w,category,'kills')??0)>0).slice(0,6);
  const maximum=Math.max(1,...barRows.map(w=>get(w,category,'kills')));
  const host=$('weapon-bars');
  host.innerHTML=barRows.map(w=>'<div class="weapon-bar-row"><strong>'+esc(w.name)+
    '</strong><div class="weapon-rail"><span data-width="'+
    Math.max(1,Math.round(100*get(w,category,'kills')/maximum))+
    '"></span></div><b>'+fmt(get(w,category,'kills'))+'</b></div>'
   ).join('')||'<p class="small muted">No positive recorded kills in this category. Missing weapon totals are not estimated.</p>';
  host.querySelectorAll('.weapon-rail [data-width]').forEach(e=>{e.style.width=e.dataset.width+'%';});
  const weapon=rows.find(w=>w.name===selected);
  const panel=$('weapon-detail');
  if(!weapon){
   panel.innerHTML='<p class="small muted">Select a saved weapon to see the complete source-by-source breakdown.</p>';
   return;
  }
  const groups=['Combat totals','Single-match records','Distance records','Legacy-only records'];
  panel.innerHTML='<div class="weapon-detail-title"><div><p class="eyebrow subtle">OFFICIAL SOURCE FIELD COMPARISON</p>'+
   '<h3>'+esc(weapon.name)+'</h3><p class="small muted">Mastery level '+
   fmt(weapon.level)+' · Tier '+fmt(weapon.tier)+' · Total XP '+fmt(weapon.xp)+
   '</p></div><span class="chip">'+esc(sourceTitle(category))+'</span></div>'+
   '<p class="small muted">Each column is a separate PUBG source. Do not add the Legacy column to post-18.2 totals. “—” means the field was not returned for this source.</p>'+
   '<div class="scroll-table"><table class="weapon-detail-table"><thead><tr><th>WEAPON FIELD</th>'+
   SOURCES.map(s=>'<th class="'+(s.key===category?'weapon-column-focus':'')+'">'+
    esc(s.label)+'</th>').join('')+'</tr></thead><tbody>'+
   groups.map(group=>FIELDS.filter(f=>f.group===group).map(f=>'<tr><td><strong>'+
    esc(f.label)+'</strong><small>'+esc(f.help)+'</small></td>'+
    SOURCES.map(s=>'<td class="'+(s.key===category?'weapon-column-focus':'')+'">'+
     fmt(get(weapon,s.key,f.key),f.unit)+'</td>').join('')+'</tr>').join('')).join('')+
   '</tbody></table></div>';
 }
 function init(){
  if(clickReady||!$('weapon-detail'))return;
  clickReady=true;
  $('weapons-table').addEventListener('click',e=>{
   const button=e.target.closest?.('[data-weapon-select]');
   if(!button)return;selected=button.dataset.weaponSelect;render(latestSource);
  });
  $('weapon-download').addEventListener('click',()=>{
   const category=$('weapon-category').value;
   const rows=sortedWeapons(latestSource?.items,category,$('weapon-sort').value,
    $('weapon-search').value);
   if(!rows.length)return;
   const blob=new Blob([exportCsv(rows,category)],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   try{
    const link=document.createElement('a');
    link.href=url;link.download='pubg-weapons-'+category+'.csv';
    link.click();
   }finally{URL.revokeObjectURL(url);}
  });
 }
 return {FIELDS,SOURCES,get,sortedWeapons,fmt,summarize,exportCsv,render,init};
});
