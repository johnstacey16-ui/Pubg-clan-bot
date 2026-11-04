// Distinct 1x sight art and image recovery never affect calculator math.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('three original sight styles and standalone presentation buttons are registered',()=>{
 const html=read('index.html'),js=read('visual-controls.js'),manifest=JSON.parse(read('assets/visual-manifest.json'));
 for(const [type,name] of [['reddot','optic-red-dot.svg'],['holo','optic-holographic.svg'],['iron','optic-iron.svg']]){
  assert.match(html,new RegExp('data-visual-optic="'+type+'"'));
  assert.ok(js.includes(name),name);
  assert.ok(manifest.assets.some(x=>x.path==='assets/'+name),'missing manifest '+name);
  assert.ok(fs.existsSync(path.join(root,'assets',name)));
 }
 assert.match(html,/1x sight appearance only/);
 assert.match(js,/aria-pressed/);
 assert.doesNotThrow(()=>new vm.Script(js));
});
test('no attachment appearance selection changes the underlying control or formula',()=>{
 const visual=read('visual-controls.js');
 assert.match(visual,/reddot:'optic-red-dot\.svg'/);
 assert.match(visual,/holo:'optic-holographic\.svg'/);
 assert.match(visual,/image\.hidden=!file/);
 assert.doesNotMatch(visual,/pixelSpeed\s*=|matchedSens\s*=|pureTtk\s*=|finalDamageAt\s*=/);
 const core=read('src/calculators/40-attachments.part');
 assert.match(core,/function opticChoicesFor/);
});
test('generic visual error recovery is accessible, scoped and does not affect Model 2',()=>{
 const script=read('visual-controls.js'),html=read('index.html'),css=read('visual-assets.css');
 assert.match(script,/addEventListener\('error',event=>/);
 assert.match(script,/visual-image-unavailable/);
 assert.match(script,/addEventListener\('load',event=>/);
 assert.match(css,/\.visual-image-unavailable/);
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
 assert.match(html,/href="\/assets\/damage-training-mannequin\.svg"/);
});
