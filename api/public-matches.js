'use strict';
const { createClient } = require('@supabase/supabase-js');
const { cachedPlayerMatches } = require('../lib/web-match-intel');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const name=req.query?.name;
  if(typeof name!=='string' || !name.trim() || name.length>100)
    return res.status(400).json({error:'Invalid PUBG gamertag'});
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({error:'Saved data source unavailable'});
  try{
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
      auth:{autoRefreshToken:false,persistSession:false}
    });
    const result=await cachedPlayerMatches(db,name);
    return res.status(result.status).json(result.body);
  }catch(error){
    console.error('Cached web match lookup failed:',error.message);
    return res.status(503).json({error:'Cached match records temporarily unavailable'});
  }
};
