// Visual library standards: every committed image is declared, local, within budget,
// and clear about origin/accessibility. No npm dependencies or network requests.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/visual-manifest.json'),'utf8'));
const panelIds=['panel-sensitivity','panel-combat','panel-hit-zone','panel-range','panel-ttk','panel-recoil2','panel-attach','panel-backpack'];
const roles=['icon','thumbnail','hero'];
const allowedOrigin=['original-generated','original-designed','licensed','official-redistribution-allowed','publisher-fan-content'];
test('manifest describes all shipped image assets and a bounded budget',()=>{
 assert.equal(manifest.schemaVersion,1);
 assert.ok(Array.isArray(manifest.assets));
 assert.ok(manifest.assets.length>=1);
 const ids=new Set(),paths=new Set();
 const listed=new Set();
 let total=0;
 for(const entry of manifest.assets){
  assert.ok(entry.id&&typeof entry.id==='string');
  assert.ok(!ids.has(entry.id),'duplicate image ID: '+entry.id);ids.add(entry.id);
  assert.match(entry.path,/^assets\/[a-z0-9][a-z0-9._-]*\.(webp|avif|png|svg)$/);
  assert.ok(!paths.has(entry.path),'duplicate path: '+entry.path);paths.add(entry.path);
  const ext=path.extname(entry.path).slice(1);
  assert.ok(manifest.rules.allowedExtensions.includes(ext));
  assert.ok(panelIds.includes(entry.panelId),'unknown panel for '+entry.id);
  assert.ok(roles.includes(entry.role));
  assert.ok(allowedOrigin.includes(entry.origin),'image rights missing: '+entry.id);
  assert.ok(typeof entry.rightsNote==='string'&&entry.rightsNote.trim().length>=15);
  if(entry.origin==='publisher-fan-content'){
   assert.match(entry.sourceUrl,/^https:\/\/(wstatic-prod\.pubg\.com\/|raw\.githubusercontent\.com\/pubg\/api-assets\/[a-f0-9]{40}\/)/);
   assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);
  }
  assert.ok(typeof entry.usage==='string'&&entry.usage.trim());
  assert.ok(Number.isInteger(entry.width)&&entry.width>0&&Number.isInteger(entry.height)&&entry.height>0);
  assert.equal(typeof entry.decorative,'boolean');
  assert.equal(typeof entry.alt,'string');
  if(entry.decorative)assert.equal(entry.alt,'','decorative artwork must have empty alt text');
  else assert.ok(entry.alt.trim().length>=5,'informative images need meaningful alt text');
  const absolute=path.join(root,entry.path);
  assert.ok(fs.existsSync(absolute),'missing registered image: '+entry.path);
  const bytes=fs.readFileSync(absolute);
  assert.ok(bytes.length>50,'suspiciously small image: '+entry.path);
  assert.ok(bytes.length<=manifest.budget.maxBytesByRole[entry.role],
   'oversized '+entry.role+': '+entry.path);
  if(ext==='webp'){
   assert.equal(bytes.subarray(0,4).toString(),'RIFF','invalid RIFF '+entry.path);
   assert.equal(bytes.subarray(8,12).toString(),'WEBP','invalid WebP '+entry.path);
  }
  if(ext==='svg'){
   const svg=bytes.toString('utf8');
   assert.match(svg,/^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.doesNotMatch(svg,/<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["']https?:/i,'SVG must contain no executable or remote resources');
  }
  total+=bytes.length;
  listed.add(path.basename(entry.path));
 }
 assert.ok(total<=manifest.budget.maxTotalImageBytes,'total media budget exceeded');
 const onDisk=fs.readdirSync(path.join(root,'assets'))
   .filter(name=>/\.(webp|avif|png|svg)$/i.test(name));
 assert.deepEqual([...onDisk].sort(),[...listed].sort(),'asset not registered (or missing) in visual-manifest.json');
});
test('interactive map uses the requested neutral mannequin with all thirteen regions',()=>{
 const item=manifest.assets.find(a=>a.id==='damage-training-mannequin');
 assert.ok(item&&item.panelId==='panel-hit-zone');
 assert.deepEqual([item.width,item.height],[500,750]);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('href="/assets/damage-training-mannequin.svg"'));
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
});
test('visual roadmap retains complete tool coverage and release/approval provenance',()=>{
 const doc=fs.readFileSync(path.join(root,'VISUAL_UPGRADE_ROADMAP.md'),'utf8');
 for(const heading of ['Scope Sensitivity Matcher','Combat DB','Effective Range','TTK Calculator',
   'Recoil Analyzer','Attachments','Tactical Loadout','Vercel']){
  assert.ok(doc.includes(heading),'roadmap missing '+heading);
 }
 const hasPreReleaseGate=doc.includes('No merge to main before this');
 const hasAuditedRelease=doc.includes('## Release record — 2026-10-26')
  && doc.includes('d54ac7cb4ba83113a54f9a6a989581c4340b7aed')
  && doc.includes('Release approval:')
  && doc.includes('Physical');
 assert.ok(hasPreReleaseGate||hasAuditedRelease,
  'Require a protected preview gate before launch, or a release record with owner authorisation and physical-device follow-ups');

});
