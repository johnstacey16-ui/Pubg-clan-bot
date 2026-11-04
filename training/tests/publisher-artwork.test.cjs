'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('assets/visual-manifest.json')).assets;
const context={window:{}};vm.runInNewContext(read('official-art-catalog.js'),context);
test('every mapped attachment, inventory and armour image has publisher provenance',()=>{
 const {HELP_OFFICIAL_ATTACHMENTS:attachments,HELP_OFFICIAL_INVENTORY:inventory,HELP_OFFICIAL_GEAR:gear}=context.window;
 assert.equal(Object.keys(attachments).length,45);
 const paths=[];
 for(const slots of Object.values(attachments))for(const options of Object.values(slots))paths.push(...Object.values(options));
 paths.push(...Object.values(inventory));
 for(const levels of Object.values(gear))paths.push(...Object.values(levels));
 for(const file of new Set(paths)){
  const item=manifest.find(a=>a.path==='assets/'+file);
  assert.ok(item&&item.origin==='publisher-fan-content','missing publisher image '+file);
 }
 const m416Suppressor=manifest.find(a=>a.path==='assets/'+attachments.M416.muzzle.suppressor);
 assert.ok(m416Suppressor.sourceUrl.endsWith('/img-weapons-add-on-muzzle-suppressor_large.webp'));
 assert.notEqual(attachments.M416.muzzle.compensator,attachments.MP5K.muzzle.compensator,'AR and SMG muzzle artwork must match their actual item');
 assert.notEqual(attachments.M416.grip.half,attachments.M416.grip.light,'different grips must not reuse a representative category drawing');
 for(const type of ['helmet','vest'])for(const level of ['1','2','3']){
  const item=manifest.find(a=>a.path==='assets/'+gear[type][level]);
  assert.match(item.sourceLabel,new RegExp('Level '+level+'$'));
 }
});
test('catalogue WebP bytes retain their recorded original SHA-256 inside local SVG viewports',()=>{
 for(const item of manifest.filter(a=>a.origin==='publisher-fan-content'&&a.sourceUrl.endsWith('.webp'))){
  const svg=read(item.path),match=svg.match(/href="data:image\/webp;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(match,'missing embedded publisher pixels '+item.path);
  const bytes=Buffer.from(match[1],'base64');
  assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sourceSha256,item.path+' must retain the source image');
 }
});
