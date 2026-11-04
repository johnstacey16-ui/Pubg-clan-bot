// Sidebar structure should remain uniform and valid HTML; avoid malformed
// navigation buttons that browser error-recovery renders differently.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=require('./toolkit-test-source.cjs')();
const css=fs.readFileSync(path.join(__dirname,'../app-shell.css'),'utf8');
const nav=html.slice(html.indexOf('<nav id="app-toolnav"'),html.indexOf('</nav>',html.indexOf('<nav id="app-toolnav"'))+6);
const expected=['panel-sensitivity','panel-combat','panel-hit-zone','panel-recoil2','panel-attach','panel-backpack'];

test('all eight tool links live in one continuous sidebar group',()=>{
  assert.equal((nav.match(/class="nav-tool-group"/g)||[]).length,1,'Exactly one navigation group');
  assert.match(nav,/<div class="nav-group-label"><span>01<\/span>ALL TOOLS<\/div>/);
  assert.doesNotMatch(nav,/GEAR &amp; LOADOUT|<span>02<\/span>/);
  assert.deepEqual([...nav.matchAll(/data-open-panel="([^"]+)"/g)].map(x=>x[1]),expected);
  assert.equal((nav.match(/<\/button>/g)||[]).length,6);
});

test('every tool has a well-formed button with the exact same icon and label structure',()=>{
  const buttons=[...nav.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length,6);
  for(let i=0;i<buttons.length;i++){
    const [,attrs,inside]=buttons[i];
    assert.doesNotMatch(attrs,/<|>/,'Button '+i+' has malformed opening markup');
    assert.match(attrs,/class="nav-tool(?: active)?"/);
    assert.match(attrs,/type="button"/);
    assert.match(attrs,new RegExp('data-open-panel="'+expected[i]+'"'));
    assert.match(attrs,new RegExp('aria-controls="'+expected[i]+'"'));
    assert.match(inside,/^(\s*)<span class="nav-tool-icon"><svg class="nav-tool-svg"/);
    assert.match(inside,/<\/svg><\/span>/);
    assert.match(inside,/<span class="nav-tool-name">[^<]+<\/span>/);
    assert.match(inside,/<svg class="nav-tool-chevron"/);
  }
  assert.match(buttons[0][1],/aria-current="page"/);
  assert.doesNotMatch(buttons[1][1],/aria-current="page"/);
});

test('icons and tap targets share common CSS rather than tool-specific overrides',()=>{
  assert.match(css,/#app-toolnav \.nav-tool-icon\s*\{\s*display:\s*grid;/);
  assert.match(css,/#app-toolnav \.nav-tool-svg\s*\{\s*display:\s*block;/);
  assert.match(css,/#app-toolnav \.nav-tool\s*\{\s*min-height:\s*52px;/);
  assert.doesNotMatch(css,/#app-toolnav \[data-open-panel="panel-combat"\]\s+\.nav-tool-icon\s*\{/);
});

test('home, current tool indices and every calculator remain intact',()=>{
  assert.match(html,/<div id="panel-sensitivity" class="hub-main active">/);
  assert.match(html,/<div id="panel-combat" class="hub-main">/);
  assert.match(html,/id="active-tool-heading" tabindex="-1">Sensitivity Studio/);
  for(const f of ['pixelSpeed','matchedSens','finalDamageAt','shotgunMinShellsAt','htkFor','pureTtk']){
    assert.match(html,new RegExp('function '+f+'\\('));
  }
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.equal(scripts.length,5);
  scripts.forEach((js,i)=>assert.doesNotThrow(()=>new vm.Script(js),'Script '+i));
});
