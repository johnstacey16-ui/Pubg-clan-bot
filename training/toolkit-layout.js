// Original HELP presentation adapters. Existing native controls own calculations.
(function(){
'use strict';
const get=id=>document.getElementById(id);
const change=el=>el.dispatchEvent(new Event('change',{bubbles:true}));
const weapons=PT.WBYNAME||{};
for(const row of document.querySelectorAll('#panel-backpack .bp-row')){
 const input=row.querySelector('input[data-bp]'),name=row.querySelector('.bp-name');
 const file=window.HELP_OFFICIAL_INVENTORY?.[input?.dataset.bp];
 if(!file||!name)continue;
 const image=document.createElement('img');if(row.closest('.hub-main').classList.contains('active'))image.src='assets/'+file;else image.dataset.visualSrc='assets/'+file;image.alt='';image.width=28;image.height=28;image.loading='lazy';image.decoding='async';image.className='pubg-inventory-icon';name.prepend(image);
}

// Keep setup and primary results together on wide screens without changing tab order.
for(const id of ['panel-range','panel-ttk','panel-attach']){
 const wrap=get(id)?.querySelector('.wrap');if(!wrap)continue;
 wrap.classList.add('tt-calculator');
 const cards=[...wrap.children].filter(el=>el.classList.contains('card')&&el.tagName!=='DETAILS');
 if(cards[0])cards[0].classList.add('tt-setup');
 if(cards[1])cards[1].classList.add('tt-primary-results');
 if(id==='panel-ttk'&&cards[1]){
  const grids=cards[1].querySelectorAll('.grid3');
  if(grids.length===2){while(grids[1].firstElementChild)grids[0].append(grids[1].firstElementChild);grids[1].remove();}
 }

}
// In-table and in-picker class navigation use the actual weapon registry.
for(const select of document.querySelectorAll('#hz_weapon,#rg_weapon,#tk_weapon,#at_weapon,#rc_weapon')){
 const picker=select.parentElement.querySelector('.workspace-picker');if(!picker)continue;
 const nav=document.createElement('div');nav.className='tt-class-pills';nav.setAttribute('role','group');nav.setAttribute('aria-label','Filter weapon cards by class');
 let active='All';
 const list=picker.querySelector('.workspace-weapon-list'),count=picker.querySelector('.workspace-picker-count');
 function filter(){
  let total=0;
  for(const button of list.querySelectorAll('button')){
   const name=button.textContent.trim(),w=weapons[name];
   button.hidden=active!=='All'&&w?.cls!==active;
   if(!button.hidden)total++;
  }
  count.textContent=total+' matching weapons';if(!total)count.textContent='No matching weapons. Change class or search.';
 }
 for(const cls of ['All','AR','DMR','SR','SMG','MG','SG','Pistol']){
  const button=document.createElement('button');button.type='button';button.textContent=cls;button.setAttribute('aria-pressed',String(cls===active));
  button.addEventListener('click',()=>{active=cls;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filter();});nav.append(button);
 }
 picker.querySelector('input[type=search]').after(nav);
 new MutationObserver(filter).observe(list,{childList:true});
 picker.addEventListener('toggle',filter);
}
// Attachment choice menus are built from current compatible native options.
const slotSync=[];
for(const [id,label] of [['at_muzzle','muzzle'],['at_grip','grip'],['at_stock','stock'],['at_mag','magazine'],['at_sight','optic']]){
 const select=get(id);if(!select)continue;
 const details=document.createElement('section');details.className='tt-slot-picker';details.dataset.slot=id;
 const summary=document.createElement('h3');summary.textContent=label+' choices';
 const group=document.createElement('div');group.className='tt-slot-options';group.setAttribute('role','group');group.setAttribute('aria-label','Compatible '+label+' choices');
 details.append(summary,group);select.after(details);
 function sync(){
  summary.textContent='Browse '+label+' choices · '+(select.options[select.selectedIndex]?.textContent||'None');
  group.replaceChildren();
  for(const option of select.options){
   const button=document.createElement('button');button.type='button';button.textContent=option.textContent;button.disabled=select.disabled||option.disabled;
   button.setAttribute('aria-pressed',String(option.value===select.value));
   const file=window.HELP_OFFICIAL_ATTACHMENTS?.[get('at_weapon').value]?.[id.replace('at_','')]?.[option.value];
   if(file){const img=document.createElement('img');if(select.closest('.hub-main').classList.contains('active'))img.src='assets/'+file;else img.dataset.visualSrc='assets/'+file;img.width=64;img.height=44;img.alt='';img.loading='lazy';img.decoding='async';button.prepend(img);}
   if(option.title)button.title=option.title;
   button.addEventListener('click',()=>{select.value=option.value;change(select);select.focus();});group.append(button);
  }
 }
 select.addEventListener('change',sync);
 new MutationObserver(sync).observe(select,{childList:true,subtree:true});slotSync.push(sync);sync();
}
get('panel-attach')?.addEventListener('click',event=>{if(event.target.closest('.preset-btns'))slotSync.forEach(fn=>fn());});
// Distinct stat cards make sourced recoil parameters readable without drawing a spray.
const recoil=get('rc_table');
if(recoil){
 const list=document.createElement('div');list.className='tt-recoil-parameters';list.setAttribute('aria-label','Recorded recoil parameters');
 const toggle=document.createElement('details');toggle.className='tt-disclosure';const summary=document.createElement('summary');summary.textContent='View equivalent parameter table';
 recoil.parentElement.before(list,toggle);toggle.append(summary,recoil.parentElement);
 const sync=()=>{list.replaceChildren();for(const row of recoil.querySelectorAll('tbody tr')){
  const item=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong');label.textContent=row.cells[0].textContent;value.textContent=row.cells[1].textContent;item.append(label,value);list.append(item);
 }};
 new MutationObserver(sync).observe(recoil,{childList:true,subtree:true});sync();
}
// Inventory filters change visibility only; totals still include every packed item.
const bag=get('panel-backpack');
if(bag){
 const wrap=bag.querySelector('.wrap'),inputs=[...bag.querySelectorAll('input[data-bp]')];
 const groups=[['Ammo','bp_ammoGrid'],['Healing & boosts','bp_healGrid'],['Throwables','bp_throwGrid']];
 const toolbar=document.createElement('section');toolbar.className='tt-inventory-tools';toolbar.setAttribute('aria-label','Find inventory items');
 const search=document.createElement('input');search.type='search';search.placeholder='Find ammo, healing or throwables…';search.setAttribute('aria-label','Search backpack items');
 const nav=document.createElement('div');nav.className='tt-class-pills';nav.setAttribute('role','group');nav.setAttribute('aria-label','Backpack item categories');
 let active='All';
 const notice=document.createElement('p');notice.className='helptext';notice.setAttribute('role','status');
 function filter(){
  let count=0;
  for(const [category,id] of groups){let visible=0;const grid=get(id);
   for(const row of grid.querySelectorAll('.bp-row')){const show=(active==='All'||active===category)&&row.querySelector('.bp-name').textContent.toLowerCase().includes(search.value.trim().toLowerCase());row.hidden=!show;if(show){visible++;count++;}}
   grid.closest('.card').hidden=visible===0;
  }
  notice.textContent=count+' matching items. Capacity includes packed items in every category, including hidden rows.';
 }
 for(const cls of ['All',...groups.map(g=>g[0])]){const button=document.createElement('button');button.type='button';button.textContent=cls;button.setAttribute('aria-pressed',String(cls===active));button.addEventListener('click',()=>{active=cls;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filter();});nav.append(button);}
 toolbar.append(search,nav,notice);get('bp_ammoGrid').closest('.card').before(toolbar);search.addEventListener('input',filter);filter();
 const inventory=document.createElement('details');inventory.className='card tt-packed';inventory.id='bp_packed';
 const heading=document.createElement('summary');heading.textContent='Packed items';
 const table=document.createElement('table');table.setAttribute('aria-label','Items currently packed');
 const capacity=document.createElement('div');capacity.className='tt-capacity';capacity.setAttribute('role','status');
 const progress=document.createElement('div');progress.className='tt-capacity-meter';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Used carrying capacity');
 const fill=document.createElement('i');progress.append(fill);inventory.append(heading,table);toolbar.before(capacity,progress,inventory);
 function update(){
  const used=Number(get('bp_used').textContent),cap=Number(get('bp_cap').textContent),remaining=Number(get('bp_rem').textContent);
  capacity.textContent=used.toFixed(1)+' / '+cap+' capacity · '+(remaining<0?Math.abs(remaining).toFixed(1)+' over capacity':remaining.toFixed(1)+' free');
  capacity.classList.toggle('tt-over',remaining<0);progress.classList.toggle('tt-over',remaining<0);
  progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(cap));progress.setAttribute('aria-valuenow',String(Math.min(cap,Math.max(0,used))));progress.setAttribute('aria-valuetext',capacity.textContent);
  fill.style.width=Math.min(100,Math.max(0,used/cap*100))+'%';
  const packed=inputs.filter(input=>(parseInt(input.value)||0)>0);
  heading.textContent='Packed items · '+packed.length+' item types';table.replaceChildren();
  if(!packed.length){const caption=table.createCaption();caption.textContent='Your pack is empty. Add items from the categories below.';return;}
  const head=table.createTHead().insertRow();for(const label of ['Item','Quantity','Space','']){const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);}
  const body=table.createTBody();
  for(const input of packed){
   const row=body.insertRow(),name=input.closest('.bp-row').querySelector('.bp-name').textContent;
   for(const text of [name,input.value,(Number(input.value)*Number(input.dataset.wt)).toFixed(1)])row.insertCell().textContent=text;
   const button=document.createElement('button');button.type='button';button.textContent='Remove';button.setAttribute('aria-label','Remove '+name+' from pack');button.addEventListener('click',()=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));heading.focus();});row.insertCell().append(button);
  }
 }
 // calc() always writes the existing total; observer also catches clear/preset buttons.
 new MutationObserver(update).observe(get('bp_used'),{childList:true,subtree:true});update();
}
})();
