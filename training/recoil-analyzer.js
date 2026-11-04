// HELP's per-shot interface and animation. Reference data never replaces stored weapon records.
(function(){
'use strict';
const get=id=>document.getElementById(id),panel=get('panel-recoil2'),model=window.HELP_RECOIL_MODEL;
const reference=window.HELP_RECOIL_REFERENCE,adapter=PT.RECOIL_ATTACHMENTS;
const palette=['#76dcf2','#ffca78','#90e3a7','#f6a4ce','#b9a6ff'];
let profile=null,result=null,modifiers={v:1,h:1},selection={muzzle:'none',grip:'none',stock:'none'},weaponKey='',sprays=[],active=null,frame=0;
const f=(n,d=3)=>Number.isFinite(n)?Number(n.toFixed(d)).toString():'No data';
function event(el){el.dispatchEvent(new Event('change',{bubbles:true}));}
function stop(){if(frame)cancelAnimationFrame(frame);frame=0;active=null;get('rc_fire').disabled=!profile;}
function reset(){stop();sprays=[];get('rc_sim_count').textContent='0 / 5 sprays';drawSimulation();}
function cards(target,items){
 target.replaceChildren();
 for(const [label,value] of items){const card=document.createElement('div'),name=document.createElement('span'),number=document.createElement('strong');name.textContent=label;number.textContent=value;card.append(name,number);target.append(card);}
}
function cell(row,value,header=false){const el=document.createElement(header?'th':'td');if(header)el.scope='row';el.textContent=value;row.append(el);return el;}
function header(table,labels){table.replaceChildren();const row=table.createTHead().insertRow();for(const label of labels){const th=document.createElement('th');th.scope='col';th.textContent=label;row.append(th);}return table.createTBody();}
function barCell(row,pct){const td=cell(row,f(pct,1)+'%'),bar=document.createElement('span');bar.className='recoil-value-bar';bar.style.setProperty('--value',Math.max(0,Math.min(100,pct))+'%');bar.setAttribute('aria-hidden','true');td.append(bar);}
function surface(id,fallbackHeight){
 const canvas=get(id),rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);
 const W=rect.width||960,H=rect.height||fallbackHeight;
 const width=Math.round(W*ratio),height=Math.round(H*ratio);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);return {ctx,W,H};
}
function drawCurve(){
 const {ctx,W,H}=surface('rc_curve_canvas',280);
 ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b1823';ctx.fillRect(0,0,W,H);if(!result)return;
 const left=52,right=W-20,top=20,bottom=H-42;
 const peak=Math.max(100,...result.shots.map(s=>Math.max(s.buildV/result.peakV*100,s.buildH/result.peakH*100)));
 ctx.font='13px system-ui';ctx.textAlign='right';
 for(let p=0;p<=100;p+=25){const y=bottom-p/peak*(bottom-top);ctx.strokeStyle='#304451';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.fillStyle='#c3d6df';ctx.fillText(p+'%',left-7,y+4);}
 ctx.textAlign='center';for(const n of [1,10,20,30]){const x=left+(n-1)/29*(right-left);ctx.fillStyle='#c3d6df';ctx.fillText(String(n),x,H-19);}
 for(const [key,max,color,dash] of [['v',result.peakV,'#95a8b2',[5,5]],['h',result.peakH,'#9e875f',[5,5]],['buildV',result.peakV,'#76dcf2',[]],['buildH',result.peakH,'#ffca78',[]]]){
  ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(dash);ctx.beginPath();
  result.shots.forEach((shot,i)=>{const x=left+i/29*(right-left),y=bottom-(max?shot[key]/max*100:0)/peak*(bottom-top);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
 }
 ctx.setLineDash([]);
}
function drawSimulation(){
 const {ctx,W,H}=surface('rc_sim_canvas',420);
 ctx.fillStyle='#0b1823';ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#223947';ctx.lineWidth=1;
 for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
 for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 if(!profile)return;
 const count=Number(get('rc_shots').value),bounds=model.bounds(profile,count);
 // Reference bounds use the unmodified curve, so gear changes do not zoom away their benefit.
 const scale=Math.min((W-90)/(bounds.horizontal*2),(H-80)/bounds.vertical),origin={x:W/2,y:H-40};
 ctx.strokeStyle='#e8f4f8';ctx.beginPath();ctx.moveTo(origin.x-9,origin.y);ctx.lineTo(origin.x+9,origin.y);ctx.moveTo(origin.x,origin.y-9);ctx.lineTo(origin.x,origin.y+9);ctx.stroke();
 ctx.fillStyle='#c2d4dc';ctx.font='14px system-ui';ctx.textAlign='left';ctx.fillText('Recoil climb ↑ · common reference scale',18,25);
 for(const spray of [...sprays,...(active?[active]:[])]){
  const points=spray.points.slice(0,spray.visible);ctx.strokeStyle=spray.color;ctx.fillStyle=spray.color;ctx.lineWidth=2;ctx.beginPath();
  points.forEach((p,i)=>{const x=origin.x+p.x*scale,y=origin.y-p.y*scale;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
  for(const p of points){ctx.beginPath();ctx.arc(origin.x+p.x*scale,origin.y-p.y*scale,3,0,Math.PI*2);ctx.fill();}
 }
}
function renderTables(){
 const body=header(get('rc_stage_table'),['Shots','Baseline V','Build V','V saved (pp)','Baseline H','Build H','H saved (pp)','Coverage']);
 for(const stage of result.stages){const row=body.insertRow();cell(row,stage.label,true);barCell(row,stage.baseVPercent);barCell(row,stage.buildVPercent);cell(row,f(stage.baseVPercent-stage.buildVPercent,1));barCell(row,stage.baseHPercent);barCell(row,stage.buildHPercent);cell(row,f(stage.baseHPercent-stage.buildHPercent,1));cell(row,stage.estimated?'EST · final key held':'Within keys');}
 const shots=header(get('rc_shot_table'),['Shot','Time (s)','Baseline V','Build V','Baseline H','Build H','Coverage']);
 for(const shot of result.shots){const row=shots.insertRow();cell(row,shot.number,true);for(const key of ['time','v','buildV','h','buildH'])cell(row,f(shot[key],5));cell(row,shot.estimated?'EST · '+[shot.heldV?'V held':null,shot.heldH?'H held':null].filter(Boolean).join(', '):'Within keys');}
}
function renderAttachments(){
 const holder=get('rc_attachment_choices');holder.replaceChildren();
 for(const [slot,label] of [['muzzle','Muzzle'],['grip','Foregrip'],['stock','Stock']]){
  const items=adapter.choices(profile.name,slot);if(!items.some(item=>item.value===selection[slot]))selection[slot]='none';
  const section=document.createElement('section'),title=document.createElement('h3');title.textContent=label;section.append(title);
  if(items.length===1){const text=document.createElement('p');text.textContent='No compatible '+label.toLowerCase()+' slot';section.append(text);}
  else for(const item of items){
   const button=document.createElement('button');button.type='button';button.dataset.rcSlot=slot;button.dataset.value=item.value;button.setAttribute('aria-pressed',String(selection[slot]===item.value));
   const file=window.HELP_OFFICIAL_ATTACHMENTS?.[profile.name]?.[slot]?.[item.value];
   if(file){const image=document.createElement('img');image.width=64;image.height=44;image.alt='';image.loading='lazy';image.decoding='async';if(panel.classList.contains('active'))image.src='assets/'+file;else image.dataset.visualSrc='assets/'+file;button.append(image);}
   const text=document.createElement('span');text.textContent=item.label+' · V '+f(item.v*100,0)+'% / H '+f(item.h*100,0)+'%';button.append(text);
   button.addEventListener('click',()=>{selection[slot]=item.value;update();panel.querySelector('[data-rc-slot="'+slot+'"][data-value="'+item.value+'"]')?.focus({preventScroll:true});});section.append(button);
  }
  holder.append(section);
 }
}
function renderPatch(){
 const root=get('rc_patch');root.replaceChildren();const changes=reference.patchChanges[profile.name.toLowerCase()];if(!changes)return;
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Reference LMG stance update';details.append(summary);const table=document.createElement('table'),body=header(table,['Parameter','Previous','Updated']);
 for(const values of changes){const row=body.insertRow();for(const value of values)cell(row,value);}details.append(table);root.append(details);
}
function update(){
 reset();const weapon=PT.WBYNAME[get('rc_weapon').value],weaponChanged=weaponKey!==weapon?.name;weaponKey=weapon?.name;profile=model.resolve(weapon,reference.weapons[weapon?.name]);
 get('rc_analyzer').hidden=!profile;
 if(!profile){result=null;get('rc_missing').textContent=(weapon?.name||'This weapon')+' · No reference curve data. Existing weapon parameters remain available below.';get('rc_fire').disabled=true;get('rc_chart').dataset.evidence='unknown';return;}
 if(weaponChanged){selection={muzzle:'none',grip:'none',stock:'none'};get('rc_rate').replaceChildren(...profile.rates.map(rpm=>new Option(rpm+' RPM'+(rpm===profile.rates[0]?(weapon.rpmDisputed?' · disputed default':' · reference default'):' · fast'),String(rpm))));}
 profile=model.atRate(profile,get('rc_rate').value);get('rc_rate_field').hidden=profile.rates.length<2;
 get('rc_rate_note').hidden=!weapon.rpmNote;get('rc_rate_note').textContent=weapon.rpmNote||'';
 for(const option of get('rc_stance').options)option.disabled=profile.stance[option.value]==null;
 if(profile.stance[get('rc_stance').value]==null)get('rc_stance').value='standing';
 const stance=get('rc_stance').value,factor=profile.stance[stance],stanceButtons=get('rc_stance_buttons');stanceButtons.replaceChildren();
 for(const [value,label] of [['standing','Standing'],['crouched','Crouched'],['prone','Prone']]){
  const mult=profile.stance[value],button=document.createElement('button');button.type='button';button.dataset.rcStance=value;button.disabled=mult==null;button.textContent=label+' · '+(mult==null?'No data':'×'+f(mult));button.setAttribute('aria-pressed',String(value===stance));button.addEventListener('click',()=>{get('rc_stance').value=value;event(get('rc_stance'));panel.querySelector('[data-rc-stance="'+value+'"]')?.focus({preventScroll:true});});stanceButtons.append(button);
 }
 renderAttachments();const attachments=adapter.combine(profile.name,selection);modifiers={v:attachments.v*factor,h:attachments.h*factor};result=model.analyze(profile,modifiers);
 get('rc_chart').dataset.evidence='reference-model';
 get('rc_missing').textContent=profile.name+' · reference curves available · '+get('rc_shots').value+'-shot simulation.'+(profile.conflicts.length?' Existing HELP values retained for '+profile.conflicts.map(c=>c.field).join(', ')+'.':'');
 get('rc_stance_summary').textContent='Stance multiplies both recoil axes. '+(profile.sources.crouch==='reference default ×1'?'No crouch multiplier was supplied; the reference uses ×1.':'Prone is available when either dataset supplies a value.');
 get('rc_build_summary').textContent='Selected build: vertical '+f((1-modifiers.v)*100,1)+'% lower and horizontal '+f((1-modifiers.h)*100,1)+'% lower than the raw curve baseline. Attachments: V ×'+f(attachments.v)+' / H ×'+f(attachments.h)+'; stance ×'+f(factor)+'.';
 cards(get('rc_metadata'),[['Fire rate',f(profile.rpm,0)+' RPM'],['Time between shots',f(profile.tbs,5)+' s'],['First vertical kick',f(profile.reference.v[0].v,4)],['First horizontal kick',f(profile.reference.h[0].v,4)],['Maximum vertical key',f(Math.max(...profile.reference.v.map(k=>k.v)),4)],['Maximum horizontal key',f(Math.max(...profile.reference.h.map(k=>k.v)),4)]]);
 cards(get('rc_sim_metadata'),[['Lean bias',profile.tendency===0?'Centered':(profile.tendency<0?'Left':'Right')+' ('+f(profile.tendency)+')'],['Horizontal kick per shot',f(profile.horizontalMin*100,0)+'–100%'],['Vertical variation','±'+f(profile.verticalVariation*100,1)+'%'],['Direction roll','Every '+profile.switchShots+' shots'],['Estimated lean onset',profile.tendency===0?'No preferred side':'≈'+Math.round(profile.switchShots/Math.abs(profile.tendency))+' shots'],['Spray duration',f((Number(get('rc_shots').value)-1)*profile.tbs,3)+' s']]);
 renderPatch();renderTables();drawCurve();drawSimulation();get('rc_fire').disabled=false;
}
function fire(){
 if(!profile||active)return;
 if(sprays.length>=5)sprays=[];
 const count=Number(get('rc_shots').value),points=model.spray(profile,count,modifiers);
 const spray={points,color:palette[sprays.length],visible:1};
 if(!get('rc_animate').checked||window.matchMedia('(prefers-reduced-motion:reduce)').matches){spray.visible=count;sprays.push(spray);drawSimulation();get('rc_sim_count').textContent=sprays.length+' / 5 sprays · '+count+' shots each';return;}
 active=spray;get('rc_fire').disabled=true;const started=performance.now();get('rc_sim_count').textContent=(sprays.length+1)+' / 5 sprays · firing';
 function tick(now){
  if(!active)return;
  active.visible=model.visibleShots((now-started)/1000,profile,count);drawSimulation();
  if(active.visible===count){sprays.push(active);active=null;frame=0;get('rc_fire').disabled=false;get('rc_sim_count').textContent=sprays.length+' / 5 sprays · '+count+' shots each';}
  else frame=requestAnimationFrame(tick);
 }
 frame=requestAnimationFrame(tick);
}
get('rc_class').addEventListener('change',()=>{
 const previous=get('rc_weapon').value,cls=get('rc_class').value;
 const weapons=PT.WEAPONS.filter(w=>cls==='all'||w.cls===cls);get('rc_weapon').replaceChildren(...weapons.map(w=>new Option(w.name,w.name)));
 if(weapons.some(w=>w.name===previous))get('rc_weapon').value=previous;
 event(get('rc_weapon'));
});
for(const id of ['rc_weapon','rc_stance','rc_shots','rc_rate']){get(id).addEventListener('change',update);get(id).addEventListener('input',update);}
get('rc_fire').addEventListener('click',fire);get('rc_reset').addEventListener('click',reset);
get('rc_animate').addEventListener('change',()=>{if(active)reset();});
window.addEventListener('resize',()=>{if(panel.classList.contains('active')){drawCurve();drawSimulation();}},{passive:true});
new MutationObserver(()=>{if(!panel.classList.contains('active'))reset();else{drawCurve();drawSimulation();}}).observe(panel,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
get('rc_export').addEventListener('click',()=>{
 if(!result)return;
 const lines=[['Shot','Time seconds','Baseline vertical','Build vertical','Baseline horizontal','Build horizontal','Estimated']];
 for(const s of result.shots)lines.push([s.number,s.time,s.v,s.buildV,s.h,s.buildH,s.estimated]);
 const blob=new Blob([lines.map(row=>row.join(',')).join('\n')+'\n'],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=profile.name.replace(/[^a-z0-9]+/gi,'-')+'-recoil-'+profile.rpm+'rpm.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
update();
})();
