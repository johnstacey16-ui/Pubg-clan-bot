// Regression coverage for Update 43.2 optic/weapon compatibility.
// This remains a fit checker: scope sensitivity mathematics is untouched.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const i=html.indexOf('const ATTACH_MOD = {');
const j=html.indexOf('(function(){\n  const $ = id => document.getElementById(id);',i);
assert.ok(i>0&&j>i,'Attachment data source boundaries');
const data=vm.runInNewContext(html.slice(i,j)+';({opticChoicesFor,attachmentChoicesFor,SIGHT_6X_COMPAT,SIGHT_8X_COMPAT,SIGHT_RED_DOT_ONLY,SIGHT_LABELS})');
const options=name=>Array.from(data.opticChoicesFor({name}));

test('long-range 8x/15x optics appear only for confirmed weapons',()=>{
  for(const gun of ['AWM','Kar98k','Lynx AMR','SLR','M24','SVD Dragunov','Mini 14','Mk12','MK14 EBR','SKS','M16A4','MK47 Mutant']){
    assert.deepEqual(options(gun),['none','reddot','holo','dot','2x','3x','4x','hybrid','thermal4x','6x','8x','15x'],gun);
  }
  for(const gun of ['AKM','M416','RPD','M249','S12K','DBS','UMP9','Vector','JS9']){
    const choices=options(gun);
    assert.ok(choices.includes('6x')&&!choices.includes('8x')&&!choices.includes('15x'),gun);
    assert.ok(choices.includes('dot')&&choices.includes('hybrid')&&choices.includes('thermal4x'),gun+' game-file optics');
  }
});

test('43.2 extra scopes use compatible 6x/8x mount groups only',()=>{
  for(const gun of ['M416','AWM','AKM','RPD','DBS','M16A4']){
    const choices=options(gun);
    assert.ok(choices.includes('dot'),gun+'/dot');
    assert.ok(choices.includes('hybrid'),gun+'/hybrid');
    assert.ok(choices.includes('thermal4x'),gun+'/thermal');
  }
  for(const gun of ['G18C','MP9','Skorpion','P92','P90']){
    const choices=options(gun);
    assert.ok(!choices.includes('dot'),gun+'/dot unsupported');
    assert.ok(!choices.includes('hybrid'),gun+'/hybrid unsupported');
    assert.ok(!choices.includes('thermal4x'),gun+'/thermal unsupported');
  }
});
test('handguns and compact SMGs offer only their listed red dot and holo sights',()=>{
  for(const gun of ['Desert Eagle','G18C','P92','MP9','Micro Uzi','Skorpion','Tommy Gun']){
    assert.deepEqual(options(gun),['none','reddot','holo'],gun);
  }
  for(const gun of ['P90','VSS Vintorez','R1895','S686','Sawn-off']){
    assert.deepEqual(options(gun),['none'],gun);
  }
});

test('every optic choice has a label, and never changes recoil output',()=>{
  assert.match(html,/<label for="at_sight">Optic<\/label><select id="at_sight"><\/select>/);
  assert.match(html,/id="at_opticNote"/);
  assert.match(html,/const sightChoices=opticChoicesFor\(w\)/);
  assert.match(html,/sight\.disabled=sightChoices\.length===1/);
  assert.match(html,/sightChoices\.includes\(sight\.value\)\?sight\.value:"none"/);
  assert.match(html,/use Scope Sensitivity Matcher for turning speed/);
  assert.match(html,/trySet\("at_sight","none"\)/);
  for(const group of [data.SIGHT_8X_COMPAT,data.SIGHT_6X_COMPAT,data.SIGHT_RED_DOT_ONLY]){
    for(const name of group){
      for(const option of options(name)) assert.ok(data.SIGHT_LABELS[option],name+'/'+option);
    }
  }
  assert.match(html,/const vChange = comp\.v \+ g\.v \+ s\.v;/);
  assert.match(html,/const hChange = comp\.h \+ g\.h \+ s\.h;/);
  assert.doesNotMatch(html,/vChange = .*selectedSight/);
});

test('Kar98k offers cheek pad and bullet loops while keeping other stocks honest',()=>{
  const choices=Array.from(data.attachmentChoicesFor({name:'Kar98k',cls:'SR'},'stock'));
  assert.deepEqual(choices,['none','cheek','loops']);
  assert.deepEqual(Array.from(data.attachmentChoicesFor({name:'AWM',cls:'SR'},'stock')),['none','cheek']);
  assert.deepEqual(Array.from(data.attachmentChoicesFor({name:'S686',cls:'SG'},'stock')),['none','loops']);
});

test('scripts compile, scopes/calculators and sidebar keep their existing defaults',()=>{
  assert.match(html,/<div id="panel-sensitivity" class="hub-main active">/);
  for(const fn of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange']){
    assert.match(html,new RegExp('function '+fn+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  for(const script of scripts) assert.doesNotThrow(()=>new vm.Script(script));
});
