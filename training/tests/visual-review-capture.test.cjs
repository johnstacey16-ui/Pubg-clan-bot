'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('all eight panels have mobile and desktop screenshot review coverage',()=>{
 const src=read('tests/visual-review-capture.cjs');
 assert.doesNotThrow(()=>new vm.Script(src));
 for(const panel of ['panel-sensitivity','panel-combat','panel-hit-zone','panel-range',
  'panel-ttk','panel-recoil2','panel-attach','panel-backpack']){
  assert.ok(src.includes(panel),'missing screenshot coverage for '+panel);
 }
 assert.match(src,/label:'phone',width:390,height:900/);
 assert.match(src,/label:'desktop',width:1280,height:900/);
 assert.match(src,/captured\.length!==16/);
 assert.match(src,/PNG|89504e470d0a1a0a/);
});
test('PR workflow uploads screenshot evidence without changing main release policy',()=>{
 const yaml=read('.github/workflows/ui-smoke.yml');
 assert.match(yaml,/Capture first-screen visual review evidence/);
 assert.match(yaml,/Attach visual review screenshots to PR checks/);
 assert.match(yaml,/if: github\.event_name == 'pull_request'/);
 assert.match(yaml,/actions\/upload-artifact@v4/);
 assert.match(yaml,/name: help-clan-visual-review/);
 assert.match(read('docs/visual-acceptance-checklist.md'),/not real Xbox TV screenshots/);
});
