'use strict';
const {createClient}=require('@supabase/supabase-js');
const {sameOrigin}=require('./player-lookup');
const {refreshScopedData,validRefresh}=require('../lib/web-refresh');
module.exports=async (req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Use POST to request a PUBG refresh'});
  if(!sameOrigin(req))return res.status(403).json({error:'Website refresh requests must come from the same origin'});
  if(Number(req.headers?.['content-length']||0)>4096)
    return res.status(413).json({error:'Request too large'});
  let body=req.body;
  if(typeof body==='string'){
    try{body=JSON.parse(body)}catch(error){return res.status(400).json({error:'Invalid JSON body'})}
  }
  if(!validRefresh(body))return res.status(400).json({error:'Invalid gamertag, console or refresh type'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({error:'PUBG cache unavailable'});
  try {
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
      auth:{autoRefreshToken:false,persistSession:false}
    });
    const result=await refreshScopedData(db,body);
    if(result.status===429)res.setHeader('Retry-After','90');
    return res.status(result.status).json(result.body);
  }catch(error){
    console.error('Scoped website PUBG refresh failed:',error.message);
    return res.status(503).json({error:'PUBG refresh temporarily unavailable'});
  }
};
