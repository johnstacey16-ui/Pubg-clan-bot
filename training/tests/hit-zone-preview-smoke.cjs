// Standalone Chromium rendering smoke for the development-only hit-zone SVG.
// Tests real CSS+HTML at phone AND desktop widths without publishing the eighth tab.
'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const binaries=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
function chromePath(){
 for(const bin of binaries){
  if(bin.includes('/')&&fs.existsSync(bin))return bin;
  if(!bin.includes('/')){
   const r=spawnSync('which',[bin],{encoding:'utf8'});
   if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
 }
 throw Error('Chrome/Chromium is required for the isolated SVG rendering smoke.');
}
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const full=path.resolve(root,'.'+pathname);
 if(!(full===root||full.startsWith(root+path.sep))){res.writeHead(403).end();return;}
 fs.stat(full,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(full).pipe(res);
 });
});
(async()=>{
 const binary=chromePath();
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',err=>err?reject(err):resolve()));
 try{
  for(const width of [320,360,390,768,1280]){
   const dir=mkdtempSync(path.join(tmpdir(),'hz-viewer-'));
   try{
    const url='http://127.0.0.1:'+server.address().port+'/tests/hit-zone-preview.html';
    const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--no-first-run','--no-default-browser-check','--disable-background-networking',
      '--window-size='+width+',900','--virtual-time-budget=9000','--dump-dom',
      '--user-data-dir='+dir,url];
    const child=spawn(binary,args,{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',v=>stdout+=String(v));
    child.stderr.on('data',v=>stderr+=String(v));
    const timeout=setTimeout(()=>child.kill('SIGKILL'),30000);
    const code=await new Promise(resolve=>child.on('close',resolve));
    clearTimeout(timeout);
    if(code!==0||!/data-preview-status="pass"/.test(stdout)){
      const message=stdout.match(/<div id="result"[^>]*>([^<]+)<\/div>/);
      throw Error(width+'px figure QA failed: '+(message?message[1]:'No result')+'; exit '+code+' '+stderr.slice(-400));
    }
    console.log('PASS: '+width+'px front-view all-zones SVG layout');
   }finally{rmSync(dir,{recursive:true,force:true});}
  }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});