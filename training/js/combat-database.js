
// ---- Combat & Armor Intelligence logic ----
(function(){
 
/* ---------------- DATA ---------------- */
const WEAPONS = [
["Lynx AMR","SR",".50 Cal",true,118,86,1200,169,10,3.1,["Semi"]],
["AWM","SR",".300 Mag",true,105,32,945,56,5,3.7,["Bolt"]],
["O12","SG","12G Slug",false,100,480,625,800,30,2.3,["Semi","Burst","Auto"]],
["Kar98k","SR","7.62mm",false,79,39,760,51,5,2.0,["Bolt"]],
["M24","SR","7.62mm",false,75,42,790,53,5,3.7,["Bolt"]],
["R1895","Pistol","7.62mm",false,64,240,330,256,7,3.0,["Semi"]],
["Desert Eagle","Pistol",".45 ACP",false,62,300,450,310,7,2.0,["Semi"]],
["MK14 EBR","DMR","7.62mm",true,54,400,853,360,10,3.1,["Semi","Auto"]],
["SVD Dragunov","DMR","7.62mm",false,53,180,830,159,10,3.1,["Semi"]],
["MK47 Mutant","AR","7.62mm",false,49,800,780,653,20,3.1,["Semi","Burst"]],
["SLR","DMR","7.62mm",false,49,330,870,270,10,3.1,["Semi"]],
["AKM","AR","7.62mm",false,48,600,715,480,30,3.1,["Semi","Auto"]],
["Groza","AR","7.62mm",true,47,750,715,588,30,3.1,["Semi","Auto"]],
["SKS","DMR","7.62mm",false,47,330,800,259,10,3.1,["Semi"]],
["VSS Vintorez","DMR","9mm",false,45,700,430,525,10,3.1,["Semi","Auto"]],
["Beryl M762","AR","7.62mm",false,44,700,715,513,30,3.1,["Semi","Burst","Auto"]],
["M16A4","AR","5.56mm",false,43,800,900,573,30,2.5,["Semi","Burst"]],
["ACE 32","AR","7.62mm",false,43,680,720,487,30,3.1,["Semi","Auto"]],
["Mk12","DMR","5.56mm",false,43,330,900,237,10,2.5,["Semi"]],
["SCAR-L","AR","5.56mm",false,42,650,870,455,30,3.1,["Semi","Auto"]],
["QBZ95","AR","5.56mm",false,42,650,870,455,30,3.1,["Semi","Auto"]],
["Mini 14","DMR","5.56mm",false,42,330,990,231,20,2.5,["Semi"]],
["UMP9","SMG","9mm",false,42,670,400,469,25,3.1,["Semi","Burst","Auto"]],
["MG3","MG","7.62mm",false,42,700,820,490,75,3.5,["Auto"]],
["K2","AR","5.56mm",false,41,700,880,478,30,3.1,["Semi","Burst","Auto"]],
["G36C","AR","5.56mm",false,41,700,870,478,30,3.1,["Semi","Auto"]],
["M249","MG","5.56mm",false,41,800,915,547,75,3.5,["Auto"]],
["M416","AR","5.56mm",false,40,700,880,467,30,3.1,["Semi","Auto"]],
["AUG A3","AR","5.56mm",false,40,720,890,480,30,3.1,["Semi","Auto"]],
["Tommy Gun","SMG","9mm",false,40,750,280,500,30,3.1,["Semi","Auto"]],
["FAMAS","AR","5.56mm",true,39,900,925,585,30,3.1,["Semi","Burst","Auto"]],
["P90","SMG","5.7mm",false,35,1000,716,583,50,3.1,["Semi","Auto"]],
["P92","Pistol","9mm",false,34,600,380,340,15,2.3,["Semi"]],
["MP5K","SMG","9mm",false,32,901,400,481,30,3.1,["Semi","Burst","Auto"]],
["JS9","SMG","9mm",false,32,900,400,480,30,3.1,["Semi","Auto"]],
["Vector","SMG","9mm",false,31,1101,380,569,19,3.1,["Semi","Burst","Auto"]],
["MP9","SMG","9mm",false,31,1000,400,517,30,3.1,["Semi","Auto"]],
["DBS","SG","12 Gauge",false,28,480,360,224,14,6.1,["Semi"]],
["Micro Uzi","SMG","9mm",false,26,1250,350,542,25,3.1,["Semi","Auto"]],
["S686","SG","12 Gauge",false,26,240,370,104,2,2.3,["Semi"]],
["S12K","SG","12 Gauge",false,23,240,350,92,5,2.3,["Semi"]],
["G18C","Pistol","9mm",false,23,1000,375,383,17,2.3,["Semi","Auto"]],
["Skorpion","SMG","9mm",false,22,850,350,312,20,3.1,["Semi","Auto"]],
["Sawn-off","SG","12 Gauge",false,21,240,330,84,2,3.0,["Semi"]],
["RPD","MG","7.62mm",false,43,750,735,538,50,3.5,["Auto"]],
].map(w=>({name:w[0],cls:w[1],ammo:w[2],crate:w[3],dmg:w[4],rpm:w[5],vel:w[6],dps:w[7],mag:w[8],reload:w[9],modes:w[10]}));
// w[9] ("reload") is preserved as originally supplied, including RPD's
// unverified 3.5s placeholder. TTK and Attachments read it through
// reloadSecondsForWeapon(): official post-42.3 RPD/M249 times override it,
// and MG3 stays unknown rather than treating the generic 3.5s as measured.
// Other weapon reload timings remain owner-supplied inputs, not guaranteed
// to be animation-verified.
// 27 October 2026 evidence review: pubg.gs PC 43.2 extraction lists
// MP5K 901 and Vector 1101 RPM. DPS above is rounded damage * RPM / 60.
// MG3's extracted default conflicts with KRAFTON's published 660/990 modes.
for(const w of WEAPONS){
  if(w.name==="MP5K" || w.name==="Vector")
    w.rpmNote="Extracted reference rate: "+w.rpm+" RPM (PUBG PC 43.2, pubg.gs). This is not a measured Xbox firing rate.";
  if(w.name==="MG3"){
    w.rpmDisputed=true;
    w.rpmNote="MG3 rate disputed: this toolkit uses 700 RPM from the 43.2 extraction; KRAFTON's published modes are 660/990 RPM. Active slow-mode timing remains unverified.";
  }
}

// RPD added per official Update 42.3 patch notes (pubg.com/en/news/10885): dmg 43, RPM 750, velocity 735 m/s,
// base magazine 50 (expandable to 110 via AR/LMG magazine attachments), Auto only, world spawn on all maps.
// RPD's 43.2 engine recoil parameters are now recorded below; the precise
// shot-by-shot spray remains unknown. Official post-balance base reload 5.2s
// is stored in LMG_RELOAD_2026, not in the legacy weapon record.
 
// recoil-pattern data: v.recoil, crouch modifier (mult + %), h.bias (direction + value), vert/horiz recovery speed, min horizontal %
// G18C's row was cut off in the source paste after h.bias — its vert/horiz speed and min-h% were not supplied, so they stay null rather than guessed.
// Crouch recoil multipliers from current 43.1/43.2 game build:
// M249: .70, MG3: .60, RPD: .70 (not the pre-43.1 M249 .54/MG3 .50).
// "crouchPct" is (multiplier - 1) × 100, not a separate game asset field.
const RECOIL_RAW = {
  "Desert Eagle": [null, 0.82,-18, "→",0.17, 15,12, 42],
  "Mini 14":      [3.15, 0.75,-25,"→",0.15, 11.2,11,30], // 43.2 vertical recoil maximum
  "UMP9":         [null, null,null,"→",0.12, 10,9, 50],
  "SCAR-L":       [7.0,  0.84,-16,"→",0.10, 15,11, 40],
  "G36C":         [7.0,  0.84,-16,"→",0.10, 15,11, 40],
  "QBZ95":        [7.0,  0.84,-16,"→",0.10, 14,11.5,43],
  "Kar98k":       [7.0,  null,null,"→",0.10, 15,7, null],
  "M24":          [7.0,  null,null,"→",0.10, 15,7, null],
  "AWM":          [7.0,  null,null,"→",0.10, 15,7, null],
  "S12K":         [9.0,  0.85,-15,"→",0.10, 15,16, 50],
  "O12":          [9.0,  null,null,"→",0.10, 13,12, 50],
  "Mk12":         [null, 0.75,-25,"→",0.05, 11.5,11,30],
  "MP5K":         [null, null,null,"→",0.05, 12,12, 60],
  "JS9":          [null, 0.85,-15,"→",0.05, 11,11, 63],
  "Tommy Gun":    [null, null,null,"→",0.033,15,11, 30], // PUBG 43.2 exact horizontal tendency
  "Vector":       [null, null,null,"→",0.03, 15,16, 55],
  "AUG A3":       [7.0,  0.86,-14,"←",0.05, 10,10.8,40],
  "K2":           [7.0,  0.84,-16,"←",0.05, 13,12, 40],
  "SLR":          [8.0,  0.75,-25,"←",0.05, 11.5,10,40],
  "M416":         [7.0,  0.84,-16,"←",0.10, 12,12, 40],
  "Beryl M762":   [8.0,  0.88,-12,"←",0.10, 16.5,11,50],
  "ACE 32":       [7.0,  0.84,-16,"←",0.10, 15,9.5, 40],
  "FAMAS":        [7.0,  0.84,-16,"←",0.10, 10,10.8,40],
  "SKS":          [8.0,  0.75,-25,"←",0.10, 9.5,7.2, 40],
  "MK14 EBR":     [8.0,  0.75,-25,"←",0.10, 11.5,10,40],
  "SVD Dragunov": [10.0, 0.75,-25,"←",0.10, 12,11, 40],
  "Lynx AMR":     [7.0,  0.75,-25,"←",0.10, 20,8,  40],
  "AKM":          [8.0,  0.84,-16,"←",0.20, 15,9.5, 42],
  "Groza":        [8.0,  null,null,null,null, 14,11, 35],
  "M16A4":        [7.0,  0.84,-16,null,null, 11,13, 40],
  "MK47 Mutant":  [8.0,  0.88,-12,null,null, 12.5,10,48],
  "VSS Vintorez": [8.0,  0.75,-25,null,null, 10.5,8, 40],
  "Micro Uzi":    [null, null,null,null,null, 15,14, 35],
  "MP9":          [null, null,null,null,null, 11,10.5,63],
  "P90":          [null, null,null,null,null, 11,10.5,63],
  "Skorpion":     [null, 0.85,-15,null,null, 15,14, 35],
  "M249":         [7.0,  0.70,-30,null,null, 15,10, 20],
  "MG3":          [null, 0.60,-40,null,null, 16,11.5,25],
  "S686":         [null, null,null,null,null, 13,11, 70],
  "DBS":          [null, null,null,null,null, 12,10, 75],
  "Sawn-off":     [null, null,null,null,null, 15,12, null],
  "P92":          [1.0,  null,null,null,null, 15,12, null],
  "R1895":        [null, null,null,null,null, 15,12, null],
  "G18C":         [null, null,null,null,null, 15,12,15], // P18C in 43.2 game data
  "RPD":          [7.5,  0.70,-30,null,null, 15.5,11,25], // Update 43.2 extracted gun data
};
// Additional recoil engine fields actually exposed by Update 43.2.
// The existing RECOIL_RAW schema has no recovery, prone, climb/fall or
// direction-switch columns. Keep these separate to avoid mislabeling them as
// per-shot movement, and never infer unknown fields from another weapon.
// Each entry maps the standard game-file "Recoil" section for this gun.
const RECOIL_DETAIL_43_2 = {
  // Additional directly extracted weapon records; null is an unknown field,
  // not an assumed zero or copied stance modifier.
  "AKM":          {switchShots:2, proneMod:null, recoveryV:8.2, climb:0.7,  fall:2.4},
  "Beryl M762":   {switchShots:2, proneMod:0.70, recoveryV:8.2, climb:0.65, fall:2.15},
  "M416":         {switchShots:2, proneMod:null, recoveryV:7,   climb:0.7,  fall:2.1},
  "AUG A3":       {switchShots:2, proneMod:null, recoveryV:6,   climb:0.65, fall:2.1},
  "G36C":         {switchShots:2, proneMod:null, recoveryV:8,   climb:0.65, fall:2.3},
  "Kar98k":       {switchShots:1, proneMod:null, recoveryV:5.5, climb:0.7,  fall:3},
  "AWM":          {switchShots:1, proneMod:null, recoveryV:5.5, climb:0.7,  fall:3},
  "M24":          {switchShots:1, proneMod:null, recoveryV:5.5, climb:0.5,  fall:3},
  "SCAR-L":       {switchShots:2, proneMod:null, recoveryV:8,   climb:0.75, fall:2.3},
  "QBZ95":        {switchShots:2, proneMod:null, recoveryV:8,   climb:0.75, fall:2.4},
  "MG3":          {switchShots:2, proneMod:0.265,recoveryV:8.5, climb:0.75, fall:3.3},
  "Mini 14":      {switchShots:1, proneMod:null, recoveryV:9,   climb:1.2,  fall:3},
  "MK14 EBR":     {switchShots:1, proneMod:0.25, recoveryV:6,   climb:0.9,  fall:3},
  // Remaining 12 weapon mappings. Missing climb/prone fields deliberately
  // remain null when the extracted gun record has no corresponding number.
  "Lynx AMR":     {switchShots:1, proneMod:0.25, recoveryV:10,  climb:null, fall:4},
  "O12":          {switchShots:1, proneMod:0.70, recoveryV:8,   climb:1.8,  fall:2},
  "R1895":        {switchShots:1, proneMod:0.70, recoveryV:11,  climb:1.2,  fall:5.5},
  "Desert Eagle": {switchShots:1, proneMod:0.75, recoveryV:11,  climb:1.2,  fall:3.5},
  "MK47 Mutant":  {switchShots:1, proneMod:0.70, recoveryV:8.2, climb:0.7,  fall:2.5},
  "Mk12":         {switchShots:1, proneMod:0.20, recoveryV:9,   climb:1.25, fall:2.8},
  "K2":           {switchShots:2, proneMod:null, recoveryV:8,   climb:0.75, fall:2.1},
  "FAMAS":        {switchShots:2, proneMod:null, recoveryV:7,   climb:0.6,  fall:2.1},
  "P92":          {switchShots:1, proneMod:0.70, recoveryV:11,  climb:null, fall:4},
  "JS9":          {switchShots:5, proneMod:0.70, recoveryV:7,   climb:0.4,  fall:2},
  "S686":         {switchShots:1, proneMod:null, recoveryV:6,   climb:null, fall:2},
  "Skorpion":     {switchShots:2, proneMod:0.80, recoveryV:12,  climb:0.23, fall:2},
  "UMP9":         {switchShots:2, proneMod:0.70, recoveryV:7,   climb:0.48, fall:1.8},
  "MP5K":         {switchShots:2, proneMod:0.70, recoveryV:8.5, climb:0.6,  fall:2.5},
  "Micro Uzi":    {switchShots:2, proneMod:0.70, recoveryV:12,  climb:0.2,  fall:1.25},
  "Tommy Gun":    {switchShots:2, proneMod:0.70, recoveryV:12,  climb:0.5,  fall:1.5},
  "Vector":       {switchShots:2, proneMod:0.70, recoveryV:12,  climb:0.5,  fall:2.2},
  "P90":          {switchShots:null,proneMod:0.70, recoveryV:7,  climb:0.4,  fall:2},
  "MP9":          {switchShots:null,proneMod:0.70, recoveryV:7,  climb:0.4,  fall:2},
  "G18C":         {switchShots:1, proneMod:0.70, recoveryV:11,  climb:0.18, fall:2},
  "RPD":          {switchShots:2, proneMod:0.32, recoveryV:7,   climb:0.7,  fall:2.2},
  "M249":         {switchShots:2, proneMod:0.32, recoveryV:6,   climb:0.75, fall:2.4},
  "SLR":          {switchShots:1, proneMod:null, recoveryV:5.3, climb:1.1,  fall:1.9},
  "SKS":          {switchShots:1, proneMod:null, recoveryV:4.8, climb:null, fall:2.4},
  "S12K":         {switchShots:1, proneMod:0.75, recoveryV:7,   climb:1.8,  fall:3},
  "DBS":          {switchShots:1, proneMod:0.70, recoveryV:6,   climb:null, fall:2},
  "Sawn-off":     {switchShots:1, proneMod:0.70, recoveryV:11,  climb:1.2,  fall:1.9},
  "VSS Vintorez": {switchShots:1, proneMod:null, recoveryV:6,   climb:0.5,  fall:2},
  "M16A4":        {switchShots:1, proneMod:null, recoveryV:8,   climb:0.8,  fall:2.6},
  "SVD Dragunov": {switchShots:1, proneMod:null, recoveryV:6,   climb:1.1,  fall:2},
  "ACE 32":       {switchShots:2, proneMod:null, recoveryV:8.2, climb:0.65, fall:2.15},
  "Groza":        {switchShots:2, proneMod:null, recoveryV:8.2, climb:0.65, fall:2.1}
};
WEAPONS.forEach(w=>{
  const r = RECOIL_RAW[w.name];
  if(!r) return;
  const [vRecoil,crouchMod,crouchPct,hBiasDir,hBiasVal,vertSpeed,horizSpeed,minH] = r;
  Object.assign(w, {vRecoil,crouchMod,crouchPct,hBiasDir,hBiasVal,vertSpeed,horizSpeed,minH});
  w.recoilDetail = RECOIL_DETAIL_43_2[w.name] || null;
});
 
// crossover data keyed by normalized weapon key (maps onto WEAPONS via ALIAS)
const ALIAS = { // crossover-sheet name -> weapon-db name
  "FAMAS G2":"FAMAS","QBZ":"QBZ95","VSS":"VSS Vintorez","Mk47 Mutant":"MK47 Mutant",
  "Mk14":"MK14 EBR","P18C":"G18C","ACE 32":"ACE 32","Mini 14":"Mini 14"
};
 
// [name, chestDmg, l3->l2, l2->l1]
const VEST_RAW = [
["AKM",48,"≤26 (10%)","Always keep"],
["Beryl M762",44,"≤24 (10%)","≤24 (11%)"],
["M416",40,"≤44 (18%)","≤22 (10%)"],
["SCAR-L",42,"≤23 (9%)","≤23 (10%)"],
["G36C",41,"≤45 (18%)","≤22 (10%)"],
["Mk47 Mutant",49,"≤26 (10%)","Always keep"],
["QBZ",42,"≤23 (9%)","≤23 (10%)"],
["Groza",47,"≤25 (10%)","≤51 (23%)"],
["AUG A3",40,"≤44 (18%)","≤22 (10%)"],
["ACE 32",43,"≤23 (9%)","≤23 (10%)"],
["FAMAS G2",39,"≤42 (17%)","≤21 (10%)"],
["K2",41,"≤45 (18%)","≤22 (10%)"],
["M16A4",43,"≤23 (9%)","≤23 (10%)"],
["UMP9",44.1,"≤16 (6%)","≤16 (7%)"],
["Vector",32.6,"≤37 (15%)","≤24 (11%)"],
["Tommy Gun",42,"≤16 (6%)","≤16 (7%)"],
["P90",36.8,"≤28 (11%)","Always keep"],
["MP5K",33.6,"≤12 (5%)","≤25 (11%)"],
["MP9",32.6,"≤37 (15%)","≤24 (11%)"],
["Micro Uzi",27.3,"≤41 (16%)","≤31 (14%)"],
["JS9",33.6,"≤12 (5%)","≤25 (11%)"],
["Skorpion",23.1,"≤35 (14%)","≤35 (16%)"],
["Mini 14",44.1,"≤25 (10%)","≤25 (11%)"],
["SKS",49.4,"≤28 (11%)","Always keep"],
["SLR",51.5,"≤29 (12%)","Always keep"],
["Mk14",56.7,"Always keep","Always keep"],
["Mk12",45.2,"≤25 (10%)","≤25 (11%)"],
["SVD Dragunov",55.7,"Always keep","Always keep"],
["VSS",47.3,"≤27 (11%)","≤54 (25%)"],
["Kar98k",102.7,"Always keep","Always keep"],
["M24",97.5,"Always keep","Always keep"],
["AWM",136.5,"Always keep","Always keep"],
["Lynx AMR",153.4,"Always keep","Always keep"],
["M249",43.1,"≤22 (9%)","≤22 (10%)"],
["MG3",44.1,"≤23 (9%)","≤23 (10%)"],
["Desert Eagle",62,"Always keep","Always keep"],
["R1895",64,"Always keep","≤25 (11%)"],
["P92",34,"≤13 (5%)","≤27 (12%)"],
["P18C",23,"≤36 (14%)","≤36 (16%)"],
];

const HELM_RAW = [
["AKM",112.8,"Always keep","Always keep"],
["Beryl M762",103.4,"Always keep","Always keep"],
["M416",94,"Always keep","Always keep"],
["SCAR-L",98.7,"Always keep","Always keep"],
["G36C",96.4,"Always keep","Always keep"],
["Mk47 Mutant",115.2,"Always keep","Always keep"],
["QBZ",98.7,"Always keep","Always keep"],
["Groza",110.5,"Always keep","Always keep"],
["AUG A3",94,"Always keep","Always keep"],
["ACE 32",101.1,"Always keep","Always keep"],
["FAMAS G2",91.7,"Always keep","Always keep"],
["K2",96.4,"Always keep","Always keep"],
["M16A4",101.1,"Always keep","Always keep"],
["UMP9",88.2,"Always keep","Always keep"],
["Vector",65.1,"Always keep","≤12 (8%)"],
["Tommy Gun",84,"Always keep","Always keep"],
["P90",73.5,"≤14 (6%)","Always keep"],
["MP5K",67.2,"Always keep","≤12 (8%)"],
["MP9",65.1,"Always keep","≤12 (8%)"],
["Micro Uzi",54.6,"≤20 (9%)","Always keep"],
["JS9",67.2,"Always keep","≤12 (8%)"],
["Skorpion",46.2,"≤8 (3%)","≤17 (11%)"],
["Mini 14",98.7,"Always keep","Always keep"],
["SKS",110.5,"Always keep","Always keep"],
["SLR",115.2,"Always keep","Always keep"],
["Mk14",126.9,"Always keep","Always keep"],
["Mk12",101.1,"Always keep","Always keep"],
["SVD Dragunov",124.6,"Always keep","Always keep"],
["VSS",105.8,"Always keep","Always keep"],
["Kar98k",197.5,"Always keep","Always keep"],
["M24",187.5,"Always keep","Always keep"],
["AWM",262.5,"Always keep","Always keep"],
["Lynx AMR",295,"Always keep","Always keep"],
["M249",94.3,"Always keep","Always keep"],
["MG3",96.6,"Always keep","Always keep"],
["Desert Eagle",142.6,"Always keep","Always keep"],
["R1895",147.2,"Always keep","Always keep"],
["P92",78.2,"≤13 (6%)","Always keep"],
["P18C",52.9,"≤18 (8%)","Always keep"],
];
 
function norm(n){ return ALIAS[n] || n; }
function buildIndex(raw){
  const idx = {};
  raw.forEach(r=>{ idx[norm(r[0])] = {srcName:r[0], dmg:r[1], l3:r[2], l2:r[3]}; });
  return idx;
}
const VEST = buildIndex(VEST_RAW);
const HELM = buildIndex(HELM_RAW);
const WBYNAME = {}; WEAPONS.forEach(w=>WBYNAME[w.name]=w);
 
function parseThreshold(str){
  // returns {always:true} or {pct:number, raw:number}
  if(/always/i.test(str)) return {always:true, label:str};
  const m = str.match(/≤\s*(\d+(?:\.\d+)?)\s*\((\d+)%\)/);
  if(m) return {always:false, raw:+m[1], pct:+m[2], label:str};
  return {always:false, label:str};
}
 
/* ---------------- SINGLE-PAGE CONTAINER ---------------- */
const panelsEl = document.getElementById("panels");
 
/* ---------------- 1. COMBAT DATABASE (weapons + helmet + vest crossover, merged) ---------------- */
(function(){
  const p = panelsEl;
  p.innerHTML = `
    <div class="card" id="combat-database">
      <div class="panel-coord">A1 · Combat Database</div>
      <p class="combat-choose-hint">Select a weapon for its picture and full statistics.</p>
      <div class="toolbar tt-db-filters">
        <input type="text" id="wSearch" placeholder="Search weapon name…" aria-label="Search weapon database">
        <label class="tt-toggle"><input type="checkbox" id="wCrates" checked> Include crate weapons</label>
        <select id="wSort">
          <option value="dmg-desc">Sort: Damage ↓</option>
          <option value="dps-desc">Sort: DPS ↓</option>
          <option value="rpm-desc">Sort: RPM ↓</option>
          <option value="vel-desc">Sort: Velocity ↓</option>
          <option value="headDmg-desc">Sort: Head dmg ↓</option>
          <option value="chestDmg-desc">Sort: Chest dmg ↓</option>
          <option value="vRecoil-desc">Sort: Max V.Recoil ↓</option>
          <option value="minH-desc">Sort: Min H% ↓</option>
          <option value="dmg-asc">Sort: Damage ↑</option>
          <option value="name-asc">Sort: Name A-Z</option>
        </select>
      </div>
      <div class="toolbar" id="wClassFilters"></div>
      <div class="workspace-segments" role="group" aria-label="Weapon table view" id="combat-views">
        <button type="button" data-combat-view="core" aria-pressed="false">Core</button>
        <button type="button" data-combat-view="damage" aria-pressed="false">Damage</button>
        <button type="button" data-combat-view="handling" aria-pressed="false">Handling</button>
        <button type="button" data-combat-view="all" aria-pressed="true">All stats</button>
      </div>
      <div class="tt-view-tools"><p class="helptext" id="combat-view-status" role="status"></p><button type="button" id="combat-leader-switch" aria-expanded="false" aria-controls="combat-insights">Leaders</button></div>
      <div class="sort-hint" id="combat-table-instructions">Sort columns · swipe sideways for more stats.</div>
      <details class="tt-disclosure" id="combat-insights"><summary>Leaders in this selection</summary><div id="combat-leaders" class="tt-leaders"></div></details>
      <div class="combat-stats-scroller" id="combat-stats-scroller" role="region" tabindex="0" aria-label="Scrollable weapon statistics" aria-describedby="combat-table-instructions"><table id="wTable"></table></div>
      <div class="missing-note">— means no available value. Mini bars compare the recorded numeric stats; they are not overall weapon ratings.</div>
      <section id="combat-browser" aria-label="Weapon pictures"><h2 class="section-h">Weapon gallery</h2><div id="combat-cards" class="tt-weapon-cards"></div></section>
      
      <div class="helptext" style="margin-bottom:6px">Recoil &amp; handling columns:</div>
      <dl class="legend">
        <div><dt>Max V.Recoil</dt><dd>Maximum vertical recoil from the gun configuration; it is not a measured per-shot screen offset.</dd></div>
        <div><dt>Crouch Recoil</dt><dd>How much recoil drops while crouching. A lower multiplier means a bigger % reduction.</dd></div>
        <div><dt>Horizontal Bias</dt><dd>Signed horizontal tendency in the gun configuration. This does not determine an exact spray or counter-pull path.</dd></div>
        <div><dt>Vertical Speed</dt><dd>Vertical recoil speed parameter; not a measurement of pixels or degrees moved per shot.</dd></div>
        <div><dt>Horizontal Speed</dt><dd>Horizontal recoil speed parameter; not measured left/right travel for each bullet.</dd></div>
        <div><dt>Minimum Horizontal %</dt><dd>Minimum horizontal recoil scalar (for example, 0.40 = 40%); alone it cannot predict sustained spray consistency.</dd></div>
      </dl>
    </div>
    <section class="card" id="armor-quick-check">
      <details class="tt-disclosure"><summary>Check a damaged helmet or vest</summary>
        <p class="helptext">Compare your remaining durability with the existing point-blank crossover record for a fresh lower tier. Head and chest only; this is a threshold lookup, not a simulated fight.</p>
        <div class="toolbar">
          <div class="field"><label for="aq_weapon">Weapon</label><select id="aq_weapon">${WEAPONS.map(w=>'<option>'+w.name+'</option>').join('')}</select></div>
          <div class="field"><label for="aq_gear">Equipment</label><select id="aq_gear"><option value="vest">Vest · chest hit</option><option value="helmet">Helmet · head hit</option></select></div>
          <div class="field"><label for="aq_tier">Current → fresh lower tier</label><select id="aq_tier"><option value="3">Level 3 → Level 2</option><option value="2">Level 2 → Level 1</option></select></div>
          <div class="field"><label for="aq_durability">Remaining durability</label><input type="number" id="aq_durability" min="0" step="1" value="100"></div>
        </div><div id="aq_verdict" class="tt-verdict" role="status" aria-live="polite"></div>
      </details>
    </section>
    <section class="card combat-crossover-card" id="combat-armor-crossover-section" aria-label="Helmet and vest crossover data">
      <details id="combat-armor-crossovers">
        <summary>Helmet &amp; vest crossover table <span class="combat-crossover-hint">Expand to compare armour thresholds · Head and Chest damage also appear here</span></summary>
        <div class="combat-crossover-body">
          <p class="helptext">The detailed helmet and vest crossover values are separated from the main weapon database to reduce sideways scrolling. Head and Chest damage are shown in both tables. Searching, sorting and filtering affect both tables together.</p>
          <div class="combat-armor-scroller" role="region" tabindex="0" aria-label="Scrollable helmet and vest crossover table">
            <table id="combatArmorTable">
              <caption>Armour crossover durability by weapon. Head and Chest are unarmoured damage values, repeated from the main weapon table.</caption>
            </table>
          </div>
          <p class="missing-note">— means unavailable. Crossover thresholds apply at point blank.</p>
          <div class="section-h">Crossover colour guide</div>
          <div class="color-legend">
        <span class="clegend-item"><i class="dot" style="background:var(--keep)"></i>Always keep — the math never favors a fresh lower tier</span>
        <span class="clegend-item"><i class="dot" style="background:var(--amber)"></i>15%+ — swap with a comfortable durability margin</span>
        <span class="clegend-item"><i class="dot" style="background:var(--orange)"></i>8–14% — swap opportunistically, not urgently</span>
        <span class="clegend-item"><i class="dot" style="background:var(--swap)"></i>Under 8% — crossover comes right before it breaks, little margin</span>
      </div>
        </div>
      </details>
    </section>
    <div class="card" style="margin-top:16px" id="realityCard"></div>
    <div class="card" style="margin-top:16px" id="compare-weapons">
      <div class="panel-coord">Compare weapons</div>
      <p class="helptext" style="margin-bottom:12px">Pick up to three weapons to see every stat side-by-side. The stronger value in each row is highlighted green.</p>
      <div class="compare-picker">
        <select id="cmpA"></select>
        <select id="cmpB"></select>
        <select id="cmpC"><option value="">— none —</option></select>
      </div>
      <div style="overflow-x:auto"><table id="cmpTable"></table></div>
    </div>
    <div class="card" style="margin-top:16px" id="how-thresholds-work">
      <div class="section-h" style="margin-top:0">How the crossover thresholds work</div>
      <p class="helptext">A crossover point is the durability value at which damaged higher-tier armor stops being worth more than a fresh piece of the tier below. Higher tiers absorb more damage per hit but wear down with use; a fresh lower tier is undamaged, so at some durability the two protect equally well, and below it the fresh lower tier wins.</p>
    </div>`;
  const ROWS = WEAPONS.map(w=>({...w, helm:HELM[norm(w.name)], vest:VEST[norm(w.name)]}));
 
  const classes = ["All",...new Set(WEAPONS.map(w=>w.cls))];
  let activeClass = "All";
  let armorFilter = "all";
  let sortKey = "dmg", sortDir = "desc";
  const cf = document.getElementById("wClassFilters");
  classes.forEach(c=>{
    const chip = document.createElement("div");
    chip.className = "chip" + (c==="All"?" on":"");
    chip.textContent = c;
    chip.tabIndex = 0;
    chip.onclick = ()=>{ activeClass=c; [...cf.children].forEach(x=>x.classList.remove("on")); chip.classList.add("on"); render(); };
    chip.onkeydown = e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); chip.click(); } };
    cf.appendChild(chip);
  });
  // Reduce main database from 19 columns to 15 without losing raw damage.
  const COLS = [["name","Weapon"],["cls","Class"],["dmg","Dmg"],["rpm","RPM"],["vel","Vel m/s"],["dps","DPS"],
    ["mag","Mag"],["vRecoil","V.Recoil"],["crouchMod","Crouch"],["hBias","H.Bias"],["vertSpeed","V.Speed"],
    ["horizSpeed","H.Speed"],["minH","Min H%"],["headDmg","Head Dmg"],["chestDmg","Chest Dmg"]];
  let tableView='all';
  const VIEW_COLUMNS={core:[0,1,2,3,4,5,6],damage:[0,1,2,13,14],handling:[0,1,7,8,9,10,11,12],all:COLS.map((_,i)=>i)};
  const GROUPS = [["",1],["Core Stats",6],["Recoil & Handling",6],["Unarmoured Damage",2]];
  const ARMOR_COLS = [["name","Weapon"],["headDmg","Head Dmg"],["helmL3","Helm L3→L2"],["helmL2","Helm L2→L1"],
    ["chestDmg","Chest Dmg"],["vestL3","Vest L3→L2"],["vestL2","Vest L2→L1"]];
  const SORTABLE = new Set(["name","dmg","rpm","vel","dps","mag","vRecoil","vertSpeed","horizSpeed","minH","headDmg","chestDmg"]);
  const TOOLTIPS = {
    cls:"Weapon category (AR, SMG, SR, DMR, SG, MG, Pistol)",
    dmg:"Base hitbox damage per hit, before armor reduction",
    rpm:"Rounds per minute at maximum fire rate",
    vel:"Bullet velocity in meters per second",
    dps:"Theoretical sustained damage per second at max RPM",
    mag:"Magazine capacity",
    vRecoil:"Extracted maximum vertical recoil parameter. NOT measured screen movement per shot or a predicted recoil pattern.",
    crouchMod:"How much recoil drops while crouching. A lower multiplier means a bigger % reduction.",
    hBias:"Signed horizontal tendency parameter from gun configuration; a direction bias, not a verified full spray path.",
    vertSpeed:"Vertical recoil speed parameter in the gun configuration; not degrees or pixels moved per shot.",
    horizSpeed:"Horizontal recoil speed parameter in the gun configuration; not a measured horizontal shot offset.",
    minH:"Minimum horizontal recoil scalar expressed as a percentage (0.40 = 40%). It does not predict the spray path.",
    headDmg:"Headshot damage against bare skin, no helmet",
    helmL3:"Durability at which a damaged Level 3 helmet stops being better than a fresh Level 2",
    helmL2:"Durability at which a damaged Level 2 helmet stops being better than a fresh Level 1",
    chestDmg:"Chest damage against bare skin, no vest",
    vestL3:"Durability at which a damaged Level 3 vest stops being better than a fresh Level 2",
    vestL2:"Durability at which a damaged Level 2 vest stops being better than a fresh Level 1",
  };
  function getVal(row,key){
    if(key==="headDmg") return row.helm ? row.helm.dmg : null;
    if(key==="chestDmg") return row.vest ? row.vest.dmg : null;
    return row[key];
  }
  function setSort(key){
    if(sortKey===key){ sortDir = sortDir==="desc"?"asc":"desc"; } else { sortKey=key; sortDir = key==="name"?"asc":"desc"; }
    document.getElementById("wSort").value = `${sortKey}-${sortDir}`;
    render();
  }
  function armorCell(entry, field){
    if(!entry) return `<td>—</td>`;
    const t = parseThreshold(entry[field]);
    let cls;
    if(t.always) cls = 'thresh-always';
    else if(t.pct>=15) cls = 'thresh-yellow';
    else if(t.pct>=8) cls = 'thresh-orange';
    else cls = 'thresh-red';
    return `<td class="${cls}">${entry[field]}</td>`;
  }
  function render(){
    const q = document.getElementById("wSearch").value.toLowerCase();
    let list = ROWS.filter(w=> w.name.toLowerCase().includes(q) && (activeClass==="All"||w.cls===activeClass)
      && (document.getElementById("wCrates").checked || !w.crate)
      && (armorFilter==="all" || (armorFilter==="vest"&&w.vest) || (armorFilter==="helm"&&w.helm)));
    list.sort((a,b)=>{
      if(sortKey==="name") return a.name.localeCompare(b.name)*(sortDir==="asc"?1:-1);
      const av=getVal(a,sortKey), bv=getVal(b,sortKey);
      const an = (av===null||av===undefined) ? -Infinity : av, bn = (bv===null||bv===undefined) ? -Infinity : bv;
      return sortDir==="desc" ? bn-an : an-bn;
    });
    const t = document.getElementById("wTable");
    const groupHtml = GROUPS.map(([label,span])=> label ? `<th colspan="${span}">${label}</th>` : `<th colspan="${span}"></th>`).join("");
    const headHtml = COLS.map(([key,label])=>{
      const arrow = sortKey===key ? `<span class="arrow">${sortDir==="desc"?"▼":"▲"}</span>` : "";
      const tip = TOOLTIPS[key] ? ` title="${TOOLTIPS[key]}"` : "";
      return SORTABLE.has(key) ? `<th data-key="${key}" tabindex="0"${tip}>${label}${arrow}</th>` : `<th${tip}>${label}</th>`;
    }).join("");
    t.innerHTML = `<tr class="grouprow">${groupHtml}</tr><tr class="colheader">${headHtml}</tr>` +
      list.map(w=>`<tr class="rowclick" tabindex="0" data-n="${w.name}" aria-label="View ${w.name} weapon details and illustration">
        <td class="combat-weapon-cell">${window.HELP_VISUAL_WEAPONS?.[w.name]?`<img class="db-weapon-picture" data-visual-src="assets/${window.HELP_VISUAL_WEAPONS[w.name]}" width="86" height="32" alt="" loading="lazy" decoding="async">`:""}${w.name} ${w.crate?'<span class="tag crate">CRATE</span>':''}</td>
        <td>${w.cls?`<span class="tag">${w.cls}</span>`:'—'}</td>
        <td>${w.dmg??'—'}</td>
        <td${w.rpmNote?` title="${w.rpmNote}"`:""}>${w.rpm??'—'}${w.rpmDisputed?" <small>(disputed)</small>":""}</td>
        <td>${w.vel??'—'}</td>
        <td>${w.dps??'—'}</td>
        <td>${w.mag??'—'}</td>
        <td>${w.vRecoil??'—'}</td>
        <td>${w.crouchMod!=null?`${w.crouchMod} (${w.crouchPct}%)`:'—'}</td>
        <td>${w.hBiasDir?`${w.hBiasDir} ${w.hBiasVal}`:'—'}</td>
        <td>${w.vertSpeed??'—'}</td>
        <td>${w.horizSpeed??'—'}</td>
        <td>${w.minH!=null?w.minH+'%':'—'}</td>
        <td>${w.helm?w.helm.dmg:'—'}</td>
        <td>${w.vest?w.vest.dmg:'—'}</td>
      </tr>`).join("");
    // Remove unwanted columns from this rendered view, including its group spans.
    const visible=new Set(VIEW_COLUMNS[tableView]);
    for(const row of t.querySelectorAll('tr:not(.grouprow)')){
      [...row.children].forEach((cell,i)=>{if(!visible.has(i))cell.remove();});
    }
    let offset=0;
    t.querySelector('.grouprow').innerHTML=GROUPS.map(([label,span])=>{
      const count=Array.from({length:span},(_,i)=>offset+i).filter(i=>visible.has(i)).length;
      offset+=span;
      return count ? '<th colspan="'+count+'">'+label+'</th>' : '';
    }).join('');
    document.getElementById('combat-view-status').textContent=list.length+' weapons · '+({core:'Core weapon statistics',damage:'Unarmoured damage at point blank',handling:'Configuration parameters, not a predicted spray',all:'All available statistics'}[tableView]);
    // Numeric bars preserve text and only encode scale within the full registry.
    const scales={dmg:Math.max(...WEAPONS.map(w=>w.dmg)),rpm:Math.max(...WEAPONS.map(w=>w.rpm)),vel:Math.max(...WEAPONS.map(w=>w.vel)),dps:Math.max(...WEAPONS.map(w=>w.dps)),mag:Math.max(...WEAPONS.map(w=>w.mag))};
    const shown=VIEW_COLUMNS[tableView];
    for(const row of t.querySelectorAll('tr.rowclick')){
      const w=WBYNAME[row.dataset.n];
      [...row.children].forEach((cell,i)=>{
        const key=COLS[shown[i]][0];
        if(!scales[key]||!Number.isFinite(w[key]))return;
        const bar=document.createElement('i');bar.className='tt-mini-bar tt-'+key;bar.setAttribute('aria-hidden','true');
        bar.style.setProperty('--stat-fill',Math.max(0,Math.min(100,w[key]/scales[key]*100))+'%');cell.append(bar);
      });
    }
    document.getElementById('combat-leaders').innerHTML=['dmg','rpm','vel','mag'].map((key,i)=>{
      const eligible=list.filter(w=>Number.isFinite(w[key]));
      const best=eligible.length?eligible.reduce((a,b)=>a[key]>=b[key]?a:b):null;
      return '<div><span>'+['Highest base damage','Highest RPM','Fastest bullet speed','Largest base magazine'][i]+'</span><strong>'+(best?best[key]:'No data')+'</strong><small>'+(best?best.name:'No matching weapons')+'</small></div>';
    }).join('');
    renderCards(list);
    if(document.getElementById('panel-combat').classList.contains('active'))for(const image of t.querySelectorAll('img[data-visual-src]')){image.src=image.dataset.visualSrc;delete image.dataset.visualSrc;}
    // Render the same sorted and filtered weapons in the optional armour table.
    const armourTable=document.getElementById("combatArmorTable");
    const armourHeaders=ARMOR_COLS.map(([key,label])=>`<th scope="col"${TOOLTIPS[key]?` title="${TOOLTIPS[key]}"`:""}>${label}</th>`).join("");
    armourTable.innerHTML = `<thead><tr><th scope="col" rowspan="1">Weapon</th><th scope="colgroup" colspan="3">Head / Helmet</th><th scope="colgroup" colspan="3">Chest / Vest</th></tr><tr>${armourHeaders}</tr></thead><tbody>`+
      list.map(w=>`<tr class="armor-crossover-row" tabindex="0" data-n="${w.name}" aria-label="View ${w.name} details">
        <td class="combat-weapon-cell">${w.name}</td>
        <td>${w.helm?w.helm.dmg:'—'}</td>
        ${armorCell(w.helm,'l3')}${armorCell(w.helm,'l2')}
        <td>${w.vest?w.vest.dmg:'—'}</td>
        ${armorCell(w.vest,'l3')}${armorCell(w.vest,'l2')}
      </tr>`).join("")+'</tbody>';
    armourTable.querySelectorAll("tr.armor-crossover-row").forEach(tr=>{
      tr.onclick=()=>openWeaponDetail(tr.dataset.n,tr);
      tr.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openWeaponDetail(tr.dataset.n,tr);}};
    });
    t.querySelectorAll("tr.rowclick").forEach(tr=>{
      tr.onclick = ()=>openWeaponDetail(tr.dataset.n,tr);
      tr.onkeydown = e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openWeaponDetail(tr.dataset.n,tr); } };
    });
    t.querySelectorAll("th[data-key]").forEach(th=>{
      th.onclick = ()=> setSort(th.dataset.key);
      th.onkeydown = e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setSort(th.dataset.key); } };
    });
  }
  document.getElementById('combat-views').addEventListener('click',event=>{
    const button=event.target.closest('[data-combat-view]');
    if(!button)return;
    tableView=button.dataset.combatView;
    const allowed=VIEW_COLUMNS[tableView].map(i=>COLS[i][0]);
    if(!allowed.includes(sortKey)){
      sortKey=tableView==='handling'?'vRecoil':'dmg';sortDir='desc';
      document.getElementById('wSort').value=sortKey+'-'+sortDir;
    }
    document.querySelectorAll('[data-combat-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    render();
  });
  function renderCards(list){
    const cards=document.getElementById('combat-cards');cards.replaceChildren();
    for(const w of list){
      const card=document.createElement('article');card.className='tt-weapon-card';
      const art=window.HELP_VISUAL_WEAPONS&&window.HELP_VISUAL_WEAPONS[w.name];
      if(art){const img=document.createElement('img');img.dataset.visualSrc='assets/'+art;img.width=180;img.height=60;img.alt='PUBG '+w.name+' weapon artwork';img.loading='lazy';card.append(img);}
      const name=document.createElement('h3');name.textContent=w.name;card.append(name);
      const stats=document.createElement('p');stats.textContent=w.cls+' · '+w.ammo+' · '+w.dmg+' base damage · '+w.rpm+' RPM';card.append(stats);
      for(const [label,action] of [['Details',button=>openWeaponDetail(w.name,button)],['Compare',()=>{document.getElementById('cmpA').value=w.name;document.getElementById('cmpA').dispatchEvent(new Event('change',{bubbles:true}));location.hash='compare-weapons';}],['Hit zones',()=>{const select=document.getElementById('hz_weapon');select.value=w.name;select.dispatchEvent(new Event('change',{bubbles:true}));location.hash='panel-hit-zone';}]]){
        const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',label+' for '+w.name);button.addEventListener('click',()=>action(button));card.append(button);
      }
      cards.append(card);
    }
    if(document.getElementById('panel-combat').classList.contains('active'))for(const image of cards.querySelectorAll('img[data-visual-src]')){image.src=image.dataset.visualSrc;delete image.dataset.visualSrc;}
    if(!list.length)cards.textContent='No matching weapons. Clear the search or change the class filter.';
  }
  const leaders=document.getElementById('combat-insights'),leaderSwitch=document.getElementById('combat-leader-switch');
  leaderSwitch.addEventListener('click',()=>{leaders.open=!leaders.open;leaderSwitch.setAttribute('aria-expanded',String(leaders.open));});
  leaders.addEventListener('toggle',()=>leaderSwitch.setAttribute('aria-expanded',String(leaders.open)));
  document.getElementById('wCrates').addEventListener('change',render);
  document.getElementById("wSearch").oninput = render;
  document.getElementById("wSort").onchange = ()=>{
    [sortKey,sortDir] = document.getElementById("wSort").value.split("-");
    render();
  };
  // Hero stat tiles are informational only now — the table below always shows every weapon;
  // clicking them to filter wasn't adding anything a search/class-chip couldn't already do.
  document.querySelector("#statAll b").textContent = WEAPONS.length; // dynamic count, no longer hard-coded
  render();
})();
 
