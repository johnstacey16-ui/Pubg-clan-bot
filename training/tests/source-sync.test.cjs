// Source fragments must reproduce the shipped static JS exactly.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {bundles,assemble,buildAll}=require('../scripts/build-static.cjs');
const root=path.resolve(__dirname,'..');
test('source parts match the deployed JavaScript byte-for-byte',()=>{
  assert.equal(bundles.length,2);
  assert.doesNotThrow(()=>buildAll(true));
  for(const {output,parts} of bundles){
    assert.equal(fs.readFileSync(path.join(root,output),'utf8'),assemble(parts));
    assert.ok(parts.length>1);
    assert.doesNotThrow(()=>new vm.Script(assemble(parts)),output);
  }
});
