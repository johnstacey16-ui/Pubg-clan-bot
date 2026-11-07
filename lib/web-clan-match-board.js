'use strict';
// Public-safe, cache-only clan historical comparison. This calls one service-role
// SQL aggregation; never reads raw match JSON into a browser or spends PUBG quota.
const PERIODS=new Set([7,30,180]);
const num=(v,limit=1e12)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=limit?v:null;
const txt=v=>typeof v==='string'?v.slice(0,100):'';
function sanitizeRow(row){
  if(!row||typeof row!=='object'||!txt(row.name).trim()||
      !['xbox','psn'].includes(row.platform)||
      num(row.games,1e7)===null||row.games<1)return null;
  const fields=['games','placed','wins','top10','killsObserved','kills',
    'damageObserved','damage','assistsObserved','assists','knocksObserved',
    'knocks','survivalObserved','survivalSeconds','placementTotal'];
  const item={name:txt(row.name),platform:row.platform,
    map:txt(row.map)||'Unknown map',mode:txt(row.mode)||'Unknown mode'};
  for(const field of fields){
    const n=num(row[field]);if(n===null)return null;
    item[field]=n;
  }
  for(const key of ['placed','wins','top10','killsObserved','damageObserved',
      'assistsObserved','knocksObserved','survivalObserved'])
    if(item[key]>item.games)return null;
  if(item.wins>item.placed||item.top10>item.placed||item.wins>item.top10)return null;
  item.latest=typeof row.latest==='string'&&Number.isFinite(Date.parse(row.latest))
    ?row.latest:null;
  return item;
}
async function publicClanMatchBoard(db,daysInput){
  const days=Number(daysInput===undefined?30:daysInput);
  if(!PERIODS.has(days)||!(typeof daysInput==='undefined'||
    typeof daysInput==='number'||typeof daysInput==='string'))
    return{status:400,body:{error:'Choose a supported historical window: 7, 30 or 180 days'}};
  const result=await db.rpc('get_clan_match_history_board',{p_days:days});
  if(result.error)throw Error('Saved clan match comparison unavailable');
  const payload=result.data;
  if(!payload||payload.schemaVersion!==1||payload.periodDays!==days||
      !Array.isArray(payload.rows))throw Error('Invalid historical match aggregation');
  const rows=payload.rows.slice(0,2000).map(sanitizeRow).filter(Boolean);
  return{status:200,body:{
    schemaVersion:1,kind:'clan-match-board',periodDays:days,
    generatedAt:typeof payload.generatedAt==='string'?payload.generatedAt:null,
    clanPlayers:num(payload.clanPlayers,10000)||0,
    observedPlayers:num(payload.observedPlayers,10000)||0,
    playerMatchObservations:num(payload.playerMatchObservations,1e7)||0,
    distinctMatches:num(payload.distinctMatches,1e7)||0,
    source:'Stored verified-clan PUBG match archive; no PUBG requests',
    note:'Only matches saved within the selected rolling date window count. A shared game can contribute one observation per participating clan member. Rates are observed samples, not lifetime statistics or normalized skill rankings.',
    rows
  }};
}
module.exports={publicClanMatchBoard,sanitizeRow,PERIODS};
