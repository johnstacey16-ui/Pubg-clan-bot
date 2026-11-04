'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Scope controls render without a delayed opacity fade',()=>{
 const css=read('visual-assets.css');
 assert.match(css,/#panel-sensitivity \.panel\.active\s*\{\s*animation:\s*none;\s*opacity:\s*1;/);
 const smoke=read('tests/browser-smoke.html');
 assert.match(smoke,/Scope controls have full opacity immediately/);
 assert.match(smoke,/Scope controls never fade to unreadable opacity/);
});
