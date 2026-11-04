'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context={window:{}};
vm.runInNewContext(read('visual-catalog.js'),context);
const art=context.window.HELP_VISUAL_WEAPONS;
const registered=JSON.parse(read('assets/visual-manifest.json')).assets;
test('all 45 names in the weapon database have exact-name publisher artwork',()=>{
 const section=read('src/combat/00-weapon-data-armor.part').split('const WEAPONS = [')[1].split('];')[0];
 const names=[...section.matchAll(/^\["([^"]+)",/gm)].map(x=>x[1]);
 assert.ok(names.length>=40,'expected full weapon dataset');
 assert.equal(Object.keys(art).length,names.length);
 for(const [name,filename] of Object.entries(art)){
   assert.ok(names.includes(name),'image mapped to unknown weapon '+name);
   assert.match(filename,/^weapon-[a-z0-9-]+-field\.svg$/);
   const file='assets/'+filename;
   assert.ok(fs.existsSync(path.join(root,file)),'missing '+file);
   assert.ok(registered.some(a=>a.path===file&&a.origin==='publisher-fan-content'),'unregistered '+file);
 }
 assert.deepEqual(Object.keys(art).sort(),names.slice().sort(),'every database entry is mapped to its own asset');
 assert.equal(art.AKM,'weapon-akm-field.svg');
 assert.equal(art.M416,'weapon-m416-field.svg');
 assert.notEqual(art.AKM,art.M416);
 assert.equal(new Set(Object.values(art)).size,names.length,'each weapon requires distinct artwork');
});
test('both Core DB and visual-only controls share one exact-name map and omit unknown images',()=>{
 const source=read('src/combat/10-combat-rendering.part'),ctrl=read('visual-controls.js');
 assert.match(source,/Object\.prototype\.hasOwnProperty\.call\(artMap,w\.name\)/);
 assert.match(ctrl,/Object\.prototype\.hasOwnProperty\.call\(map,key\)/);
 assert.match(ctrl,/image\.hidden=true;image\.removeAttribute\('src'\)/);
 assert.match(source,/Artwork not available for this weapon yet/);
 assert.ok(read('index.html').indexOf('src="visual-catalog.js"')<read('index.html').indexOf('src="js/combat-database.js"'));
});
