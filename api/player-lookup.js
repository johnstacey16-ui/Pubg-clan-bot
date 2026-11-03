'use strict';
const {createClient}=require('@supabase/supabase-js');
const {getStats}=require('../lib/live-stats');
const {publicPlayer,validInput,REFRESH_FRESH_MS}=require('../lib/web-player');
const sameOrigin=req=>{
 const host=String(req.headers?.host||'').toLowerCase();
 const origin=String(req.headers?.origin||'').toLowerCase();
 return /^pubg-clan-bot(?:-[a-z0-9-]+)?\.vercel\.app$/.test(host) &&
   origin==='https://'+host;
};
async function processLookup(db,{name,platform,refresh=false}){
 if(!validInput(name,platform))
   return{status:400,body:{error:'Choose a valid gamertag and console'}};
 const saved=await publicPlayer(db,name,platform);
 if(saved.status!==200||!refresh)return saved;
 const stamp=saved.body.player?.updatedAt;
 if(stamp && Number.isFinite(Date.parse(stamp))&&
   Date.now()-Date.parse(stamp)<REFRESH_FRESH_MS)
   return{status:200,body:{...saved.body,refreshState:'recent',
     note:'These PUBG statistics were updated within the last 15 minutes.'}};
 const slot=await db.rpc('reserve_web_refresh',{p_player_key:platform+':'+name.toLowerCase()});
 if(slot.error)throw new Error('Web refresh budget unavailable');
 if(!slot.data)return{status:429,body:{error:'Website PUBG refresh capacity is cooling down. Saved statistics remain available.',retryAfterSeconds:90}};
 const result=await getStats(db,name,{platform,refreshRequested:true});
 if(result.state==='platform_conflict')
   return{status:409,body:{error:result.message}};
 if(result.state==='invalid')return{status:400,body:{error:result.message}};
 if(result.state==='queued')return{status:429,body:{error:'PUBG API budget is busy. Please try again later.',retryAfterSeconds:90}};
 if(result.state==='not_found')return{status:404,body:{error:'No matching PUBG account on this console.'}};
 if(result.state==='unavailable')return{status:503,body:{error:'PUBG data is temporarily unavailable.'}};
 const updated=await publicPlayer(db,name,platform);
 if(updated.status!==200)return updated;
 return{status:200,body:{...updated.body,
   refreshState:result.source==='live'?'refreshed':result.source||result.state,
   note:result.source==='live'?'Updated from PUBG and saved to Supabase.':
     result.message||'Showing the latest saved PUBG statistics.'}};
}
module.exports=async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))
   return res.status(405).json({error:'Method not allowed'});
 if(req.method==='POST'&&!sameOrigin(req))
   return res.status(403).json({error:'Website refresh requests must come from the same origin'});
 if(req.method==='POST'&&Number(req.headers['content-length']||0)>4096)
   return res.status(413).json({error:'Request too large'});
 let body=req.method==='GET'?req.query:req.body;
 if(req.method==='POST'&&typeof body==='string'){
   try{body=JSON.parse(body)}catch(e){return res.status(400).json({error:'Invalid JSON'})}
 }
 if(!body||typeof body!=='object'||!validInput(body.name,body.platform))
   return res.status(400).json({error:'Choose a valid player name and console'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
   return res.status(503).json({error:'Data source is not configured'});
 try{
   const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
     auth:{autoRefreshToken:false,persistSession:false}
   });
   const out=await processLookup(db,{name:body.name,platform:body.platform,refresh:req.method==='POST'});
   if(out.status===429)res.setHeader('Retry-After','90');
   return res.status(out.status).json(out.body);
 }catch(error){
   console.error('Web player lookup failed:',error.message);
   return res.status(503).json({error:'PUBG lookup temporarily unavailable'});
 }
};
module.exports.processLookup=processLookup;
module.exports.sameOrigin=sameOrigin;
