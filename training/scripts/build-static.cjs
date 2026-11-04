// Assemble maintainable source sections into two plain scripts committed for
// Vercel static hosting. No package manager or runtime build is required.
// Usage: node scripts/build-static.cjs [--check]
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const bundles=[
  {output:'js/combat-database.js',parts:[
    'src/combat/00-weapon-data-armor.part',
    'src/combat/10-combat-rendering.part'
  ]},
  {output:'js/toolkit-calculators.js',parts:[
    'src/calculators/00-damage-ballistics.part',
    'src/calculators/10-effective-range.part',
    'src/calculators/20-ttk.part',
    'src/calculators/30-recoil-evidence.part',
    'src/calculators/40-attachments.part',
    'src/calculators/45-hit-zone-explorer.part',
    'src/calculators/50-backpack.part'
  ]}
];
function assemble(parts){
  return parts.map(part=>fs.readFileSync(path.join(root,part),'utf8')).join('');
}
function buildAll(check){
  for(const {output,parts} of bundles){
    const generated=assemble(parts),dest=path.join(root,output);
    if(check){
      if(fs.readFileSync(dest,'utf8')!==generated)throw Error(output+' is out of date. Run: node scripts/build-static.cjs');
    }else fs.writeFileSync(dest,generated,'utf8');
  }
}
if(require.main===module)buildAll(process.argv.includes('--check'));
module.exports={bundles,assemble,buildAll};
