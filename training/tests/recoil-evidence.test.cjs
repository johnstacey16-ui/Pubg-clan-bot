// The Recoil Evidence Explorer must never fabricate 5%-per-shot recoil.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {Script,runInNewContext} = require('node:vm');

const html = require('./toolkit-test-source.cjs')();
const start = html.indexOf('/* ================= 3. RECOIL EVIDENCE EXPLORER ================= */');
const end = html.indexOf('/* ================= 4. ATTACHMENTS & RECOIL ================= */', start);
const recoil = html.slice(start,end);

test('per-shot tools and existing parameters are available without a release blocker',()=>{
 assert.match(html,/<h1>Per-Shot Recoil Analyzer<\/h1>/);
 assert.match(html,/id="rc_sim_canvas"/);assert.match(html,/id="rc_stage_table"/);
 assert.doesNotMatch(html,/recoil-coming-soon/);
});

test('retire unsupported recoil growth and assumed prone multipliers',()=>{
  assert.ok(start>=0 && end>start,'Recoil evidence source section exists');
  assert.doesNotThrow(()=>new Script(recoil));
  assert.doesNotMatch(recoil,/0\.05|5%\s*\/\s*shot|PRONE_EXTRA|seededNoise|Math\.random|cumV|cumH|Math\.sin/);
  assert.match(html,/simulated positions in curve units/);
  assert.doesNotMatch(html, /<div class="recoil-source-list">/);
  assert.match(html,/Weapon recoil parameters/);
});

function node(id,value=''){
  return {
    id,value,events:{},attributes:{},children:{},
    textContent:'',innerHTML:'',
    addEventListener(k,v){this.events[k]=v},
    setAttribute(k,v){this.attributes[k]=v},
    querySelector(tag){return this.children[tag]||null}
  };
}

test('existing parameter rendering remains independent of spray length',()=>{
  const objects = {
    rc_weapon:node('rc_weapon','AKM'),
    rc_stance:node('rc_stance','standing'),
    rc_shots:node('rc_shots','20'),
    rc_missing:node('rc_missing'),
    rc_table:node('rc_table'),
    rc_chart:node('rc_chart')
  };
  objects.rc_chart.children.strong=node('strong');
  const document={getElementById(id){
    assert.ok(objects[id], 'Expected input '+id);
    return objects[id];
  }};
  const PT={
    WBYNAME:{
      AKM:{name:'AKM',vRecoil:8,vertSpeed:15,horizSpeed:9.5,minH:42,hBiasDir:'←',hBiasVal:.2,crouchMod:.84},
      G18C:{name:'G18C',vRecoil:null,vertSpeed:null,horizSpeed:null,minH:null,hBiasVal:null,crouchMod:null}
    }
  };
  runInNewContext(recoil,{document,PT,fillWeaponSelect(sel){sel.value='AKM'}});

  for(const count of [10,20,30]){
    objects.rc_shots.value=String(count);
    objects.rc_shots.events.change();
    assert.match(objects.rc_table.innerHTML,/Maximum vertical recoil/);
    assert.doesNotMatch(objects.rc_table.innerHTML,/<td>10<\/td><td>\d/);
    assert.match(objects.rc_table.innerHTML,/<th>Value<\/th>/);
  }
  objects.rc_weapon.value='G18C';
  objects.rc_weapon.events.change();
  assert.match(objects.rc_table.innerHTML,/No data/);
  assert.doesNotMatch(objects.rc_table.innerHTML,/NaN|undefined/);
  objects.rc_stance.value='prone';
  objects.rc_stance.events.change();
  assert.match(objects.rc_table.innerHTML,/No data/);
});

test('existing toolkit panels and script structure remain intact',()=>{
  for(const id of ['panel-combat','panel-sensitivity','panel-range','panel-ttk','panel-recoil2','panel-attach' ,'panel-backpack']){
    assert.ok(html.includes('id="'+id+'" class="'));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
  assert.equal(scripts.length,5);
  scripts.forEach(code=>assert.doesNotThrow(()=>new Script(code)));
});
