'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const src=read('js/sensitivity.js');
const constants=vm.runInNewContext('('+src.match(/const SCOPE_CONST = (\{[\s\S]*?\n\});/)[1]+')');
const functions=src.match(/function pixelSpeed\(C, A, B\)\{[\s\S]*?\n\}\s*function matchedSens\(speed, A, B\)\{[\s\S]*?\n\}/)[0];
const model=vm.runInNewContext(functions+';({pixelSpeed,matchedSens})');
test('Aim shares the supplied 15x constants and all original scopes retain their calibrations',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(constants.aim)),JSON.parse(JSON.stringify(constants['15x'])));
 assert.equal(constants.aim.A,53);assert.equal(constants.aim.B,0.2);
 const expected={'1x':[64,2],'2x':[54,.6],'3x':[70,.6],'4x':[50,.6],'6x':[35,.6],'8x':[35,.6],'15x':[53,.2]};
 for(const [key,[A,B]] of Object.entries(expected)){assert.equal(constants[key].A,A);assert.equal(constants[key].B,B);}
 for(const C of [0,1.3,10,14.7,20])assert.equal(model.pixelSpeed(C,constants.aim.A,constants.aim.B),model.pixelSpeed(C,constants['15x'].A,constants['15x'].B));
});
test('matched settings reproduce the reference speed across every aiming mode',()=>{
 for(const C of [0,5,12,20])for(const ref of Object.values(constants)){
  const speed=model.pixelSpeed(C,ref.A,ref.B);
  for(const target of Object.values(constants)){
   const matched=model.matchedSens(speed,target.A,target.B);
   assert.ok(Math.abs(model.pixelSpeed(matched,target.A,target.B)-speed)<1e-8);
  }
 }
});
test('Combat Lab owns range and TTK engines and supports a TTK model display',()=>{
 const html=read('index.html'),nav=read('js/app-navigation.js'),controller=read('src/calculators/45-hit-zone-explorer.part');
 assert.match(html,/<option value="ttk">Time to kill \(seconds\)<\/option>/);
 assert.match(html,/<div id="panel-range" class="combat-result-section">/);
 assert.match(html,/<div id="panel-ttk" class="combat-result-section">/);
 assert.doesNotMatch(html,/data-open-panel="panel-(?:range|ttk)"/);
 assert.match(nav,/labAnchors\.has\(id\)\?'panel-hit-zone'/);
 assert.match(controller,/pureTtk\(zone\.htk,currentWeapon\(\)\?\.rpm\)/);
 assert.doesNotMatch(html,/<details[^>]+visual-(?:opt-in-art|art-panel)/);
});

test('current speed spread uses the fastest and slowest entered modes',()=>{
 const summarize=vm.runInNewContext('('+src.match(/function summarizeSpeeds\(entries\)\{[\s\S]*?\n\}/)[0]+')');
 assert.equal(summarize([]),null);assert.equal(summarize([{key:'1x',speed:3600}]),null);
 const result=summarize([{key:'1x',speed:3600},{key:'3x',speed:3912},{key:'15x',speed:model.pixelSpeed(10,53,.2)}]);
 assert.equal(result.slowest.key,'1x');assert.equal(result.fastest.key,'15x');
 assert.ok(Math.abs(result.gap-(model.pixelSpeed(10,53,.2)-3600))<1e-8);
 assert.equal(Math.round(result.percent*10)/10,20.8);
 assert.equal(summarize([{key:'aim',speed:4347},{key:'15x',speed:4347}]).gap,0);
});
test('requested starting settings and top tool guide are explicit',()=>{
 const html=read('index.html'),combat=read('src/combat/10-combat-rendering.part');
 assert.match(html,/<option value="1x" selected>/);assert.match(html,/id="px_sens" value="10"/);
 assert.match(combat,/let tableView='all'/);assert.match(combat,/data-combat-view="all" aria-pressed="true"/);
 assert.ok(html.indexOf('Choose a sensitivity tool')<html.indexOf('data-panel="scope"'));
 assert.doesNotMatch(html,/Speeds use this calculator’s 3840-pixel reference width|<th>Reference<\/th>/);
 assert.doesNotMatch(src,/Use as reference|row\.use|row\.delta.*reference/);
});
