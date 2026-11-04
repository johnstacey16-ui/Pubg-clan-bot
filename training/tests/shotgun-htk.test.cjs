// Test best-case shotgun shell counts from actual published checkpoints,
// without pretending the number of pellets connecting is known.
// Run: node --test tests/*.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const vm=require('node:vm');

const html=require('./toolkit-test-source.cjs')();
function section(a,b){
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i, 'Missing source boundaries: '+a+' -> '+b);
  return html.slice(i,j);
}
const source=[
  section('const BODY_PARTS = {','// Real per-weapon falloff tables'),
  section('const FALLOFF_TABLES = {','// Bullet drop, sourced'),
  section('const SHOTGUN_PELLETS = {','// PUBG\'s 2026 Dev Letter')
].join('\n');
const context=vm.createContext({});
vm.runInContext(source+
  '\nthis.model={SHOTGUN_PELLETS,PELLET_FALLOFF,BODY_PARTS,shotgunMinShellsAt};',
  context);
const {SHOTGUN_PELLETS,PELLET_FALLOFF,BODY_PARTS,shotgunMinShellsAt}=context.model;
const w=name=>({name,cls:'SG'});

test('per-shell pellet counts use 9, consistent with official shotgun patch notes',()=>{
  for(const name of ['DBS','S686','S12K','Sawn-off']){
    assert.equal(SHOTGUN_PELLETS[name].count,9,name+' count');
  }
});

test('best-case shotgun HTK exists only at recorded weapon-specific distances',()=>{
  for(const [name,last] of [['DBS',70],['S686',80],['S12K',70],['Sawn-off',50]]){
    const rows=PELLET_FALLOFF[name];
    assert.equal(rows.at(-1)[0],last);
    for(const [metres] of rows){
      for(const hitbox of ['head','chest','limb']){
        for(const armor of [0,1,2,3]){
          const min=shotgunMinShellsAt(w(name),metres,hitbox,armor);
          assert.ok(Number.isInteger(min)&&min>=1,name+' '+metres+'m '+hitbox+' L'+armor);
        }
      }
    }
    assert.equal(shotgunMinShellsAt(w(name),last+1,'chest',0),null,name+' beyond limit');
    assert.equal(shotgunMinShellsAt(w(name),999,'chest',0),null,name+' absurd range');
    assert.equal(shotgunMinShellsAt(w(name),null,'chest',0),null,name+' invalid range');
    assert.equal(shotgunMinShellsAt(w(name),-1,'chest',0),null,name+' before first point');
    const samples=rows.map(row=>row[0]);
    for(let r=1;r<samples.length;r++){
      const mid=(samples[r-1]+samples[r])/2;
      assert.equal(shotgunMinShellsAt(w(name),mid,'chest',0),null,name+' unsampled '+mid+'m');
    }
  }
});

test('measured per-pellet damage drives full-hit HTK; armour and hitbox affect it',()=>{
  // 80m S686 sample = 6.9 per pellet, 9 pellets, chest hit area 1.1,
  // shotgun torso multiplier 0.9, Level-3 vest damage pass-through 0.45.
  const perPellet=6.9;
  const fullConnection=perPellet*9*BODY_PARTS.chest.hitArea*0.9*0.45;
  assert.equal(shotgunMinShellsAt(w('S686'),80,'chest',3),Math.ceil(100/fullConnection));
  assert.equal(shotgunMinShellsAt(w('S686'),80,'chest',0),
    Math.ceil(100/(perPellet*9*BODY_PARTS.chest.hitArea*0.9)));
  assert.ok(shotgunMinShellsAt(w('S686'),80,'chest',3)>=
            shotgunMinShellsAt(w('S686'),80,'chest',0));
  assert.notEqual(shotgunMinShellsAt(w('DBS'),0,'head',0),null);
});

test('range and point-blank TTK screens label the best-case condition and keep TTK unknown',()=>{
  assert.match(html,/id="rg_htkLabel"/);
  assert.match(html,/id="tk_htkLabel"/);
  assert.match(html,/Minimum shells \(all pellets hit\)/);
  assert.match(html,/Actual shots may need more/);
  assert.match(html,/shotgunMinShellsAt\(w,range,hitbox,armor\)/);
  assert.match(html,/shotgunMinShellsAt\(w,Number\(\$\("tk_distance"\)\.value\),hitbox,armor\)/);
  assert.match(html,/const ttk = pellet \? null : pureTtk/);
  assert.match(html,/pure:null,withReload:null,reloads:null,bestCase:true/);
  assert.match(html,/HTK \(SG: minimum\)/);
  assert.match(html,/rows\.map\(\(\[range\]\)=>\{/);
  assert.match(html,/shotgunMinShellsAt\(w,range,hitbox,armor\)/);
  assert.match(html,/Unknown|unavailable|No data/i);
});

test('original inline scripts and weapon database still parse',()=>{
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((code,i)=>assert.doesNotThrow(()=>new vm.Script(code),'script '+i));
  assert.match(html,/id="wTable"/);
  assert.match(html,/src="sticky-weapon-header\.js" defer/);
});
