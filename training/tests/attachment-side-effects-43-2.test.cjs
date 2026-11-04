const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','src/calculators/40-attachments.part'),'utf8');
test('secondary attachment tooltips are disclosed without invented spray physics',()=>{
  for(const s of [
    'Half Grip carries a -10% sway-control trade-off',
    'Lightweight Grip also improves initial-shot recoil control by 30%',
    'Thumbgrip also gives +40% ADS speed',
    'Laser Sight improves hip-fire accuracy by 30%',
    'Tilted Grip also improves camera-shake control by 25%',
    'Muzzle Brake also improves camera-shake control by 35%',
    'Choke tightens pellet spread by 13%',
    'Duckbill tightens vertical pellet spread by 50%',
    'Heavy Stock trades -10% ADS speed',
    'Tactical Stock also gives +10% ADS speed'
  ])assert.ok(code.includes(s),s);
  assert.match(code,/bestAttachmentPreset\(w,focus\)/);
  assert.match(code,/combined reductions and suggested setups remain a simplified model/);
});
