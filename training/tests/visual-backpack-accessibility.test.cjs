'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('inventory presentation names dynamic existing controls without changing calculator source',()=>{
 const visual=read('visual-controls.js');
 const calculator=read('src/calculators/50-backpack.part');
 assert.doesNotThrow(()=>new vm.Script(visual));
 assert.match(visual,/row\.querySelectorAll\('\.bp-stepper button\[data-step\]'\)/);
 assert.match(visual,/Quantity of /);
 assert.match(visual,/Add one/);
 assert.match(visual,/Remove one/);
 assert.match(calculator,/const CHARACTER_BASE_CAPACITY = 70;/);
 assert.match(calculator,/const VEST_CAPACITY_BONUS = 50;/);
 assert.doesNotMatch(visual,/BACKPACK_CAPACITY_BONUS\s*=|VEST_CAPACITY_BONUS\s*=|CHARACTER_BASE_CAPACITY\s*=/);
});
test('backpack tap targets are 44 px and tested at six screen widths',()=>{
 const css=read('visual-assets.css'),layout=read('tests/visual-layout.html');
 assert.match(css,/#panel-backpack \.bp-row \.bp-stepper button \{/);
 assert.match(css,/min-width:44px;/);
 assert.match(css,/min-height:44px;/);
 assert.match(css,/focus-visible/);
 assert.match(layout,/panelId==='panel-backpack'/);
 assert.match(read('tests/visual-layout-smoke.cjs'),/\[320,360,390,768,1280,1440\]/);
});
