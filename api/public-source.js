'use strict';
const {createClient}=require('@supabase/supabase-js');
const {publicSource}=require('../lib/web-source');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
  return res.status(503).json({error:'Saved source unavailable'});
 const args={name:req.query?.name,platform:req.query?.platform||'auto',
  kind:req.query?.kind||'profile',match:req.query?.match};
 try{
  const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
   auth:{autoRefreshToken:false,persistSession:false}
  });
  const result=await publicSource(db,args);
  return res.status(result.status).json(result.body);
 }catch(error){
  console.error('Public PUBG source explorer failed:',error.message);
  return res.status(503).json({error:'Saved source lookup temporarily unavailable'});
 }
};
