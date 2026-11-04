// True browser smoke with no npm dependencies. Run locally or on GitHub Actions.
// The browser serves actual committed HTML/JS through a temporary localhost server.
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {tmpdir}=require('node:os');
const {mkdtempSync,rmSync}=require('node:fs');
const root=path.resolve(__dirname,'..');
const candidates=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
const {spawnSync}=require('node:child_process');
function chromePath(){
  for(const candidate of candidates){
    if(candidate.includes('/')&&fs.existsSync(candidate))return candidate;
    if(!candidate.includes('/')){
      const r=spawnSync('which',[candidate],{encoding:'utf8'});
      if(r.status===0&&r.stdout.trim())return r.stdout.trim();
    }
  }
  throw Error('Chrome/Chromium is required to run the real-browser smoke checks.');
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.avif':'image/avif'};
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
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
  const dir=mkdtempSync(path.join(tmpdir(),'help-smoke-'));
  const url='http://127.0.0.1:'+server.address().port+'/tests/browser-smoke.html';
  const args=['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--no-first-run','--no-default-browser-check','--disable-background-networking',
    '--window-size=390,850','--virtual-time-budget=12000','--dump-dom',
    '--user-data-dir='+dir,url];
  let stdout='',stderr='',terminalDom=false,stoppedAfterResult=false,hardTimedOut=false;
  let grace;
  const child=spawn(binary,args,{stdio:['ignore','pipe','pipe']});
  const finalResult=()=>/\bdata-smoke-status="(?:pass|fail)"/.test(stdout)&&/<\/html>\s*$/.test(stdout);
  child.stdout.on('data',v=>{
    stdout+=v.toString();
    // Chromium may hang during teardown after --dump-dom has emitted the complete
    // document and the page has finished asynchronous image decoding. Stop it
    // only after observing a full terminal DOM, preserving the pass/fail result.
    if(!terminalDom && finalResult()){
      terminalDom=true;
      grace=setTimeout(()=>{
        if(child.exitCode===null && child.signalCode===null){
          stoppedAfterResult=true;
          child.kill('SIGTERM');
        }
      },1200);
    }
  });
  child.stderr.on('data',v=>stderr+=v.toString());
  const timeout=setTimeout(()=>{
    hardTimedOut=true;
    child.kill('SIGKILL');
  },40000);
  const code=await new Promise(resolve=>child.on('close',resolve));
  clearTimeout(timeout);
  if(grace)clearTimeout(grace);
  server.close();
  rmSync(dir,{recursive:true,force:true});
  const completedPass=terminalDom && /<body[^>]*data-smoke-status="pass"/.test(stdout) && /<\/html>\s*$/.test(stdout);
  const ok=completedPass && !hardTimedOut && (code===0 || stoppedAfterResult);
  if(!ok){
    const msg=stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
    console.error('Browser smoke failed:',msg?msg[1]:'No test result found');
    console.error('Chrome exit:',code,'complete DOM:',terminalDom,'hard timeout:',hardTimedOut,'Chrome stderr:',stderr.slice(-2500));
    process.exitCode=1;
  }else console.log('PASS: real Chrome exercised eight toolkit tools and all image assets'+(stoppedAfterResult?' (Chrome shut down after completed DOM).':'.'));
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
