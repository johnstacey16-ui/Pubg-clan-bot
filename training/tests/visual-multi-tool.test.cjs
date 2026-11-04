// Independent presentation-only visual asset checks.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8'),html=read('index.html');
test('all six newly illustrated tool surfaces exist',()=>{
 for(const id of ['visual-scope-image','visual-attachment-grid','visual-pack-label','visual-range','visual-ttk','visual-recoil'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.equal((html.match(/data-hit-zone="/g)||[]).length,13);
 assert.ok(html.includes('href="/assets/damage-training-mannequin.svg"'));
});
test('art mapping never writes gameplay data',()=>{
 const src=read('visual-controls.js');assert.doesNotThrow(()=>new vm.Script(src));
 for(const name of ['optic-1x.svg','optic-2x.svg','optic-3x.svg','optic-4x.svg','optic-6x.svg','optic-8x.svg','optic-15x.svg'])assert.ok(src.includes(name),name);
 assert.doesNotMatch(src,/pixelSpeed\s*=|matchedSens\s*=|finalDamageAt\s*=|pureTtk\s*=/);
 const matches=[...html.matchAll(/<img\b[^>]*src="assets\/[^"]+"[^>]*>/g)];
 assert.ok(matches.length>=12);
 for(const [tag] of matches){assert.match(tag,/width="\d+"/);assert.match(tag,/height="\d+"/);assert.match(tag,/alt="[^"]+"/);}
});
