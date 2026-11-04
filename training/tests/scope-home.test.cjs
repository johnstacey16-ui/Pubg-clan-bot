// Regression tests: Scope Sensitivity Matcher is the homepage and first sensitivity subtool.
// No changes are allowed to the user's original conversion maths.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');

const html=require('./toolkit-test-source.cjs')();
const docs=readFileSync(resolve(__dirname,'../DATA_ACCURACY_POLICY.md'),'utf8');
const sensitivityStart=html.indexOf('<div id="panel-sensitivity"');
const rangeStart=html.indexOf('<!-- ================= EFFECTIVE RANGE',sensitivityStart);
const sensitivityHtml=html.slice(sensitivityStart,rangeStart);
const inlineScripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const sensScript=inlineScripts.find(s=>s.includes('function pixelSpeed(C, A, B)'));
const nav=html.slice(html.indexOf('<nav id="app-toolnav"'),html.indexOf('</nav>'));

test('main site starts on Scope Sensitivity Matcher with Combat DB second',()=>{
  const order=[...nav.matchAll(/data-open-panel="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(order.slice(0,3),['panel-sensitivity','panel-combat','panel-hit-zone']);
  assert.match(nav,/data-open-panel="panel-sensitivity" aria-controls="panel-sensitivity" aria-current="page"/);
  assert.match(nav,/Sensitivity Studio/);
  assert.match(html,/<div id="panel-sensitivity" class="hub-main active">/);
  assert.match(html,/<div id="panel-combat" class="hub-main">/);
  assert.doesNotMatch(html,/<div id="panel-combat" class="hub-main active">/);
  assert.match(html,/id="active-tool-heading" tabindex="-1">Sensitivity Studio</);
  assert.match(inlineScripts[0],/selectPanel\(panelForHash\(initialHash\)\)/);
  assert.match(inlineScripts[0],/const target = panelIds\.includes\(id\) \? id : panelIds\[0\]/);
});

test('within Sensitivity, Scope Matcher is the first and default calculator',()=>{
  assert.ok(sensitivityStart>0&&rangeStart>sensitivityStart);
  assert.ok(sensitivityHtml.indexOf('data-panel="scope"')<sensitivityHtml.indexOf('data-panel="vert"'));
  assert.match(sensitivityHtml,/PUBG <span>SCOPE SENSITIVITY<\/span> MATCHER/);
  assert.match(sensitivityHtml,/<span class="n">01<\/span> Scope Sensitivity Matcher/);
  assert.match(sensitivityHtml,/<span class="n">02<\/span> Vertical Multiplier Calculator/);
  assert.match(sensScript,/panel\.classList\.add\('active'\)/);
  assert.doesNotMatch(sensScript,/aria-hidden|switchTab/);
  assert.ok(sensitivityHtml.indexOf('Choose a sensitivity tool')<sensitivityHtml.indexOf('data-panel="scope"'),'Tool guide belongs beside the top jump links');
});

test('owner-authored empirical formulas and scope values are preserved',()=>{
  const funcs = sensScript.match(/function pixelSpeed\(C, A, B\)\{[\s\S]*?\n\}\s*function matchedSens\(speed, A, B\)\{[\s\S]*?\n\}/);
  assert.ok(funcs,'Original pair of math functions must stay available');
  const model=vm.runInNewContext(funcs[0]+'; ({pixelSpeed,matchedSens})');
  const speed=model.pixelSpeed(12,70,0.6);
  const matched=model.matchedSens(speed,70,0.6);
  assert.ok(Number.isFinite(speed));
  assert.ok(Math.abs(matched-12)<1e-9);
  assert.match(sensScript,/'1x':\s*\{A:64, B:2,\s*range:\[0\.1,19\.1\]\}/);
  assert.match(sensScript,/'3x':\s*\{A:70, B:0\.6,\s*range:\[1\.4,19\.8\]\}/);
  assert.match(docs,/developer-built models are allowed/i);
  assert.match(docs,/owner-supplied scope-specific A\/B constants/);
});

test('existing calculations and all eight panels compile',()=>{
  assert.equal(inlineScripts.length,5);
  inlineScripts.forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s),'block '+i));
  assert.equal((nav.match(/data-open-panel="panel-/g)||[]).length,6);
  for(const id of ['panel-range','panel-ttk','panel-recoil2','panel-attach','panel-backpack']){
    assert.match(html,new RegExp('id="'+id+'" class="(?:hub-main|combat-result-section)'));
  }
});
