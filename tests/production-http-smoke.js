'use strict';
// Independent public production static-asset check from GitHub Actions.
// GET only. Never reads credentials, user accounts or PUBG/Supabase endpoints.
const assert=require('node:assert/strict');
const host='https://pubg-help-clan.vercel.app';
const assets=[
 {path:'/',name:'HELP Clan home',content:'HELP Clan — PUBG Field Toolkit',mime:'text/html'},
 {path:'/dashboard/',name:'Embedded clan dashboard',content:'id="panel-clan"',mime:'text/html'},
 {path:'/training/',name:'HELP training homepage',content:'HELP Clan — PUBG Field Toolkit',mime:'text/html'},
 {path:'/training/clan-dashboard-scoped.css',name:'scoped dashboard presentation',
  content:'#panel-clan .hero',mime:'text/css'},
 {path:'/training/clan-dashboard-shell.css',name:'shared toolkit shell theme',
  content:'clan-section-tabs',mime:'text/css'},
 {path:'/training/js/clan-dashboard-loader.js',name:'lazy clan API tool loader',
  content:'help:panel-changed',mime:'javascript'},
 {path:'/training/legacy-dashboard-hashes.js',name:'legacy player-link compatibility',
  content:"window.location.replace('/dashboard/'",mime:'javascript'},
 {path:'/training/assets/damage-training-mannequin.svg',name:'13-region neutral SVG mannequin',
  content:'<svg',mime:'image/svg+xml'},
 {path:'/training/js/sensitivity.js',name:'original sensitivity calculations',
  minBytes:300,mime:'javascript'},
 {path:'/training/js/toolkit-calculators.js',name:'original calculator bundle',
  minBytes:1000,mime:'javascript'}
];
async function check(asset){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const res=await fetch(host+asset.path,{
   signal:controller.signal,
   headers:{Accept:'*/*','Cache-Control':'no-cache'},
   redirect:'follow'
  });
  assert.equal(res.status,200,asset.name+' unexpected HTTP '+res.status);
  const type=res.headers.get('content-type')||'';
  assert.ok(type.toLowerCase().includes(asset.mime),
   asset.name+' incorrect MIME type: '+type);
  const body=await res.text();
  if(asset.content)assert.ok(body.includes(asset.content),
   asset.name+' missing expected content');
  if(asset.minBytes)assert.ok(body.length>=asset.minBytes,
   asset.name+' unexpectedly short response: '+body.length);
  if(['/', '/dashboard/','/training/'].includes(asset.path)){
    assert.match(body,/id="app-shell"/,'All entry routes must use the toolkit shell');
    assert.match(body,/id="panel-clan"/,'All entry routes must contain the dashboard');
    assert.match(body,/Back to Toolkit/,'Dashboard must include Back to Toolkit');
    assert.match(body,/clan-dashboard-scoped\.css/,'Dashboard must load isolated styling');
    assert.match(body,/data-open-panel="panel-clan"/,'Clan must be first inside toolkit navigation');
    assert.match(body,/href="\/training\/assets\/damage-training-mannequin.svg"/,
      'The original trainer artwork must remain available');
  }
  console.log('PRODUCTION STATIC PASS',res.status,asset.name,asset.path,body.length+' bytes');
 }finally{clearTimeout(timer);}
}
async function main(){
 // A deployment may finish shortly after the main commit. Retry transient failures,
 // but never claim acceptance if a path remains missing or access is protected.
 for(const asset of assets){
  let error;
  for(let attempt=0;attempt<3;attempt++){
   try{await check(asset);error=null;break;}
   catch(e){
    error=e;
    console.warn('Attempt '+(attempt+1)+' for '+asset.path+': '+e.message);
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,4000));
   }
  }
  if(error)throw error;
 }
 console.log('PRODUCTION STATIC ACCEPTANCE PASS: all ten public resources verified.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
