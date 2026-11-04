
// ==================================================================
// EXTENSION PANELS: Range, TTK, Recoil Analyzer, Attachments, Backpack, Data
// ==================================================================
(function(){
// Only PT.WEAPONS and PT.WBYNAME (exposed by the Combat & Armor Intelligence script above) are used
// here — everything else in this script is self-contained.
// ==================================================================

/* ---------------- shared damage model ---------------- */
// Per-class hit-area × class-multiplier system, reverse-engineered from pubgstatistics.com's published
// "Damage multipliers" tables and cross-checked exactly (every body part, to the decimal) against the
// AKM, M416, M16A4, Vector, UMP, M249, RPD, VSS, and M24 weapon pages on 2026-09-10.
// Full 13-body-part table — Pelvis is its own class-multiplier bucket, distinct from the other torso
// parts, since LMG's pelvis multiplier (100%) differs from its chest/clavicle/stomach multiplier (105%).
// "armored" marks whether the selected armor level applies: helmets cover head/neck, vests cover
// clavicle/chest/upper+lower stomach/pelvis, nothing covers the arms or legs.
const BODY_PARTS = {
  head:         {label:"Head",          hitArea:1.00, bucket:"head",  armored:true},
  neck:         {label:"Neck",          hitArea:0.75, bucket:"head",  armored:true},
  clavicle:     {label:"Clavicle",      hitArea:1.00, bucket:"torso", armored:true},
  chest:        {label:"Chest",         hitArea:1.10, bucket:"torso", armored:true},
  upperStomach: {label:"Upper stomach", hitArea:1.00, bucket:"torso", armored:true},
  lowerStomach: {label:"Lower stomach", hitArea:0.95, bucket:"torso", armored:true},
  pelvis:       {label:"Pelvis",        hitArea:1.00, bucket:"pelvis",armored:true},
  upperArm:     {label:"Upper arm",     hitArea:0.60, bucket:"limb",  armored:false},
  forearm:      {label:"Forearm",       hitArea:0.50, bucket:"limb",  armored:false},
  hand:         {label:"Hand",          hitArea:0.30, bucket:"limb",  armored:false},
  thigh:        {label:"Thigh",         hitArea:0.60, bucket:"limb",  armored:false},
  calf:         {label:"Calf",          hitArea:0.50, bucket:"limb",  armored:false},
  foot:         {label:"Foot",          hitArea:0.30, bucket:"limb",  armored:false},
  limb:         {label:"Limbs (avg.)",  hitArea:0.60, bucket:"limb",  armored:false}, // simple-mode alias = upper arm/thigh figure
};
const SIMPLE_PARTS = ["head","chest","limb"];
const DETAILED_PARTS = ["head","neck","clavicle","chest","upperStomach","lowerStomach","pelvis","upperArm","forearm","hand","thigh","calf","foot"];
const CLASS_MULT_DETAILED = {
  AR:     {head:2.35, torso:1.00, pelvis:1.00, limb:0.90},
  DMR:    {head:2.35, torso:1.05, pelvis:1.05, limb:0.95},
  SR:     {head:2.50, torso:1.30, pelvis:1.30, limb:0.95},
  MG:     {head:2.30, torso:1.05, pelvis:1.00, limb:0.90}, // "LMG" on the site; MG is this toolkit's existing class label
  SMG:    {head:2.10, torso:1.05, pelvis:1.05, limb:1.30},
  Pistol: {head:2.10, torso:1.00, pelvis:1.00, limb:1.05}, // site's "Handgun" class
  SG:     {head:1.50, torso:0.90, pelvis:0.90, limb:1.05}, // site's "Shotgun" class — shotguns' pellet mechanic isn't modeled here regardless
};
// Per-weapon head-multiplier overrides. pubgstatistics.com's Dragunov page lists a 2.80 head multiplier
// (53 base -> 148.4 unarmoured headshot at 0m) instead of the 2.35 DMR class value; its Mk12 and Mk14 pages
// show the normal 2.35. Only weapons whose page was checked are listed — other weapons' multiplier columns
// have not been individually re-verified. Applies to head and neck (both use the head bucket).
const WEAPON_HEAD_MULT = {"SVD Dragunov":2.80};
// Real per-weapon falloff tables [distance_m, baseDamage], sourced directly from each weapon's
// pubgstatistics.com page (fetched 2026-09-10, patch 42.3 data unless the page said otherwise). Every
// distances outside published checkpoints are deliberately unknown; there is no generic falloff.
const FALLOFF_TABLES = {
  "AWM":  [[0,105.0],[100,105.0],[150,104.9],[200,104.2],[250,103.1],[300,101.9],[400,99.4],[500,97.0]],
  "AKM":  [[0,48.0],[25,48.0],[50,48.0],[100,45.5],[150,42.4],[200,39.3],[250,37.0],[300,36.0],[400,36.0],[500,36.0]],
  "M416": [[0,40.0],[25,40.0],[50,40.0],[100,39.0],[150,37.5],[200,35.8],[250,34.1],[300,32.5],[400,30.3],[450,30.0]],
  "M16A4":[[0,43.0],[25,43.0],[50,43.0],[100,42.8],[150,41.6],[200,39.9],[250,37.8],[300,35.8],[400,32.7],[500,32.3]],
  "Vector":[[0,31.0],[25,28.1],[50,24.5],[100,20.4],[150,18.9],[200,18.6],[250,18.6],[275,18.6]],
  "UMP9": [[0,42.0],[25,41.5],[50,39.8],[100,34.5],[150,30.8],[200,29.5],[250,29.4]],
  "M249": [[0,41.0],[25,41.0],[50,41.0],[100,40.4],[150,39.0],[200,37.3],[250,35.7],[300,34.3],[400,32.8],[500,32.8]],
  "RPD":  [[0,43.0],[25,43.0],[50,42.9],[100,41.8],[150,40.6],[200,39.3],[250,38.1],[300,36.9],[400,34.6],[500,34.4]],
  "VSS Vintorez":[[0,45.0],[25,45.0],[50,45.0],[100,44.1],[150,42.7],[200,41.3],[250,40.5],[300,40.5],[400,40.5],[500,40.5]],
  "M24":  [[0,75.0],[25,75.0],[50,75.0],[100,75.0],[150,74.8],[200,74.4],[250,74.0],[300,73.6],[400,72.8],[500,72.0]],
  "O12":  [[2,98.7],[25,92.2],[50,88.8]],
  "Kar98k":[[0,79.0],[25,79.0],[50,79.0],[100,79.0],[150,78.5],[200,78.0],[250,77.5],[300,77.0],[400,76.0],[500,75.1]],
  "R1895":[[0,64.0],[25,63.4],[50,62.9],[100,61.8]],
  "Desert Eagle":[[0,62.0],[25,62.0],[45,60.1]],
  "MK47 Mutant":[[0,49.0],[25,49.0],[50,49.0],[100,48.2],[150,45.8],[200,43.2],[250,40.8],[300,38.7],[400,36.8],[450,36.8]],
  "Groza":[[0,47.0],[25,47.0],[50,47.0],[100,46.5],[150,45.0],[200,43.2]],
  "SLR":  [[0,49.0],[25,49.0],[50,49.0],[100,49.0],[150,47.9],[200,46.4],[250,44.9],[300,43.4],[400,40.5],[500,38.2]],
  "SKS":  [[0,47.0],[25,47.0],[50,47.0],[100,46.9],[150,45.7],[200,44.3],[250,43.0],[300,41.7],[400,39.0],[500,37.6]],
  "Beryl M762":[[0,44.0],[25,44.0],[50,44.0],[100,41.7],[150,38.9],[200,36.0],[250,33.9],[300,33.0],[350,33.0]],
  "ACE 32":[[0,43.0],[25,43.0],[50,43.0],[100,40.8],[150,38.0],[200,35.2],[250,33.2],[300,32.3],[350,32.3]],
  "SCAR-L":[[0,42.0],[25,42.0],[50,42.0],[100,41.3],[150,40.0],[200,38.4],[250,36.7],[300,35.3],[350,33.8]],
  "QBZ95":[[0,42.0],[25,42.0],[50,42.0],[100,40.4],[150,38.5],[200,36.8],[250,35.4],[300,34.0],[400,32.1]],
  "Mini 14":[[0,42.0],[25,42.0],[50,42.0],[100,41.7],[150,40.3],[200,38.9],[250,37.5],[300,36.0],[400,33.2],[500,33.2]],
  "MG3":  [[0,42.0],[25,42.0],[50,42.0],[100,40.8],[150,39.6],[200,38.4],[250,37.2],[300,36.1],[400,33.9]],
  "K2":   [[0,41.0],[25,41.0],[50,41.0],[100,40.3],[150,38.8],[200,37.3],[250,35.3],[275,34.3]],
  "G36C": [[0,41.0],[25,41.0],[50,41.0],[100,40.3],[150,38.9],[200,37.3],[250,35.6]],
  "AUG A3":[[0,40.0],[25,40.0],[50,40.0],[100,39.1],[150,37.6],[200,35.9],[250,34.2],[300,32.6],[400,30.4]],
  "FAMAS":[[0,39.0],[25,39.0],[50,39.0],[100,38.8],[150,37.6],[200,36.1],[225,35.5]],
  "Tommy Gun":[[0,40.0],[25,39.3],[50,37.7],[100,33.4],[150,29.8],[160,29.2]],
  "JS9":  [[0,32.0],[25,31.9],[50,31.4],[100,27.4],[150,22.1],[200,19.7],[250,19.4],[275,19.2]],
  "MP5K": [[0,32.0],[25,31.4],[50,29.5],[100,24.9],[150,21.0],[200,19.2],[250,19.2],[275,19.2]],
  "P90":  [[0,35.0],[25,35.0],[50,35.0],[100,33.3],[150,31.6],[200,29.9]],
  "MP9":  [[0,31.0],[25,28.6],[50,25.3],[100,21.1],[120,20.2]],
  "Micro Uzi":[[0,26.0],[25,23.9],[50,21.2],[100,17.6],[120,16.9]],
  // Added 2026-10-22 from each weapon's pubgstatistics.com page (patch 43.1/43.2). Beyond the last point the
  // site says damage is unknown; no values are now generated past the last measured checkpoint.
  "Mk12":[[0,43.0],[25,43.0],[50,42.9],[100,41.7],[150,40.4],[200,39.2],[250,37.9],[300,36.6],[400,34.1],[500,34.0]],
  "MK14 EBR":[[0,54.0],[25,54.0],[50,54.0],[100,54.0],[150,53.5],[200,52.3],[250,50.9],[300,49.5],[400,47.0],[500,45.9]],
  "SVD Dragunov":[[0,53.0],[25,53.0],[50,53.0],[100,51.9],[150,49.8],[200,47.8],[250,45.8],[300,43.8],[400,39.8],[500,39.8]],
  "Lynx AMR":[[2,118.0],[25,118.0],[50,118.0],[100,118.0],[150,117.9],[200,117.1],[250,115.8],[300,114.5],[350,113.1]],
  "G18C":[[0,23.0],[25,21.6],[50,20.4],[60,20.1]],
  "P92":[[0,34.0],[25,33.0],[50,32.0],[90,30.4]],
  "Skorpion":[[0,22.0],[25,22.0],[50,21.0],[90,18.4]],
};
// Strict evidence policy: numerical range results require an actual source checkpoint.
function measuredValueAt(rows, range){
  if(!rows || !Number.isFinite(range)) return null;
  const point = rows.find(([metres]) => metres === range);
  return point ? point[1] : null;
}
function sourcedRangeRows(w){
  return FALLOFF_TABLES[w.name] || PELLET_FALLOFF[w.name] || null;
}
// Bullet drop, sourced from winnermeta.win telemetry-based flight-time estimates (2026 snapshots).
// WinnerMeta computes estimated gravity displacement using 1/2*g*t^2, not measured bullet impacts,
// aim-point deviation, sight zero, or scope holdover. The 200/400/600 keys are the START of
// 200–250/400–450/600–650m aggregate buckets, not observations precisely at their start.
// 0m is a mathematical zero; no interpolation or extension between or beyond published buckets.
// This is beta telemetry from a rolling 14-day sample, not a fixed-patch official figure.
const DROP_TABLES = {
  "AUG A3": [[0,0],[200,35.2],[400,177.6]],
  "AKM":    [[0,0],[200,66.0],[400,341.6]],
  "M416":   [[0,0],[200,36.0],[400,187.7]],
  "AWM":    [[0,0],[200,27.1],[400,123.0],[600,290.1]],
  "Kar98k": [[0,0],[200,44.1],[400,172.3],[600,404.0]],
  "Vector": [[0,0],[200,198.2],[400,1595.5]],
  "M24":    [[0,0],[200,40.4],[400,168.8],[600,429.3]],
  "Beryl M762":[[0,0],[200,55.0],[400,291.7]],
  "SCAR-L": [[0,0],[200,36.8],[400,197.6]],
  "M249":   [[0,0],[200,35.2],[400,172.9],[600,504.8]],
  "UMP9":   [[0,0],[200,218.0],[400,961.8]],
  "Groza":  [[0,0],[200,55.0]],
  "Mini 14":[[0,0],[200,27.8],[400,145.0],[600,446.0]],
  "SKS":    [[0,0],[200,44.4],[400,198.2],[600,563.6]],
  "K2":     [[0,0],[200,43.8]],
  "QBZ95":  [[0,0],[200,34.9],[400,176.7]],
  // Added 2026-10-22 from winnermeta.win weapon pages (14-day rolling windows, Jul-Sep 2026 snapshots).
  "MG3":    [[0,0],[200,44.1],[400,179.9]],
  "Mk12":   [[0,0],[200,35.2],[400,178.2],[600,561.0]],
  "VSS Vintorez":[[0,0],[200,139.7],[400,525.9],[600,1231.0]],
  "MP9":    [[0,0],[200,197.6]],
  "G36C":   [[0,0],[200,35.6]],
  // Added 2026-10-25: WinnerMeta telemetry-derived 50m distance-bin gravity estimates.
  // Integer keys (200,400,600) are BUCKET STARTS, not exact-distance measurements.
  "RPD":    [[0,0],[200,45.9],[400,203.2]],
  "ACE 32": [[0,0],[200,58.7],[400,317.1]],
  "M16A4":  [[0,0],[200,35.2],[400,177.0]],
  "MK14 EBR":[[0,0],[200,35.2],[400,158.6]],
  "SVD Dragunov":[[0,0],[200,44.1],[400,183.5],[600,512.8]],
  "MK47 Mutant":[[0,0],[200,54.7],[400,265.4]],
  "P90":    [[0,0],[200,66.4]],
  "MP5K":   [[0,0],[200,219.3]],
  "FAMAS":  [[0,0],[200,34.9]],
};
// WinnerMeta's own independently-measured muzzle velocity, for comparison against this toolkit's supplied
// value — shown as a secondary reference, not used to override the supplied WEAPONS velocity anywhere.
const MEASURED_MUZZLE_VEL = {"AUG A3":927, "AKM":762, "M416":921, "AWM":1009, "Kar98k":823, "Vector":389, "M24":860, "Beryl M762":786, "SCAR-L":916, "M249":953, "UMP9":368, "Groza":764, "Mini 14":1057, "SKS":845, "K2":924, "QBZ95":962, "MG3":860, "Mk12":955, "VSS Vintorez":440, "MP9":405, "G36C":927};
// PUBG 43.2 extracted muzzle velocity: separate from WinnerMeta's derived gravity estimates.
const GAME_MUZZLE_VEL_43_2 = {
  "Lynx AMR":1200, "AWM":945, "O12":625, "Kar98k":760, "M24":790,
  "R1895":330, "Desert Eagle":450, "MK14 EBR":853, "SVD Dragunov":830,
  "MK47 Mutant":780, "SLR":870, "AKM":715, "Groza":715, "SKS":800,
  "VSS Vintorez":430, "Beryl M762":715, "M16A4":900, "ACE 32":720,
  "Mk12":900, "SCAR-L":870, "QBZ95":870, "Mini 14":990, "UMP9":400,
  "MG3":820, "K2":880, "G36C":870, "M249":915, "M416":880,
  "AUG A3":890, "Tommy Gun":280, "FAMAS":925, "P90":716, "P92":380,
  "MP5K":400, "JS9":400, "MP9":400, "DBS":360, "Micro Uzi":350,
  "S686":370, "S12K":350, "G18C":375, "Skorpion":350,
  "Sawn-off":330, "RPD":735
};
function knownMuzzleVelocity(w){
  return GAME_MUZZLE_VEL_43_2[w.name] ?? MEASURED_MUZZLE_VEL[w.name] ?? null;
}
// Physical lower bound for a projectile fired toward a range marker:
// the projectile cannot arrive quicker than straight-line distance at its
// initial muzzle speed if air drag slows it. This is *not* in-game flight
// time, not a drag simulation, and does not fill unpublished gravity-estimate checkpoints.
function minimumIdealFlightTime(w,range){
  const speed=knownMuzzleVelocity(w);
  return Number.isFinite(range) && range>=0 && Number.isFinite(speed) && speed>0
    ? range/speed : null;
}
function hasDropData(w){ return DROP_TABLES[w.name] != null; }
function dropAtRange(w, range){
  return measuredValueAt(DROP_TABLES[w.name], range);
}
function hasExactFalloff(w){ return FALLOFF_TABLES[w.name] != null; }
// Shotguns fire multiple pellets per trigger pull; the WEAPONS array's dmg field for these four is a
// single pellet's damage (matches pubgstatistics.com's per-pellet figure), not the shot's total output.
// Counts/per-pellet damage sourced from pubgstatistics.com's "X-Y base damage (one pellet up to the full
// pattern)" wording, fetched 2026-09-10: DBS 28-252, S686 26-234, S12K 23-207, Sawn-off 21-168.
// Current 43.2 game-file extract says Sawn-off fires NINE pellets per shell.
// The pubgstatistics.com 21–168 display implies eight; that headline range
// conflicts with the newer raw gun-file pellet count, so use the game-file
// count of 9 without fabricating pellet-hit distribution. Older wikis also
// describe an eight-pellet historical setup. O12 fires a slug, not pellets.
const SHOTGUN_PELLETS = {
  "DBS":{count:9, dmgPerPellet:28},
  "S686":{count:9, dmgPerPellet:26},
  "S12K":{count:9, dmgPerPellet:23},
  "Sawn-off":{count:9, dmgPerPellet:21},
};
// Per-PELLET damage falloff [distance_m, damagePerPellet] from each shotgun's pubgstatistics.com page
// (patch 43.1/43.2, fetched 2026-10-22; "Shotgun values are per pellet"). Measured range only: DBS to 70m,
// S686 to 80m, S12K to 70m, Sawn-off to 50m — the site states damage past that is unknown. Per-pellet damage
// really does fall hard with range (S12K 23.0 -> 9.8 by 25m), which the earlier model ignored: it applied
// only a spread-based hit fraction to flat full-pattern damage.
const PELLET_FALLOFF = {
  "DBS":     [[0,28.0],[5,27.9],[10,26.4],[15,24.4],[20,22.3],[25,20.3],[30,18.5],[35,16.9],[40,16.2],[45,15.7],[50,15.0],[55,14.4],[60,13.8],[65,13.4],[70,13.0]],
  "S686":    [[0,26.0],[5,26.0],[10,23.3],[15,19.3],[20,17.8],[25,16.4],[30,15.2],[35,14.2],[40,13.2],[45,12.3],[50,11.5],[55,10.7],[60,9.8],[65,9.1],[70,8.4],[75,7.7],[80,6.9]],
  "S12K":    [[0,23.0],[5,21.7],[10,18.6],[15,15.1],[20,11.7],[25,9.8],[30,8.4],[35,7.8],[40,7.4],[45,7.1],[50,6.8],[55,6.4],[60,6.0],[65,5.7],[70,5.4]],
  "Sawn-off":[[0,21.0],[2,21.0],[4,20.9],[6,20.4],[8,19.3],[10,17.9],[12,16.6],[14,15.0],[16,13.6],[18,12.3],[20,11.5],[22,11.2],[24,10.9],[26,10.7],[28,10.4],[30,10.2],[32,10.0],[34,9.7],[36,9.5],[38,9.3],[40,9.0],[42,8.8],[44,8.5],[46,8.3],[48,8.2],[50,8.0]],
};
// Historical spread estimates were retired. Old cone-angle tables and assumed
// target widths do not verify how many shotgun pellets actually hit a player.
function baseDamageAtRange(w, range){
  // Per-pellet damage is not actual whole-shot damage.
  if(SHOTGUN_PELLETS[w.name]) return null;
  return measuredValueAt(FALLOFF_TABLES[w.name], range);
}
function armorMultFor(part, level){
  if(!part.armored) return 1.00;
  return {0:1.00,1:0.70,2:0.60,3:0.45}[level] ?? 1.00;
}
function finalDamageAt(w, range, hitbox, armorLevel, stance){
  const base = baseDamageAtRange(w, range, stance);
  if(base == null) return null;
  const part = BODY_PARTS[hitbox] || BODY_PARTS.chest;
  const cm = CLASS_MULT_DETAILED[w.cls] || CLASS_MULT_DETAILED.AR;
  const classMult = (part.bucket==="head" && WEAPON_HEAD_MULT[w.name]) || cm[part.bucket];
  const beforeArmor = base * part.hitArea * classMult;
  return beforeArmor * armorMultFor(part, armorLevel);
}
// Minimum shells needed in the idealized case that EVERY pellet connects
// with the selected hitbox. This is a mathematical lower bound, not an
// in-match prediction: hit probability and pellet spread are NOT modelled.
// Only available at published per-pellet damage checkpoints.
function shotgunMinShellsAt(w,range,hitbox,armorLevel){
  const config=SHOTGUN_PELLETS[w.name];
  const perPellet=measuredValueAt(PELLET_FALLOFF[w.name],range);
  if(!config || perPellet==null || !Number.isInteger(config.count) || config.count<=0) return null;
  const part=BODY_PARTS[hitbox] || BODY_PARTS.chest;
  const multipliers=CLASS_MULT_DETAILED[w.cls];
  if(!part || !multipliers) return null;
  const classMult=(part.bucket==="head" && WEAPON_HEAD_MULT[w.name]) || multipliers[part.bucket];
  if(!Number.isFinite(classMult) || !Number.isFinite(part.hitArea)) return null;
  const damageIfAllConnect=perPellet*config.count*part.hitArea*classMult*armorMultFor(part,armorLevel);
  return htkFor(damageIfAllConnect);
}
function htkFor(dmg){ return dmg == null ? null : (dmg>0 ? Math.ceil(100/dmg) : null); }
function pureTtk(htk, rpm){ return htk == null ? null : (htk>1 ? (htk-1)/(rpm/60) : 0); }

// ================= HIT ZONE EXPLORER DATA ADAPTER =================
// Pure, side-effect-free bridge between the established damage functions and
// the forthcoming all-at-once front-view body map. No UI/DOM references.
// Standard helmet and vest levels independently cover their documented zones.
// Intact equipment only; no armour-durability simulation.
function hitZoneEquipmentType(part){
  if(!part.armored) return "None";
  return part.bucket==="head" ? "Helmet" : "Vest";
}
function armorLevelForHitZone(part, helmetLevel, vestLevel){
  const gear=hitZoneEquipmentType(part);
  return gear==="Helmet" ? helmetLevel : (gear==="Vest" ? vestLevel : 0);
}
function getAllZoneDamageForWeapon(w, distance, helmetLevel, vestLevel){
  // A malformed selection must never silently display unarmoured damage.
  for(const [key,level] of [["helmet",helmetLevel],["vest",vestLevel]]){
    if(!Number.isInteger(level) || level<0 || level>3)
      throw new RangeError(key+" level must be an integer from 0 to 3");
  }
  if(!w || typeof w.name!=="string" || !CLASS_MULT_DETAILED[w.cls])
    throw new TypeError("A known weapon class and name are required");

  const checkpoint=measuredValueAt(sourcedRangeRows(w),distance);
  const isPelletShotgun=Boolean(SHOTGUN_PELLETS[w.name]);
  // A shotgun's published value is *per pellet*; actual total pellet
  // connections, whole-shell damage, and HTK are unknown.
  const sourceStatus=checkpoint==null ? "no-data" :
    (isPelletShotgun ? "per-pellet-only" : "measured-checkpoint");
  const classBuckets=CLASS_MULT_DETAILED[w.cls];
  return DETAILED_PARTS.map(id=>{
    const part=BODY_PARTS[id];
    const gear=hitZoneEquipmentType(part);
    const armorLevel=armorLevelForHitZone(part,helmetLevel,vestLevel);
    const classMultiplier=(part.bucket==="head" && WEAPON_HEAD_MULT[w.name]) ||
      classBuckets[part.bucket];
    const damage=sourceStatus==="measured-checkpoint"
      ? finalDamageAt(w,distance,id,armorLevel) : null;
    return {
      id, label:part.label,
      damage, htk:damage==null ? null : htkFor(damage),
      // Separately labelled lower bound; all pellets must hit this exact zone
      // for every shell. Never a prediction of real shotgun damage/HTK.
      idealMinShells:isPelletShotgun && sourceStatus==="per-pellet-only"
        ? shotgunMinShellsAt(w,distance,id,armorLevel) : null,
      hitAreaMultiplier:part.hitArea,
      classMultiplier,
      armorMultiplier:armorMultFor(part,armorLevel),
      armorLevel,
      armorSource:armorLevel>0 ? gear : "None",
      armorSlot:gear,
      sourceStatus
    };
  });
}

// PUBG's 2026 Dev Letter explicitly publishes *post-42.3* base reloads:
// RPD 5.2s, M249 5.962s. These values already reflect the LMG balance
// changes, so NEVER apply the patch's approximate extra -25% to them.
// MG3 animation duration was not separately verified: no precise TTK with
// reload is claimed for MG3. Leave the original w.reload entries untouched
// for provenance / rollback; calculation uses the override below.
const LMG_RELOAD_2026 = Object.freeze({"RPD":5.2,"M249":5.962,"MG3":null});
function reloadSecondsForWeapon(w){
  if(Object.prototype.hasOwnProperty.call(LMG_RELOAD_2026,w.name))
    return LMG_RELOAD_2026[w.name];
  return Number.isFinite(w.reload) && w.reload>0 ? w.reload : null;
}
function debounce(fn, ms){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}
function setBar(id, value, max){
  const bar = document.getElementById(id+"_bar");
  if(!bar) return;
  const pct = max>0 ? Math.min(100, Math.max(0, (value/max)*100)) : 0;
  bar.style.width = (isFinite(pct)?pct:0)+"%";
}
function fillWeaponSelect(sel, def){
  sel.innerHTML = PT.WEAPONS.map(w=>`<option ${w.name===def?'selected':''}>${w.name}</option>`).join("");
}
function fillHitboxSelect(sel, detailed, keepValue){
  const ids = detailed ? DETAILED_PARTS : SIMPLE_PARTS;
  const prev = keepValue || sel.value;
  sel.innerHTML = ids.map(id=>`<option value="${id}">${BODY_PARTS[id].label}</option>`).join("");
  sel.value = ids.includes(prev) ? prev : (detailed ? "chest" : "chest");
}
function drawLineChart(canvas, series, opts={}){
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height, pad = 36;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#0f161d"; ctx.fillRect(0,0,W,H);
  const allY = series.flatMap(s=>s.data.map(p=>p.y));
  const minY = Math.min(0,...allY), maxY = Math.max(...allY,1);
  const allX = series.flatMap(s=>s.data.map(p=>p.x));
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const xAt = x => pad + (W-2*pad) * ((x-minX)/(maxX-minX||1));
  const yAt = y => H-pad - (H-2*pad) * ((y-minY)/(maxY-minY||1));
  ctx.strokeStyle = "#223140"; ctx.lineWidth = 1;
  for(let i=0;i<=4;i++){
    const gy = pad + (H-2*pad)*i/4;
    ctx.beginPath(); ctx.moveTo(pad,gy); ctx.lineTo(W-pad,gy); ctx.stroke();
  }
  series.forEach(s=>{
    if(opts.pointsOnly){
      // Separate markers denote actual published checkpoints; do not draw a
      // connecting line that visually implies measured intermediate values.
      ctx.fillStyle = s.color;
      s.data.forEach(p=>{
        ctx.beginPath();
        ctx.arc(xAt(p.x),yAt(p.y),3.5,0,Math.PI*2);
        ctx.fill();
      });
    } else {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
      s.data.forEach((p,i)=>{ const x=xAt(p.x), y=yAt(p.y); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.stroke();
    }
  });
  ctx.fillStyle = "#71899b"; ctx.font = "10px ui-monospace,monospace";
  ctx.fillText(String(Math.round(minX)), pad, H-14);
  ctx.fillText(String(Math.round(maxX)), W-pad-24, H-14);
  let lx = pad;
  series.forEach(s=>{
    ctx.fillStyle = s.color; ctx.fillRect(lx, 10, 8, 8);
    ctx.fillStyle = "#eef4f8"; ctx.fillText(s.label, lx+12, 18);
    lx += ctx.measureText(s.label).width + 34;
  });
}

// Read-only presentation adapter: all numbers reuse the established damage engine.
PT.DAMAGE_GUIDE=Object.freeze({
  parts:Object.freeze(DETAILED_PARTS.map(id=>Object.freeze({id,...BODY_PARTS[id]}))),
  classes:Object.freeze(Object.keys(CLASS_MULT_DETAILED)),
  rows(cls,helmet=2,vest=2){
    if(!CLASS_MULT_DETAILED[cls])throw new RangeError('Unknown weapon class');
    for(const level of [helmet,vest])if(!Number.isInteger(level)||level<0||level>3)throw new RangeError('Invalid gear level');
    return DETAILED_PARTS.map(id=>{
      const p=BODY_PARTS[id],level=armorLevelForHitZone(p,helmet,vest),classMultiplier=CLASS_MULT_DETAILED[cls][p.bucket],gear=armorMultFor(p,level);
      return {id,label:p.label,hitArea:p.hitArea,classMultiplier,gear,combined:p.hitArea*classMultiplier*gear};
    });
  },
  breakdown(w,distance,zone,helmet,vest){
    const rows=getAllZoneDamageForWeapon(w,distance,helmet,vest),row=rows.find(r=>r.id===zone);
    if(!row)throw new RangeError('Unknown hit zone');
    const atRange=baseDamageAtRange(w,distance);
    return {...row,base:w.dmg,distanceFactor:atRange==null?null:atRange/w.dmg,atRange,
      pellet:Boolean(SHOTGUN_PELLETS[w.name]),damage:row.damage};
  }
});
/* ================= 1. EFFECTIVE RANGE & DAMAGE ================= */
// Strict source-only policy: show published checkpoints, never inferred distances
// or assumed shotgun pellet connections.
(function(){
  const $ = id => document.getElementById(id);
  fillWeaponSelect($("rg_weapon"), "AKM");
  const rangeSlider = $("rg_range");
  let previousWeaponName = null;
  let preferredRange = 100;
  function currentWeapon(){ return PT.WBYNAME[$("rg_weapon").value]; }
  function isPelletShotgun(w){ return SHOTGUN_PELLETS[w.name] != null; }
  function rowsFor(w){ return sourcedRangeRows(w); }

  function selectMeasuredRange(w) {
    const rows = rowsFor(w);
    $("rg_stanceField").style.display = "none"; // no verified hip-fire / ADS impact count
    if(!rows || !rows.length) {
      rangeSlider.disabled = true;
      rangeSlider.min = "0"; rangeSlider.max = "0"; rangeSlider.value = "0";
      $("rg_rangeLabel").textContent = "No recorded distance";
      $("rg_rangeEvidence").textContent = "No damage readings available.";
      previousWeaponName = w.name;
      return null;
    }
    rangeSlider.disabled = false;
    rangeSlider.min = "0";
    rangeSlider.max = String(rows.length-1);
    rangeSlider.step = "1";
    if(previousWeaponName !== w.name) {
      let chosen = 0;
      for(let k=1;k<rows.length;k++){
        if(Math.abs(rows[k][0]-preferredRange)<Math.abs(rows[chosen][0]-preferredRange)) chosen=k;
      }
      rangeSlider.value = String(chosen);
      previousWeaponName = w.name;
    }
    const chosenIndex = Math.max(0, Math.min(rows.length-1, Number(rangeSlider.value)||0));
    const distance = rows[chosenIndex][0];
    $("rg_rangeLabel").textContent = distance+" m";
    $("rg_rangeEvidence").textContent =
      w.name+": recorded "+rows[0][0]+"–"+rows[rows.length-1][0]+
      "m ("+rows.length+" measured checkpoints). No figures beyond this range or between sampled points.";
    return distance;
  }

  function updateDrop(w, range) {
    const data=DROP_TABLES[w.name],velocity=knownMuzzleVelocity(w);
    $("rg_muzzlecmp").textContent=velocity==null?"No data":velocity+" m/s";
    $("rg_velocityLabel").textContent=Object.prototype.hasOwnProperty.call(GAME_MUZZLE_VEL_43_2,w.name)
      ? "Muzzle velocity (43.2 game files)"
      : "Muzzle velocity (historical measurement)";
    const point=dropAtRange(w,range);
    if(point==null){
      $("rg_drop").textContent="No data";
      $("rg_holdover").textContent="No data";
      $("rg_dropNote").textContent=data?
        "No gravity-drop estimate for "+range+"m. Available bucket starts: "+data.map(p=>p[0]+"m").join(", ")+
        ".":"No gravity-drop estimates for this weapon.";
      return;
    }
    $("rg_drop").textContent=point.toFixed(1);
    // WinnerMeta's observations cover 50m distance buckets; approximate angular
    // equivalent uses the bucket midpoint, never a fabricated exact-range holdover.
    const effectiveRange=range>0 ? range+25 : 0;
    $("rg_holdover").textContent=(effectiveRange>0?(point/100)/effectiveRange*1000:0).toFixed(2);
    $("rg_dropNote").textContent=range===0
      ? "Mathematical zero at muzzle; no telemetry drop measurement at 0m."
      : "Telemetry-derived gravity estimate for the "+range+"–"+(range+50)+"m bucket (not an exact "+range+"m impact reading). Equivalent angle uses bucket midpoint and is not scope holdover.";
  }
  function updateEvidence(w,range){
    const rows=rowsFor(w);
    if(!rows){
      $("rg_approxNote").textContent="No damage readings available.";
      return;
    }
    const first=rows[0][0],last=rows[rows.length-1][0];
    $("rg_approxNote").textContent=isPelletShotgun(w)?
      "Available range: "+first+"–"+last+"m. Minimum shells assume all "+SHOTGUN_PELLETS[w.name].count+" pellets hit the selected area; actual shots may need more. TTK is unknown.":
      "Available range: "+first+"–"+last+"m. Damage uses the selected hitbox and armor.";
  }

  function updatePoint(w,range){
    const pellet = isPelletShotgun(w);
    const hitbox = $("rg_hitbox").value;
    const armor = +$("rg_armor").value;
    const damage = range==null ? null :
      pellet ? measuredValueAt(PELLET_FALLOFF[w.name], range) :
      finalDamageAt(w,range,hitbox,armor);
    const htk = pellet ? shotgunMinShellsAt(w,range,hitbox,armor) : htkFor(damage);
    const ttk = pellet ? null : pureTtk(htk,w.rpm);
    $("rg_dmgLabel").textContent = pellet ? "Measured base dmg / pellet" : "Damage at checkpoint";
    $("rg_htkLabel").textContent = pellet ? "Minimum shells (all pellets hit)" : "Hits to kill";
    $("rg_dmg").textContent = damage==null ? "No data" : damage.toFixed(1);
    $("rg_htk").textContent = htk==null ? "No data" : String(htk);
    $("rg_ttk").textContent = ttk==null ? "No data" : ttk.toFixed(2);
    // Ideal minimum is not real PUBG flight time: drag and the curved
    // trajectory make actual travel slower. Preserve a clear unknown state
    // when no velocity or measured range is available.
    const idealFlight=range==null ? null : minimumIdealFlightTime(w,range);
    $("rg_flight").textContent = idealFlight==null ? "No data" : idealFlight.toFixed(3)+" s";
    setBar("rg_dmg",damage, (pellet ? SHOTGUN_PELLETS[w.name].dmgPerPellet : w.dmg)*1.3);
    setBar("rg_htk",htk,8);
    setBar("rg_ttk",ttk,2);
    if(range == null) {
      $("rg_drop").textContent = "No data";
      $("rg_holdover").textContent = "No data";
      $("rg_muzzlecmp").textContent = "No data";
      $("rg_dropNote").textContent = "No supported range available.";
    } else updateDrop(w,range);
    updateEvidence(w,range);
  }

  function updateCharts(){
    const w = currentWeapon();
    const rows = rowsFor(w);
    const pellet = isPelletShotgun(w);
    const ctx = $("rg_chartDmg").getContext("2d");
    const table = $("rg_brackets");
    if(!rows || !rows.length){
      ctx.clearRect(0,0,$("rg_chartDmg").width,$("rg_chartDmg").height);
      $("rg_chartTitle").textContent = "No recorded damage chart";
      table.innerHTML = '<tr><td>No recorded damage checkpoints for this weapon.</td></tr>';
      return;
    }
    const hitbox = $("rg_hitbox").value;
    const armor = +$("rg_armor").value;
    const points = rows.map(([range,perPellet])=>({
      x:range,
      y:pellet ? perPellet : finalDamageAt(w,range,hitbox,armor)
    })).filter(p=>p.y!=null);
    $("rg_chartTitle").textContent = pellet ?
      "Measured base damage per pellet ("+rows[0][0]+"–"+rows[rows.length-1][0]+"m)" :
      "Calculated damage at measured checkpoints ("+rows[0][0]+"–"+rows[rows.length-1][0]+"m)";
    if(points.length) drawLineChart($("rg_chartDmg"), [{
      label:pellet ? "Base damage / pellet" : "Damage at recorded distances",
      color:"#8bd8e8", data:points
    }], {pointsOnly:true});
    if(pellet){
      table.innerHTML =
        '<tr><th>Recorded range</th><th>Minimum shells (all pellets hit)</th><th>TTK</th></tr>'+
        rows.map(([range])=>{
          const min=shotgunMinShellsAt(w,range,hitbox,armor);
          return "<tr><td>"+range+"m</td><td>"+(min==null?"No data":min)+
            "</td><td>No data</td></tr>";
        }).join("");
      return;
    }
    table.innerHTML =
      '<tr><th>Measured range</th><th>Hits to kill (calculated)</th><th>TTK (s, calculated)</th></tr>'+
      points.map(p=>{
        const hits=htkFor(p.y), time=pureTtk(hits,w.rpm);
        return "<tr><td>"+p.x+"m</td><td>"+(hits==null?"No data":hits)+
          "</td><td>"+(time==null?"No data":time.toFixed(2))+"</td></tr>";
      }).join("");
  }

  const compareSelect=$("rg_compare");
  for(const weapon of PT.WEAPONS)compareSelect.add(new Option(weapon.name,weapon.name));
  function updateComparison(){
    const ref=PT.WBYNAME[compareSelect.value],w=currentWeapon(),table=$("rg_compareTable"),canvas=$("rg_compareChart");
    if(!ref){table.replaceChildren();canvas.hidden=true;$("rg_compareNote").textContent="Choose a reference weapon. Comparisons use the same hitbox and equipment.";return;}
    const hitbox=$("rg_hitbox").value,armor=Number($("rg_armor").value),a=rowsFor(w)||[],b=rowsFor(ref)||[];
    const pellet=isPelletShotgun(w),otherPellet=isPelletShotgun(ref);
    const value=(gun,distance)=>isPelletShotgun(gun)?measuredValueAt(rowsFor(gun),distance):finalDamageAt(gun,distance,hitbox,armor);
    const selected=parseFloat($("rg_rangeLabel").textContent);
    const num=n=>Number.isFinite(n)?n.toFixed(1):"No data";
    const unit=gun=>isPelletShotgun(gun)?"base damage / pellet":"damage to selected hitbox";
    const distances=[...new Set([...a,...b].map(row=>row[0]))].sort((x,y)=>x-y);
    table.innerHTML='<caption>Exact source checkpoints. A missing reading stays No data; no interpolation. Selected: '+(Number.isFinite(selected)?selected+' m':'No recorded distance')+'.</caption><thead><tr><th scope="col">Distance</th><th scope="col">'+w.name+' · '+unit(w)+'</th><th scope="col">'+ref.name+' · '+unit(ref)+'</th></tr></thead><tbody>'+
      distances.map(distance=>'<tr'+(distance===selected?' class="tt-selected-checkpoint"':'')+'><th scope="row">'+distance+' m</th><td>'+num(value(w,distance))+'</td><td>'+num(value(ref,distance))+'</td></tr>').join('')+'</tbody>';
    const sameUnits=pellet===otherPellet;
    canvas.hidden=!sameUnits||!a.length||!b.length;
    $("rg_compareNote").textContent=(Number.isFinite(selected)?'At '+selected+' m: '+w.name+' '+num(value(w,selected))+'; '+ref.name+' '+num(value(ref,selected))+'. ':'')+
      (sameUnits?(pellet?'Both series show base damage per pellet, not whole-shell damage. ':'Both series use the selected hitbox and equipment. '):'Mixed units: shotgun per-pellet damage and player damage are listed separately; no combined chart. ')+
      'Markers show recorded checkpoints only. No connecting curve or inferred intermediate damage.';
    if(!canvas.hidden&&$("rg_comparison").open){
      drawLineChart(canvas,[{label:w.name,color:'#e9bd77',data:a.map(([x])=>({x,y:value(w,x)})).filter(p=>p.y!=null)},
        {label:ref.name,color:'#72cde1',data:b.map(([x])=>({x,y:value(ref,x)})).filter(p=>p.y!=null)}],{pointsOnly:true});
    }
  }
  compareSelect.addEventListener('change',updateComparison);
  $("rg_comparison").addEventListener('toggle',updateComparison);
  function update(){
    const w=currentWeapon(), range=selectMeasuredRange(w);
    if(range!=null) preferredRange=range;
    updatePoint(w,range);
    updateCharts();
    updateComparison();
  }
  rangeSlider.addEventListener("input",()=>{
    const w=currentWeapon(), range=selectMeasuredRange(w);
    if(range!=null) preferredRange=range;
    updatePoint(w,range);
    updateComparison();
  });
  ["rg_weapon","rg_hitbox","rg_armor"].forEach(id=>{
    $(id).addEventListener("input",update);
    $(id).addEventListener("change",update);
  });
  // Kept for compatibility but cannot affect a reported value without verified spread evidence.
  $("rg_stance").addEventListener("change",update);
  $("rg_detailed").addEventListener("change",()=>{
    fillHitboxSelect($("rg_hitbox"),$("rg_detailed").checked);
    update();
  });
  update();
})();

/* ================= 2. TTK CALCULATOR ================= */
(function(){
  const $ = id => document.getElementById(id);
  fillWeaponSelect($("tk_weapon"), "AKM");
  fillWeaponSelect($("tk_cmpA"), "AKM");
  fillWeaponSelect($("tk_cmpB"), "UMP9");
  $("tk_cmpC").innerHTML += PT.WEAPONS.map(w=>"<option>"+w.name+"</option>").join("");
  function reloadDistances(){
    const select=$("tk_distance"), previous=select.value;
    const rows=sourcedRangeRows(PT.WBYNAME[$("tk_weapon").value]) || [];
    select.replaceChildren();
    rows.forEach(([m])=>select.add(new Option(m+" m",String(m))));
    select.disabled=!rows.length;
    if(!rows.length) select.add(new Option("No recorded checkpoints",""));
    if(rows.some(([m])=>String(m)===previous)) select.value=previous;
  }
  reloadDistances();
  $("tk_weapon").addEventListener("change",reloadDistances);
  $("tk_weapon").addEventListener("input",reloadDistances);
  const display = (value, digits) => value == null ? "No data" : Number(value).toFixed(digits);
  const displayReload = r => r.withReload == null ? "No data" :
    (r.reloadConfidence==="estimate" ? "≈" : "")+display(r.withReload,2);
  // Shared with Attachments calculator: official LMG reload durations are
  // post-patch values and must not have the 25% reduction applied twice.
  function reloadSecondsFor(w){ return reloadSecondsForWeapon(w); }
  // The standard TTK excludes reloads. Only low-capacity weapons requiring
  // an additional magazine depend on these optional timings.
  function reloadConfidenceForWeapon(w, reloads){
    if(reloads===0) return "not-needed";
    if(w.name==="MG3") return "unknown";
    return Object.prototype.hasOwnProperty.call(LMG_RELOAD_2026,w.name)
      ? "published" : "estimate";
  }
  function computeFor(w, hitbox, armor){
    if(SHOTGUN_PELLETS[w.name]){
      // 0m exists in the published pellet tables: only the theoretical
      // minimum shells is calculable; damage-to-player and time-to-kill
      // still require knowing how many pellets connected.
      return {dmg:null,htk:shotgunMinShellsAt(w,Number($("tk_distance").value),hitbox,armor),
        pure:null,withReload:null,reloads:null,bestCase:true};
    }
    const dmg = finalDamageAt(w, Number($("tk_distance").value), hitbox, armor);
    if(dmg==null){
      return {dmg:null,htk:null,pure:null,withReload:null,reloads:null};
    }
    const htk = htkFor(dmg);
    const pure = pureTtk(htk,w.rpm);
    if(htk==null || pure==null) return {dmg,htk:null,pure:null,withReload:null,reloads:null};
    const reloads = w.mag ? Math.max(0, Math.ceil(htk/w.mag)-1) : 0;
    const reloadTime = reloads>0 ? reloadSecondsFor(w) : 0;
    const withReload = reloadTime == null ? null : pure + reloads*reloadTime;
    return {dmg,htk,pure,withReload,reloads,reloadConfidence:reloadConfidenceForWeapon(w,reloads)};
  }
  function update(){
    const w=PT.WBYNAME[$("tk_weapon").value];
    const hitbox=$("tk_hitbox").value, armor=+$("tk_armor").value;
    const r=computeFor(w,hitbox,armor);
    $("tk_dmg").textContent=display(r.dmg,1);
    $("tk_htkLabel").textContent=SHOTGUN_PELLETS[w.name] ? "Minimum shells (all pellets hit)" : "Hits to kill";
    $("tk_htk").textContent=r.htk==null?"No data":r.htk;
    $("tk_pure").textContent=display(r.pure,2);
    $("tk_reload").textContent=display(r.withReload,2);
    setBar("tk_dmg",r.dmg,w.dmg*1.3);
    setBar("tk_htk",r.htk,8);
    setBar("tk_pure",r.pure,2);
    setBar("tk_reload",r.withReload,6);
    let tkNote;
    if(SHOTGUN_PELLETS[w.name]){
      tkNote="Minimum shells assumes all "+SHOTGUN_PELLETS[w.name].count+" pellets hit the selected area. Actual shots may need more; TTK unavailable.";
    } else if(r.dmg==null){
      tkNote="No damage reading at "+$("tk_distance").value+"m for "+w.name+"; TTK unavailable.";
    } else if(r.withReload==null){
      tkNote="Reload time is unavailable for "+w.name+"; total TTK cannot be calculated.";
    } else if(r.reloads>0){
      tkNote="Includes "+r.reloads+" reload(s). "+(r.reloadConfidence==="published" ? "Uses published LMG reload timing." : "Reload timing is an estimate, not independently verified.");
    } else {
      tkNote="No reload needed for this calculation.";
    }
    $("tk_note").textContent=tkNote+(w.rpmDisputed?" "+w.rpmNote:"");
    renderCompare();
  }
  function renderCompare(){
    const hitbox=$("tk_hitbox").value, armor=+$("tk_armor").value;
    const names=[$("tk_cmpA").value,$("tk_cmpB").value,$("tk_cmpC").value].filter(Boolean);
    const rows=names.map(n=>{const w=PT.WBYNAME[n];return {name:n,...computeFor(w,hitbox,armor)};});
    $("tk_cmpTable").innerHTML=
      '<tr><th>Weapon</th><th>Dmg</th><th>HTK (SG: minimum)</th><th>Pure TTK</th><th>Incl. reload</th></tr>'+
      rows.map(r=>'<tr><td>'+r.name+(PT.WBYNAME[r.name].rpmDisputed?' (rate disputed)':'')+'</td><td>'+display(r.dmg,1)+
        '</td><td>'+(r.htk==null?'No data':r.htk)+
        '</td><td>'+display(r.pure,2)+
        '</td><td>'+displayReload(r)+'</td></tr>').join("");
  }
  ["tk_weapon","tk_hitbox","tk_armor","tk_distance"].forEach(id=>{
    $(id).addEventListener("input",update);
    $(id).addEventListener("change",update);
  });
  $("tk_detailed").addEventListener("change",()=>{
    fillHitboxSelect($("tk_hitbox"),$("tk_detailed").checked);
    update();
  });
  ["tk_cmpA","tk_cmpB","tk_cmpC"].forEach(id=>$(id).addEventListener("change",renderCompare));
  update();
})();

/* ================= 3. RECOIL EVIDENCE EXPLORER ================= */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  fillWeaponSelect($("rc_weapon"), "AKM");
  const format = (value, suffix="") =>
    value == null || !Number.isFinite(value) ? "No data" : String(value)+suffix;

  function update(){
    const w = PT.WBYNAME[$("rc_weapon").value];
    const stance = $("rc_stance").value;
    const count = Number($("rc_shots").value);
    if(!w) return;

    // Weapon parameter fields are not per-bullet displacement measurements.
    // Do not use any guessed scale such as 5% per shot or fixed 10/20/30 jumps.
    const fields = [
      ["Maximum vertical recoil (raw)", format(w.vRecoil)],
      ["Vertical recoil speed", format(w.vertSpeed)],
      ["Horizontal recoil speed", format(w.horizSpeed)],
      ["Minimum horizontal recoil", format(w.minH,"%")],
      ["Horizontal tendency", w.hBiasVal == null ? "No data" :
        (w.hBiasDir || "Direction not recorded")+" "+String(w.hBiasVal)],
      ["Crouch recoil multiplier", format(w.crouchMod)]
    ];
    // Source-backed weapon parameters, not a predicted bullet-by-bullet spray.
    const detail = w.recoilDetail;
    if(detail){
      const additional = [
        ["Prone recoil multiplier", detail.proneMod, ""],
        ["Vertical recovery speed", detail.recoveryV, ""],
        ["Bullets per direction switch", detail.switchShots, ""],
        ["Recoil climb parameter", detail.climb, ""],
        ["Recoil fall parameter", detail.fall, ""]
      ];
      additional.forEach(([label,value,suffix])=>{
        if(value!=null)fields.push([label,format(value,suffix)]);
      });
    }

    $("rc_table").innerHTML =
      "<thead><tr><th>Weapon parameter</th><th>Value</th></tr></thead>"+
      "<tbody>"+fields.map(([label,value])=>
        "<tr><td>"+label+"</td><td>"+value+"</td></tr>"
      ).join("")+"</tbody>";

    // The per-shot controller owns the curve, comparison and simulation UI.

  }
  ["rc_weapon","rc_stance","rc_shots"].forEach(id=>{
    $(id).addEventListener("input", update);
    $(id).addEventListener("change", update);
  });
  update();
})();

/* ================= 4. ATTACHMENTS & RECOIL ================= */
const ATTACH_MOD = {
  muzzle: {
    none: {v:0,h:0,recov:0,label:"None"},
    compensator: {v:-0.25,h:-0.20,recov:0,label:"Compensator"},
    compensator_ar: {v:-0.15,h:-0.10,recov:0,label:"Compensator (AR/DMR)"},
    suppressor: {v:0,h:0,recov:0,label:"Suppressor"},
    flash: {v:-0.10,h:-0.10,recov:0,label:"Flash Hider"},
    brake: {v:-0.10,h:-0.08,recov:0,label:"Muzzle Brake"},
    choke: {v:0,h:0,recov:0,label:"Choke (SG)"},
    duckbill: {v:0,h:0,recov:0,label:"Duckbill (SG)"},
  },
  grip: {
    none: {v:0,h:0,recov:0,label:"None"},
    vertical: {v:-0.15,h:0,recov:0,label:"Vertical Foregrip"},
    angled: {v:0.05,h:-0.20,recov:0,label:"Angled Foregrip"},
    half: {v:-0.08,h:-0.16,recov:0.10,label:"Half Grip"},
    light: {v:0,h:0,recov:0.20,label:"Light Grip"},
    thumb: {v:-0.10,h:0,recov:0.10,label:"Thumb Grip"},
    laser: {v:0,h:0,recov:0,label:"Laser Sight"},
    tilted: {v:-0.12,h:-0.06,recov:0,shake:-0.25,label:"Tilted Grip"},
  },
  stock: {
    none: {v:0,h:0,recov:0,label:"None"},
    tactical: {v:0,h:0,recov:0.05,label:"Tactical Stock"},
    heavy: {v:-0.10,h:-0.10,recov:0.05,label:"Heavy Stock"},
    folding: {v:-0.20,h:0,recov:0.15,label:"Folding Stock"},
    cheek: {v:-0.20,h:0,recov:0,label:"Cheek Pad"},
    loops: {v:0,h:0,recov:0,label:"Bullet Loops"},
  },
};
// Sourced from official PUBG patch notes (pubg.com/en/news):
// - Half Grip horizontal recoil control: +8% -> +16% (Update 41.1) — reflected above as h:-0.16.
// - Angled Foregrip removed from world spawn, its role folded into Half Grip (Update 41.1) — kept in the
//   dropdown (it can still turn up via crates/inventory carryover in some contexts) but labeled as removed.
// - Tilted Grip added: +12% vertical recoil control, +6% horizontal recoil control, +25% camera-shake
//   control (Update 41.1). This toolkit doesn't model camera shake elsewhere, so "shake" is shown as a
//   note only, not folded into the vertical/horizontal recoil totals.
// slot access assigned by weapon class + the explicit exceptions given in the build spec, plus RPD (Update 42.3)
// Weapon slot tags in PUBG game-file extract (Update 43.2).
const STOCK_LIST = new Set(["M16A4","M416","MK47 Mutant","ACE 32","Vector","MP5K","MP9","M249","RPD"]);
const HEAVY_STOCK_LIST = new Set(["M16A4","M416","MK47 Mutant","ACE 32","Vector","MP5K","M249","RPD"]);
const GRIP_LIST = new Set([
  "ACE 32","AUG A3","Beryl M762","Desert Eagle","G18C","G36C","M416","P92",
  "MP5K","Mk12","MK47 Mutant","O12","QBZ95","SCAR-L","SKS","Tommy Gun","UMP9","Vector","Skorpion"
]);
// Update 43.2 attachment-item compatibility, taken from weapon tags.
// The source has multiple suppressor/compensator variants. Show DMR/SR as
// the primary compensator for DMRs and offer the AR/DMR variant separately.
// All sets use the standard-mode gun names from our WEAPONS array.
const MUZZLE_AR_COMPAT = new Set([
  "ACE 32","AKM","AUG A3","Beryl M762","FAMAS","SLR",
  "G36C","Groza","M416","K2","M16A4","Mini 14","Mk12",
  "MK14 EBR","MK47 Mutant","O12","QBZ95","SCAR-L","SKS",
  "S12K","SVD Dragunov"
]);
const MUZZLE_SR_COMPAT = new Set([
  "AWM","SVD Dragunov","SLR","Kar98k","M24","Mini 14",
  "Mk12","MK14 EBR","SKS"
]);
const MUZZLE_SMG_COMPAT = new Set([
  "JS9","MP5K","Tommy Gun","UMP9","Micro Uzi","Vector"
]);
const MUZZLE_HANDGUN_COMPAT = new Set(["G18C","P92","R1895","Skorpion"]);
const CHOKE_COMPAT = new Set(["S686","Sawn-off"]);
const DUCKBILL_COMPAT = new Set(["S12K"]);
const FOLDING_STOCK_LIST = new Set(["MP9","Micro Uzi","Skorpion"]);
const CHEEK_PAD_LIST = new Set([
  "AWM","SVD Dragunov","SLR","M24","MK14 EBR","SKS","VSS Vintorez","Kar98k"
]);
const BULLET_LOOPS_LIST = new Set(["S686","Kar98k"]);

// Verified optic fit from PUBG PC Update 43.2 attachment table. No sight
// options are generated from weapon class: integrated or unsupported optics
// (e.g. P90, VSS, Sawed-off, S686) remain unavailable.
const SIGHT_6X_COMPAT = new Set([
  "ACE 32","AKM","AUG A3","AWM","Beryl M762","DBS","SVD Dragunov",
  "FAMAS","SLR","G36C","Groza","M416","JS9","Kar98k","K2","Lynx AMR",
  "M16A4","M249","M24","MG3","MP5K","Mini 14","Mk12","MK14 EBR",
  "MK47 Mutant","O12","QBZ95","RPD","SCAR-L","SKS","S12K",
  "UMP9","Vector"
]);
const SIGHT_8X_COMPAT = new Set([
  "AWM","SVD Dragunov","SLR","Kar98k","Lynx AMR","M16A4",
  "M24","Mini 14","Mk12","MK14 EBR","MK47 Mutant","SKS"
]);
const SIGHT_RED_DOT_ONLY = new Set([
  "Desert Eagle","G18C","P92","MP9","Micro Uzi","Skorpion","Tommy Gun"
]);
// The extracted 43.2 item table lists Dot Sight, Hybrid Scope and Thermal
// 4x in addition to the usual Red Dot/Holo and 2x–15x optics. These share
// the UpperSmall/UpperLarge weapon groups; compact pistols/SMGs which only
// accept Red Dot/Holo do not get the extra optics.
const SIGHT_LABELS = {
  none:"No optic",reddot:"Red Dot Sight",holo:"Holographic Sight",
  dot:"Dot Sight",
  "2x":"2x Scope","3x":"3x Scope","4x":"4x Scope",
  hybrid:"Hybrid Scope",thermal4x:"Thermal 4x Scope",
  "6x":"6x Scope","8x":"8x Scope","15x":"15x Scope"
};
function opticChoicesFor(w){
  const common=["none","reddot","holo","dot","2x","3x","4x","hybrid","thermal4x","6x"];
  if(SIGHT_8X_COMPAT.has(w.name))return [...common,"8x","15x"];
  if(SIGHT_6X_COMPAT.has(w.name))return common;
  if(SIGHT_RED_DOT_ONLY.has(w.name))return ["none","reddot","holo"];
  return ["none"];
}
// Buttons and presets use "compensator"/"flash"/"suppressor" as stable
// option keys; each muzzle is filtered to options the selected gun accepts.
function attachmentChoicesFor(w,group){
  if(group==="grip")return GRIP_LIST.has(w.name)
    ? ["none","vertical","half","light","thumb","laser","tilted"]
    : ["none"];
  if(group==="stock"){
    const options=["none"];
    if(STOCK_LIST.has(w.name)) options.push("tactical");
    if(HEAVY_STOCK_LIST.has(w.name)) options.push("heavy");
    if(FOLDING_STOCK_LIST.has(w.name)) options.push("folding");
    if(CHEEK_PAD_LIST.has(w.name)) options.push("cheek");
    if(BULLET_LOOPS_LIST.has(w.name)) options.push("loops");
    return options;
  }
  if(group==="muzzle"){
    const options=["none"];
    const name=w.name;
    const ar=MUZZLE_AR_COMPAT.has(name),sr=MUZZLE_SR_COMPAT.has(name),smg=MUZZLE_SMG_COMPAT.has(name);
    if(ar||sr||smg){
      options.push("compensator","flash","suppressor");
      if(ar&&sr) options.push("compensator_ar");
      if(ar)options.push("brake");
    } else if(MUZZLE_HANDGUN_COMPAT.has(name)) {
      options.push("suppressor");
    }
    if(CHOKE_COMPAT.has(name))options.push("choke");
    if(DUCKBILL_COMPAT.has(name))options.push("duckbill");
    return options;
  }
  return ["none"];
}
// Presets optimise the simplified recoil modifiers from current compatible
// weapon attachments, not a hard-coded loadout shared between every gun.
// These are model scores, not an exact physical spray simulation.
function bestAttachmentPreset(w,focus){
  const muzzles=attachmentChoicesFor(w,"muzzle");
  const grips=attachmentChoicesFor(w,"grip");
  const stocks=attachmentChoicesFor(w,"stock");
  let best={muzzle:"none",grip:"none",stock:"none"}, bestScore=-Infinity;
  for(const muzzle of muzzles)for(const grip of grips)for(const stock of stocks){
    const m=muzzle==="compensator" ? compensatorFor(w) : ATTACH_MOD.muzzle[muzzle];
    const g=ATTACH_MOD.grip[grip],s=ATTACH_MOD.stock[stock];
    const v=m.v+g.v+s.v,h=m.h+g.h+s.h;
    const recovery=(ATTACH_MOD.muzzle[muzzle].recov||0)+(g.recov||0)+(s.recov||0);
    const vertical=-v,horizontal=-h;
    const score=focus==="vertical"
      ? vertical*1000 + horizontal + recovery*0.01
      : focus==="horizontal"
      ? horizontal*1000 + vertical + recovery*0.01
      : (vertical+horizontal)*100 - Math.abs(vertical-horizontal)*25 + recovery;
    if(score>bestScore+1e-9){bestScore=score;best={muzzle,grip,stock};}
  }
  return best;
}
// Class-specific compensators: AR/DMR/S12K +15V/+10H; SMG +25V/+20H;
// DMR/SR compensator +20V/+20H. Other tooltips aren't identical across classes.
function compensatorFor(w){
  if(w.cls==="SMG")return {v:-0.25,h:-0.20};
  if(w.cls==="DMR"||w.cls==="SR")return {v:-0.20,h:-0.20};
  if(w.cls==="AR"||w.name==="S12K"||w.name==="O12")return {v:-0.15,h:-0.10};
  return {v:0,h:0};
}
// Each magazine family has weapon-specific limits. The global "extended
// magazine adds 30%" shortcut was an approximation and does not represent
// the official Extended vs Extended QuickDraw distinction.
// Explicit values below derive from official patch notes and linked weapon
// tables (full references in docs/research-and-patch-references.md).
// Historical name: the rows below include both directly published and
// cross-source reconciled capacities. Provenance is specified explicitly
// so the latter cannot be misrepresented as direct in-game verification.
const MAG_CAP_EVIDENCE = Object.freeze({
  "M416": "official-15.1-weapon-example",
  "ACE 32": "cross-source-magazine-type-reconciliation",
  "MK14 EBR": "weapon-specific-family-tables",
  "SVD Dragunov": "unresolved-family-and-type"
});
const MAG_CAP_VERIFIED = {
  "M416":     {extended:42,extquick:40}, // Official PUBG Update 15.1 magazine example.
  // ACE32's source-published 40/42 pair is mapped using PUBG's official
  // Extended (higher capacity) vs Extended QuickDraw (slightly lower) rule.
  // Cross-source reconciliation; direct 43.2 Xbox loaded-round check pending.
  "ACE 32":   {extended:42,extquick:40},
  "AWM":      {extended:8, extquick:7},  // 43.2 DMR/SR item data
  "M24":      {extended:8, extquick:7},
  // Current weapon-specific tables: these 10/20-round DMRs do not use the
  // attachment's "42 rounds" item label as their resulting gun capacity.
  "SKS":      {extended:20,extquick:20},
  "SLR":      {extended:20,extquick:20},
  "VSS Vintorez":{extended:20,extquick:20},
  "Mini 14":  {extended:30,extquick:30},
  "Mk12":     {extended:30,extquick:30},
  // Mk14 accepts both AR/DMR and DMR/SR magazine families in 43.2.
  // Wiki magazine-family tables list different loaded-round capacities:
  // DMR/SR Extended 22; DMR/SR Extended QuickDraw 20;
  // AR/DMR Extended and Extended QuickDraw 20.
  "MK14 EBR": {extended:22,extquick:20,extended_ar:20,extquick_ar:20},
  // Dragunov's historical 18/20 pair is not mapped to exact magazine FAMILY
  // and TYPE in a 43.2 Xbox loaded-round check. Keep all variants unknown
  // instead of transferring another DMR's 20-round capacity.
  // Never substitute generic attachment-item labels for weapon-loaded rounds.
  "M249":     {extended:150,extquick:null}, // no checked EQ capacity
  "RPD":      {extended:110,extquick:null}, // official 42.3 max; EQ unverified
  "MK47 Mutant": {extended:30,extquick:null},
  "S12K":     {extended:10,extquick:10},
  "Tommy Gun":{extended:50,extquick:50},
  "Skorpion": {extended:40,extquick:40},
  "Vector":   {extended:33,extquick:33},
  "UMP9":     {extended:35,extquick:35},
  "MP5K":     {extended:40,extquick:40},
  "Micro Uzi":{extended:35,extquick:35},
  "P92":      {extended:20,extquick:20},
  "G18C":     {extended:25,extquick:25},
  "Desert Eagle":{extended:10,extquick:10}
};
// Game-file slot tags include BOTH AR/DMR and DMR/SR magazines on these DMRs.
 // Keep their AR variant choices distinct from the DMR/SR item family.
 // For Dragunov both family-specific loaded capacities remain unverified.
const DUAL_MAG_FAMILY = new Set([
  "SVD Dragunov","SLR","Mini 14","Mk12","MK14 EBR","SKS","VSS Vintorez"
]);
// Most 30-round assault rifles have 40 loaded rounds with an extended mag.
// The "42 rounds" shown on the shared 43.2 attachment item is not a reliable
// universal *weapon-loaded* count. Only explicitly listed, independently
// supported guns use this fallback. M416 overrides it with its sourced 42/40;
// ACE 32's published 40/42 pair is now reconciled by magazine TYPE, not
// silently applied to other 30-round ARs.
const MAG_LARGE_30_ROUND_MODEL = new Set([
  "AKM","AUG A3","Beryl M762","G36C","Groza","M16A4",
  "SCAR-L","QBZ95","K2","FAMAS"
]);
function slotsFor(w){
  // Lynx AMR is optics-only, and P90 uses an integral 50-round magazine.
  if(w.name==="Lynx AMR" || w.name==="P90")
    return {muzzle:null, grip:null, stock:null, magazine:null};
  if(w.name==="RPD") return {muzzle:null, grip:null, stock:"tactical", magazine:"AR_LMG"}; // official: no muzzle, no foregrip
  const muzzle = (MUZZLE_SR_COMPAT.has(w.name)) ? "DMR_SR"
    : MUZZLE_AR_COMPAT.has(w.name) ? "AR_DMR_S12K"
    : MUZZLE_SMG_COMPAT.has(w.name) ? "SMG"
    : MUZZLE_HANDGUN_COMPAT.has(w.name) ? "HANDGUN"
    : CHOKE_COMPAT.has(w.name) ? "CHOKE"
    : DUCKBILL_COMPAT.has(w.name) ? "DUCKBILL" : null;
  const grip = GRIP_LIST.has(w.name) ? "FOREGRIP" : null;
  const stock = STOCK_LIST.has(w.name) ? "tactical"
    : FOLDING_STOCK_LIST.has(w.name) ? "folding"
    : CHEEK_PAD_LIST.has(w.name) ? "cheek"
    : BULLET_LOOPS_LIST.has(w.name) ? "loops" : null;
  // Current magazine attachment table excludes the bolt-fed Kar98k and
  // revolver R1895. M249 (class MG in our dataset) explicitly takes LMG mags.
  const magazine = w.name==="Kar98k" || w.name==="R1895" || w.name==="MG3" || w.name==="O12"
    ? null
    : w.name==="M249" ? "AR_LMG"
    : (w.cls==="SR"||w.cls==="DMR") ? "DMR_SR"
    : (w.cls==="AR"||w.name==="S12K") ? "AR_DMR_S12K"
    : (w.cls==="SMG"||w.cls==="Pistol") ? "SMG_PISTOL" : null;
  return {muzzle, grip, stock, magazine};
}
function extendedCapFor(w,kind="extended"){
  const slots=slotsFor(w);
  if(!slots.magazine || !w.mag) return null;
  const exact=MAG_CAP_VERIFIED[w.name];
  if(exact && Object.prototype.hasOwnProperty.call(exact,kind)) return exact[kind];
  // Other dual-family DMRs share confirmed weapon-loaded counts.  Never copy
  // the generic AR attachment label of 42 rounds onto them.
  if(DUAL_MAG_FAMILY.has(w.name) && (kind==="extended_ar"||kind==="extquick_ar"))
    return exact && Object.prototype.hasOwnProperty.call(exact,kind==="extended_ar"?"extended":"extquick")
      ? exact[kind==="extended_ar"?"extended":"extquick"] : null;
  if(MAG_LARGE_30_ROUND_MODEL.has(w.name) && w.mag===30)
    return kind==="extended" || kind==="extquick" ? 40 : null;
  // Missing source figures stay unknown rather than masquerading as a
  // verified "+5" or "+30%" universal magazine rule.
  return null;
}
(function(){
  const $ = id => document.getElementById(id);
  fillWeaponSelect($("at_weapon"), "AKM");
  function populateSlot(selId, group, w, defaultKey){
    const sel = $(selId);
    const choices = attachmentChoicesFor(w,group);
    const available = choices.length > 1;
    sel.disabled = !available;
    if(!available){ sel.innerHTML = `<option value="none">No slot</option>`; return; }
    const selected = choices.includes(defaultKey) ? defaultKey : "none";
    sel.innerHTML = choices.map(k=>`<option value="${k}" ${k===selected?'selected':''}>${ATTACH_MOD[group][k].label}</option>`).join("");
  }
  function update(){
    const w = PT.WBYNAME[$("at_weapon").value];
    const slots = slotsFor(w);
    populateSlot("at_muzzle","muzzle", w, $("at_muzzle").value||"none");
    populateSlot("at_grip","grip", w, $("at_grip").value||"none");
    populateSlot("at_stock","stock", w, $("at_stock").value||"none");
    const sight=$("at_sight"),sightChoices=opticChoicesFor(w);
    const previousSight=sightChoices.includes(sight.value)?sight.value:"none";
    sight.disabled=sightChoices.length===1;
    sight.innerHTML=sightChoices.map(id=>`<option value="${id}"${id===previousSight?" selected":""}>${SIGHT_LABELS[id]}</option>`).join("");
    // magazine select
    const magSel = $("at_mag");
    if(!slots.magazine || !w.mag){ magSel.innerHTML = `<option value="none">No slot</option>`; magSel.disabled = true; }
    else {
      magSel.disabled = false;
      const ext = extendedCapFor(w,"extended");
      const eq  = extendedCapFor(w,"extquick");
      const both = DUAL_MAG_FAMILY.has(w.name);
      const previous=magSel.value;
      const extAr=both?extendedCapFor(w,"extended_ar"):null;
      const eqAr=both?extendedCapFor(w,"extquick_ar"):null;
      magSel.innerHTML = `<option value="none">None (${w.mag})</option>
        <option value="extended">Extended${both?" (DMR/SR)":""} (${ext==null?"No data":ext})</option>
        <option value="quickdraw">QuickDraw (${w.mag}, +60% reload speed)</option>
        <option value="extquick">Extended QuickDraw${both?" (DMR/SR)":""} (${eq==null?"No data":eq}, +15% reload speed)</option>`+
        (both ? `
        <option value="extended_ar">Extended (AR/DMR) (${extAr==null?"No data":extAr})</option>
        <option value="extquick_ar">Extended QuickDraw (AR/DMR) (${eqAr==null?"No data":eqAr}, +15% reload speed)</option>` : "");
      // Keep a compatible choice when comparing weapons; never carry over
      // dual-family magazine choices to a gun without that magazine family.
      magSel.value=[...magSel.options].some(o=>o.value===previous)?previous:"none";
    }
    recompute();
  }
  function recompute(){
    const w = PT.WBYNAME[$("at_weapon").value];
    const slots = slotsFor(w);
    const mVal = slots.muzzle ? $("at_muzzle").value : "none";
    const gVal = slots.grip ? $("at_grip").value : "none";
    const sVal = slots.stock ? $("at_stock").value : "none";
    const magVal = (slots.magazine && w.mag) ? $("at_mag").value : "none";
    const sightChoices=opticChoicesFor(w);
    const selectedSight=sightChoices.includes($("at_sight").value)?$("at_sight").value:"none";
    $("at_opticNote").textContent=
      (sightChoices.length===1 ? "No compatible detachable optic is listed for this weapon."
      : selectedSight==="none" ? "Select an optic to confirm fit."
      : SIGHT_LABELS[selectedSight]+" fits this weapon.")+
      " Optics do not change recoil calculations here; use Scope Sensitivity Matcher for turning speed.";
    const m = ATTACH_MOD.muzzle[mVal] || ATTACH_MOD.muzzle.none;
    const g = ATTACH_MOD.grip[gVal] || ATTACH_MOD.grip.none;
    const selectedStock = attachmentChoicesFor(w,"stock").includes(sVal) ? sVal : "none";
    const s = ATTACH_MOD.stock[selectedStock] || ATTACH_MOD.stock.none;
    const comp = mVal==="compensator" ? compensatorFor(w) : m;
    const vChange = comp.v + g.v + s.v;
    const hChange = comp.h + g.h + s.h;
    const recovChange = m.recov + g.recov + s.recov;
    const baseCap = w.mag || null;
    const ext = extendedCapFor(w,"extended");
    const extQuick = extendedCapFor(w,"extquick");
    let newCap = baseCap;
    let reloadSpeedMultiplier = 1;
    if(magVal==="extended") newCap = ext;
    else if(magVal==="quickdraw"){ newCap = baseCap; reloadSpeedMultiplier = 1.60; }
    else if(magVal==="extquick"){ newCap = extQuick; reloadSpeedMultiplier = 1.15; }
    else if(magVal==="extended_ar") newCap = extendedCapFor(w,"extended_ar");
    else if(magVal==="extquick_ar"){ newCap = extendedCapFor(w,"extquick_ar"); reloadSpeedMultiplier = 1.15; }
    // Bullet Loops (SG/SR) currently has a documented +30% reload-speed
    // tooltip for the Kar98k variant. The S686 entry does not publish a
    // comparable speed modifier, so do not infer one from the same name.
    if(selectedStock==="loops" && w.name==="Kar98k") reloadSpeedMultiplier *= 1.30;
    const realBaseReload = reloadSecondsForWeapon(w);
    // Attachments change the current base reload; 42.3's LMG adjustment is
    // already included in the two official timings above.
    const reloadMult = 1 / reloadSpeedMultiplier;
    $("at_vrecoil").textContent = (vChange*100).toFixed(0)+"%";
    $("at_hrecoil").textContent = (hChange*100).toFixed(0)+"%";
    $("at_recovery").textContent = "+"+(recovChange*100).toFixed(0)+"%";
    const finalReload = realBaseReload==null ? null : realBaseReload*reloadMult;
    $("at_reload").textContent = finalReload==null ? "No data" : reloadMult<1
      ? finalReload.toFixed(2)+"s (−"+((1-reloadMult)*100).toFixed(0)+"%)"
      : finalReload.toFixed(2)+"s";
    $("at_capBase").textContent = baseCap ?? "—";
    $("at_capNew").textContent = newCap ?? "No data";
    let note = `Attachment control percentages are from the 43.2 item descriptions; combined reductions and suggested setups remain a simplified model, not a measured spray. Attachment stacking is additive here; whether PUBG adds or multiplies combined attachment effects remains unresolved.`;
    if(w.name==="MG3") note += " MG3 real reload-animation time is not verified.";
    if(["extended","extquick","extended_ar","extquick_ar"].includes(magVal) && newCap==null)
      note += " This magazine's capacity is not verified.";
    if(w.name==="MK14 EBR" && magVal!=="none")
      note += " Mk14 capacity depends on magazine family; values await a direct 43.2 in-game capacity check.";
    if(w.name==="ACE 32" && ["extended","extquick"].includes(magVal))
      note += " ACE32's 42/40 capacity mapping follows the official magazine trade-off and published weapon range; direct current-build Xbox confirmation is pending.";
    if(w.name==="SVD Dragunov" &&
      ["extended","extquick","extended_ar","extquick_ar"].includes(magVal))
      note += " Dragunov's reported 18/20 variants are not mapped to exact magazine types and families in verified current-build data.";
    if(mVal==="choke") note += " Choke tightens pellet spread by 13%; no hit probability is modeled.";
    if(mVal==="duckbill") note += " Duckbill tightens vertical pellet spread by 50%; no hit probability is modeled.";
    if(selectedStock==="cheek") note += " Cheek Pad also boosts sway control by 15% and muzzle-rise control by 20%.";
    if(selectedStock==="tactical") note += " Tactical Stock also gives +10% ADS speed, sway and muzzle-rise control.";
    if(selectedStock==="heavy") note += " Heavy Stock trades -10% ADS speed and hip-fire accuracy for recoil control.";
    if(gVal==="half") note += " Half Grip carries a -10% sway-control trade-off.";
    if(gVal==="light") note += " Lightweight Grip also improves initial-shot recoil control by 30%, sway by 20% and muzzle-rise by 10%.";
    if(gVal==="thumb") note += " Thumbgrip also gives +40% ADS speed and +20% sway control.";
    if(gVal==="laser") note += " Laser Sight improves hip-fire accuracy by 30%, not recoil.";
    if(gVal==="tilted") note += " Tilted Grip also improves camera-shake control by 25%.";
    if(mVal==="brake") note += " Muzzle Brake also improves camera-shake control by 35%.";
    
    
    
    $("at_note").innerHTML = note;
  }
  ["at_weapon"].forEach(id=>$(id).addEventListener("change", update));
  ["at_muzzle","at_grip","at_stock","at_mag","at_sight"].forEach(id=>$(id).addEventListener("change", recompute));
  function applyPreset(focus){
    const w=PT.WBYNAME[$("at_weapon").value];
    const best=bestAttachmentPreset(w,focus);
    trySet("at_muzzle",best.muzzle);
    trySet("at_grip",best.grip);
    trySet("at_stock",best.stock);
    recompute();
  }
  $("at_presetVert").onclick = ()=>applyPreset("vertical");
  $("at_presetHoriz").onclick = ()=>applyPreset("horizontal");
  $("at_presetBal").onclick = ()=>applyPreset("balanced");
  $("at_presetClear").onclick = ()=>{ trySet("at_muzzle","none"); trySet("at_grip","none"); trySet("at_stock","none"); trySet("at_mag","none"); trySet("at_sight","none"); recompute(); };
  function trySet(id,val){ const sel=$(id); if(!sel.disabled && [...sel.options].some(o=>o.value===val)) sel.value = val; }
  update();
})();


// Read-only adapter: Recoil Analyzer uses the same compatibility and additive
// attachment effects as the established Attachments calculator.
PT.RECOIL_ATTACHMENTS=Object.freeze({
 choices(name,slot){
  const w=PT.WBYNAME[name];if(!w)return [];
  return attachmentChoicesFor(w,slot).map(value=>{
   const item=ATTACH_MOD[slot][value],effect=slot==='muzzle'&&value==='compensator'?compensatorFor(w):item;
   return {value,label:item.label,v:effect.v,h:effect.h};
  });
 },
 combine(name,selection){
  let v=1,h=1;
  for(const slot of ['muzzle','grip','stock']){
   const option=this.choices(name,slot).find(x=>x.value===selection[slot])||this.choices(name,slot)[0];
   if(option){v+=option.v;h+=option.h;}
  }
  return {v:Math.max(0,v),h:Math.max(0,h)};
 }
});

/* ================= HIT ZONE EXPLORER =================
 * The controller runs within the established calculator IIFE.
 * All damage values come from the sourced all-zone adapter.
 * No interpolation, no fabricated pellet shotgun totals.
 */
function initHitZoneExplorer({ panel, weapons, getCheckpoints, getZoneResults, isPelletShotgun }) {
  if (!panel) throw new Error('Hit Zone Explorer panel is missing');
  const byId = id => panel.querySelector('#' + id);
  const weaponSelect = byId('hz_weapon');
  const distanceSelect = byId('hz_distance');
  const helmetSelect = byId('hz_helmet');
  const vestSelect = byId('hz_vest');
  const modeSelect = byId('hz_mode');
  const body = byId('hz_body');
  const rowsElement = byId('hz_rows');
  const detail = byId('hz_detail');
  const summary = byId('hz_summary');
  const status = byId('hz_status');
  const zones = [...panel.querySelectorAll('[data-hit-zone]')];
  const totalZoneCount = 13;
  if(zones.length !== totalZoneCount) throw Error('Expected all thirteen SVG hit zones');
  let selectedZone = 'chest';
  let results = [];

  const decimal = n => Number(n).toFixed(1);
  const showValue = (zone, mode) => {
    // An idealized shotgun shell count is NOT measured damage or real HTK.
    if(mode === 'ideal-shells'){
      return zone && Number.isInteger(zone.idealMinShells) && zone.idealMinShells > 0
        ? String(zone.idealMinShells) + (zone.idealMinShells===1 ? ' shell*' : ' shells*')
        : 'No data';
    }
    if (!zone || zone.damage == null || !Number.isFinite(zone.damage)) return 'No data';
    if(mode === 'ttk'){const time=pureTtk(zone.htk,currentWeapon()?.rpm);return time==null?'No data':time.toFixed(2)+' s';}
    if (mode === 'htk') return zone.htk == null ? 'No data' : String(zone.htk) + ' hits';
    return decimal(zone.damage);
  };
  function updateModeAvailability(){
    const shotgun=currentWeapon() && isPelletShotgun(currentWeapon());
    const ideal=modeSelect.querySelector('option[value="ideal-shells"]');
    if(ideal) ideal.disabled=!shotgun;
    if(!shotgun && modeSelect.value==='ideal-shells') modeSelect.value='damage';
  }
  function currentWeapon() {
    return weapons.find(w => w.name === weaponSelect.value) || null;
  }
  function reloadCheckpoints() {
    const previousDistance = distanceSelect.value;
    const w = currentWeapon();
    const points = w ? getCheckpoints(w) : null;
    distanceSelect.replaceChildren();
    if (!Array.isArray(points) || points.length === 0) {
      const option = new Option('No recorded checkpoints', '');
      distanceSelect.add(option);
      distanceSelect.disabled = true;
      return;
    }
    distanceSelect.disabled = false;
    for (const [distance] of points) {
      distanceSelect.add(new Option(String(distance) + ' m', String(distance)));
    }
    if ([...distanceSelect.options].some(opt => opt.value === previousDistance)) {
      distanceSelect.value = previousDistance;
    }
  }
  function selectZone(id) {
    if (!results.some(r => r.id === id)) return;
    selectedZone = id;
    zones.forEach(el => {
      const active=el.dataset.hitZone === id;
      el.classList.toggle('selected', active);
      el.setAttribute('aria-pressed', String(active));
    });
    renderDetail();
    const disclosure=detail.closest('details');
    if(disclosure)disclosure.open=true;
  }
  function renderDetail() {
    const zone = results.find(r => r.id === selectedZone);
    if (!zone) {
      detail.textContent = 'No zone result available for this selection.';
      return;
    }
    const mode = modeSelect.value;
    const lines = [
      zone.label + ': ' + showValue(zone, mode),
      'Hit-area multiplier: ' + (zone.hitAreaMultiplier == null ? 'No data' : zone.hitAreaMultiplier),
      'Class multiplier: ' + (zone.classMultiplier == null ? 'No data' : zone.classMultiplier),
      'Armour multiplier: ' + (zone.armorMultiplier == null ? 'No data' : zone.armorMultiplier),
      'Protective equipment: ' + (zone.armorSource || 'None'),
    ];
    if(mode === 'ideal-shells' && zone.idealMinShells != null){
      const w=currentWeapon();
      const pellets=SHOTGUN_PELLETS[w.name].count;
      lines.push('THEORETICAL LOWER BOUND ONLY — assumes all ' + pellets +
        ' pellets from every shell strike this exact zone.');
      lines.push('Actual pellet spread, accuracy, protection durability and movement are not modelled. Real fights can require more shells.');
    }
    if(zone.damage == null){
      const w=currentWeapon();
      lines.push(w && isPelletShotgun(w)
        ? 'Actual whole-shell damage and actual shots-to-kill: No data.'
        : 'Damage and hits to kill at the selected distance: No data.');
    }
    detail.textContent = lines.join('\n');
  }
  function render() {
    const w = currentWeapon();
    const distance = Number(distanceSelect.value);
    const helmet = Number(helmetSelect.value);
    const vest = Number(vestSelect.value);
    const mode = modeSelect.value;
    if (!w || distanceSelect.disabled || !Number.isFinite(distance)) {
      results = [];
      status.textContent = 'No recorded damage checkpoints for the chosen weapon.';
    } else {
      results = getZoneResults(w, distance, helmet, vest) || [];
      status.textContent = isPelletShotgun(w)
        ? (mode === 'ideal-shells'
          ? '* THEORETICAL MINIMUM SHELLS ONLY (best case: every pellet hits this exact zone). Not actual damage, expected shells or real TTK. Assumes intact gear.'
          : 'No data for actual total shell damage or actual hits-to-kill: published values are per pellet. Select the separate theoretical minimum-shell mode for an all-pellets-hit lower bound.')
        : 'Calculated from a recorded source checkpoint at ' + distance + ' m. Assumes intact selected equipment; no interpolation or simulated armour durability.' +
          (mode === 'htk' ? ' Hits to kill assumes 100 HP and repeated shots striking the same hit zone.' :
           mode === 'ttk' ? ' TTK assumes 100 HP, all hits in the same zone and maximum fire rate; excludes reloads and projectile travel.' :
           mode === 'heatmap' ? ' Heatmap colour is relative to damage across this weapon\'s zones.' : '');
    }
    body.classList.toggle('has-helmet', helmet > 0);
    body.classList.toggle('has-vest', vest > 0);
    summary.textContent = w
      ? w.name + ' · ' + (distanceSelect.disabled ? 'No recorded range' : distance + ' m') +
        ' · Helmet ' + helmet + ' · Vest ' + vest
      : 'Weapon unavailable';
    const byZone = new Map(results.map(r => [r.id, r]));
    const supportedDamages = results.map(r => r.damage).filter(Number.isFinite);
    const low = supportedDamages.length ? Math.min(...supportedDamages) : 0;
    const high = supportedDamages.length ? Math.max(...supportedDamages) : 0;

    // Fill every annotation, not only a tapped zone.
    panel.querySelectorAll('[data-hz-value]').forEach(node => {
      const zone = byZone.get(node.dataset.hzValue);
      const val = showValue(zone, mode);
      node.textContent = val;
    });
    zones.forEach(node => {
      const data = byZone.get(node.dataset.hitZone);
      const active=node.dataset.hitZone === selectedZone;
      node.classList.toggle('selected', active);
      node.setAttribute('aria-pressed', String(active));
      node.style.removeProperty('fill');
      if (mode === 'heatmap' && data && Number.isFinite(data.damage)) {
        const t = high === low ? 0.5 : (data.damage - low) / (high - low);
        // Hue shift (cyan -> amber/orange); all numbers remain visible for non-color users.
        const hue = Math.round(190 - 165 * t);
        node.style.fill = 'hsl(' + hue + ' 60% 29%)';
      }
      const value = showValue(data, mode);
      const accessibleValue = value === 'No data' ? value
        : mode === 'ideal-shells' ? value + ', theoretical minimum (all pellets hit)'
        : mode === 'damage' || mode === 'heatmap' ? value + ' damage'
        : value;
      node.setAttribute('aria-label', (data ? data.label : node.dataset.hitZone) + ': ' + accessibleValue);
    });

    const fragment = document.createDocumentFragment();
    for (const zone of results) {
      const tr = document.createElement('tr');
      const name = document.createElement('th');
      name.scope = 'row'; name.textContent = zone.label;
      const val = document.createElement('td');
      val.textContent = showValue(zone, mode);
      const gear = document.createElement('td');
      gear.textContent = zone.armorSource || 'None';
      tr.append(name, val, gear);
      fragment.append(tr);
    }
    rowsElement.replaceChildren(fragment);
    renderDetail();
  }

  weaponSelect.replaceChildren();
  for (const w of weapons) weaponSelect.add(new Option(w.name, w.name));
  if (weapons.some(w => w.name === 'M416')) weaponSelect.value = 'M416';
  weaponSelect.addEventListener('change', () => { updateModeAvailability(); reloadCheckpoints(); render(); });
  for (const control of [distanceSelect, helmetSelect, vestSelect, modeSelect]) {
    control.addEventListener('change', render);
  }
  for (const node of zones) {
    node.addEventListener('click', () => selectZone(node.dataset.hitZone));
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectZone(node.dataset.hitZone);
      }
    });
  }
  updateModeAvailability();
  reloadCheckpoints();
  render();
}

