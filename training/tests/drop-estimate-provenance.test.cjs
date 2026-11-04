// WinnerMeta drop checkpoints are telemetry-derived gravity estimates, not impact measurements.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=fs.readFileSync(path.join(root,'src/calculators/00-damage-ballistics.part'),'utf8');
const range=fs.readFileSync(path.join(root,'src/calculators/10-effective-range.part'),'utf8');
test('gravity estimates are never labeled observed impacts or sight corrections',()=>{
  assert.match(html,/Estimated gravity displacement \(cm\)/);
  assert.match(html,/Estimated gravity drop at this range/);
  assert.doesNotMatch(html,/Drop below aim point \(cm\)/);
  assert.match(range,/is not scope holdover/);
  assert.match(core,/not measured bullet impacts/);
  assert.match(range,/No gravity-drop estimates for this weapon/);
});
