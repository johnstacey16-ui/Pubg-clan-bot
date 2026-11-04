'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
function verify(){
 const main=read('index.html'),toolkit=read('training/index.html');
 const source=read('training/SOURCE.md');
 const v=JSON.parse(read('vercel.json'));
 assert.match(main,/href="\/#panel-sensitivity"/);
 assert.match(main,/Open Sensitivity Studio/);
 assert.match(toolkit,/data-open-panel="panel-clan"/);
 assert.match(toolkit,/Back to Toolkit/);
 assert.match(toolkit,/clan-dashboard-scoped\.css/);
 assert.match(toolkit,/\/training\/assets\/damage-training-mannequin\.svg/);
 assert.doesNotMatch(toolkit,/<iframe\b/);
 assert.match(source,/a836606c896069b342fe9a1dbf3fb05934284342/);
 assert.equal(v.routes.find(r=>r.src==='/')?.dest,'/training/index.html');
 assert.equal(v.routes.find(r=>r.src==='/dashboard/')?.dest,'/training/index.html');
 assert.ok(v.builds.some(b=>b.src==='training/**'&&b.use==='@vercel/static'));
 assert.ok(v.routes.some(r=>r.src==='/training/'&&r.dest==='/training/index.html'));
 assert.ok(v.routes.some(r=>r.src==='/training/(.*)'&&r.dest==='/training/$1'));
 const required=[
  'training/js/app-navigation.js','training/js/combat-database.js',
  'training/js/sensitivity.js','training/js/toolkit-calculators.js',
  'training/scripts/build-static.cjs','training/assets/visual-manifest.json',
  'training/visual-assets.css','training/DATA_ACCURACY_POLICY.md',
  'training/VISUAL_ARTWORK_CREDITS.md','training/tests/browser-smoke.cjs',
  'training/assets/damage-training-mannequin.svg'
 ];
 for(const file of required)assert.ok(exists(file),'Missing toolkit file: '+file);
 const apis=fs.readdirSync(path.join(root,'api')).filter(n=>n.endsWith('.js'));
 assert.ok(apis.length<=12,'Vercel Hobby API function ceiling exceeded');
 console.log('Complete HELP training snapshot integrated; API functions:',apis.length);
}
if(require.main===module)verify();
module.exports={verify};
