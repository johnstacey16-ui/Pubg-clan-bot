// Exhaustive optimization check for every registered weapon and every preset.
// This proves optimality *within the declared additive model*; it does not
// assert the most controllable actual PUBG spray pattern.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const combat=fs.readFileSync(path.join(root,'js/combat-database.js'),'utf8');
const code=fs.readFileSync(path.join(root,'js/toolkit-calculators.js'),'utf8');

const weaponsStart=combat.indexOf('const WEAPONS = [');
const weaponsEnd=combat.indexOf('// w[9]',weaponsStart);
assert.ok(weaponsStart>=0&&weaponsEnd>weaponsStart);
const weapons=vm.runInNewContext(combat.slice(weaponsStart,weaponsEnd)+'\nWEAPONS');

const attachStart=code.indexOf('const ATTACH_MOD = {');
const attachEnd=code.indexOf('(function(){\n  const $ = id => document.getElementById(id);',attachStart);
assert.ok(attachStart>=0&&attachEnd>attachStart);
const model=vm.runInNewContext(code.slice(attachStart,attachEnd)+
  '\n({ATTACH_MOD,bestAttachmentPreset,attachmentChoicesFor,compensatorFor})');
const {ATTACH_MOD,bestAttachmentPreset,attachmentChoicesFor,compensatorFor}=model;

function modelScore(w,parts,focus){
  const m=parts.muzzle==='compensator'
    ? compensatorFor(w):ATTACH_MOD.muzzle[parts.muzzle];
  const g=ATTACH_MOD.grip[parts.grip],s=ATTACH_MOD.stock[parts.stock];
  assert.ok(m&&g&&s,'recognized modifiers for '+w.name);
  const vertical=-(m.v+g.v+s.v),horizontal=-(m.h+g.h+s.h);
  const recovery=(ATTACH_MOD.muzzle[parts.muzzle].recov||0)+(g.recov||0)+(s.recov||0);
  if(focus==='vertical')return vertical*1000+horizontal+recovery*.01;
  if(focus==='horizontal')return horizontal*1000+vertical+recovery*.01;
  return (vertical+horizontal)*100-Math.abs(vertical-horizontal)*25+recovery;
}

test('all 45 registered weapons have legal, globally model-optimal presets for each focus',()=>{
  assert.equal(weapons.length,45,'update the coverage expectation when the catalog changes');
  for(const w of weapons){
    for(const focus of ['vertical','horizontal','balanced']){
      const options={};
      for(const group of ['muzzle','grip','stock']){
        options[group]=Array.from(attachmentChoicesFor(w,group));
        assert.ok(options[group].length>0,w.name+' '+group+' must have a none option');
      }
      const selected=bestAttachmentPreset(w,focus);
      for(const group of ['muzzle','grip','stock'])
        assert.ok(options[group].includes(selected[group]),w.name+' selected invalid '+group);
      const selectedScore=modelScore(w,selected,focus);
      let maximum=-Infinity;
      for(const muzzle of options.muzzle)
        for(const grip of options.grip)
          for(const stock of options.stock)
            maximum=Math.max(maximum,modelScore(w,{muzzle,grip,stock},focus));
      assert.ok(Math.abs(selectedScore-maximum)<1e-8,
        w.name+' '+focus+' preset is not optimal within the additive model');
    }
  }
});
test('2026 published grip changes remain separate from unsupported physical interactions',()=>{
  assert.equal(ATTACH_MOD.grip.half.h,-.16,'Update 41.1 Half Grip horizontal control');
  assert.equal(ATTACH_MOD.grip.tilted.v,-.12,'Tilted Grip vertical control');
  assert.equal(ATTACH_MOD.grip.tilted.h,-.06,'Tilted Grip horizontal control');
  assert.equal(ATTACH_MOD.grip.tilted.shake,-.25,'camera-shake term is recorded separately');
  assert.match(code,/These are model scores, not an exact physical spray simulation/);
});
