'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('range source explicitly labels observational checkpoints and theoretical shotgun minima',()=>{
 const s=read('src/calculators/10-effective-range.part');
 assert.match(s,/Minimum shells \(all pellets hit\)/);
 assert.match(s,/TTK is unknown/);
 assert.match(s,/No figures beyond this range or between sampled points/);
 assert.match(s,/Measured base damage per pellet/);
 assert.match(s,/pointsOnly:true/);
 assert.match(s,/No data/);
 assert.match(s,/"rg_range"/);
 assert.match(s,/"rg_chartDmg"/);
 assert.equal((read('index.html').match(/data-hit-zone="/g)||[]).length,13);
});
test('real browser range regression exercises shotgun evidence and AR weapon switching',()=>{
 const s=read('tests/browser-smoke.html');
 for(const phrase of ['S686','all 9 pellets hit','80 m','6.9','per pellet','Shotgun TTK remains unknown','AR hit-count label is restored']){
  assert.ok(s.includes(phrase),'Missing browser evidence assertion '+phrase);
 }
});
