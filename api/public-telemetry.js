'use strict';
const {createClient}=require('@supabase/supabase-js');
const {publicTelemetry}=require('../lib/web-telemetry');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
  return res.status(503).json({error:'Saved PUBG database unavailable'});
 try{
  const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
   auth:{autoRefreshToken:false,persistSession:false}
  });
  const result=await publicTelemetry(db,{name:req.query?.name,match:req.query?.match});
  if(result.body?.retryAfterSeconds)
   res.setHeader('Retry-After',String(result.body.retryAfterSeconds));
  return res.status(result.status).json(result.body);
 }catch(error){
  console.error('Public telemetry endpoint failed:',error.message);
  return res.status(503).json({error:'Trusted telemetry unavailable'});
 }
};
