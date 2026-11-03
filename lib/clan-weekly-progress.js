'use strict';
const {escapeLike}=require('./pubg-utils');
function shape(rows){
 const safeNumber=n=>n===null||n===undefined||!Number.isFinite(Number(n))?
   null:Math.max(0,Number(n));
 const out=[];
 for(const r of rows||[]){
  if(!r||typeof r.player_name!=='string'||r.player_name.length>100||
     !['xbox','psn'].includes(r.platform)||
     !Number.isFinite(Date.parse(r.latest_at)))continue;
  out.push({
   name:r.player_name,platform:r.platform,latestAt:r.latest_at,
   previousAt:r.previous_at&&Number.isFinite(Date.parse(r.previous_at))?r.previous_at:null,
   latestKills:safeNumber(r.latest_kills),latestWins:safeNumber(r.latest_wins),
   latestMatches:safeNumber(r.latest_matches),
   previousKills:safeNumber(r.previous_kills),previousWins:safeNumber(r.previous_wins),
   previousMatches:safeNumber(r.previous_matches)
  });
 }
 return{schemaVersion:1,source:'Genuine lifetime snapshot comparisons, 6–14 day observed interval',
  rows:out,count:out.length,
  note:'Gaps mean no real comparison snapshot; negative cumulative changes are flagged, not interpreted as performance declines.'};
}
async function weeklyProgress(db){
 const r=await db.rpc('get_clan_weekly_progress');
 if(r.error||!Array.isArray(r.data))throw Error('Clan history query unavailable');
 if(r.data.length>1000)throw Error('Unbounded clan history');
 return{status:200,body:shape(r.data)};
}
module.exports={shape,weeklyProgress};