'use strict';
// Run from GitHub Actions with a repository secret matching Vercel CRON_SECRET.
// Each invocation is short; no attempt to bypass Vercel Hobby's scheduled cron.
const URL='https://pubg-help-clan.vercel.app/api/sync?mode=backfill';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const secret=process.env.PUBG_SYNC_CRON_SECRET;
 if(!secret)throw Error('Add PUBG_SYNC_CRON_SECRET to GitHub Actions repository secrets (same value as Vercel CRON_SECRET).');
 const cycles=Math.min(25,Math.max(1,Number(process.env.PUBG_BACKFILL_CYCLES)||20));
 for(let i=0;i<cycles;i++){
   const response=await fetch(URL,{
     method:'GET',headers:{Authorization:'Bearer '+secret,Accept:'application/json','Cache-Control':'no-store'},
     redirect:'error',signal:AbortSignal.timeout(45000)
   });
   if(!response.ok)throw Error('Authenticated backfill endpoint returned HTTP '+response.status+
      '; make sure the updated GitHub commit is deployed before running this job.');
   const result=await response.json();
   const progress=result.extras||{},season=result.seasonCollection||{};
   console.log(JSON.stringify({cycle:i+1,import:result.status,identified:result.identified,
     matched:result.matched,backfillDone:progress.done,backfillTotal:progress.total,
     backfillPending:progress.pending,backfillUnavailable:progress.unavailableTotal,
     seasonAttempted:season.playersAttempted,seasonSaved:season.seasonSaved,
     rankedSaved:season.rankedSaved,rateLimited:season.rateLimited||progress.rateLimited}));
   if(result.status==='no_work'&&
      progress.status==='no_work'&&
      !progress.pending&&!season.playersAttempted) {
     console.log('No due backfill jobs. Waiting for future scheduled maintenance or player searches.');
     break;
   }
   if(i+1<cycles)await sleep(66000); // Rate limiter itself is atomic at 10/65 sec.
 }
}
if(require.main===module)main().catch(error=>{
 console.error('Backfill stopped:',error.message);process.exitCode=1;
});
module.exports={main};
