// Generate review-ready Chromium viewport screenshots for draft PR visual QA.
// Static local assets only; no external browser automation dependencies.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'artifacts','visual-review');
const panels=[
 ['scope','panel-sensitivity'],['combat','panel-combat'],
 ['hit-zone','panel-hit-zone'],['range','panel-range'],
 ['ttk','panel-ttk'],['recoil','panel-recoil2'],
 ['attachments','panel-attach'],['backpack','panel-backpack']
];
const viewports=[
 {label:'phone',width:390,height:900},
 {label:'desktop',width:1280,height:900}
];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp',
 '.json':'application/json','.png':'image/png','.avif':'image/avif'};
function chromePath(){
 const candidates=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
 for(const candidate of candidates){
  if(candidate.includes('/')&&fs.existsSync(candidate))return candidate;
  if(!candidate.includes('/')){
   const result=spawnSync('which',[candidate],{encoding:'utf8'});
   if(result.status===0&&result.stdout.trim())return result.stdout.trim();
  }
 }
 throw Error('Chrome/Chromium needed for visual review capture.');
}
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
 catch{res.writeHead(400).end();return;}
 const target=path.resolve(root,'.'+pathname);
 if(!(target===root||target.startsWith(root+path.sep))){res.writeHead(403).end();return;}
 fs.stat(target,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream',
   'Cache-Control':'no-store'});
  fs.createReadStream(target).pipe(res);
 });
});
async function capture(binary,base,viewport,panel){
 const filename=viewport.label+'-'+panel[0]+'.png';
 const file=path.join(output,filename);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'help-review-chrome-'));
 const url=panel[2]?base+panel[2]:base+'/index.html#'+panel[1];
 const args=[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-first-run','--no-default-browser-check','--disable-background-networking',
  '--hide-scrollbars','--force-device-scale-factor=1',
  '--window-size='+viewport.width+','+viewport.height,
  '--virtual-time-budget=6000','--screenshot='+file,
  '--user-data-dir='+profile,url
 ];
 let outputError='';
 try{
  const child=spawn(binary,args,{stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',v=>{outputError+=v.toString();if(outputError.length>12000)outputError=outputError.slice(-12000);});
  let expired=false;
  const timeout=setTimeout(()=>{expired=true;child.kill('SIGKILL');},30000);
  const exit=await new Promise((resolve,reject)=>{
   child.once('error',reject);
   child.once('close',resolve);
  }).finally(()=>clearTimeout(timeout));
  if(expired||exit!==0||!fs.existsSync(file))
   throw Error(filename+' screenshot failed; exit '+exit+', timed out '+expired+': '+outputError.slice(-1000));
  const bytes=fs.readFileSync(file);
  if(bytes.length<3000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
   throw Error(filename+' is missing or not a useful PNG');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(width<viewport.width||height<viewport.height)
   throw Error(filename+' captured an unexpectedly small screenshot '+width+'x'+height);
  console.log('CAPTURE '+filename+' '+width+'x'+height+' '+bytes.length+' bytes');
  return {filename,tool:panel[0],panelId:panel[1],
   requestedViewport:viewport.width+'x'+viewport.height,
   actualScreenshot:width+'x'+height,bytes:bytes.length};
 }finally{fs.rmSync(profile,{recursive:true,force:true});}
}
(async()=>{
 fs.rmSync(output,{recursive:true,force:true});
 fs.mkdirSync(output,{recursive:true});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 try{
  const binary=chromePath();
  const base='http://127.0.0.1:'+server.address().port;
  const captured=[];
  for(const viewport of viewports){
   for(const panel of panels)captured.push(await capture(binary,base,viewport,panel));
  }
  const damageGuide=[];
  for(const viewport of viewports)for(const section of ['dg_calculation','dg_hit_area','dg_weapon_class','dg_combined'])
   damageGuide.push(await capture(binary,base,{...viewport,height:1600},['damage-'+section,null,'/tests/damage-guide-preview.html?section='+section]));
  const report={
   kind:'HELP Clan visual upgrade screenshot evidence',
   guidance:'Automated first-viewport captures, not proof of Xbox Edge behaviour, full-page layout, contrast or owner approval.',
   source:'PR #41 / feature/toolkit-visual-upgrade; matching run commit is shown on GitHub Actions.',
   damageGuide,
   captures:captured
  };
  fs.writeFileSync(path.join(output,'capture-manifest.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(output,'README.txt'),
   'HELP CLAN VISUAL REVIEW: 16 automated Chromium screenshots\n'+
   'phone-*.png: requested 390x900 viewport; desktop-*.png: requested 1280x900 viewport.\n'+
   'Check actualScreenshot in capture-manifest.json for recorded PNG dimensions.\n'+
   'These capture the first screen of each panel, not a complete full-page scroll or Xbox device render.\n'+
   'For selected weapon modal and expanded optional art, open the same PR preview manually.\n'+
   'Do not sign off or merge until owner reviews real mobile/Xbox Edge behaviour.\n');
  if(captured.length!==16)throw Error('Missing expected visual review screenshots');
  console.log('PASS: '+captured.length+' screenshot files prepared for owner visual review');
 }finally{server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
