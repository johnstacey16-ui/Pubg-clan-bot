'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Chrome smoke runner distinguishes completed DOM from failed/timed-out runs',()=>{
 const source=read('tests/browser-smoke.cjs');
 assert.match(source,/terminalDom && \/<body\[\^>\]\*data-smoke-status="pass"/);
 assert.match(source,/hardTimedOut/);
 assert.match(source,/SIGTERM/);
 assert.match(source,/SIGKILL/);
 assert.match(source,/finalResult\(\)/);
 assert.match(source,/stoppedAfterResult/);
});
test('source attribution and accessibility affordances are documented',()=>{
 const docs=read('VISUAL_ARTWORK_CREDITS.md'),html=read('index.html'),css=read('visual-assets.css');
 assert.match(docs,/unofficial fan toolkit; no endorsement is implied/);
 assert.match(docs,/45 database weapons have distinct, name-matched artwork/);
 assert.match(read('README.md'),/VISUAL_ARTWORK_CREDITS\.md/);
 assert.match(html,/id="visual-scope-label" aria-live="polite"/);
 assert.match(css,/@media\(prefers-contrast:more\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('layout suite now includes narrow Android phones and wide displays',()=>{
 const code=read('tests/visual-layout-smoke.cjs');
 assert.match(code,/\[320,360,390,768,1280,1440\]/);
});
