'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('all sensitivity sections are visible and reachable with native jump links',()=>{
 const html=read('index.html'),src=read('js/sensitivity.js');
 assert.match(html,/<nav class="tabs quicknav" id="tabs" aria-label="Sensitivity sections"><\/nav>/);
 assert.match(src,/document\.createElement\('a'\)/);
 assert.match(src,/panel\.classList\.add\('active'\)/);
 assert.doesNotMatch(src,/setAttribute\('role','tab'\)|aria-hidden|switchTab/);
 assert.match(src,/link\.href='#'\+panel\.id/);
 assert.doesNotThrow(()=>new vm.Script(src));
});
test('sensitivity formulas retain their original forward and inverse functions',()=>{
 const src=read('js/sensitivity.js');
 assert.match(src,/function pixelSpeed\(C, A, B\)/);
 assert.match(src,/function matchedSens\(speed, A, B\)/);
 assert.match(read('unified-workspace.css'),/#tabs a:focus-visible/);
});
test('all static inline images reserve dimensions, supply alt and explicit loading intent',()=>{
 const html=read('index.html'),images=[...html.matchAll(/<img\b[^>]*>/g)].map(x=>x[0]);
 assert.ok(images.length>=20,'Expected visible artwork and optional images');
 let eager=0;
 for(const tag of images){
   assert.match(tag,/\bwidth="\d+"/,'Missing width on '+tag);
   assert.match(tag,/\bheight="\d+"/,'Missing height on '+tag);
   assert.match(tag,/\balt="[^"]*"/,'Missing alt text on '+tag);
   assert.match(tag,/\bloading="(?:eager|lazy)"/,'Missing loading intent on '+tag);
   if(/\bloading="eager"/.test(tag))eager++;
   if(/data-visual-src=/.test(tag)){
     assert.doesNotMatch(tag,/\ssrc=/,'Deferred image unexpectedly requests art');
   }
 }
 assert.ok(eager<=1,'Optional images must not be eager');
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
});
