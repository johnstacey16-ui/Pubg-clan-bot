// Actual browser CSS geometry check for new media surfaces across viewport widths.
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {spawn,spawnSync}=require('node:child_process'),{mkdtempSync,rmSync}=require('node:fs'),{tmpdir}=require('node:os');
const root=path.resolve(__dirname,'..'),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'};
const binaries=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
let binary;
for(const candidate of binaries){
 if(candidate.includes('/') && fs.existsSync(candidate)){binary=candidate;break;}
 if(!candidate.includes('/')){
   const v=spawnSync('which',[candidate],{encoding:'utf8'});
   if(v.status===0 && v.stdout.trim()){binary=v.stdout.trim();break;}
 }
}
if(!binary)throw Error('Chrome is required for layout smoke');
const server=http.createServer((req,res)=>{
 let target;
 try{target=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+target);
 if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403).end();return;}
 fs.stat(file,(err,st)=>{
   if(err||!st.isFile()){res.writeHead(404).end();return;}
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
   fs.createReadStream(file).pipe(res);
 });
});
(async()=>{
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',err=>err?reject(err):resolve()));
 try{
  for(const width of [320,360,390,768,1280,1440]){
   const dir=mkdtempSync(path.join(tmpdir(),'visual-layout-'));
   try{
    const url='http://127.0.0.1:'+server.address().port+'/tests/visual-layout.html';
    const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
     '--no-first-run','--no-default-browser-check','--disable-background-networking',
     '--window-size='+width+',900','--virtual-time-budget=11000','--dump-dom','--user-data-dir='+dir,url];
    const child=spawn(binary,args,{stdio:['ignore','pipe','pipe']});
    let out='',err='';
    child.stdout.on('data',v=>out+=v.toString());
    child.stderr.on('data',v=>err+=v.toString());
    const timer=setTimeout(()=>child.kill('SIGKILL'),30000);
    const exit=await new Promise(resolve=>child.on('close',resolve));
    clearTimeout(timer);
    if(exit!==0||!/data-visual-layout-status="pass"/.test(out)){
       const txt=out.match(/<div id="result">([^<]+)<\/div>/);
       throw Error(width+'px layout failed: '+(txt?txt[1]:'no QA outcome')+' / Chrome '+exit+' '+err.slice(-380));
    }
    console.log('PASS: '+width+'px new media surfaces fit their seven tool layouts');
   }finally{rmSync(dir,{recursive:true,force:true});}
  }
 }finally{server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
