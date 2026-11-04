// Verifies the real browser load order and the navigation fallback.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const names=['js/app-navigation.js','js/shared.js','js/combat-database.js','js/sensitivity.js','js/toolkit-calculators.js'];
test('five external classic scripts preserve the original synchronous load order',()=>{
  const actual=[...html.matchAll(/<script src="(js\/[^"]+\.js)"><\/script>/g)].map(m=>m[1]);
  assert.deepEqual(actual,names);
  assert.equal([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].length,0);
  for(const name of actual){
    const code=fs.readFileSync(path.join(root,name),'utf8');
    assert.doesNotThrow(()=>new vm.Script(code),name);
  }
  const reconstructed=require('./toolkit-test-source.cjs')();
  assert.equal([...reconstructed.matchAll(/<script>([\s\S]*?)<\/script>/g)].length,5);
});
test('invalid/empty hash defaults to Scope, but valid Combat subsection hashes stay in Combat',()=>{
  const navigation=fs.readFileSync(path.join(root,names[0]),'utf8');
  assert.match(navigation,/const target = panelIds\.includes\(id\) \? id : panelIds\[0\]/);
  assert.match(navigation,/return combatAnchors\.has\(id\)\?'panel-combat'/);
  assert.match(navigation,/window\.addEventListener\('popstate',followHash\)/);
  assert.match(navigation,/window\.addEventListener\('hashchange',followHash\)/);
  assert.match(navigation,/selectPanel\(panelForHash\(initialHash\)\)/);
});
