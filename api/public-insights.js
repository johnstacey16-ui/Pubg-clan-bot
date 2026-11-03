'use strict';
const {createClient}=require('@supabase/supabase-js');
const {publicInsights}=require('../lib/web-insights');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const name=req.query?.name,kind=req.query?.kind;
  if(typeof name!=='string'||!name.trim()||name.length>100 ||
    typeof kind!=='string'||!['weapons','teammates'].includes(kind))
    return res.status(400).json({error:'Invalid insight request'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({error:'Saved data source unavailable'});
  try {
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
      auth:{autoRefreshToken:false,persistSession:false}
    });
    const result=await publicInsights(db,{name,kind});
    return res.status(result.status).json(result.body);
  } catch(error) {
    console.error('Public console insights failed:',error.message);
    return res.status(503).json({error:'Saved console insights temporarily unavailable'});
  }
};
