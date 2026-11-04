// Synthetic media and layout shift budget: does not claim field Web Vitals.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('all illustration media stays inside documented byte budget',()=>{
 const manifest=JSON.parse(read('assets/visual-manifest.json'));
 const totals=manifest.assets.reduce((acc,item)=>{
  const length=fs.statSync(path.join(root,item.path)).size;
  acc.total+=length;acc.max=Math.max(acc.max,length);acc.count++;
  return acc;
 },{total:0,max:0,count:0});
 assert.equal(totals.count,127);
 assert.ok(totals.total<=manifest.budget.maxTotalImageBytes);
 assert.ok(totals.total<=8*1024*1024,'Total artwork increased unexpectedly: '+totals.total+' bytes');
 const scope=fs.statSync(path.join(root,'assets/optic-red-dot.svg')).size;
 assert.ok(scope<=8*1024,'Initial scope art too large: '+scope);
});
test('landing media has explicit dimensions and low image fetch priority',()=>{
 const html=read('index.html');
 const scope=html.match(/<img id="visual-scope-image"[^>]+>/);
 assert.ok(scope,'Landing illustration missing');
 assert.match(scope[0],/loading="eager"/);
 assert.match(scope[0],/fetchpriority="low"/);
 assert.match(scope[0],/decoding="async"/);
 assert.match(scope[0],/width="320" height="200"/);
 assert.match(read('visual-controls.js'),/if\(img\.getAttribute\('src'\)!==source\)img\.src=source/);
});
test('Chrome checks initial artwork requests and preview stability before other tools open',()=>{
 const smoke=read('tests/browser-smoke.html');
 assert.match(smoke,/initialMediaEntries\.length<=8/);
 assert.match(smoke,/initialMediaBytes<=65536/);
 assert.match(smoke,/previewInitialHeight-preview8xHeight/);
 assert.match(smoke,/Only the 1x reference art is active/);
});
