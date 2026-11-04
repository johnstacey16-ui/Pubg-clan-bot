// Attachment presets should optimise the verified model on each compatible gun.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {runInNewContext,Script}=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const a=html.indexOf('const ATTACH_MOD = {');
const b=html.indexOf('(function(){\n  const $ = id => document.getElementById(id);',a);
assert.ok(a>=0&&b>a);
const data=runInNewContext(html.slice(a,b)+'\n({bestAttachmentPreset,attachmentChoicesFor,ATTACH_MOD,compensatorFor})');
const {bestAttachmentPreset,attachmentChoicesFor,ATTACH_MOD,compensatorFor}=data;
function opt(name,cls,focus){return bestAttachmentPreset({name,cls},focus);}
function gain(w,choice){
  const m=choice.muzzle==='compensator'
    ? compensatorFor(w) : ATTACH_MOD.muzzle[choice.muzzle];
  const g=ATTACH_MOD.grip[choice.grip],s=ATTACH_MOD.stock[choice.stock];
  return {v:-(m.v+g.v+s.v),h:-(m.h+g.h+s.h)};
}

test('vertical and horizontal M416 presets select the best real accessories, including Heavy Stock',()=>{
  assert.deepEqual({...opt('M416','AR','vertical')},
    {muzzle:'compensator',grip:'vertical',stock:'heavy'});
  assert.deepEqual({...opt('M416','AR','horizontal')},
    {muzzle:'compensator',grip:'half',stock:'heavy'});
  assert.deepEqual({...opt('M416','AR','balanced')},
    {muzzle:'compensator',grip:'half',stock:'heavy'});
  const v=gain({name:'M416',cls:'AR'},opt('M416','AR','vertical'));
  assert.ok(v.v>=.40-1e-9,'M416 vertical preset should reduce reported vertical recoil >=40%');
});

test('optimisation never chooses a muzzle, grip or stock the gun cannot attach',()=>{
  const cases=[
    {name:'M416',cls:'AR'},{name:'Vector',cls:'SMG'},
    {name:'MG3',cls:'MG'},{name:'RPD',cls:'MG'},
    {name:'Kar98k',cls:'SR'},{name:'Skorpion',cls:'SMG'},
    {name:'MP9',cls:'SMG'},{name:'S686',cls:'SG'},
    {name:'Lynx AMR',cls:'SR'},{name:'P90',cls:'SMG'},
    {name:'Groza',cls:'AR'},{name:'O12',cls:'SG'},
    {name:'G18C',cls:'Pistol'}
  ];
  for(const w of cases)for(const focus of ['vertical','horizontal','balanced']){
    const selection=bestAttachmentPreset(w,focus);
    for(const group of ['muzzle','grip','stock']){
      assert.ok(Array.from(attachmentChoicesFor(w,group)).includes(selection[group]),
        w.name+'/'+focus+'/'+group+' invalid '+selection[group]);
    }
  }
  for(const focus of ['vertical','horizontal','balanced']){
    assert.deepEqual({...opt('MG3','MG',focus)}, {muzzle:'none',grip:'none',stock:'none'});
    assert.deepEqual({...opt('Lynx AMR','SR',focus)}, {muzzle:'none',grip:'none',stock:'none'});
    assert.deepEqual({...opt('S686','SG',focus)}, {muzzle:'none',grip:'none',stock:'none'});
  }
});

test('focus optimiser uses the same recoil sums as the calculator without inventing multipliers',()=>{
  for(const w of [{name:'M416',cls:'AR'},{name:'Vector',cls:'SMG'},{name:'Kar98k',cls:'SR'}]){
    const opts={
      muzzle:Array.from(attachmentChoicesFor(w,'muzzle')),
      grip:Array.from(attachmentChoicesFor(w,'grip')),
      stock:Array.from(attachmentChoicesFor(w,'stock'))
    };
    const combos=[];
    for(const muzzle of opts.muzzle)for(const grip of opts.grip)for(const stock of opts.stock)
      combos.push({muzzle,grip,stock});
    const maxV=Math.max(...combos.map(p=>gain(w,p).v));
    const maxH=Math.max(...combos.map(p=>gain(w,p).h));
    assert.ok(gain(w,bestAttachmentPreset(w,'vertical')).v>=maxV-1e-9,w.name+' best vertical');
    assert.ok(gain(w,bestAttachmentPreset(w,'horizontal')).h>=maxH-1e-9,w.name+' best horizontal');
  }
  assert.match(html,/const vChange = comp\.v \+ g\.v \+ s\.v;/);
  assert.match(html,/const hChange = comp\.h \+ g\.h \+ s\.h;/);
  assert.match(html,/function applyPreset\(focus\)/);
  assert.match(html,/bestAttachmentPreset\(w,focus\)/);
  assert.doesNotMatch(html,/trySet\("at_stock","tactical"\); recompute\(\)/);
});

test('scope matcher, shotguns, bullet drop and scripts remain untouched',()=>{
  for(const fn of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange','knownMuzzleVelocity']){
    assert.match(html,new RegExp('function '+fn+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((x,i)=>assert.doesNotThrow(()=>new Script(x),'script '+i));
});
