// Combat workspace enhancements. Native calculator controls remain the source of truth.
(function(){
'use strict';
const get=id=>document.getElementById(id);
const fire=el=>el.dispatchEvent(new Event('change',{bubbles:true}));
const set=(id,value)=>{
 const el=get(id);if(!el||el.disabled)return false;
 if(![...el.options].some(o=>o.value===String(value)&&!o.disabled))return false;
 if(el.value!==String(value)){el.value=String(value);fire(el);}return true;
};
// Accessible native button groups mirror the existing equipment and mode controls.
for(const [id,art] of [['hz_helmet','gear-helmet.svg'],['hz_vest','gear-vest.svg'],['hz_mode',null]]){
 const select=get(id);if(!select)continue;
 const group=document.createElement('div');group.className='workspace-segments workspace-equipment';
 group.setAttribute('role','group');group.setAttribute('aria-label',id==='hz_mode'?'Damage display':id==='hz_helmet'?'Helmet level':'Vest level');
 if(art){const img=document.createElement('img');img.dataset.visualSrc='assets/'+art;img.alt='';img.width=38;img.height=38;group.append(img);}
 for(const option of select.options){
  const button=document.createElement('button');button.type='button';button.dataset.value=option.value;
  button.textContent=art?(option.value==='0'?'None':'L'+option.value):option.textContent;
  button.setAttribute('aria-label',option.textContent+(art?(id==='hz_helmet'?' helmet':' vest'):''));
  button.title=option.textContent;button.addEventListener('click',()=>set(id,option.value));group.append(button);
 }
 const sync=()=>{
  const icon=group.querySelector('img'),gear=id==='hz_helmet'?'helmet':'vest';
  if(icon){
   icon.hidden=select.value==='0';const file=window.HELP_OFFICIAL_GEAR?.[gear]?.[select.value];
   if(!file||icon.hidden){icon.removeAttribute('src');delete icon.dataset.visualSrc;}
   else if(select.closest('.hub-main').classList.contains('active')){icon.src='assets/'+file;delete icon.dataset.visualSrc;}
   else{icon.removeAttribute('src');icon.dataset.visualSrc='assets/'+file;}
  }
  group.querySelectorAll('button').forEach(button=>{
  button.setAttribute('aria-pressed',String(button.dataset.value===select.value));
  button.disabled=[...select.options].find(o=>o.value===button.dataset.value).disabled;
  button.hidden=button.disabled;
 });
 };
 select.after(group);select.hidden=true;
 // The label remains visible, with the group supplying its own accessible name.
 select.addEventListener('change',sync);
 get('hz_weapon').addEventListener('change',sync);
 new MutationObserver(sync).observe(select,{subtree:true,attributes:true,attributeFilter:['disabled'],childList:true});sync();
}
// Searchable weapon galleries always show their matching pictures.
for(const id of ['hz_weapon','at_weapon','rc_weapon']){
 const select=get(id);if(!select)continue;
 const picker=document.createElement('section');picker.className='workspace-picker';
 const summary=document.createElement('h3');summary.textContent='Choose a weapon';
 const search=document.createElement('input');search.type='search';search.placeholder='Search weapon name…';search.setAttribute('aria-label','Search weapons for '+id.split('_')[0]);
 const list=document.createElement('div');list.className='workspace-weapon-list';
 const count=document.createElement('p');count.className='workspace-picker-count';count.setAttribute('role','status');
 picker.append(summary,search,count,list);select.after(picker);
 function render(){
  list.replaceChildren();
  const options=[...select.options].filter(o=>o.textContent.toLowerCase().includes(search.value.trim().toLowerCase()));
  count.textContent=options.length+' weapons';
  for(const option of options){
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed',String(option.value===select.value));
   const art=window.HELP_VISUAL_WEAPONS&&window.HELP_VISUAL_WEAPONS[option.value];
   if(art){const image=document.createElement('img');if(select.closest('.hub-main').classList.contains('active'))image.src='assets/'+art;else image.dataset.visualSrc='assets/'+art;image.alt='';image.width=70;image.height=40;image.loading='lazy';button.append(image);}
   button.append(document.createTextNode(option.textContent));
   button.addEventListener('click',()=>{set(id,option.value);select.focus();});list.append(button);
  }
  if(!options.length)list.textContent='No matching weapons.';
 }
 search.addEventListener('input',render);select.addEventListener('change',render);render();
}
// One in-session combat context. No settings are persisted or changed on page load.
let syncing=false,context=null;
const heads=new Set(['head','neck']);const limbs=new Set(['limb','upperArm','forearm','hand','thigh','calf','foot']);
const panels={hz:'panel-hit-zone',rg:'panel-range',tk:'panel-ttk'};
for(const [prefix,id] of Object.entries(panels)){
 const panel=get(id);if(!panel)continue;
 const line=document.createElement('p');line.id=prefix+'_context';line.className='workspace-context';line.setAttribute('role','status');
 panel.querySelector('.wrap').prepend(line);
}
function read(prefix){
 const part=prefix==='hz'?(context?.part||'chest'):get(prefix+'_hitbox').value;
 const level=prefix==='hz'?null:Number(get(prefix+'_armor').value);
 const distance=prefix==='hz'?Number(get('hz_distance').value):prefix==='tk'?Number(get('tk_distance').value):parseFloat(get('rg_rangeLabel').textContent);
 return {weapon:get(prefix+'_weapon').value,part,distance,
 helmet:prefix==='hz'?Number(get('hz_helmet').value):(heads.has(part)?level:context?.helmet??0),
 vest:prefix==='hz'?Number(get('hz_vest').value):(!heads.has(part)&&!limbs.has(part)?level:context?.vest??0)};
}
function syncFrom(prefix,eventId){
 if(syncing)return;syncing=true;
 try{
  const previous=context;context=read(prefix);
  // Preserve a requested distance across weapon changes; disclose missing checkpoints.
  if(previous&&prefix!=='hz'&&eventId===prefix+'_weapon')context.distance=previous.distance;
  for(const target of Object.keys(panels)){
   set(target+'_weapon',context.weapon);
   if(target==='hz'){
    set('hz_helmet',context.helmet);set('hz_vest',context.vest);
   }else{
    const detail=get(target+'_detailed');
    if(![...get(target+'_hitbox').options].some(o=>o.value===context.part)){
     detail.checked=true;fire(detail);
    }
    set(target+'_hitbox',context.part);
    set(target+'_armor',heads.has(context.part)?context.helmet:limbs.has(context.part)?0:context.vest);
   }
   let exact;
   if(target==='rg'){
    const points=[...get('hz_distance').options].map(o=>Number(o.value));
    const i=points.indexOf(context.distance),slider=get('rg_range');exact=i>=0&&!slider.disabled;
    if(exact){slider.value=String(i);slider.dispatchEvent(new Event('input',{bubbles:true}));}
   }else exact=set(target==='hz'?'hz_distance':'tk_distance',context.distance);
   get(target+'_context').textContent=exact
    ? context.weapon+' · '+context.distance+' m · Helmet '+context.helmet+' / Vest '+context.vest+' · shared Combat Lab setup'
    : context.weapon+' · '+(Number.isFinite(context.distance)?context.distance+' m':'The requested distance')+' is not a recorded checkpoint. This tool shows its labelled distance; choose another checkpoint to relink.';
  }
 }finally{syncing=false;}
}
for(const prefix of Object.keys(panels)){
 const ids=prefix==='hz'?['weapon','distance','helmet','vest']:['weapon','distance','hitbox','armor','detailed'];
 for(const field of ids){const el=get(prefix+'_'+field);if(el)el.addEventListener('change',()=>syncFrom(prefix,el.id));}
}
get('rg_range')?.addEventListener('input',()=>syncFrom('rg','rg_range'));
// Zone selection also carries the exact hit region to Range and TTK.
for(const node of document.querySelectorAll('#hz_body [data-hit-zone]')){
 const sync=()=>{if(!context)context=read('hz');context.part=node.dataset.hitZone;syncFrom('hz','zone');};
 node.addEventListener('click',sync);
 node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')sync();});
}
syncFrom('hz','initial');
})();