// One-shot startup after the static HTML has loaded. The existing site loads
// its plain scripts at the end of <body>, so no DOMContentLoaded race.
const hitZonePanel = document.getElementById('panel-hit-zone');
if(hitZonePanel){
  initHitZoneExplorer({
    panel:hitZonePanel,
    weapons:PT.WEAPONS,
    getCheckpoints:sourcedRangeRows,
    getZoneResults:getAllZoneDamageForWeapon,
    isPelletShotgun:w=>Boolean(SHOTGUN_PELLETS[w.name])
  });
}
/* ================= 5. BACKPACK CALCULATOR ================= */
// Update 41.1 verifies Jammer and normal backpack carry bonuses match;
// do not confuse the +150/+200/+250 pack additions with total character capacity.
// Update 28.2 integrated the former +50 Utility Belt bonus into character
// base capacity: old innate 20 + belt 50 = 70; Update 41.1 confirms Jammer
// Packs grant exactly the same +150/+200/+250 as standard backpacks.
// These are total character carrying capacities, not item weights.
const CHARACTER_BASE_CAPACITY = 70;
// 28.2 incorporated the old Utility Belt into base capacity, not the equipped vest.
const VEST_CAPACITY_BONUS = 50;
const BACKPACK_CAPACITY_BONUS = Object.freeze({1:150, 2:200, 3:250});
const BACKPACKS = {
  standard: Object.fromEntries(Object.entries(BACKPACK_CAPACITY_BONUS).map(([level,bonus])=>[level,CHARACTER_BASE_CAPACITY+bonus])),
  jammer: Object.fromEntries(Object.entries(BACKPACK_CAPACITY_BONUS).map(([level,bonus])=>[level,CHARACTER_BASE_CAPACITY+bonus])),
};
const JAMMER_PROTECTION = {1:"Low", 2:"Medium", 3:"High"};
const BP_CAP = BACKPACKS.standard; // kept for reference; calc() now reads BACKPACKS[type] directly
const BP_AMMO = [ // [key,label,weight]
  ["9mm","9mm (per round)",0.30], ["57","5.7mm / P90 (per round)",0.35], [".45acp",".45 ACP (per round)",0.40],
  ["556","5.56mm (per round)",0.50], ["762","7.62mm (per round)",0.60],
  ["300mag",".300 Magnum (per round)",1.00], ["12g","12 Gauge (per round)",1.25],
  ["bolt","Crossbow bolt (per round)",2.00],
  ["50cal",".50 Caliber / Lynx AMR (per round)",1.00],
];
const BP_HEAL = [
  ["bandage","Bandage",2], ["firstaid","First Aid Kit",10], ["medkit","Med Kit",15],
  ["energy","Energy Drink",4], ["pain","Painkiller",6], ["adren","Adrenaline Syringe",10],
];
const BP_THROW = [
  ["frag","Frag Grenade",27], ["smoke","Smoke Grenade",14], ["stun","Stun Grenade",12],
  ["molotov","Molotov Cocktail",16], ["c4","C4",35],
  // Standard 43.2 game inventory weights; additional throwables vary by map/mode.
  ["bz","BZ Grenade",23], ["decoy","Decoy Grenade",12],
  ["sticky","Sticky Bomb",20], ["spike","Spike Trap",18],
  ["minismoke","Mini Smoke Grenade",10],
  ["coverflare","Emergency Cover Flare",27],
  ["supportflare","Emergency Support Flare",35],
];
(function(){
  const $ = id => document.getElementById(id);
  function buildGrid(container, items){
    container.innerHTML = items.map(([k,label,wt])=>
      `<div class="bp-row">
        <span class="bp-name">${label}</span>
        <span class="bp-wt">${wt}ea</span>
        <span class="bp-sub" data-sub="${k}">0</span>
        <span class="bp-stepper">
          <button type="button" data-step="-1" data-target="${k}">−</button>
          <input type="number" min="0" step="1" value="0" data-bp="${k}" data-wt="${wt}">
          <button type="button" data-step="1" data-target="${k}">+</button>
        </span>
      </div>`
    ).join("");
  }
  buildGrid($("bp_ammoGrid"), BP_AMMO);
  buildGrid($("bp_healGrid"), BP_HEAL);
  buildGrid($("bp_throwGrid"), BP_THROW);
  function allInputs(){ return [...document.querySelectorAll('#panel-backpack input[data-bp]')]; }
  function calc(){
    const type = $("bp_type").value;
    const level = +$("bp_level").value;
    const cap = BACKPACKS[type][level] + ($("bp_vest").value === "yes" ? VEST_CAPACITY_BONUS : 0);
    $("bp_jammerNote").innerHTML = type==="jammer"
      ? `<div class="note">Jammer Pack Lv.${level}: ${JAMMER_PROTECTION[level]} Blue Zone protection.</div>` : "";
    let used = 0;
    const cats = {Ammo:0, "Healing & Boosts":0, Throwables:0};
    const ammoKeys = new Set(BP_AMMO.map(a=>a[0])), healKeys = new Set(BP_HEAL.map(a=>a[0]));
    allInputs().forEach(inp=>{
      const n = Math.max(0, parseInt(inp.value)||0);
      const wt = +inp.dataset.wt;
      const sub = n*wt;
      used += sub;
      const subEl = document.querySelector(`.bp-sub[data-sub="${inp.dataset.bp}"]`);
      if(subEl) subEl.textContent = sub.toFixed(1).replace(/\.0$/,"");
      if(ammoKeys.has(inp.dataset.bp)) cats.Ammo += sub;
      else if(healKeys.has(inp.dataset.bp)) cats["Healing & Boosts"] += sub;
      else cats.Throwables += sub;
    });
    const rem = cap - used;
    $("bp_cap").textContent = cap;
    $("bp_used").textContent = used.toFixed(1);
    $("bp_rem").textContent = rem.toFixed(1);
    setBar("bp_used", used, cap);
    setBar("bp_rem", Math.max(0,rem), cap);
    document.getElementById("bp_remStat").classList.toggle("warn", rem<0);
    $("bp_breakdown").innerHTML = Object.entries(cats).map(([k,v])=>`<div class="catrow">${k}<b>${v.toFixed(1)}</b></div>`).join("");
    $("bp_warn").innerHTML = rem<0
      ? `<b>Over capacity by ${Math.abs(rem).toFixed(1)}.</b> Consider dropping some ammo or grenades to get back under the limit.`
      : "";
  }
  document.addEventListener("input", e=>{ if(e.target.matches('#panel-backpack input[data-bp], #panel-backpack select#bp_level, #panel-backpack select#bp_type, #panel-backpack select#bp_vest')) calc(); });
  document.addEventListener("change", e=>{ if(e.target.matches('#panel-backpack select#bp_level, #panel-backpack select#bp_type, #panel-backpack select#bp_vest')) calc(); });
  document.addEventListener("click", e=>{
    const btn = e.target.closest('#panel-backpack .bp-stepper button');
    if(!btn) return;
    const inp = document.querySelector(`#panel-backpack input[data-bp="${btn.dataset.target}"]`);
    if(!inp) return;
    inp.value = Math.max(0, (parseInt(inp.value)||0) + (+btn.dataset.step));
    calc();
  });
  $("bp_clear").onclick = ()=>{ allInputs().forEach(i=>i.value=0); calc(); };
  calc();
})();



})();
