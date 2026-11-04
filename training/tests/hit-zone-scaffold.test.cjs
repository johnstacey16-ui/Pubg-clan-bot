// Asset-stage invariants for the UNWIRED front-only SVG scaffold.
// This checks the repository's actual anatomy markup; visual QA is separate.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const markup=read('src/explorer/hit-zone-explorer.fragment.html');
const styles=read('src/explorer/hit-zone-explorer.scaffold.css');
const controller=read('src/explorer/hit-zone-explorer.scaffold.part');
const calc=read('src/calculators/00-damage-ballistics.part');
const zoneDeclaration=calc.match(/const DETAILED_PARTS = \[([^\]]+)\]/);
assert.ok(zoneDeclaration,'Detailed parts declaration present');
const regions=[...zoneDeclaration[1].matchAll(/"([^"]+)"/g)].map(match=>match[1]);
const markers=[...markup.matchAll(/<g data-hit-zone="([^"]+)"([^>]*)>([\s\S]*?)<\/g>/g)];
const valueKeys=[...markup.matchAll(/data-hz-value="([^"]+)"/g)].map(match=>match[1]);
const sorted=items=>[...items].sort().join('|');

test('one forward-facing SVG provides exactly the 13 matching damage regions',()=>{
  assert.match(markup,/<svg id="hz_body" viewBox="0 0 500 760"/);
  assert.match(markup,/Front view of PUBG damage hit zones/);
  assert.equal(markers.length,13);
  assert.equal(sorted(markers.map(m=>m[1])),sorted(regions));
  assert.equal(new Set(markers.map(m=>m[1])).size,13);
  assert.doesNotMatch(markup,/data-hit-zone="back"|id="hz_rear"|rotateModel/);
});
test('all 13 values are on the figure at once without tapping the silhouette',()=>{
  assert.equal(valueKeys.length,13);
  assert.equal(sorted(valueKeys),sorted(regions));
  assert.match(markup,/<g class="hz-callouts"/);
  assert.match(controller,/querySelectorAll\('\[data-hz-value\]'\)/);
  assert.match(controller,/for \(const zone of results\)/);
});
test('arms and legs mirror left and right through the same logical zone',()=>{
  for(const id of ['upperArm','forearm','hand','thigh','calf','foot']){
    const match=markers.find(m=>m[1]===id);
    assert.ok(match,'missing '+id);
    assert.equal((match[3].match(/<path /g)||[]).length,2,
      id+' requires one path on each side of the body');
  }
  assert.equal((markers.find(m=>m[1]==='head')[3].match(/<ellipse /g)||[]).length,1);
});
test('helmet and vest are separate visual overlays and gear selectors',()=>{
  for(const gear of ['helmet','vest']){
    assert.match(markup,new RegExp('data-armour="'+gear+'"'));
    assert.match(markup,new RegExp('id="hz_'+gear+'"'));
    for(const level of ['0','1','2','3']){
      const select=markup.match(new RegExp('<select id="hz_'+gear+'">([\\s\\S]*?)</select>'));
      assert.ok(select && select[1].includes('value="'+level+'"'),gear+' level '+level);
    }
  }
  assert.match(styles,/#panel-hit-zone #hz_body\.has-helmet \[data-armour=helmet\]/);
  assert.match(styles,/#panel-hit-zone #hz_body\.has-vest \[data-armour=vest\]/);
  assert.doesNotMatch(markup,/data-armour="(?:limb|arm|leg)"/);
});
test('the front-view remains a single mobile-accessible eighth live panel',()=>{
  const html=read('index.html');
  const nav=read('js/app-navigation.js');
  assert.match(html,/id="panel-hit-zone"/);
  assert.match(nav,/"panel-hit-zone"/);
  assert.match(markup,/keyboard|touch/i);
  assert.match(styles,/@media\(max-width:780px\)/);
});
