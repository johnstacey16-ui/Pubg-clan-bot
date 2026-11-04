# Hit Zone Damage Explorer — technical blueprint (v0)

Status: approved interaction design; development planning, **not yet a live toolkit panel**.

## Screen layout

**Desktop:** narrow control rail; large center **front-only segmented figure with all 13 result labels in view**; optional detail/summary card at right. **Mobile:** selectors above full-width figure, legible leader lines and labels, results table below, optional detail card after it. When a zone is tapped/keyboard-focused its breakdown opens, but *no interaction is needed to see every zone*.

**Inputs**
- `hz_weapon`: source weapon ID/name from `PT.WEAPONS` (initially M416).
- `hz_distance`: native select generated from this weapon's **measured checkpoint list**, not a free-form slider. First available checkpoint as default. Preserve selected distance on weapon switch only if the new weapon has that checkpoint.
- `hz_helmet`: none/1/2/3; `hz_vest`: none/1/2/3; independent controls.
- `hz_mode`: damage / HTK / heatmap. When shotgun data cannot support actual damage, show “No data” in damage and HTK modes, with a separately named future optional ideal-shell view.

**Output**
- `hz_body`: SVG with paths using `data-hit-zone`, not position-only click targets. Mirrored limb graphics share one logical key.
- `hz_labels`: numeric annotations with stable anchors at each body zone, no overlapping text at 360px mobile widths (can use external legend / mirrored leader lines).
- `hz_summary`: legend and current weapon/gear/checkpoint.
- `hz_detail`: selected region formula breakdown with labelled source.
- `hz_status`: data-quality state e.g. measured checkpoint / no observation / theoretical minimum shells.
- A real table lists all region names/results as accessible fallback, also useful for precise comparisons.

## Hit-zone keys and gear mapping

Use exactly `DETAILED_PARTS`:

| Key | Label | Bucket | Equipment selector |
| --- | --- | --- | --- |
| head | Head | head | helmet |
| neck | Neck | head | helmet |
| clavicle | Clavicle | torso | vest |
| chest | Chest | torso | vest |
| upperStomach | Upper stomach | torso | vest |
| lowerStomach | Lower stomach | torso | vest |
| pelvis | Pelvis | pelvis | vest |
| upperArm | Upper arm | limb | none |
| forearm | Forearm | limb | none |
| hand | Hand | limb | none |
| thigh | Thigh | limb | none |
| calf | Calf | limb | none |
| foot | Foot | limb | none |

Baseline coverage and bone multipliers cross-checked against [October 2026 source audit](hit-zone-source-check-2026-10-25.md). This is community-extracted PC game data, not live match damage. Weapon values and special overrides still have unresolved cross-source differences. Existing local model currently uses exactly these zones. There is no front/back multiplier. Both arms and legs are mirrored with one computed damage value per logical region. Visually distinguish zone outlines from armour overlays.

## Computation contract

Suggested pure adapter inside `src/calculators/00-damage-ballistics.part`, adjacent to `finalDamageAt`:

```js
function armorLevelForZone(part, helmetLevel, vestLevel) {
  if (!part.armored) return 0;
  return part.bucket === 'head' ? helmetLevel : vestLevel;
}
function getAllZoneDamageForWeapon(w, distance, helmetLevel, vestLevel) {
  return DETAILED_PARTS.map(id => {
    const part = BODY_PARTS[id];
    const gearLevel = armorLevelForZone(part, helmetLevel, vestLevel);
    // Delegate actual hitbox maths to finalDamageAt; do not reimplement.
    const damage = finalDamageAt(w, distance, id, gearLevel);
    return { id, label:part.label, damage,
      htk: damage == null ? null : htkFor(damage) };
  });
}
```

This is a **design sketch**, not yet production code. Add explicit validation for input levels; read `cm[part.bucket]` and `WEAPON_HEAD_MULT` for the optional breakdown, and preserve original source status instead of defaulting missing rows to `w.dmg`.

**Damage:** `measuredBaseDamage × BODY_PARTS[id].hitArea × classBucketMult × armorMultFor(part, selectedLevel)`. **HTK:** `ceil(100 / damage)` for finite positive damage, 0 HP damage unsupported. **Heatmap:** visual encoding of computed actual numeric values, not a new calculation. Avoid colour-only semantics.

**Shotguns:** `baseDamageAtRange` intentionally returns `null` for pellet shotguns because it has only *per-pellet* source data. The existing `shotgunMinShellsAt` is specifically **best case all pellets connect**, so never relabel it actual damage or TTK. O12 slug still uses exact checkpoints, with first published distance 2 m.

**Durability:** first-release standard equipment selectors assume intact gear. Destroyed vests retain special partial protection and are outside this first implementation. Avoid implying the level selector simulates damaged gear.

**Data metadata:** display the checkpoint and known source note from `DATA_ACCURACY_POLICY.md`. Build quality gates into tests for nulls / latest weapon changes. No source = “No data”, not zero.

## Scaffold / integration sequence

1. Build the pure adapter + tests **first** (do not change existing single-level `finalDamageAt` callers).
2. Replace starter geometry with polished multi-path front view; each left/right limb path shares the same `data-hit-zone` key, add focus and visible result labels. Helmet and vest overlay shape groups reflect the same data mapping.
3. Insert markup into `index.html` as eighth `.hub-main`, add sidebar nav button, and add `panel-hit-zone` to `js/app-navigation.js` **together**.
4. Add `src/calculators/60-hit-zone-explorer.part` to `scripts/build-static.cjs` following `50-backpack.part`, and regenerate `js/toolkit-calculators.js`. Note existing `50-backpack.part` ends the shared IIFE, so move/reposition the closing `})();` appropriately **or** expose a deliberate namespaced adapter and load the new explorer as a separate script. Never simply append part 60 outside the lexical closure while calling private symbols.
5. CSS in `hit-zone-explorer.css` referenced in `index.html` after existing CSS, strictly scoped `#panel-hit-zone`.
6. Test with Node static invariant tests and real browser smoke checks. Confirm the seven existing tools and default sensitivity screen are untouched.

## Minimum test matrix

- No helmet/no vest yields unarmoured damage in all 13 zones.
- Helmet level 3 reduces head/neck only; vest level 2 reduces only five torso/pelvis zones. Limb values remain identical.
- Dragunov override to head bucket is preserved.
- M416 0m chest no-vest: `40 × 1.10 × 1.00 = 44`; with level 2 vest: `26.4`.
- Swapping the weapon changes all displayed numbers appropriately, not a stale cached result.
- Source checkpoint missing or beyond supported max yields null / “No data”; weapon switching updates distance options.
- Pellet shotgun does not print per-pellet results as actual shot damage.
- All 13 regions present, mirrored limbs identical, numeric labels readable with a full-page mobile screenshot.
- `node scripts/build-static.cjs --check`; `node --test tests/*.test.cjs`; `node tests/browser-smoke.cjs`.

## Owner decisions recorded

- Always-visible complete body result map rather than click-to-reveal values.
- Optional click-for-detail.
- Front only; front/back treated as the same for this viewer.
- No unverified maths or misleading armour protection art.
- Keep existing toolkit static architecture and current seven tools working.
