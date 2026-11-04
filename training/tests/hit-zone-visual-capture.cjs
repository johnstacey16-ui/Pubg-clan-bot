// Temporary developer-only screen capture for visual inspection of the real
// integrated hit-zone panel. Not part of the deployed app. Captures the mobile
// viewport using locally served committed HTML/JS/CSS in headless Chromium.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const target=path.resolve(root,'.'+pathname);
 if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(target,(err,stats)=>{
  if(err||!stats.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});
  fs.createReadStream(target).pipe(res);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'help-zone-capture-'));
 try{
  const candidates=[process.env.CHROME_BIN,'google-chrome','chromium','google-chrome-stable'].filter(Boolean);
  const binary=candidates.find(candidate=>spawnSync('which',[candidate],{encoding:'utf8'}).status===0);
  if(!binary)throw Error('Headless Chrome not found');
  const desktop=process.argv.includes('--desktop');
  const png=path.join(dir,desktop?'hit-zone-desktop.png':'hit-zone-mobile.png');
  const url='http://127.0.0.1:'+server.address().port+'/index.html#panel-hit-zone';
  const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--no-first-run','--no-default-browser-check','--hide-scrollbars',
    '--window-size='+(desktop?'1440,1100':'390,1600'),'--force-device-scale-factor=1',
    '--virtual-time-budget=4500','--screenshot='+png,'--user-data-dir='+path.join(dir,'profile'),url];
  const child=spawn(binary,args,{stdio:['ignore','pipe','pipe']});
  let errText='';
  child.stderr.on('data',chunk=>errText+=String(chunk));
  // Drain stdout to avoid a blocked child pipe.
  child.stdout.resume();
  const kill=setTimeout(()=>child.kill('SIGKILL'),28000);
  const exit=await new Promise(resolve=>child.on('close',resolve));
  clearTimeout(kill);
  if(exit!==0||!fs.existsSync(png))throw Error('Chrome screenshot failed: '+exit+' '+errText.slice(-700));
  const image=fs.readFileSync(png);
  const sig=image.subarray(0,8).toString('hex');
  if(sig!=='89504e470d0a1a0a')throw Error('Invalid PNG screenshot');
  console.log('HZ_VISUAL_CAPTURE_BEGIN width='+image.readUInt32BE(16)+' height='+image.readUInt32BE(20)+' bytes='+image.length);
  const b64=image.toString('base64');
  for(let i=0;i<b64.length;i+=7000)console.log('HZ_IMAGE_CHUNK:'+b64.slice(i,i+7000));
  console.log('HZ_VISUAL_CAPTURE_END');
 }finally{fs.rmSync(dir,{recursive:true,force:true});server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;server.close();});
