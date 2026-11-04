'use strict';
// Real Chrome for the vendored static training app at its final /training/ URL.
// Uses local files only; does not contact Vercel, PUBG, Supabase or Discord.
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs/promises');
const {chromium}=require('playwright-core');
const ROOT=path.resolve(__dirname,'..');
const TYPES={
 '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.webp':'image/webp','.json':'application/json',
 '.avif':'image/avif'
};
const panels=['panel-sensitivity','panel-combat','panel-hit-zone',
 'panel-recoil2','panel-attach','panel-backpack'];
function respond(res,code,content,type){
 res.writeHead(code,{'Content-Type':type||'text/plain','Cache-Control':'no-store'});
 res.end(content);
}
const server=http.createServer(async(req,res)=>{
 let p;
 try{p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}
 catch{return respond(res,400,'Bad URI');}
 if(p==='/training')return respond(res,308,'',undefined);
 if(p==='/training/')p='/training/index.html';
 if(p==='/')p='/index.html';
 if(p==='/favicon.ico')return respond(res,204,'');
 if(p==='/ _vercel/insights/script.js'.replace(' ',''))return respond(res,200,'','text/javascript');
 const full=path.resolve(ROOT,'.'+p);
 if(!(full===ROOT||full.startsWith(ROOT+path.sep)))
  return respond(res,403,'Forbidden');
 try{
  const bytes=await fs.readFile(full);
  respond(res,200,bytes,TYPES[path.extname(full)]||'application/octet-stream');
 }catch{return respond(res,404,'Missing file: '+p);}
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true,
   args:['--no-sandbox','--disable-dev-shm-usage']});
  const base='http://127.0.0.1:'+server.address().port;
  for(const width of [1280,390]){
   const errors=[],notFound=[];
   const page=await browser.newPage({viewport:{width,height:850}});
   await page.route('https://fonts.googleapis.com/**',route=>
    route.fulfill({status:200,contentType:'text/css',body:''}));
   await page.route('https://fonts.gstatic.com/**',route=>
    route.fulfill({status:200,contentType:'application/octet-stream',body:''}));
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{
    if(response.url().startsWith(base+'/training/')&&response.status()>=400)
     notFound.push(response.status()+' '+response.url());
   });
   const entry=await page.goto(base+'/training/',{waitUntil:'domcontentloaded'});
   assert.equal(entry.status(),200);
   await page.waitForSelector('.command-centre-bridge a[href="/"]');
   assert.match(await page.title(),/HELP/);
   assert.equal(await page.locator('#app-toolnav [data-open-panel]').count(),6);
   assert.match(await page.locator('.command-centre-bridge').innerText(),
    /PUBG COMMAND CENTRE/);
   for(const id of panels){
    await page.evaluate(panel=>{
     const btn=document.querySelector('#app-toolnav [data-open-panel="'+panel+'"]');
     if(!btn)throw Error('Missing toolkit navigation '+panel);
     btn.click();
    },id);
    assert.ok(await page.locator('#'+id).evaluate(el=>el.classList.contains('active')),
     'Navigation failed for '+id+' at '+width);
   }
   const image=await page.request.get(base+'/training/assets/damage-training-mannequin.svg');
   assert.equal(image.status(),200);
   assert.match(await image.text(),/<svg/);
   const script=await page.request.get(base+'/training/js/sensitivity.js');
   assert.equal(script.status(),200);
   const stylesheet=await page.request.get(base+'/training/command-centre-bridge.css');
   assert.equal(stylesheet.status(),200);
   const mainLink=await page.locator('.command-centre-bridge a[href="/"]').getAttribute('href');
   assert.equal(mainLink,'/');
   assert.deepEqual(notFound,[],'Unresolved training assets at '+width+'px');
   assert.deepEqual(errors,[],'JavaScript errors at '+width+'px');
   console.log('MERGED HELP CHROME PASS: '+width+'px; 6 tool workspaces, static assets, cross-navigation');
   await page.close();
  }
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
