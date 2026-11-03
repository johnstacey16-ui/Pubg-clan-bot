'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { playerHistory }=require('../api/player-history');

function makeDb(memberStatus='matched') {
  const calls=[];
  const tables={
    player_import_queue:[{gamertag:'Xbox_Test',status:memberStatus,is_clan_member:true}],
    players:[{id:11,gamertag:'Xbox_Test',platform:'xbox',pubg_account_id:'account.PRIVATE'}],
    player_stat_snapshots:[
      {observed_at:'2026-11-03T12:00:00Z',kills:300,wins:15,matches:200},
      {observed_at:'2026-11-02T12:00:00Z',kills:290,wins:14,matches:198}
    ]
  };
  return {
    calls,
    from(table) {
      calls.push(table);
      return {
        select(){return this},eq(){return this},ilike(){return this},
        order(){return this},
        async limit(){return {data:tables[table]||[],error:null}}
      };
    }
  };
}
test('public history is chronological, real and excludes private IDs', async()=>{
 const db=makeDb();
 const r=await playerHistory(db,'Xbox_Test');
 assert.equal(r.status,200);
 assert.deepEqual(db.calls,['player_import_queue','players','player_stat_snapshots']);
 assert.deepEqual(r.data.points.map(p=>p.kills),[290,300]);
 assert.equal(r.data.platform,'xbox');
 assert.doesNotMatch(JSON.stringify(r.data),/account\.PRIVATE|"id":11/);
});
test('history requires verified clan membership before reading private player table',async()=>{
 const db=makeDb('pending');
 const r=await playerHistory(db,'Xbox_Test');
 assert.equal(r.status,404);
 assert.deepEqual(db.calls,['player_import_queue']);
});
test('invalid names and comma-separated searches are rejected',async()=>{
 for(const name of ['','name,outsider','\n','x'.repeat(101)]) {
   const db=makeDb();
   const r=await playerHistory(db,name);
   assert.equal(r.status,400);
   assert.deepEqual(db.calls,[]);
 }
});
test('one actual snapshot never fabricates historic points',async()=>{
 const db=makeDb();
 const baseFrom=db.from.bind(db);
 db.from=function(table){
   const q=baseFrom(table);
   if(table==='player_stat_snapshots')q.limit=async()=>({data:[
     {observed_at:'2026-11-03T12:00:00Z',kills:300,wins:15,matches:200}
   ],error:null});
   return q;
 };
 const r=await playerHistory(db,'Xbox_Test');
 assert.equal(r.data.points.length,1);
 assert.match(r.data.note,/baseline/);
});

test('tracked outsider is denied even if a database adapter returns that row',async()=>{
 const db=makeDb();
 const baseFrom=db.from.bind(db);
 db.from=function(table){
   const q=baseFrom(table);
   if(table==='player_import_queue')q.limit=async()=>({data:[
     {gamertag:'Xbox_Test',status:'matched',is_clan_member:false}
   ],error:null});
   return q;
 };
 const r=await playerHistory(db,'Xbox_Test');
 assert.equal(r.status,404);
 assert.deepEqual(db.calls,['player_import_queue']);
});
