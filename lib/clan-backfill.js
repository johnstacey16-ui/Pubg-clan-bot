'use strict';
// Persistent, service-role-only clan collection. All rate-limited PUBG calls
// share the atomic Supabase key budget; match details are individually cached.
const {playerEndpoint,matchEndpoint}=require('./pubg-endpoints');
const {getStats}=require('./live-stats');

const MAX_JOBS=6;
const MAX_MATCHES=5; // Per invocation, not a lifetime per-player ceiling.
const MAX_MATCH_REFERENCES=50;
const MATCH_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPES=Object.freeze({
  lifetime:null,profile:'',weapons:'weapon_mastery',survival:'survival_mastery'
});

async function read(query,label) {
  const result=await query;
  if(result.error)throw Error(label+' failed: '+result.error.message);
  return result.data;
}

// Ignore completions from timed-out workers that no longer own their lease.
// The SQL claim increments attempts on each lease, providing a fencing token.
async function finish(db,job,state,outcome,delaySeconds=0) {
  const now=Date.now();
  const saved=await read(db.from('pubg_backfill_jobs').update({
    state,last_outcome:outcome,
    next_attempt_at:new Date(now+delaySeconds*1000).toISOString(),
    ...(state==='done'||state==='unavailable'
      ? {completed_at:new Date(now).toISOString()}
      : {completed_at:null})
  }).eq('player_id',job.player_id).eq('scope',job.scope)
    .eq('attempts',job.attempts).eq('state','leased')
    .select('player_id'),'Save backfill progress');
  return Boolean(saved?.length);
}

// Collect every referenced recent match across successive runs, without
// fetching stored match details again just because the player index is fresh.
// Match objects represent completed games and are not rate-limited by PUBG.
async function collectMatchDetails(db,index,match) {
  const raw=index?.data?.relationships?.matches?.data;
  const ids=Array.isArray(raw)?[...new Set(raw.map(x=>x?.id)
    .filter(id=>typeof id==='string'&&MATCH_ID.test(id)))]
    .slice(0,MAX_MATCH_REFERENCES):[];
  if(!ids.length)return {referenced:0,attempted:0,saved:0,remaining:0,failed:0};
  const keys=ids.map(id=>'pubg:v1:console/matches/'+id);
  const saved=await read(db.from('pubg_endpoint_cache')
    .select('cache_key').in('cache_key',keys),'Read previously cached match details');
  const existing=new Set((saved||[]).map(x=>x.cache_key));
  const missing=ids.filter(id=>!existing.has('pubg:v1:console/matches/'+id));
  const next=missing.slice(0,MAX_MATCHES);
  const responses=await Promise.allSettled(next.map(id=>match(db,id)));
  const successes=responses.filter(r=>r.status==='fulfilled'&&Boolean(r.value?.data)).length;
  return {
    referenced:ids.length,attempted:next.length,saved:successes,
    remaining:missing.length-successes,
    failed:next.length-successes
  };
}

async function collectClanExtras(db,services={}) {
  const endpoint=services.playerEndpoint||playerEndpoint;
  const match=services.matchEndpoint||matchEndpoint;
  const lifetime=services.getStats||getStats;
  const batchSize=Math.min(MAX_JOBS,Math.max(1,Number(services.batchSize)||MAX_JOBS));
  const seeded=await read(db.rpc('seed_pubg_backfill_jobs'),'Seed matched clan tasks');
  const rows=await read(db.rpc('claim_pubg_backfill_jobs',{p_limit:batchSize}),
    'Claim next clan tasks');
  const jobs=Array.isArray(rows)?rows:[];
  const result={
    status:'no_work',seeded:Number(seeded)||0,claimed:jobs.length,
    saved:0,cached:0,staleFallbacks:0,unavailable:0,rateLimited:0,
    errors:0,freeMatchDetails:0,matchDetailsRemaining:0,matchDetailsAttempted:0
  };
  // Parallel function work is still bounded by the same atomic Supabase budget.
  await Promise.all(jobs.map(async job=>{
    if(!Object.hasOwn(SCOPES,job.scope)||
        !['xbox','psn'].includes(job.platform)||!job.pubg_account_id){
      result.unavailable++;
      await finish(db,job,'unavailable','invalid_identity');
      return;
    }
    try {
      let response;
      if(job.scope==='lifetime'){
        const current=await lifetime(db,job.gamertag,{
          platform:job.platform,refreshRequested:true,background:true
        });
        response=current?.state==='player'?
          {state:current.source==='live'?'fresh':
             current.source==='cache'?'cached':'stale',data:current.player}:
          {state:current?.state==='queued'?'rate_limited':
             current?.state||'unavailable'};
      }else{
        response=await endpoint(db,job,SCOPES[job.scope],6*3600,
          {background:true});
      }

      // Cached stale payloads are useful for display, but never proof that
      // this periodic refresh succeeded. Retry when capacity returns.
      if(response?.state==='stale'){
        result.staleFallbacks++;
        await finish(db,job,'pending','stale_retry',90);
        return;
      }
      if(response?.state==='rate_limited'){
        result.rateLimited++;
        await finish(db,job,'pending','budget_full',70);
        return;
      }
      if(response?.data){
        if(response.state==='fresh')result.saved++;
        else result.cached++;
        if(job.scope==='profile'){
          const details=await collectMatchDetails(db,response.data,match);
          result.freeMatchDetails+=details.saved;
          result.matchDetailsAttempted+=details.attempted;
          result.matchDetailsRemaining+=details.remaining;
          if(details.remaining){
            await finish(db,job,'pending',
              details.failed?'match_details_retry':'match_details_remaining',
              details.failed?300:25);
            return;
          }
        }
        await finish(db,job,'done',response.state||'saved');
        return;
      }

      // A temporary upstream outage is not a permanently missing resource.
      // Only repeated 404s are terminal; other failures use bounded backoff.
      const notFound=response?.state==='not_found';
      const final=notFound&&Number(job.attempts)>=3;
      result.unavailable++;
      const delay=Math.min(24*3600,300*Math.pow(3,
        Math.min(5,Math.max(0,Number(job.attempts)-1))));
      await finish(db,job,final?'unavailable':'pending',
        response?.state||'upstream_unavailable',final?0:delay);
    }catch(error){
      console.error('Saved PUBG backfill task failed:',job.scope,error.message);
      result.errors++;
      await finish(db,job,'pending','request_failed',
        300*Math.min(12,Math.max(1,Number(job.attempts)||1)));
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
module.exports={
  collectClanExtras,collectMatchDetails,finish,
  MAX_JOBS,MAX_MATCHES,MAX_MATCH_REFERENCES,SCOPES
};
