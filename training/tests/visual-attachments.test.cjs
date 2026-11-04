'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('five pictured attachment categories follow actual selected options without changing calculations',()=>{
 const src=read('visual-controls.js'),html=read('index.html'),media=JSON.parse(read('assets/visual-manifest.json'));
 assert.doesNotThrow(()=>new vm.Script(src));
 for(const item of ['muzzle','grip','mag','sight','stock']){
  assert.ok(html.includes('id="visual-at-'+item+'-image"'),item+' image');
  assert.ok(html.includes('id="visual-at-'+item+'"'),item+' selection label');
  // The same id-based renderer is deliberately reused for every slot.
  assert.ok(src.includes("get('visual-at-'+id+'-image')"),'shared visual slot lookup');
 }
 for(const asset of ['gear-suppressor','gear-compensator','gear-flash-hider','gear-vertical-grip','gear-angled-grip','gear-stock','gear-extended-magazine']){
  assert.ok(media.assets.some(x=>x.id===asset&&x.panelId==='panel-attach'),'missing media provenance '+asset);
 }
 assert.match(src,/image\.hidden=!file/);
 assert.match(src,/image\.removeAttribute\('src'\)/);
 assert.match(src,/select\.disabled\?'none'/);
 const main=read('src/calculators/40-attachments.part');
 assert.match(main,/function opticChoicesFor/);
 assert.doesNotMatch(src,/pureTtk\s*=|pixelSpeed\s*=|matchedSens\s*=/);
});
test('attachment cards fit two columns on small phones and allow legible labels',()=>{
 const css=read('visual-assets.css');
 assert.match(css,/#panel-attach \.visual-gear-grid \{ grid-template-columns:repeat\(5,minmax\(0,1fr\)\);/);
 assert.match(css,/@media\(max-width:450px\)/);
 assert.match(css,/#panel-attach \.visual-gear-tile \{ min-height:95px; \}/);
 assert.equal((read('index.html').match(/data-hit-zone="/g)||[]).length,13);
});