function getStrengthsWeaknesses(w){
  const rank = (arr,key)=> [...arr].sort((a,b)=>b[key]-a[key]).findIndex(x=>x.name===w.name)+1;
  const dmgRank = rank(WEAPONS,"dmg");
  const sameClass = WEAPONS.filter(x=>x.cls===w.cls);
  const classRank = (key,asc)=>{
    const sorted = [...sameClass].sort((a,b)=> asc ? a[key]-b[key] : b[key]-a[key]);
    return sorted.findIndex(x=>x.name===w.name)+1;
  };
  const n = sameClass.length;
  const strengths = [], weaknesses = [];
  const cDmg = classRank("dmg"), cDps = classRank("dps"), cVel = classRank("vel"), cMag = classRank("mag");
  if(n>1){
    if(cDmg===1) strengths.push(`highest base damage of the ${n} ${w.cls} weapons`);
    else if(cDmg<=Math.ceil(n/3)) strengths.push(`top-third damage among ${w.cls} weapons`);
    if(cDps===1) strengths.push(`highest DPS of the ${n} ${w.cls} weapons`);
    if(cVel===1) strengths.push(`fastest bullet velocity in its class`);
    if(cMag===1) strengths.push(`largest magazine in its class (${w.mag} rounds)`);
    if(cDmg===n) weaknesses.push(`lowest base damage of the ${n} ${w.cls} weapons`);
    if(cMag===n && w.cls!=="SR") weaknesses.push(`smallest magazine in its class (${w.mag} rounds)`);
    if(cVel===n) weaknesses.push(`slowest bullet velocity in its class`);
  }
  if(dmgRank<=5) strengths.push(`top-5 base damage across all ${WEAPONS.length} weapons`);
  if(w.vel<450) weaknesses.push("low absolute bullet velocity — noticeable lead required at range");
  if(!strengths.length) strengths.push(`mid-pack on damage, DPS, and magazine size within its ${n>1?w.cls+" class":"category"}`);
  return {strengths, weaknesses};
}
let lastWeaponTrigger=null;
function openWeaponDetail(name,trigger){
  const w = WBYNAME[name]; if(!w) return;
  // Clicking or pressing Enter on a table row remembers where to return focus.
  lastWeaponTrigger=trigger && trigger.isConnected ? trigger : document.activeElement;
  const rank = (arr,key)=> [...arr].sort((a,b)=>b[key]-a[key]).findIndex(x=>x.name===w.name)+1;
  const dmgRank = rank(WEAPONS,"dmg"), dpsRank = rank(WEAPONS,"dps");
  const {strengths, weaknesses} = getStrengthsWeaknesses(w);
  const helm = HELM[norm(w.name)], vest = VEST[norm(w.name)];
  const artMap = window.HELP_VISUAL_WEAPONS || {};
  const image = Object.prototype.hasOwnProperty.call(artMap,w.name) ? artMap[w.name] : null;
  // Never substitute another gun's artwork, including for unavailable assets.
  const weaponArt = image
    ? '<figure class="visual-modal-media"><img src="assets/'+image+'" width="960" height="320" loading="lazy" decoding="async" alt="PUBG '+w.name+' weapon artwork"><figcaption>PUBG weapon artwork © KRAFTON</figcaption></figure>'
    : '<p class="visual-modal-unavailable">Artwork not available for this weapon yet. Statistics are unaffected.</p>';
  document.getElementById("modalBody").innerHTML = `
    <button class="close" data-action="close-modal" aria-label="Close weapon detail">✕</button>
    <div class="eyebrow">${w.cls}${w.crate?' · CRATE':''}</div>
    <h3 id="modalTitle">${w.name}</h3>
    ${weaponArt}
    <div class="kv">
      <div><span>Damage</span> ${w.dmg}</div>
      <div><span>RPM</span> ${w.rpm}${w.rpmDisputed?" (disputed)":""}</div>
      <div><span>Velocity</span> ${w.vel} m/s</div>
      <div><span>DPS</span> ${w.dps}</div>
      <div><span>Magazine</span> ${w.mag}</div>
      <div><span>Damage rank</span> #${dmgRank} of ${WEAPONS.length}</div>
      <div><span>DPS rank</span> #${dpsRank} of ${WEAPONS.length}</div>
    </div>
    <div class="note">
      <b>Provided-data notes:</b><br>
      ${w.rpmNote?w.rpmNote+"<br>":""}
      ${strengths.length?"Strengths: "+strengths.join("; ")+".":"No standout strengths from supplied stats."}<br>
      ${weaknesses.length?"Weaknesses: "+weaknesses.join("; ")+".":"No notable weaknesses from supplied stats."}
      ${helm?`<br><br>Headshot vs armor: ${helm.dmg} dmg. L3→L2 ${helm.l3} · L2→L1 ${helm.l2}.`:''}
      ${vest?`<br>Chest vs armor: ${vest.dmg} dmg. L3→L2 ${vest.l3} · L2→L1 ${vest.l2}.`:''}
    </div>`;
  const modalFigure=document.querySelector("#modalBody .visual-modal-media");
  const modalImage=modalFigure && modalFigure.querySelector("img");
  if(modalImage)modalImage.addEventListener("error",()=>{
    const fallback=document.createElement("p");
    fallback.className="visual-modal-unavailable";
    fallback.textContent="Artwork could not load for this weapon. Statistics are unaffected.";
    modalFigure.replaceWith(fallback);
  });
  const overlay=document.getElementById("overlay");
  overlay.classList.add("show");
  // A single, visible close button is the modal's focus target on Xbox Edge.
  document.querySelector("#modalBody [data-action=\"close-modal\"]").focus({preventScroll:true});
}
function closeModal(){
  const overlay=document.getElementById("overlay");
  if(!overlay.classList.contains("show"))return;
  overlay.classList.remove("show");
  if(lastWeaponTrigger && lastWeaponTrigger.isConnected)lastWeaponTrigger.focus({preventScroll:true});
  lastWeaponTrigger=null;
}
document.getElementById("overlay").onclick = e=>{ if(e.target.id==="overlay") closeModal(); };
document.getElementById("overlay").addEventListener("click",e=>{
  if(e.target.closest('[data-action="close-modal"]'))closeModal();
});
document.addEventListener("keydown",e=>{
  const overlay=document.getElementById("overlay");
  if(!overlay.classList.contains("show"))return;
  if(e.key==="Escape"){ e.preventDefault();closeModal();return; }
  // Trap Tab on the one available control so focus cannot wander behind the modal.
  if(e.key==="Tab"){
    e.preventDefault();
    document.querySelector("#modalBody [data-action=\"close-modal\"]").focus({preventScroll:true});
  }
});
 

