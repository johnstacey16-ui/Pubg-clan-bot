// Visual/layout regression guard for the sharing-ready HELP Clan toolkit.
// Run: node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');

const root=resolve(__dirname,'..');
const html=require('./toolkit-test-source.cjs')();
const css=readFileSync(resolve(root,'app-shell.css'),'utf8');
const header=html.slice(html.indexOf('<header id="app-topbar">'),html.indexOf('</header>',html.indexOf('<header id="app-topbar">')));
const recoil=html.slice(html.indexOf('<div id="panel-recoil2"'),html.indexOf('<!-- ================= ATTACHMENTS'));
const scope=html.slice(html.indexOf('<div id="panel-sensitivity"'),html.indexOf('<!-- ================= EFFECTIVE RANGE'));
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);

test('HELP CLAN masthead stays centred in a sticky top bar on every page',()=>{
  assert.match(header,/<div class="topbar-brand" aria-label="HELP CLAN">/);
  assert.match(header,/<span class="brand-help">HELP<\/span> <span class="brand-clan">CLAN<\/span>/);
  assert.match(header,/PUBG FIELD TOOLKIT/);
  assert.ok(header.indexOf('topbar-main')<header.indexOf('topbar-brand'));
  assert.ok(header.indexOf('topbar-brand')<header.indexOf('topbar-actions'));
  assert.match(css,/#app-topbar\s*\{[\s\S]*?position:\s*sticky;\s*top:\s*0;/);
  assert.match(css,/#app-topbar\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0,\s*1fr\) max-content minmax\(0,\s*1fr\)/);
  assert.match(css,/#app-topbar \.topbar-brand\s*\{[\s\S]*?grid-column:\s*2;/);
  assert.match(css,/#app-topbar \.topbar-brand\s*\{[\s\S]*?justify-self:\s*center;/);
  assert.match(css,/@media \(max-width:\s*900px\)[\s\S]*?#app-topbar\s*\{\s*grid-template-columns:/);
  assert.match(css,/#app-topbar \.topbar-heading\s*\{[\s\S]*?clip-path:\s*inset\(50%\);/);
});

test('Recoil Analyzer exposes the per-shot tools without a Coming Soon blocker',()=>{
 assert.match(recoil,/<h1>Per-Shot Recoil Analyzer<\/h1>/);
 for(const id of ['rc_weapon','rc_chart','rc_table','rc_curve_canvas','rc_stage_table','rc_sim_canvas','rc_fire','rc_export'])assert.ok(recoil.includes('id="'+id+'"'),id);
 assert.doesNotMatch(recoil,/recoil-coming-soon|IN DEVELOPMENT/);
});

test('Scope Matcher remains first; results are uncluttered and swipeable',()=>{
  assert.match(html,/<div id="panel-sensitivity" class="hub-main active">/);
  assert.match(scope,/Scope Sensitivity Matcher/);
  assert.match(scope,/<div class="scope-results-scroll" role="region" aria-label="Matched scope sensitivities" tabindex="0">/);
  assert.match(scope,/id="px_table"/);
  assert.match(css,/#panel-sensitivity \.scope-results-scroll\s*\{[\s\S]*?overflow-x:\s*auto;/);
  assert.match(css,/#panel-sensitivity #px_table th:nth-child\(2\),/);
  assert.match(css,/#panel-sensitivity #px_table td:nth-child\(3\)[\s\S]*?\{\s*display:\s*none;/);
  assert.match(css,/#panel-sensitivity \.tab\s*\{[\s\S]*?min-height:\s*44px;/);
});

test('calculator scripts, panels and sticky database header all remain present',()=>{
  assert.equal(scripts.length,5);
  scripts.forEach((code,i)=>assert.doesNotThrow(()=>new vm.Script(code),'Inline block '+i));
  for(const id of ['panel-sensitivity','panel-combat','panel-range','panel-ttk','panel-recoil2','panel-attach','panel-backpack']){
    assert.match(html,new RegExp('id="'+id+'" class="'));
  }
  for(const fn of ['shotgunMinShellsAt','finalDamageAt','htkFor','pureTtk','pixelSpeed','matchedSens']){
    assert.match(html,new RegExp('function '+fn+'\\('));
  }
  assert.match(html,/src="sticky-weapon-header\.js" defer/);
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'No duplicated ids in markup');
});
