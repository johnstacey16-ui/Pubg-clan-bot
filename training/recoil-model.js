// Original HELP model using imported numeric curves. No game records are mutated.
(function(factory){
 const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;
 else window.HELP_RECOIL_MODEL=model;
})(function(){
'use strict';
const finite=Number.isFinite;
function sample(keys,time){
 if(!Array.isArray(keys)||!keys.length)return null;
 if(time<=keys[0].t)return keys[0].v;
 const last=keys[keys.length-1];if(time>=last.t)return last.v;
 const i=keys.findIndex((key,index)=>index<keys.length-1&&time<keys[index+1].t);
 const a=keys[i],b=keys[i+1],duration=b.t-a.t,u=(time-a.t)/duration;
 if(a.mode==='Constant')return a.v;
 if(a.mode==='Linear')return a.v+(b.v-a.v)*u;
 // Cubic Hermite interpolation of unweighted leave/arrive tangents.
 const u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*a.v+(u3-2*u2+u)*duration*a.lt+
  (-2*u3+3*u2)*b.v+(u3-u2)*duration*b.at;
}
function resolve(weapon,reference){
 if(!weapon||!reference)return null;
 const conflicts=[],sources={};
 function prefer(field,own,external){
  const ownKnown=finite(own),externalKnown=finite(external);
  sources[field]=ownKnown?'HELP':externalKnown?'PUBGIntel':'unavailable';
  if(ownKnown&&externalKnown&&Math.abs(own-external)>1e-8)conflicts.push({field,help:own,reference:external,used:own});
  return ownKnown?own:externalKnown?external:null;
 }
 const settings=reference.stanceAndSlots,r=reference.random,detail=weapon.recoilDetail||{};
 const ownT=finite(weapon.hBiasVal)?(weapon.hBiasVal===0?0:weapon.hBiasDir==='←'?-weapon.hBiasVal:weapon.hBiasDir==='→'?weapon.hBiasVal:null):null;
 const rpm=prefer('rpm',weapon.rpm,Math.round(60/reference.tbs));
 const crouch=prefer('crouch',weapon.crouchMod,settings.crouchMod);
 const profile={name:weapon.name,reference,conflicts,sources,rpm,tbs:60/rpm,
  stance:{standing:prefer('standing',weapon.standMod,settings.standMod)??1,crouched:crouch??1,prone:prefer('prone',detail.proneMod,settings.proneMod)},
  tendency:prefer('tendency',ownT,r.T),switchShots:prefer('switchShots',detail.switchShots,r.bps),
  horizontalMin:prefer('horizontalMin',finite(weapon.minH)?weapon.minH/100:null,r.hMin),verticalVariation:prefer('verticalVariation',weapon.verticalVariation,r.vVar),rates:[rpm]};
 if(crouch==null)sources.crouch='reference default ×1';
 if(finite(reference.tbsAlt)){const alternate=Math.round(60/reference.tbsAlt);if(!profile.rates.includes(alternate))profile.rates.push(alternate);}
 return profile;
}
function atRate(profile,rpm){return {...profile,rpm:profile.rates.includes(Number(rpm))?Number(rpm):profile.rates[0],tbs:60/(profile.rates.includes(Number(rpm))?Number(rpm):profile.rates[0])};}
function analyze(profile,multipliers={v:1,h:1}){
 const vertical=profile.reference.v,horizontal=profile.reference.h;
 const shots=Array.from({length:30},(_,index)=>{
  const number=index+1,time=index*profile.tbs;
  const v=sample(vertical,time),h=sample(horizontal,time);
  const heldV=time>vertical[vertical.length-1].t,heldH=time>horizontal[horizontal.length-1].t;
  return {number,time,v,h,buildV:v*multipliers.v,buildH:h*multipliers.h,heldV,heldH,estimated:heldV||heldH};
 });
 const peakV=Math.max(...shots.map(s=>s.v)),peakH=Math.max(...shots.map(s=>s.h));
 const stages=[0,10,20].map(offset=>{
  const group=shots.slice(offset,offset+10),avg=key=>group.reduce((sum,s)=>sum+s[key],0)/group.length;
  const v=avg('v'),h=avg('h'),buildV=avg('buildV'),buildH=avg('buildH');
  return {label:(offset+1)+'–'+(offset+10),v,h,buildV,buildH,baseVPercent:peakV?v/peakV*100:0,baseHPercent:peakH?h/peakH*100:0,
   buildVPercent:peakV?buildV/peakV*100:0,buildHPercent:peakH?buildH/peakH*100:0,estimated:group.some(s=>s.estimated)};
 });
 return {shots,stages,peakV,peakH};
}
function spray(profile,count,multipliers={v:1,h:1},random=Math.random){
 if(!Number.isInteger(count)||count<1||count>100)throw Error('Spray length must be 1–100 shots');
 const points=[];let x=0,y=0,direction=0;
 const leftChance=Math.max(.05,Math.min(.95,.5-profile.tendency*2.5));
 for(let i=0;i<count;i++){
  const time=i*profile.tbs;points.push({x,y,time,shot:i+1});
  const v=sample(profile.reference.v,time)*(1+(random()*2-1)*profile.verticalVariation)*multipliers.v;
  const h=sample(profile.reference.h,time)*(profile.horizontalMin+(1-profile.horizontalMin)*random())*multipliers.h;
  if(i%profile.switchShots===0)direction=random()<leftChance?-1:1;
  x+=direction*h;y+=v;
 }
 return points;
}
function visibleShots(seconds,profile,count){return Math.min(count,Math.max(1,1+Math.floor((seconds+1e-9)/profile.tbs)));}
function bounds(profile,count){
 let horizontal=0,vertical=0;
 for(let i=0;i<count;i++){
  horizontal+=sample(profile.reference.h,i*profile.tbs);
  vertical+=sample(profile.reference.v,i*profile.tbs)*(1+profile.verticalVariation);
 }
 return {horizontal:Math.max(horizontal,1),vertical:Math.max(vertical,1)};
}
return Object.freeze({sample,resolve,atRate,analyze,spray,bounds,visibleShots});
});
