'use strict';
const {createClient}=require('@supabase/supabase-js');
const {weeklyProgress}=require('../lib/clan-weekly-progress');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
   return res.status(503).json({error:'History unavailable'});
 try{
  const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
   auth:{autoRefreshToken:false,persistSession:false}
  });
  const result=await weeklyProgress(db);
  return res.status(result.status).json(result.body);
 }catch(error){
  console.error('Clan improvement history read failed:',error.message);
  return res.status(503).json({error:'Saved clan progress temporarily unavailable'});
 }
};