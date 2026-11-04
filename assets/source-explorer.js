'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const reference=window.PubgReference||{dictionaryRevision:'unknown',dictionaries:{}};
 let current=null,fields=[],page=0,players=[];
 function escape(s){return String(s??'').replace(/[&<>"']/g,x=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[x]);}
 function flatten(value,path='$',rows=[],depth=0){
  if(depth>24||rows.length>30000)return rows;
  if(value!==null&&typeof value==='object'){
   const entries=Object.entries(value);
   if(!entries.length)rows.push([path,Array.isArray(value)?'[]':'{}',
    Array.isArray(value)?'array':'object']);
   for(const [key,part] of entries){
    const next=Array.isArray(value)?path+'['+key+']':
     /^[A-Za-z_$][\w$]*$/.test(key)?path+'.'+key:
     path+'['+JSON.stringify(key)+']';
    flatten(part,next,rows,depth+1);
   }
  }else rows.push([path,typeof value==='string'?JSON.stringify(value):
    String(value),value===null?'null':typeof value]);
  return rows;
 }
 function annotate(path,value,type){
  if(type!=='string')return '';
  const key=path.match(/\.([A-Za-z]+)$/)?.[1];
  const map={itemId:'item',damageCauserName:'cause',damageTypeCategory:'damage',
   vehicleId:'vehicle',mapName:'map',gameMode:'mode',medalName:'medal'};
  const category=map[key];
  try{
   const code=JSON.parse(value);
   const entry=reference.dictionaries[category]?.values?.[code];
   return typeof entry==='string'?entry:entry?.name||'';
  }catch{return '';}
 }
 function renderFields(){
  const term=$('source-filter').value.toLowerCase();
  const filtered=fields.filter(row=>!term||row.join(' ').toLowerCase().includes(term)||
   annotate(...row).toLowerCase().includes(term));
  const limit=100,pages=Math.max(1,Math.ceil(filtered.length/limit));
  page=Math.max(0,Math.min(page,pages-1));
  $('source-count').textContent=filtered.length+' field(s) · page '+(page+1)+' of '+pages;
  $('source-prev').disabled=page===0;
  $('source-next').disabled=page>=pages-1;
  $('source-table').innerHTML=filtered.slice(page*limit,page*limit+limit).map(row=>
   '<tr><td><code>'+escape(row[0])+'</code></td><td><code>'+escape(row[1])+
   '</code></td><td>'+escape(row[2])+'</td><td>'+escape(annotate(...row))+'</td></tr>'
  ).join('')||'<tr><td colspan="4">No fields match your search.</td></tr>';
 }
 async function loadSource(){
  const name=$('source-name').value.trim(),kind=$('source-kind').value,
   match=$('source-match').value.trim(),platform=$('source-platform').value;
  if(!name){$('source-note').textContent='Enter a saved console player name.';return;}
  $('source-load').disabled=true;
  $('source-note').textContent='Reading real saved PUBG response…';
  fields=[];current=null;renderFields();
  try{
   const query=new URLSearchParams({name,kind,platform});
   if(kind==='match')query.set('match',match);
   const response=await fetch('/api/public-source?'+query.toString(),{cache:'no-store'});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Saved resource unavailable');
   if(result.schemaVersion!==1)throw Error('Unexpected source schema');
   current=result;fields=flatten(result.payload);
   page=0;renderFields();
   $('source-note').textContent=result.name+' · '+result.platform+
    ' · '+result.resource+' · saved '+(result.fetchedAt||'unknown time')+
    ' · '+fields.length+' public-safe source fields. Missing values are not filled in.';
  }catch(error){
   $('source-note').textContent=error.message;
  }finally{$('source-load').disabled=false;}
 }
 function dictionary(){
  const types=Object.keys(reference.dictionaries||{});
  $('dictionary-kind').innerHTML=types.map(k=>'<option value="'+escape(k)+'">'+
   escape(reference.dictionaries[k].label||k)+'</option>').join('');
  $('dictionary-provenance').textContent='Official publisher dictionary revision '+
    reference.dictionaryRevision+' (pinned 29 October 2026; names may change in later PUBG updates).';
  paintDictionary();
 }
 function paintDictionary(){
  const values=reference.dictionaries[$('dictionary-kind').value]?.values||{};
  const query=$('dictionary-filter').value.toLowerCase();
  const rows=Object.entries(values).filter(([k,v])=>
   !query||k.toLowerCase().includes(query)||String(typeof v==='string'?v:v?.name||'').toLowerCase().includes(query));
  $('dictionary-count').textContent=rows.length+' matching official reference entries';
  $('dictionary-table').innerHTML=rows.slice(0,250).map(([key,value])=>
   '<tr><td><code>'+escape(key)+'</code></td><td>'+escape(typeof value==='string'?value:value?.name||JSON.stringify(value))+
   '</td></tr>').join('')||
   '<tr><td colspan="2">No matching dictionary entries</td></tr>';
 }
 function download(){
  if(!current)return;
  const blob=new Blob([JSON.stringify(current,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  try{
   const a=document.createElement('a');
   a.href=url;a.download='pubg-saved-'+current.resource+'.json';a.click();
  }finally{URL.revokeObjectURL(url);}
 }
 function init(){
  $('source-load').addEventListener('click',loadSource);
  $('source-filter').addEventListener('input',()=>{page=0;renderFields();});
  $('source-prev').addEventListener('click',()=>{page--;renderFields();});
  $('source-next').addEventListener('click',()=>{page++;renderFields();});
  $('source-download').addEventListener('click',download);
  $('dictionary-kind').addEventListener('change',paintDictionary);
  $('dictionary-filter').addEventListener('input',paintDictionary);
  $('source-kind').addEventListener('change',()=>{
   $('source-match-wrap').hidden=$('source-kind').value!=='match';
  });
  dictionary();
 }
 init();
 window.SourceExplorer={
  show(){if(!players.length)return;
   if(!$('source-name').value)$('source-name').value=players[0].name;},
  setPlayers(list){players=Array.isArray(list)?list:[];this.show();},
  flatten
 };
})();
