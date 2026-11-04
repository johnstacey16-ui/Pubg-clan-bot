'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Combat weapon table has an accessible horizontal-scroll region without artwork',()=>{
 const src=read('src/combat/10-combat-rendering.part');
 assert.match(src,/id="combat-stats-scroller" role="region" tabindex="0"/);
 assert.match(src,/aria-label="Scrollable weapon statistics"/);
 assert.match(src,/aria-describedby="combat-table-instructions"/);
 assert.match(src,/swipe sideways for more stats/);
 assert.doesNotMatch(src,/visual-weapon-thumb|combat-pilot-image/);
 assert.match(src,/class="combat-weapon-cell"/);
 const bundled=read('js/combat-database.js');
 assert.equal(bundled,read('src/combat/00-weapon-data-armor.part')+src);
});
test('small-screen horizontal weapon scroll retains sticky weapon name and visible focus',()=>{
 const styles=read('visual-assets.css');
 assert.match(styles,/#panel-combat \.combat-stats-scroller:focus-visible/);
 assert.match(styles,/overscroll-behavior-x:contain/);
 assert.match(styles,/position:sticky;/);
 assert.match(read('tests/visual-layout.html'),/scrollRegion\.scrollLeft=130/);
 assert.equal((read('index.html').match(/data-hit-zone="/g)||[]).length,13);
});
