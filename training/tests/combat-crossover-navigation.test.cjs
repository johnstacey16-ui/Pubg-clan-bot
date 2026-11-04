'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('main table has 15 columns and duplicate Head/Chest values in crossover table',()=>{
 const src=read('src/combat/10-combat-rendering.part');
 assert.match(src,/const ARMOR_COLS = /);
 assert.match(src,/\["headDmg","Head Dmg"\],\["chestDmg","Chest Dmg"\]/);
 assert.match(src,/id="combat-armor-crossovers"/);
 assert.match(src,/id="combatArmorTable"/);
 assert.match(src,/armorCell\(w\.helm,'l3'\)/);
 assert.match(src,/armorCell\(w\.vest,'l3'\)/);
 assert.match(src,/class="armor-crossover-row"/);
 assert.match(src,/const armourTable=document\.getElementById\("combatArmorTable"\)/);
 assert.doesNotMatch(src,/visual-weapon-thumb|combat-pilot-image/);
 assert.equal(read('js/combat-database.js'),read('src/combat/00-weapon-data-armor.part')+src);
});
test('all three existing internal anchor URLs route back to Combat',()=>{
 const nav=read('js/app-navigation.js'),index=read('index.html');
 assert.doesNotThrow(()=>new vm.Script(nav));
 for(const id of ['combat-database','compare-weapons','how-thresholds-work']){
   assert.ok(index.includes('href="#armor-guide"'),'armour guide quick link');
   assert.ok(nav.includes("'"+id+"'"),'router missing '+id);
   assert.ok(read('src/combat/10-combat-rendering.part').includes('id="'+id+'"'),'target missing '+id);
 }
 assert.match(nav,/scrollCombatAnchor/);
 assert.match(nav,/window\.addEventListener\('hashchange'/);
});
test('expanded armor table has focus style and uses original threshold colours',()=>{
 const css=read('visual-assets.css'),src=read('src/combat/10-combat-rendering.part');
 assert.match(css,/#panel-combat #combat-armor-crossovers>summary:focus-visible/);
 assert.match(css,/#panel-combat #combatArmorTable/);
 assert.match(css,/scroll-margin-top:110px/);
 assert.match(src,/clegend-item/);
 assert.equal((read('index.html').match(/data-hit-zone="/g)||[]).length,13);
});
