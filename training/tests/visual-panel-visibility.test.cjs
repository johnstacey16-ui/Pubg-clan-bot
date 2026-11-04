'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('all active tool panels show immediately at full opacity',()=>{
 const css=read('design-refresh.css'),smoke=read('tests/browser-smoke.html');
 assert.doesNotMatch(css,/help-panel-enter/);
 assert.match(css,/\.hub-main\.active \{ display: block; \}/);
 assert.match(smoke,/Panel must not fade/);
 assert.match(smoke,/Panel must be fully opaque/);
});
test('TTK hitbox and armour take one mobile row and retain all source values',()=>{
 const css=read('visual-assets.css'),html=read('index.html');
 assert.match(css,/#panel-ttk \.wrap > p\.sub \+ \.card \.toolbar/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 for(const id of ['tk_weapon','tk_hitbox','tk_armor','tk_detailed','tk_dmg','tk_htk','tk_pure'])
  assert.ok(html.includes('id="'+id+'"'),'missing TTK control '+id);
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
});