(function(){
  const get=id=>document.getElementById(id);
  get('aq_weapon').value='AKM';
  function update(){
    const input=get('aq_durability'),raw=input.value.trim(),remaining=Number(raw),tier=get('aq_tier').value;
    const source=(get('aq_gear').value==='vest'?VEST:HELM)[norm(get('aq_weapon').value)];
    const out=get('aq_verdict');
    out.classList.remove('tt-keep','tt-swap');
    if(raw===''||!Number.isFinite(remaining)||remaining<0){out.textContent='Enter a non-negative remaining durability.';return;}
    if(!source){out.textContent='No crossover record for this weapon and equipment.';return;}
    const threshold=parseThreshold(source[tier==='3'?'l3':'l2']);
    if(!threshold.always&&!Number.isFinite(threshold.raw)){out.textContent='No usable crossover threshold for this selection.';return;}
    const swap=remaining===0||(!threshold.always&&remaining<=threshold.raw);
    out.classList.add(swap?'tt-swap':'tt-keep');
    out.textContent=(swap?'Replace with the fresh Level '+(Number(tier)-1):'Keep the current Level '+tier)+' · '+remaining+' durability. '+
      (threshold.always?'Record: keep the higher tier at any durability above zero.':'Recorded swap threshold: '+threshold.label+'.')+
      ' Assumes the documented point-blank '+(get('aq_gear').value==='vest'?'chest':'head')+' hit and a fresh lower-tier replacement.';
  }
  for(const id of ['aq_weapon','aq_gear','aq_tier','aq_durability']){get(id).addEventListener('input',update);get(id).addEventListener('change',update);}
  update();
})();

