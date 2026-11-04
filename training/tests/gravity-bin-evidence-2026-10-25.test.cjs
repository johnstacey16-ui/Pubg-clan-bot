// Snapshot regression for WinnerMeta's directly published gravity estimates.
// They are 50m-bucket gravity estimates, not observed bullet impacts or holdovers.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/calculators/00-damage-ballistics.part'),'utf8');
const range=fs.readFileSync(path.join(root,'src/calculators/10-effective-range.part'),'utf8');
const from=core.indexOf('const DROP_TABLES = {');
const to=core.indexOf("const MEASURED_MUZZLE_VEL =",from);
assert.ok(from>=0&&to>from);
const DROP_TABLES=vm.runInNewContext(core.slice(from,to)+'\nDROP_TABLES');
const expected={
  'RPD':[[0,0],[200,45.9],[400,203.2]],
  'ACE 32':[[0,0],[200,58.7],[400,317.1]],
  'M16A4':[[0,0],[200,35.2],[400,177]],
  'MK14 EBR':[[0,0],[200,35.2],[400,158.6]],
  'SVD Dragunov':[[0,0],[200,44.1],[400,183.5],[600,512.8]],
  'MK47 Mutant':[[0,0],[200,54.7],[400,265.4]],
  'P90':[[0,0],[200,66.4]],
  'MP5K':[[0,0],[200,219.3]],
  'FAMAS':[[0,0],[200,34.9]]
};
test('nine source-backed 50m-bin tables complete 30/45 gravity-estimate coverage',()=>{
  assert.equal(Object.keys(DROP_TABLES).length,30);
  for(const [name,rows] of Object.entries(expected))
    assert.deepEqual(Array.from(DROP_TABLES[name],r=>Array.from(r)),rows,name);
});
test('no interpolated data, no exact-distance or scope-holdover claim',()=>{
  assert.match(core,/BUCKET STARTS, not exact-distance measurements/);
  assert.ok(range.includes('const effectiveRange=range>0 ? range+25 : 0'));
  assert.match(range,/Telemetry-derived gravity estimate for the /);
  assert.match(range,/not scope holdover/);
  assert.match(range,/No gravity-drop estimates for this weapon/);
});
