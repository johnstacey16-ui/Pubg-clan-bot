'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('armour imagery is visible and grouped with all durability tools',()=>{
 const html=read('index.html'),source=read('unified-workspace.js');
 assert.match(html,/<section class="visual-art-panel combat-armour-disclosure"/);
 assert.match(html,/gear-helmet\.svg/);assert.match(html,/gear-vest\.svg/);
 for(const id of ['combat-armour-disclosure','armor-quick-check','combat-armor-crossover-section','how-thresholds-work','realityCard'])assert.ok(source.includes("'"+id+"'"));
 assert.match(source,/armour\.append\(get\(id\)\)/);
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
});
test('database removes the redundant nearby-table link and retains useful jump destinations',()=>{
 const html=read('index.html');
 assert.doesNotMatch(html,/href="#combat-database"/);
 assert.match(html,/href="#compare-weapons"/);assert.match(html,/href="#armor-guide"/);
});
test('weapon gallery shows pictures without an artwork toggle',()=>{
 const source=read('src/combat/10-combat-rendering.part');
 assert.match(source,/<section id="combat-browser"/);
 assert.doesNotMatch(source,/combat-card-art|combat-card-switch/);
 assert.match(source,/if\(art\)/);
});
