'use strict';
const { createClient } = require('@supabase/supabase-js');
const { cachedPlayerMatches } = require('../lib/web-match-intel');
const { publicTelemetry, publicRivalTrends } = require('../lib/web-telemetry');
const { publicClanMatchBoard } = require('../lib/web-clan-match-board');
const { publicClanMatchRecords } = require('../lib/web-clan-records');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const name=req.query?.name,route=req.query?.route;
  if(route!==undefined && !['telemetry','rivals','clan-board','clan-records'].includes(route))
    return res.status(400).json({error:'Unknown match route'});
  if(!['clan-board','clan-records'].includes(route) && (typeof name!=='string' || !name.trim() || name.length>100))
    return res.status(400).json({error:'Invalid PUBG gamertag'});
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({error:'Saved data source unavailable'});
  try{
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
      auth:{autoRefreshToken:false,persistSession:false}
    });
    const result=route==='clan-records'?await publicClanMatchRecords(db,req.query?.days):
      route==='clan-board'?await publicClanMatchBoard(db,req.query?.days):
      route==='telemetry'?await publicTelemetry(db,{name,match:req.query?.match}):
      route==='rivals'?await publicRivalTrends(db,{name}):
      await cachedPlayerMatches(db,name);
    if(route)res.setHeader('Cache-Control','private, no-store');
    if(result.body?.retryAfterSeconds)res.setHeader('Retry-After',String(result.body.retryAfterSeconds));
    return res.status(result.status).json(result.body);
  }catch(error){
    console.error('Cached web match lookup failed:',error.message);
    return res.status(503).json({error:'Cached match records temporarily unavailable'});
  }
};
