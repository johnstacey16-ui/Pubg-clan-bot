// Original explanatory UI using the toolkit's existing damage model.
(function(){
'use strict';
const get=id=>document.getElementById(id),model=PT.DAMAGE_GUIDE,root=get('damage-guide');
if(!root||!model)return;
get('panel-hit-zone').querySelector('.hz-detail-card').after(root);
const names={AR:'Assault rifles',DMR:'Marksman rifles',SR:'Sniper rifles',MG:'Light machine guns',SMG:'Submachine guns',Pistol:'Handguns',SG:'Shotguns'};
const slug={AR:'ar',DMR:'dmr',SR:'sr',MG:'mg',SMG:'smg',Pistol:'pistol',SG:'sg'};
const pct=n=>Number((n*100).toFixed(2))+'%',num=n=>n==null?'No data':Number(n.toFixed(4)).toString();
const ns='http://www.w3.org/2000/svg';
function svgEl(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;}
const markers={head:[210,65,0,65],neck:[210,127,0,117],clavicle:[210,170,0,169],chest:[210,222,0,221],upperStomach:[210,275,0,273],lowerStomach:[210,322,0,325],pelvis:[210,365,0,377],upperArm:[275,235,1,210],forearm:[293,310,1,294],hand:[305,380,1,378],thigh:[235,468,1,478],calf:[235,598,1,590],foot:[235,704,1,702]};
const short={upperStomach:'Upper abs',lowerStomach:'Lower abs',upperArm:'Upper arm'};
function makeModel(id,asset,rows,mode){
 const svg=svgEl('svg',{viewBox:'0 0 420 760',role:'img','aria-labelledby':id+'-title',class:'dg-model'});
 svg.append(svgEl('title',{id:id+'-title'},mode==='area'?'Hit-area multipliers on a front-view model':names[id.split('-').at(-1)]||'Damage multiplier reference model'));
 svg.append(svgEl('rect',{x:0,y:0,width:420,height:760,rx:16,fill:'#091722'}));
 svg.append(svgEl('image',{'data-dg-src':'assets/'+asset,x:-40,y:5,width:500,height:750,preserveAspectRatio:'xMidYMid meet','aria-hidden':'true'}));
 const parts=mode==='class'?['head','chest','pelvis','upperArm','thigh']:model.parts.map(p=>p.id);
 for(const key of parts){const [x,y,side,ly]=markers[key],lx=side?305:5,anchor=side?305:115,r=rows.find(p=>p.id===key);
  const group=svgEl('g',{'data-guide-zone':key});
  group.append(svgEl('path',{d:`M${x} ${y} L${anchor} ${ly+17}`,stroke:'#8ab5c7','stroke-width':1.25,fill:'none'}));
  group.append(svgEl('circle',{cx:x,cy:y,r:3,fill:'#ffc45c'}));
  group.append(svgEl('rect',{x:lx,y:ly-8,width:110,height:48,rx:7,fill:'#0c2534','fill-opacity':.96,stroke:'#385667'}));
  const label=mode==='class'?({chest:'Torso',upperArm:'Arms',thigh:'Legs'}[key]||r.label):(short[key]||r.label);
  group.append(svgEl('text',{x:lx+8,y:ly+9,fill:'#b6ced8','font-size':19,'font-family':'system-ui'},label));
  const value=mode==='area'?r.hitArea:mode==='class'?r.classMultiplier:r.combined;
  group.append(svgEl('text',{x:lx+8,y:ly+31,fill:'#fff0c7','font-size':pct(value).length>6?20:23,'font-weight':700,'font-family':'system-ui','data-guide-value':key},pct(value)));
  svg.append(group);
 }
 return svg;
}
function table(rows,mode,caption){
 const table=document.createElement('table');table.className='dg-value-table';const cap=table.createCaption();cap.textContent=caption;
 const head=table.createTHead().insertRow();for(const text of ['Body part','Multiplier']){const th=document.createElement('th');th.scope='col';th.textContent=text;head.append(th);}
 const body=table.createTBody();for(const r of rows){const row=body.insertRow();row.insertCell().textContent=r.label;row.insertCell().textContent=pct(mode==='area'?r.hitArea:mode==='class'?r.classMultiplier:r.combined);}
 return table;
}
function card(cls,mode){
 const id='dg-'+mode+'-'+slug[cls],article=document.createElement('article');article.className='dg-model-card';article.dataset.guideClass=cls;
 const h=document.createElement('h3');h.textContent=names[cls];const kicker=document.createElement('p');kicker.className='dg-kicker';kicker.textContent=mode==='class'?'CLASS FACTOR ONLY':'CLASS × HIT AREA × GEAR';article.append(kicker,h);
 const rows=model.rows(cls,Number(get('dg_helmet').value),Number(get('dg_vest').value));
 article.append(makeModel(id,'damage-training-mannequin.svg',rows,mode));
 // Values remain fully accessible without relying on the image or colour.
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Equivalent values as a table';details.append(summary,table(rows,mode,names[cls]+' '+mode+' multipliers'));article.append(details);return article;
}
const areaRows=model.rows('AR',0,0);get('dg_area_model').append(makeModel('dg-area','damage-training-mannequin.svg',areaRows,'area'));get('dg_area_table').append(table(areaRows,'area','Fixed hit-area multipliers'));
for(const cls of model.classes)get('dg_class_models').append(card(cls,'class'));
function loadGuideArtwork(){
 if(!get('panel-hit-zone').classList.contains('active'))return;
 for(const image of root.querySelectorAll('image[data-dg-src]')){image.setAttribute('href',image.getAttribute('data-dg-src'));image.removeAttribute('data-dg-src');}
}
function renderCombined(){
 const grid=get('dg_combined_models');grid.replaceChildren(...model.classes.map(cls=>card(cls,'combined')));
 get('dg_gear_context').textContent='Helmet '+get('dg_helmet').selectedOptions[0].textContent+' · Vest '+get('dg_vest').selectedOptions[0].textContent+' · Distance excluded. Values show the percentage of base damage remaining.';
 loadGuideArtwork();
}
for(const id of ['dg_helmet','dg_vest'])get(id).addEventListener('change',renderCombined);
get('dg_copy_gear').addEventListener('click',()=>{get('dg_helmet').value=get('hz_helmet').value;get('dg_vest').value=get('hz_vest').value;renderCombined();});
function renderFormula(){
 const w=PT.WBYNAME[get('hz_weapon').value],zone=get('hz_body').querySelector('[data-hit-zone][aria-pressed="true"]')?.dataset.hitZone||'chest';
 const result=model.breakdown(w,Number(get('hz_distance').value),zone,Number(get('hz_helmet').value),Number(get('hz_vest').value));
 get('dg_formula_context').textContent=w.name+' · '+get('hz_distance').value+' m · '+result.label;
 const factors=[['Base damage',num(result.base)],['Distance',num(result.distanceFactor)],['Armour remaining',num(result.armorMultiplier)],['Hit area',num(result.hitAreaMultiplier)],['Weapon class',num(result.classMultiplier)]];
 const line=get('dg_formula_values');line.replaceChildren();for(const [label,value]of factors){const item=document.createElement('div'),labelEl=document.createElement('span'),strong=document.createElement('strong');labelEl.textContent=label;strong.textContent=value;item.append(labelEl,strong);line.append(item);}
 get('dg_actual_damage').textContent=num(result.damage);
 get('dg_formula_note').textContent=result.pellet?'This weapon uses pellets. Actual whole-shell damage depends on how many pellets connect, so no whole-shell total is shown.':result.damage==null?'No recorded damage checkpoint at this distance. The formula keeps missing values as No data.':'Base × distance × armour remaining × hit area × weapon class. A 40% damage reduction leaves an armour factor of 0.60.';
}
for(const id of ['hz_weapon','hz_distance','hz_helmet','hz_vest'])get(id).addEventListener('change',renderFormula);
for(const event of ['click','keydown'])get('hz_body').addEventListener(event,()=>queueMicrotask(renderFormula));
new MutationObserver(loadGuideArtwork).observe(get('panel-hit-zone'),{attributes:true,attributeFilter:['class']});
renderCombined();renderFormula();loadGuideArtwork();
})();
