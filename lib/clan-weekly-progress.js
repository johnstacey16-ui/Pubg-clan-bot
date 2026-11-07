'use strict';
// Server-only source shaping: no raw snapshot rows or database player IDs leave
// Supabase. Every comparison is between two observed PUBG lifetime counters.
const WINDOWS=Object.freeze({
  1:{minDays:0.75,maxDays:1.5},
  3:{minDays:2,maxDays:4},
  7:{minDays:6,maxDays:9},
  14:{minDays:12,maxDays:17}
});
const safeNumber=n=>((typeof n==='number'||typeof n==='string')&&
 n!==''&&Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=1e10
 ?Number(n):null);
function shape(rows,options={}){
 const out=[];
 const windowDays=options.windowDays;
 const limits=WINDOWS[windowDays]||null;
 for(const r of rows||[]){
  if(!r||typeof r.player_name!=='string'||!r.player_name.trim()||
     r.player_name.length>100||!['xbox','psn'].includes(r.platform)||
     !Number.isFinite(Date.parse(r.latest_at)))continue;
  const recentAt=Date.parse(r.latest_at);
  let previousAt=r.previous_at&&Number.isFinite(Date.parse(r.previous_at))
    ?r.previous_at:null;
  if(previousAt&&(
      Date.parse(previousAt)>=recentAt ||
      (limits&&(
       (recentAt-Date.parse(previousAt))/86400000<limits.minDays-0.001||
       (recentAt-Date.parse(previousAt))/86400000>limits.maxDays+0.001
      ))
    ))previousAt=null;
  out.push({
   name:r.player_name,platform:r.platform,latestAt:r.latest_at,
   previousAt,
   latestKills:safeNumber(r.latest_kills),latestWins:safeNumber(r.latest_wins),
   latestMatches:safeNumber(r.latest_matches),
   previousKills:previousAt?safeNumber(r.previous_kills):null,
   previousWins:previousAt?safeNumber(r.previous_wins):null,
   previousMatches:previousAt?safeNumber(r.previous_matches):null
  });
 }
 return{
  schemaVersion:1,
  source:'Genuine official PUBG lifetime counter snapshots',
  rows:out,count:out.length,
  note:limits?
   'Only real saved PUBG lifetime snapshots '+limits.minDays+'–'+limits.maxDays+
    ' days apart are compared, nearest to '+windowDays+
    ' days. Changes may include missed collection time. This is not a PUBG-reported daily split or a lifetime growth forecast. Negative resets, no earlier source, and zero new matches do not qualify for momentum awards.':
   'Gaps mean no real comparison snapshot; negative cumulative changes are flagged, not interpreted as performance declines.'
 };
}
async function weeklyProgress(db){
 const r=await db.rpc('get_clan_weekly_progress');
 if(r.error||!Array.isArray(r.data))throw Error('Clan history query unavailable');
 if(r.data.length>1000)throw Error('Unbounded clan history');
 return{status:200,body:shape(r.data)};
}
async function observedProgress(db,daysInput=3){
 const parsed=typeof daysInput==='number'?daysInput:
  typeof daysInput==='string'&&/^(1|3|7|14)$/.test(daysInput)?
    Number(daysInput):NaN;
 const limits=WINDOWS[parsed];
 if(!limits)return{status:400,body:{error:'Choose 1, 3, 7 or 14 real observed days'}};
 const result=await db.rpc('get_clan_observed_progress',{p_days:parsed});
 if(result.error||!Array.isArray(result.data))throw Error('Clan observation query unavailable');
 if(result.data.length>1000)throw Error('Unbounded clan observation query');
 const data=shape(result.data,{windowDays:parsed});
 const compared=data.rows.filter(r=>r.previousAt!==null);
 return{status:200,body:{
  ...data,kind:'observed-progress',windowDays:parsed,
  minDays:limits.minDays,maxDays:limits.maxDays,
  comparedPlayers:compared.length,
  awaitingComparison:data.rows.length-compared.length
 }};
}
module.exports={shape,weeklyProgress,observedProgress,WINDOWS,safeNumber};
