// Keep estimates distinct from the published LMG timings if a magazine runs dry.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../js/toolkit-calculators.js'),'utf8');
const from=source.indexOf('function reloadConfidenceForWeapon(');
const to=source.indexOf('function computeFor(',from);
assert.ok(from>0&&to>from);
const confidence=vm.runInNewContext(
  'const LMG_RELOAD_2026 = Object.freeze({RPD:5.2,M249:5.962,MG3:null});\n'+
  source.slice(from,to)+'\nreloadConfidenceForWeapon'
);
test('reload is unnecessary for normal within-magazine TTK',()=>{
  for(const name of ['AKM','M416','M249','RPD','MG3'])
    assert.equal(confidence({name},0),'not-needed');
});
test('only verified LMG values are labeled published and unknown remains unknown',()=>{
  assert.equal(confidence({name:'RPD'},1),'published');
  assert.equal(confidence({name:'M249'},2),'published');
  assert.equal(confidence({name:'MG3'},1),'unknown');
  assert.equal(confidence({name:'AKM'},1),'estimate');
  assert.equal(confidence({name:'Kar98k'},1),'estimate');
  assert.match(source,/Reload timing is an estimate, not independently verified/);
  assert.match(source,/r\.reloadConfidence==="estimate" \? "≈" : ""/);
});
