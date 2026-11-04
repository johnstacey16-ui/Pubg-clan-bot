'use strict';
// Bounded, persistent clan backfill. Only the server-side service role can
// seed/claim these jobs. User-triggered PUBG lookups retain two reserved slots.
const {playerEndpoint,matchEndpoint}=require('./pubg-endpoints');
const {getStats}=require('./live-stats');
const MAX_JOBS=6;
const MAX_MATCHES=5;
const MATCH_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPES=Object.freeze({lifetime:null,profile:'',weapons:'weapon_mastery',survival:'survival_mastery'});
async function read(query,label) {
 const r=await query;
 if(r.error)throw Error(label+' failed: '+r.error.message);
 return r.data;
}
async function finish(db,job,state,outcome,delaySeconds=0){
 const now=Date.now();
 await read(db.from('pubg_backfill_jobs').update({
   state,last_outcome:outcome,next_attempt_at:new Date(now+delaySeconds*1000).toISOString(),
   ...(state==='done'||state==='unavailable'?{completed_at:new Date(now).toISOString()}: {})
 }).eq('player_id',job.player_id).eq('scope',job.scope).select('player_id'),'Save backfill progress');
}
async function collectClanExtras(db,services={}){
 const endpoint=services.playerEndpoint||playerEndpoint;
 const match=services.matchEndpoint||matchEndpoint;
 const lifetime=services.getStats||getStats;
 const batchSize=Math.min(MAX_JOBS,Math.max(1,Number(services.batchSize)||MAX_JOBS));
 const seeded=await read(db.rpc('seed_pubg_backfill_jobs'),'Seed matched clan tasks');
 const rows=await read(db.rpc('claim_pubg_backfill_jobs',{p_limit:batchSize}),'Claim next clan tasks');
 const jobs=Array.isArray(rows)?rows:[];
 const result={status:'no_work',seeded:Number(seeded)||0,claimed:jobs.length,
   saved:0,cached:0,unavailable:0,rateLimited:0,errors:0,freeMatchDetails:0};
 // Parallel requests are still serialized by the same atomic Supabase rate bucket.
 await Promise.all(jobs.map(async job=>{
   if(!Object.hasOwn(SCOPES,job.scope)||
      !['xbox','psn'].includes(job.platform)||!job.pubg_account_id){
     result.unavailable++;
     await finish(db,job,'unavailable','invalid_identity');
     return;
   }
   let response;
   try{
     if(job.scope==='lifetime'){
       const current=await lifetime(db,job.gamertag,{platform:job.platform,
         refreshRequested:true,background:true});
       response=current?.state==='player'&&current.source!=='stale'
         ?{state:current.source==='live'?'fresh':'cached',data:current.player}
         :{state:current?.state==='queued'?'rate_limited':current?.state||'unavailable'};
     }else response=await endpoint(db,job,SCOPES[job.scope],6*3600,{background:true});
     if(response?.data){
       if(response.state==='fresh')result.saved++;
       else result.cached++;
       // Match details are explicitly exempt from PUBG's API-key RPM limit.
       // Fetch at most five new details from a saved player index; cached details
       // are reused by matchEndpoint. Never fetch arbitrary URLs.
       if(job.scope==='profile'){
         const listed=response.data?.data?.relationships?.matches?.data;
         const ids=Array.isArray(listed)?[...new Set(listed.map(x=>x?.id)
           .filter(x=>typeof x==='string'&&MATCH_ID.test(x)))].slice(0,MAX_MATCHES):[];
         const details=await Promise.allSettled(ids.map(id=>match(db,id)));
         result.freeMatchDetails+=details.filter(x=>
           x.status==='fulfilled'&&Boolean(x.value?.data)).length;
       }
       await finish(db,job,'done',response.state||'saved');
     }else if(response?.state==='rate_limited'){
       result.rateLimited++;
       await finish(db,job,'pending','budget_full',70);
     }else{
       result.unavailable++;
       // Permanent unsupported endpoints should not starve the rest of the
       // queue. Retry transient failures later, but stop after three tries.
       const final=Number(job.attempts)>=3;
       await finish(db,job,final?'unavailable':'pending',
         response?.state||'unavailable',final?0:Math.min(3600*24,300*Math.pow(3,Math.max(0,Number(job.attempts)-1))));
     }
   }catch(error){
     console.error('Saved PUBG backfill task failed:',job.scope,error.message);
     result.errors++;
     await finish(db,job,'pending','request_failed',300*Math.min(12,Math.max(1,Number(job.attempts)||1)));
   }
 }));
 const counts=await read(db.rpc('get_pubg_backfill_status'),'Read backfill status');
 const status=counts&&typeof counts==='object'?counts:{};
 result.total=Number(status.total)||0;
 result.done=Number(status.done)||0;
 result.pending=(Number(status.pending)||0)+(Number(status.leased)||0);
 result.unavailableTotal=Number(status.unavailable)||0;
 result.status=result.rateLimited?'rate_limited':
   result.errors||result.unavailable?'partial':
   result.claimed?'processed':'no_work';
 return result;
}
module.exports={collectClanExtras,MAX_JOBS,MAX_MATCHES,SCOPES};
