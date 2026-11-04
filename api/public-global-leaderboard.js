'use strict';
const {createClient}=require('@supabase/supabase-js');
const {officialLeaderboard}=require('../lib/web-global-leaderboard');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
  return res.status(503).json({error:'Shared leaderboard cache unavailable'});
 try{
  const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
   auth:{autoRefreshToken:false,persistSession:false}
  });
  const result=await officialLeaderboard(db,{
   platform:req.query?.platform||'xbox',region:req.query?.region||'eu',
   mode:req.query?.mode||'squad',season:req.query?.season||undefined
  });
  if(result.body?.retryAfterSeconds)
   res.setHeader('Retry-After',String(result.body.retryAfterSeconds));
  return res.status(result.status).json(result.body);
 }catch(error){
  console.error('Official global leaderboard failed:',error.message);
  return res.status(503).json({error:'Official regional leaderboard temporarily unavailable'});
 }
};
