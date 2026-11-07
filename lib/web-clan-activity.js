'use strict';
// One service-role database aggregation. No match IDs, account IDs, raw
// participant payloads, individual player locations or PUBG API calls.
const WINDOWS=new Set([7,30,180]);
const integer=(value,limit=1e7)=>
 typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=limit
  ?value:null;
const quantity=(value,limit=1e12)=>
 typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=limit
  ?value:null;
const FIELDS=['playerMatches','distinctMatches','activePlayers',
 'killsObserved','kills','damageObserved','damage',
 'knownPlacements','playerWins','playerTop10'];
function validDate(value){
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  Number.isFinite(Date.parse(value+'T00:00:00Z'))&&
  new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
}
function safeDay(row){
 if(!row||!validDate(row.day))return null;
 const out={day:row.day};
 for(const field of FIELDS){
  const n=field==='damage'?quantity(row[field]):integer(row[field]);
  if(n===null)return null;
  out[field]=n;
 }
 const related=['distinctMatches','activePlayers','killsObserved',
  'damageObserved','knownPlacements'];
 if(related.some(f=>out[f]>out.playerMatches)||
   out.playerWins>out.knownPlacements||
   out.playerTop10>out.knownPlacements||
   out.playerWins>out.playerTop10)return null;
 return out;
}
function parseDays(input){
 if(input===undefined)return 30;
 if(typeof input==='number')return WINDOWS.has(input)?input:null;
 return typeof input==='string'&&/^(7|30|180)$/.test(input)?
  Number(input):null;
}
async function publicClanActivity(db,daysInput){
 const days=parseDays(daysInput);
 if(!days)return{status:400,body:{error:'Choose 7, 30 or 180 UTC calendar days'}};
 const result=await db.rpc('get_clan_activity_pulse',{p_days:days});
 if(result.error)throw Error('Archived clan activity unavailable');
 const payload=result.data;
 if(!payload||payload.schemaVersion!==1||payload.periodDays!==days||
   payload.timeZone!=='UTC'||!Array.isArray(payload.days)||payload.days.length!==days)
   throw Error('Invalid archived activity response');
 const rows=payload.days.map(safeDay);
 if(rows.some(r=>!r))throw Error('Invalid archived daily source numbers');
 for(let i=1;i<rows.length;i++){
  if(Date.parse(rows[i].day+'T00:00:00Z')-
    Date.parse(rows[i-1].day+'T00:00:00Z')!==86400000)
    throw Error('Archive dates not consecutive UTC days');
 }
 const count=name=>integer(payload[name])??null;
 const totals=['verifiedPlayers','observedPlayers',
  'playerMatchObservations','distinctMatches'];
 if(totals.some(f=>count(f)===null)||count('observedPlayers')>count('verifiedPlayers')||
   count('distinctMatches')>count('playerMatchObservations')||
   count('playerMatchObservations')!==rows.reduce((a,r)=>a+r.playerMatches,0))
   throw Error('Archived activity coverage inconsistent');
 const sourceDate=value=>
  typeof value==='string'&&Number.isFinite(Date.parse(value))?value:null;
 return{status:200,body:{
  schemaVersion:1,kind:'clan-activity',periodDays:days,timeZone:'UTC',
  generatedAt:sourceDate(payload.generatedAt),
  verifiedPlayers:count('verifiedPlayers'),
  observedPlayers:count('observedPlayers'),
  playerMatchObservations:count('playerMatchObservations'),
  distinctMatches:count('distinctMatches'),
  firstMatchAt:sourceDate(payload.firstMatchAt),
  lastMatchAt:sourceDate(payload.lastMatchAt),
  source:'Verified-clan saved PUBG console match archive only',
  note:'UTC calendar dates including today (today is incomplete). Missing archived games cannot be inferred. Empty dates mean no SAVED reports, not proof no one played. A shared match counts once in distinct games, but once per recorded clan player as a player-match observation; wins and kills are per-player observations.',
  days:rows
 }};
}
module.exports={publicClanActivity,safeDay,parseDays,validDate,WINDOWS};