/* ---------------- 4. REALITY CHECK + COMPARE (folded into the Combat Database panel) ---------------- */
(function(){
  function counts(raw){
    let alwaysL3=0; raw.forEach(r=>{ if(parseThreshold(r[2]).always) alwaysL3++; });
    return {alwaysL3, total:raw.length};
  }
  const vc = counts(VEST_RAW), hc = counts(HELM_RAW);
  document.getElementById("realityCard").innerHTML =
    `<div class="section-h" style="margin-top:0">Reality check</div>
     <p class="helptext" style="margin-bottom:0">Helmets barely ever cross over — ${hc.alwaysL3} of ${hc.total} weapons keep Level 3 head protection valuable at any durability above zero, versus only ${vc.alwaysL3} of ${vc.total} for vests. Chest damage is where the interesting swap decisions live; headshots almost always favor keeping the higher tier.</p>`;
 
  const names = WEAPONS.map(w=>w.name);
  const $ = id=>document.getElementById(id);
  const optHtml = sel => names.map(n=>`<option ${n===sel?'selected':''}>${n}</option>`).join("");
  $("cmpA").innerHTML = optHtml("AKM");
  $("cmpB").innerHTML = optHtml("Beryl M762");
  $("cmpC").innerHTML += names.map(n=>`<option>${n}</option>`).join("");
  function render(){
    const sel = [$("cmpA").value, $("cmpB").value, $("cmpC").value].filter(Boolean);
    const ws = sel.map(n=>WBYNAME[n]);
    const ROW_GROUPS = [
      ["Core Stats", [
        ["Class", w=>w.cls, null],
        ["Damage", w=>w.dmg, "high"],
        ["RPM", w=>w.rpm, "high"],
        ["Velocity", w=>w.vel, "high", v=>v+" m/s"],
        ["DPS", w=>w.dps, "high"],
        ["Magazine", w=>w.mag, "high"],
      ]],
      ["Recoil & Handling", [
        ["Max V.Recoil", w=>w.vRecoil, "low"],
        ["Crouch Recoil", w=> w.crouchMod!=null?`${w.crouchMod} (${w.crouchPct}%)`:null, null],
        ["Horizontal Bias", w=> w.hBiasDir?`${w.hBiasDir} ${w.hBiasVal}`:null, null],
        ["Vertical Speed", w=>w.vertSpeed, "low"],
        ["Horizontal Speed", w=>w.horizSpeed, "low"],
        ["Minimum Horizontal %", w=> w.minH!=null?w.minH+'%':null, null],
      ]],
      ["Vs. Head / Helmet", [
        ["Head dmg", w=> HELM[norm(w.name)]?HELM[norm(w.name)].dmg:null, "high"],
        ["Helm L3→L2", w=> HELM[norm(w.name)]?HELM[norm(w.name)].l3:"—", null],
        ["Helm L2→L1", w=> HELM[norm(w.name)]?HELM[norm(w.name)].l2:"—", null],
      ]],
      ["Vs. Chest / Vest", [
        ["Chest dmg", w=> VEST[norm(w.name)]?VEST[norm(w.name)].dmg:null, "high"],
        ["Vest L3→L2", w=> VEST[norm(w.name)]?VEST[norm(w.name)].l3:"—", null],
        ["Vest L2→L1", w=> VEST[norm(w.name)]?VEST[norm(w.name)].l2:"—", null],
      ]],
      ["Verdict", [
        ["Notable", w=>{
          const {strengths, weaknesses} = getStrengthsWeaknesses(w);
          const s = strengths.length ? "+ "+strengths.join("; ") : "";
          const wk = weaknesses.length ? "− "+weaknesses.join("; ") : "";
          return [s,wk].filter(Boolean).join("<br>");
        }, null],
      ]],
    ];
    const renderRow = ([label,fn,better,fmt])=>{
      const wrap = label==="Notable";
      const style = wrap ? ' style="white-space:normal;max-width:240px;font-size:11.5px;line-height:1.6"' : '';
      const vals = ws.map(fn);
      let winnerIdx = -1;
      if(better && ws.length>1){
        const nums = vals.map(v=> typeof v==='number' ? v : null);
        if(nums.every(v=>v!==null)){
          const best = better==="high" ? Math.max(...nums) : Math.min(...nums);
          if(new Set(nums).size>1) winnerIdx = nums.indexOf(best);
        }
      }
      return `<tr><td>${label}</td>${ws.map((w,i)=>{
        const raw = vals[i];
        const display = raw===null||raw===undefined ? "—" : (fmt ? fmt(raw) : raw);
        const win = i===winnerIdx ? ' class="thresh-always"' : '';
        return `<td${win}${style}>${display}</td>`;
      }).join("")}</tr>`;
    };
    $("cmpTable").innerHTML =
      `<tr><th></th>${ws.map(w=>`<th>${w.name}</th>`).join("")}</tr>` +
      ROW_GROUPS.map(([label,groupRows])=>
        `<tr class="grouplabel"><td colspan="${ws.length+1}">${label}</td></tr>` + groupRows.map(renderRow).join("")
      ).join("");
  }
  ["cmpA","cmpB","cmpC"].forEach(id=>$(id).onchange = render);
  render();
})();

// Expose only what other scripts on this page actually need — everything else above
// (RECOIL_RAW, ALIAS, VEST_RAW, HELM_RAW, HELM, VEST, norm, buildIndex, parseThreshold, panelsEl,
// getStrengthsWeaknesses, openWeaponDetail, closeModal) stays private to this script.
PT.WEAPONS = WEAPONS;
PT.WBYNAME = WBYNAME;
})();
 
