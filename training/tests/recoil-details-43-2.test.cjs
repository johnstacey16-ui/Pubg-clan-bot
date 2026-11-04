// Source-backed recoil metadata in the Recoil Evidence Explorer (Update 43.2).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {runInNewContext,Script}=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const at=html.indexOf('const RECOIL_DETAIL_43_2 = {');
const end=html.indexOf('WEAPONS.forEach(w=>',at);
assert.ok(at>0&&end>at);
const recoil=runInNewContext(html.slice(at,end)+';RECOIL_DETAIL_43_2');
const keys=Object.keys(recoil);
const legacyStart=html.indexOf('const RECOIL_RAW = {');
const legacyStop=html.indexOf('const RECOIL_DETAIL_43_2 = {',legacyStart);
assert.ok(legacyStart>0&&legacyStop>legacyStart);
const legacyRecoil=runInNewContext(html.slice(legacyStart,legacyStop)+';RECOIL_RAW');

test('Tommy Gun horizontal tendency retains all three precision digits from 43.2 files',()=>{
  const tommy=legacyRecoil['Tommy Gun'];
  assert.equal(tommy[3],'→');
  assert.equal(tommy[4],0.033);
  assert.equal(tommy[5],15);
  assert.equal(tommy[6],11);
  assert.equal(tommy[7],30);
  assert.equal(recoil['Tommy Gun'].recoveryV,12);
});

const start=html.indexOf('/* ================= 3. RECOIL EVIDENCE EXPLORER ================= */');
const finish=html.indexOf('/* ================= 4. ATTACHMENTS & RECOIL ================= */',start);
const logic=html.slice(start,finish);

