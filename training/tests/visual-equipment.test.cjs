// Illustrative equipment coverage without touching gameplay calculations.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),js=read('visual-controls.js');
test('three backpack levels and jammer have distinct display mapping',()=>{
 assert.match(js,/gear-backpack-l1\.svg/);
 assert.match(js,/gear-backpack-l2\.svg/);
 assert.match(js,/gear-backpack\.svg/);
 assert.match(js,/gear-jammer\.svg/);
 assert.match(js,/bp_vest/);
 assert.match(js,/visual-pack-vest-label/);
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(html.includes('id="visual-pack-note"'));
});
test('six illustrated categories and combat armour key are accessible',()=>{
 assert.match(html,/class="visual-armour-key"/);
 assert.match(html,/id="visual-pack-vest-label"/);
 const a=html.match(/<div class="visual-pack-items">([\s\S]*?)<\/div>/);
 assert.ok(a,'pack category container');
 assert.equal((a[1].match(/<img /g)||[]).length,6);
 const names=['gear-booster.svg','gear-helmet.svg','gear-vest.svg','gear-backpack-l1.svg','gear-backpack-l2.svg'];
 const manifest=JSON.parse(read('assets/visual-manifest.json'));
 for(const name of names){
  assert.ok(manifest.assets.some(x=>x.path==='assets/'+name),'missing manifest entry '+name);
  assert.ok(fs.existsSync(path.join(root,'assets',name)));
 }
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
});
test('equipment visual stylesheet is independent of calculator code',()=>{
 const css=read('visual-assets.css');
 assert.match(css,/#panel-backpack \.visual-pack-items/);
 assert.match(css,/#panel-combat \.visual-armour-key/);
 assert.doesNotMatch(js,/\b(?:pixelSpeed|matchedSens|pureTtk|calcBackpack)\s*=|\b(?:HELM|VEST)\s*=/);
});
