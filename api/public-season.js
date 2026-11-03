'use strict';
const {createClient}=require('@supabase/supabase-js');
const {savedSeason}=require('../lib/web-season');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const name=req.query?.name,platform=req.query?.platform||'auto',type=req.query?.type||'season';
  if(typeof name!=='string'||!name.trim()||name.length>100||
    !['auto','xbox','psn'].includes(platform)||!['season','ranked'].includes(type))
    return res.status(400).json({error:'Invalid season request'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({error:'Saved stats unavailable'});
  try{
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
      auth:{autoRefreshToken:false,persistSession:false}
    });
    const result=await savedSeason(db,{name,platform,type});
    return res.status(result.status).json(result.body);
  }catch(error){
    console.error('Public season lookup failed:',error.message);
    return res.status(503).json({error:'Saved PUBG season stats temporarily unavailable'});
  }
};
