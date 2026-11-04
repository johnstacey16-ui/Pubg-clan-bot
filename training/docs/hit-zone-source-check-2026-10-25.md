# Hit Zone source cross-check — 25 October 2026

**Scope:** confirm PUBG: BATTLEGROUNDS (PC), not PUBG Mobile, baseline hitbox/gear mapping for the proposed front-only Damage Explorer. This is a *source review*, not an in-game live-damage measurement or a blanket audit of every weapon.

## Strong corroboration for armour slots and zone multipliers

- [PUBG PC game-data hit zones, extracted by pubg.gs](https://pubg.gs/damage/) (site identifies PC Update 43.2, Steam build **26072644**, extracted **21 October 2026**; independent community data extraction, not KRAFTON's official calculator):
  - **Head** uses `Head` armour slot. Its bone keys: `head ×1.0`, `neck_01 ×0.75`.
  - **Torso** uses `TorsoArmor`: `clavicle_l/r ×1.0`, `spine_03 ×1.1`, `spine_02 ×1.0`, `spine_01 ×0.95`.
  - **Pelvis** is a separate class-multiplier bucket, `pelvis ×1.0`, also uses `TorsoArmor`.
  - **Arm/Leg** use `none` for armour, with hand ×0.3, lower arm ×0.5, upper arm ×0.6, thigh ×0.6, calf ×0.5, foot ×0.3.
  - A reference mapping of upper-stomach to spine_02 and lower-stomach to spine_01 is a human-friendly presentation; actual engine bones do not use those English names.
- [Gear table](https://pubg.gs/gear/): helmets slot Head; vests slot TorsoArmor. The published reductions are **Level 1 30%, Level 2 40%, Level 3 55%**; static factors are 0.70 / 0.60 / 0.45.
- [PUBG Wiki — vests](https://pubg.wiki.gg/wiki/Vests): older reference noting destroyed vest **still provides 20% protection**; a standard full-strength gear-level selector is only for non-destroyed gear, not durability simulation.

## Existing calculator mapping matched by that source

`BODY_PARTS` currently defines all 13 needed keys in `src/calculators/00-damage-ballistics.part`; all listed multipliers and current coverage flags correspond to the hit-zone/game-gear-slot table above. Specifically, **helmets protect head and neck; vests protect clavicle, chest, upper stomach, lower stomach and pelvis; vests do not protect arms or legs.**

## Important unresolved items (do not silently conflate)

1. **Resolved field-name confusion for five audited weapons, but full weapon verification remains open:** The source's displayed “Base damage” belongs to `WeaponGunConfig.BaseDamage`, **not** to the separately extracted `TrajectoryConfig.HitDamage` in Ballistics. For M416 these are **39** and **40**, respectively; the toolkit uses the independently observed **40** projectile checkpoint. AKM, AUG, Dragunov, and RPD likewise match the separate projectile field rather than gun-config BaseDamage. See the linked [damage-field audit](hit-zone-damage-field-audit.md) with per-field/patch sources. This does **not** prove the runtime damage pipeline, all 45 weapons, or special per-weapon modifiers. **Do not bulk replace the existing damage model** with the gun-config column.
2. Source-wide DMR head multiplier is ×2.35. Toolkit's `SVD Dragunov` has a weapon-specific ×2.80 override attributed to its individually checked weapon page. Preserve it provisionally; validate weapon-specific overrides and current patch before claiming it is an engine default.
3. Special damage types, limb-interception behavior, penetrations, gear durability, low-health targets and accumulated bullet damage are outside first release. Firing from behind does not require a second set of UI zones for this baseline model. Do not claim this simple panel reproduces every gameplay damage interaction.
4. Confirm whether any latest patch changes the above gear-zone mapping when the implementation work is resumed.

## Development guidance

Use the 13-zone *source-provenance* layer to validate anatomy/armour coverage, not to auto-import current per-gun values. Build independent helmet/vest adapter next. In first release, label the armour configuration as **intact standard helmet/vest** (or omit broken-gear states entirely). Unknown measured distance and shotgun whole-shell actual damage remain **No data**.
