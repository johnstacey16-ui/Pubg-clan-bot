'use strict';
const {createClient}=require('@supabase/supabase-js');
const {savedLeaderboard}=require('../lib/web-season-leaderboard');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const type=req.query?.type||'ranked',mode=req.query?.mode||'squad';
  if(typeof type!=='string'||typeof mode!=='string')
    return res.status(400).json({error:'Invalid leaderboard request'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({error:'Saved clan leaderboards unavailable'});
  try{
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
      auth:{autoRefreshToken:false,persistSession:false}
    });
    const result=await savedLeaderboard(db,{type,mode});
    return res.status(result.status).json(result.body);
  }catch(error){
    console.error('Historical season leaderboard read failed:',error.message);
    return res.status(503).json({error:'Saved clan season leaderboards temporarily unavailable'});
  }
};
