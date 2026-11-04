// Neutral mannequin/overlay invariants. Arithmetic source and controls must be untouched.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const markup=read('src/explorer/hit-zone-explorer.fragment.html');
const live=read('index.html');
const css=read('src/explorer/hit-zone-explorer.scaffold.css');
const asset=path.join(root,'assets/damage-training-mannequin.svg');
test('neutral vector model has the intended geometry and no photographic or remote layers',()=>{
  const svg=fs.readFileSync(asset,'utf8');
  assert.match(svg,/width="500" height="750" viewBox="0 0 500 750"/);
  assert.equal((svg.match(/data-region="/g)||[]).length,13);
  assert.doesNotMatch(svg,/<image|<script|<foreignObject|https?:\/\/(?!www\.w3\.org)/);
  assert.ok(Buffer.byteLength(svg)<20000);
});
test('neutral mannequin is beneath all 13 focusable hit zone paths in both sources',()=>{
  assert.equal(live.match(/<svg id="hz_body"[\s\S]*?<\/svg>/)[0],markup.match(/<svg id="hz_body"[\s\S]*?<\/svg>/)[0],'Model 2 geometry must match the canonical fragment');
  const photo=markup.indexOf('class="hz-model"');
  const region=markup.indexOf('data-hit-zone="head"');
  assert.ok(photo>0&&region>photo);
  assert.match(markup,/href="\/assets\/damage-training-mannequin\.svg"/);
  assert.equal((markup.match(/data-hit-zone="/g)||[]).length,13);
  assert.equal((markup.match(/data-hz-value="/g)||[]).length,13);
  assert.match(css,/\.hz-model \{ pointer-events:none/);
  assert.equal((markup.match(/data-armour="(?:helmet|vest)"/g)||[]).length,2);
});
