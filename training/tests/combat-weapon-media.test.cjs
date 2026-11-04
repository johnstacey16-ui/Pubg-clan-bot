// Source and markup invariants for the first Combat DB weapon-image pilot.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('src/combat/10-combat-rendering.part');
const html=read('index.html');
const style=read('visual-assets.css');
test('Combat DB is text-first and loads artwork only after a weapon is activated',()=>{
 assert.ok(fs.existsSync(path.join(root,'assets/weapon-m416-field.svg')));
 assert.match(html,/href="visual-assets\.css"/);
 assert.match(source,/class="combat-weapon-cell"/);
 assert.match(source,/data-n="\$\{w.name\}"/);
 assert.match(source,/View \$\{w.name\} weapon details and illustration/);
 assert.match(source,/tr\.onclick = \(\)=>openWeaponDetail/);
 assert.match(source,/tr\.onkeydown = e=>/);
 assert.doesNotMatch(source,/visual-weapon-thumb|combat-pilot-image|combat-pilot-open|combat-visual-pilot|const thumb =/);
 assert.doesNotMatch(style,/visual-weapon-thumb|combat-visual-pilot/);
 assert.match(source,/Object\.prototype\.hasOwnProperty\.call\(artMap,w\.name\)/);
 assert.match(source,/const weaponArt/);
 assert.match(source,/visual-modal-media/);
 assert.match(source,/Artwork not available for this weapon yet/);
 assert.match(source,/\$\{weaponArt\}/);
});
test('numeric weapon data and all 13 hit zones retain their existing source boundaries',()=>{
  assert.match(html,/id="panel-combat"/);
  assert.match(html,/id="panel-hit-zone"/);
  assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
  assert.ok(!source.includes('updateDamageModel'));
  assert.match(read('src/explorer/hit-zone-explorer.fragment.html'),/damage-training-mannequin\.svg/);
});

test('shared weapon art catalogue only defines entries present in the static weapon database',()=>{
 const vm=require('node:vm');
 const root=require('node:path').resolve(__dirname,'..');
 const catalog=read('visual-catalog.js'),ctx={window:{}};
 vm.runInNewContext(catalog,ctx);
 const listed=ctx.window.HELP_VISUAL_WEAPONS;
 const db=read('src/combat/00-weapon-data-armor.part');
 assert.equal(Object.keys(listed).length,45);
 for(const [name,file] of Object.entries(listed)){
   assert.ok(db.includes('["'+name+'",'),'catalogue name absent from data: '+name);
   assert.ok(fs.existsSync(require('node:path').join(root,'assets',file)),'missing artwork '+file);
 }
 assert.match(read('index.html'),/<script src="visual-catalog\.js"><\/script>/);
});

test('weapon popups support Xbox/keyboard focus without reintroducing thumbnails',()=>{
 assert.match(source,/let lastWeaponTrigger=null/);
 assert.match(source,/openWeaponDetail\(tr\.dataset\.n,tr\)/);
 assert.match(source,/\.focus\(\{preventScroll:true\}\)/);
 assert.match(source,/if\(e\.key==="Escape"\)/);
 assert.match(source,/if\(e\.key==="Tab"\)/);
 assert.match(source,/tr\.onclick/);
 assert.doesNotMatch(source,/visual-weapon-thumb|combat-pilot-image/);
 assert.match(style,/min-width:44px;min-height:44px/);
});
