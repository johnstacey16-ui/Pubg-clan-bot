// Keep source research in GitHub documentation and keep the public page tool-only.
// Run alongside existing smoke tests: node --test tests/*.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script } = require('node:vm');

const root = resolve(__dirname,'..');
const html = require('./toolkit-test-source.cjs')();
const docs = readFileSync(resolve(root,'docs/research-and-patch-references.md'),'utf8');
const policy = readFileSync(resolve(root,'DATA_ACCURACY_POLICY.md'),'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);

test('the live app has exactly eight tool panels, no research tab, and correct counter',()=>{
  const visible = [...html.matchAll(/<div id="(panel-[^"]+)" class="hub-main/g)].map(m=>m[1]);
  assert.deepEqual(visible,[
    'panel-combat','panel-sensitivity',
    'panel-recoil2','panel-attach','panel-backpack','panel-hit-zone'
  ]);
  assert.equal((html.match(/data-open-panel="panel-/g)||[]).length,6);
  assert.doesNotMatch(html,/id="panel-data"|data-open-panel="panel-data"|Data &amp; Patch Info/);
  assert.doesNotMatch(html,/<div class="nav-group-label"><span>03<\/span>REFERENCE/);
  assert.match(html,/id="active-tool-index" aria-label="Tool 1 of 6">01 <i>\/<\/i> 06/);
  assert.match(html,/String\(panelIds\.length\)\.padStart/);
  assert.match(html,/const target = panelIds\.includes\(id\) \? id : panelIds\[0\]/);
});

test('source and patch research is archived in docs, not displayed in the app',()=>{
  assert.match(docs,/## Original Data & Patch HTML \(full archival copy\)/);
  assert.match(docs,/pubgstatistics\.com/);
  assert.match(docs,/winnermeta\.win/);
  assert.match(docs,/Sensitivity scope matching/);
  assert.match(docs,/pubg\.com\/en\/news\/10874/);
  assert.match(policy,/developer-built models are allowed/i);
  assert.doesNotMatch(html,/<div class="recoil-source-list">/);
  assert.doesNotMatch(html,/<b>Data sources:<\/b>/);
  assert.doesNotMatch(html,/see Data &amp; Patch Info/i);
  assert.doesNotMatch(html,/Source: supplied weapon DataAssets/);
  assert.doesNotMatch(html,/WinnerMeta beta telemetry reports/);
  assert.doesNotMatch(html,/Angle[d]? Foregrip \(removed from world spawn/);
});

test('players still see critical No data and uncertainty warnings',()=>{
  assert.match(html,/Minimum shells assume all /);
  assert.match(html,/Actual shots may need more/);
  assert.match(html,/combined reductions and suggested setups remain a simplified model/);
  assert.match(html,/MG3 real reload-animation time is not verified/);
  assert.match(html,/const LMG_RELOAD_2026 = Object\.freeze/);
  assert.match(html,/simulated positions in curve units/);
  assert.match(html,/No gravity-drop estimate for /);
  assert.match(html,/Over capacity by /);
});

test('all existing calculator scripts and public table anchors remain available',()=>{
  assert.equal(scripts.length,5);
  scripts.forEach((script,i)=>assert.doesNotThrow(()=>new Script(script),'Inline block '+i));
  for(const id of ['wTable','rg_chartDmg','rg_brackets','tk_cmpTable','rc_table','at_weapon','bp_level']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/src="sticky-weapon-header.js" defer/);
  assert.doesNotMatch(html,/getElementById\("dp_updated"\)/);
});
