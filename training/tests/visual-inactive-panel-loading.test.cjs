'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('all inactive tool images are deferred in static HTML',()=>{
 const html=read('index.html'),media=[...html.matchAll(/<img\b[^>]*>/g)].map(x=>x[0]);
 const eager=media.filter(tag=>/\ssrc="assets\//.test(tag));
 assert.equal(eager.length,1,'Only initial active Scope preview may have static src');
 assert.match(eager[0],/id="visual-scope-image"/);
 const deferred=media.filter(tag=>/\bdata-visual-src="assets\//.test(tag));
 assert.ok(deferred.length>=10,'Image-heavy tools must not preload on landing');
 for(const tag of deferred)assert.doesNotMatch(tag,/\ssrc=/,'Deferred image must not also request the resource');
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
});
test('panel navigation and native expanders activate and defer image requests',()=>{
 const js=read('visual-controls.js');
 assert.match(js,/function syncPanelArtwork\(panel\)/);
 assert.match(js,/new MutationObserver\(\(\)=>syncPanelArtwork\(panel\)\)/);
 assert.match(js,/panel&&!panel\.classList\.contains\('active'\)/);
 assert.doesNotMatch(js,/details&&!details\.open/);
 assert.match(js,/if\(inactive\)/);
 assert.match(js,/assignOptionalArt\(image,'assets\/'\+file\)/);
 assert.match(js,/image\.removeAttribute\('data-visual-src'\)/);
});