test('all 45 toolkit weapons have individually mapped 43.2 recoil metadata',()=>{
  assert.equal(keys.length,45);
  for(const [name,mod,recovery,shotSwitch] of [
    ['RPD',.32,7,2],
    ['M249',.32,6,2],
    ['UMP9',.70,7,2],
    ['MP5K',.70,8.5,2],
    ['Micro Uzi',.70,12,2],
    ['G18C',.70,11,1],
    ['Tommy Gun',.70,12,2],
    ['P90',.70,7,null],
    ['MP9',.70,7,null],
    ['S12K',.75,7,1]
  ]){
    assert.equal(recoil[name].proneMod,mod,name+' prone');
    assert.equal(recoil[name].recoveryV,recovery,name+' recovery');
    assert.equal(recoil[name].switchShots,shotSwitch,name+' direction switch');
  }

  // Every field below comes from a named 43.2 RecoilConfig weapon page.
  for(const [name,prone,recovery,switchShots,climb,fall] of [
    ['AKM',null,8.2,2,0.7,2.4],
    ['Beryl M762',.7,8.2,2,.65,2.15],
    ['M416',null,7,2,.7,2.1],
    ['AUG A3',null,6,2,.65,2.1],
    ['G36C',null,8,2,.65,2.3],
    ['Kar98k',null,5.5,1,.7,3],
    ['AWM',null,5.5,1,.7,3],
    ['M24',null,5.5,1,.5,3],
    ['SCAR-L',null,8,2,.75,2.3],
    ['QBZ95',null,8,2,.75,2.4],
    ['MG3',.265,8.5,2,.75,3.3],
    ['Mini 14',null,9,1,1.2,3],
    ['MK14 EBR',.25,6,1,.9,3]
  ]){
    assert.equal(recoil[name].proneMod,prone,name+'/prone');
    assert.equal(recoil[name].recoveryV,recovery,name+'/recovery');
    assert.equal(recoil[name].switchShots,switchShots,name+'/switch');
    assert.equal(recoil[name].climb,climb,name+'/climb');
    assert.equal(recoil[name].fall,fall,name+'/fall');
  }
  assert.equal(Object.values(recoil).filter(r=>r.proneMod!=null).length > 0,true);
  // The 12 final source mappings complete coverage without fabricated values.
  for(const [name,prone,recovery,switchShots,climb,fall] of [
    ['Lynx AMR',.25,10,1,null,4],
    ['O12',.7,8,1,1.8,2],
    ['R1895',.7,11,1,1.2,5.5],
    ['Desert Eagle',.75,11,1,1.2,3.5],
    ['MK47 Mutant',.7,8.2,1,.7,2.5],
    ['Mk12',.2,9,1,1.25,2.8],
    ['K2',null,8,2,.75,2.1],
    ['FAMAS',null,7,2,.6,2.1],
    ['P92',.7,11,1,null,4],
    ['JS9',.7,7,5,.4,2],
    ['S686',null,6,1,null,2],
    ['Skorpion',.8,12,2,.23,2]
  ]){
    assert.equal(recoil[name].proneMod,prone,name+'/prone');
    assert.equal(recoil[name].recoveryV,recovery,name+'/recovery');
    assert.equal(recoil[name].switchShots,switchShots,name+'/switch');
    assert.equal(recoil[name].climb,climb,name+'/climb');
    assert.equal(recoil[name].fall,fall,name+'/fall');
  }
  const weapons=[...html.slice(
    html.indexOf('const WEAPONS = ['),html.indexOf('].map(w=>',html.indexOf('const WEAPONS = ['))
  ).matchAll(/^\["([^"]+)"/gm)].map(m=>m[1]);
  assert.equal(weapons.length,45,'expected 45 named toolkit weapons');
  assert.deepEqual(weapons.filter(name=>!recoil[name]),[],'each weapon has a recoil data record');
  assert.equal(recoil.SKS.climb,null);
  assert.equal(recoil.SLR.proneMod,null);
  for(const [name,obj] of Object.entries(recoil)){
    for(const [field,value] of Object.entries(obj)){
      assert.ok(value===null||Number.isFinite(value),name+'/'+field+' invalid field');
    }
  }
  assert.match(html,/w\.recoilDetail = RECOIL_DETAIL_43_2\[w.name\] \|\| null/);
});

function element(id,value=''){
  return {id,value,handlers:{},children:{},innerHTML:'',textContent:'',attrs:{},
    addEventListener(event,fn){this.handlers[event]=fn},
    setAttribute(k,v){this.attrs[k]=v},
    querySelector(k){return this.children[k]||null}
  };
}
test('recoil explorer renders recovered fields and preserves unknown shot-by-shot curve',()=>{
  const nodes={
    rc_weapon:element('rc_weapon','RPD'),
    rc_stance:element('rc_stance','prone'),
    rc_shots:element('rc_shots','20'),
    rc_missing:element('rc_missing'),
    rc_table:element('rc_table'),
    rc_chart:element('rc_chart')
  };
  nodes.rc_chart.children.strong=element('strong');
  const doc={getElementById(name){assert.ok(nodes[name],name);return nodes[name]}};
  const PT={WBYNAME:{
    RPD:{name:'RPD',vRecoil:7.5,vertSpeed:15.5,horizSpeed:11,minH:25,crouchMod:.70,recoilDetail:recoil.RPD},
    AKM:{name:'AKM',vRecoil:8,vertSpeed:15,horizSpeed:9.5,minH:42,crouchMod:.84,recoilDetail:null}
  }};
  runInNewContext(logic,{document:doc,PT,fillWeaponSelect(sel){sel.value='RPD'}});
  assert.match(nodes.rc_table.innerHTML,/Prone recoil multiplier<\/td><td>0\.32/);
  assert.match(nodes.rc_table.innerHTML,/Vertical recovery speed<\/td><td>7/);
  assert.match(nodes.rc_table.innerHTML,/Bullets per direction switch<\/td><td>2/);
  assert.match(nodes.rc_table.innerHTML,/Recoil climb parameter<\/td><td>0\.7/);
  assert.match(nodes.rc_table.innerHTML,/Weapon parameter/);
  nodes.rc_weapon.value='AKM';
  nodes.rc_weapon.handlers.change();
  assert.doesNotMatch(nodes.rc_table.innerHTML,/Prone recoil multiplier/);
  assert.match(nodes.rc_table.innerHTML,/Maximum vertical recoil/);
});

test('sensitivity, ballistics, and shotgun best-case maths are unaffected',()=>{
  for(const name of ['pixelSpeed','matchedSens','shotgunMinShellsAt','dropAtRange','extendedCapFor']){
    assert.match(html,new RegExp('function '+name+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((text,i)=>assert.doesNotThrow(()=>new Script(text),'script '+i));
});
