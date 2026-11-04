'use strict';
// Adapted from the user-owned older PUBG dashboard, with sample-gap disclosure.
// Official coordinate reference: documentation.pubg.com/en/telemetry-objects.html
const extents={Erangel_Main:816000,Baltic_Main:816000,Desert_Main:816000,Tiger_Main:816000,DihorOtok_Main:816000,Kiki_Main:816000,Savage_Main:408000,Chimera_Main:306000,Summerland_Main:204000,Range_Main:204000,Heaven_Main:102000};
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y,z:Number.isFinite(p.z)?p.z:null}:null;
function buildReplay(events,mapName){
  const tracks=new Map(),circles=[],combat=[];let invalidTimes=0,invalidPositions=0;
  const times=events.map(e=>Date.parse(e._D)).filter(Number.isFinite);
  const origin=times.length?times.reduce((a,b)=>Math.min(a,b)):0;
  let duration=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  function include(p){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  for(const [sourceIndex,e] of events.entries()){
    const stamp=Date.parse(e._D);if(!Number.isFinite(stamp)){invalidTimes++;continue;}
    const t=(stamp-origin)/1000;duration=Math.max(duration,t);
    if(e._T==='LogPlayerPosition'){
      const c=e.character,p=point(c?.location);if(!p||!c?.accountId){invalidPositions++;continue;}
      include(p);const track=tracks.get(c.accountId)||{id:c.accountId,name:c.name||c.accountId,teamId:c.teamId??null,samples:[]};
      track.samples.push({t,...p,health:Number.isFinite(c.health)?c.health:null,sourceIndex});tracks.set(c.accountId,track);
    }else if(e._T==='LogGameStatePeriodic'){
      const g=e.gameState||{},zones=[];
      for(const key of ['safetyZone','poisonGasWarning','redZone','blackZone']){const p=point(g[key+'Position']),radius=g[key+'Radius'];if(p&&Number.isFinite(radius)&&radius>0)zones.push({key,...p,radius});}
      circles.push({t,zones,alive:Number.isFinite(g.numAlivePlayers)?g.numAlivePlayers:null,sourceIndex});
    }else if(['LogPlayerKill','LogPlayerKillV2','LogPlayerMakeGroggy'].includes(e._T)){
      const actor=e._T==='LogPlayerMakeGroggy'?e.attacker:e.killer,location=point(e.victim?.location),from=point(actor?.location);
      combat.push({t,type:e._T,actor:actor?.name||'Unattributed',actorId:actor?.accountId??null,victim:e.victim?.name||'Unknown',victimId:e.victim?.accountId??null,location,from,sourceIndex});
    }
  }
  const byTime=(a,b)=>a.t-b.t||a.sourceIndex-b.sourceIndex;for(const track of tracks.values())track.samples.sort(byTime);circles.sort(byTime);combat.sort(byTime);
  let bounds;
  if(extents[mapName])bounds={x:0,y:0,size:extents[mapName],source:'Official documented coordinate extent'};
  else{const size=Number.isFinite(minX)?Math.max(maxX-minX,maxY-minY,10000)*1.05:100000;bounds={x:Number.isFinite(minX)?minX-size*.025:0,y:Number.isFinite(minY)?minY-size*.025:0,size,source:'Observed position bounds; full map extent is not documented here'};}
  return {mapName:mapName||'Unknown map',origin:new Date(origin).toISOString(),duration,sourceEvents:events.length,invalidTimes,invalidPositions,bounds,tracks:[...tracks.values()],circles,combat,sampleColumns:['t (seconds since origin)','x/y/z (centimeters)','health','sourceIndex']};
}
function latestSample(samples,t){let lo=0,hi=samples.length-1,index=-1;while(lo<=hi){const mid=(lo+hi)>>1;if(samples[mid].t<=t){index=mid;lo=mid+1;}else hi=mid-1;}return index<0?null:samples[index];}
function pathSegments(samples,t,windowSeconds=120,maxGap=30){const result=[];let segment=[];for(const p of samples){if(p.t>t)break;if(p.t<t-windowSeconds)continue;if(segment.length&&p.t-segment.at(-1).t>maxGap){result.push(segment);segment=[];}segment.push(p);}if(segment.length)result.push(segment);return result;}

module.exports={buildReplay,latestSample,pathSegments};
