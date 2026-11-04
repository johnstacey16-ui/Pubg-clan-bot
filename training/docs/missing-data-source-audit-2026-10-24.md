> **25 October 2026 gear/patch update:** Backpack now includes selectable vest's +50 capacity and 8 additional source-backed ammo/throwable entries, and attachment UI discloses unscored side effects. The older figures below remain a historical audit, not the current code state. See DATA_ACCURACY_POLICY.md.

> **25 October 2026 follow-up:** Nine additional WinnerMeta telemetry-bin estimate tables have been verified and added; current `DROP_TABLES` coverage is **30/45**, with **15 missing**. See [gravity-drop-evidence-2026-10-25.md](gravity-drop-evidence-2026-10-25.md). The historical counts below describe the earlier 24 October snapshot and have not been silently reinterpreted.

> **25 October 2026 correction:** WinnerMeta's published drop figures are estimates from flight time (½gt²), not observed impact displacement or validated sight holdover. The historical research notes below must not be used to fill missing observed trajectories.

# Missing data and source-recovery audit — 24 October 2026

**Research-only.** This file records possible data sources for blanks in the public toolkit; it does **not** authorize replacing existing weapon values automatically. Preserve the user's empirical Scope Sensitivity Matcher maths. Detailed research belongs in the repo, not on player-facing calculator pages.

## Current toolkit coverage (checked against `main/index.html`)

- **45 weapons** in `WEAPONS`.
- **41 single-projectile falloff tables** in `FALLOFF_TABLES` and **4 pellet-shotgun falloff tables** in `PELLET_FALLOFF`, for 45 weapons with some damage-distance data.
- **21 telemetry-derived gravity-drop estimate tables** and **21 corresponding muzzle velocity entries** in `DROP_TABLES` / `MEASURED_MUZZLE_VEL`; **24 weapons lack gravity-drop estimate checkpoints**, and therefore no associated data from those two tables.
- **44 recoil records** in `RECOIL_RAW`: **RPD is completely missing**. Of the 44 recorded weapons, **27 contain at least one null recoil field**; G18C has all 8 fields blank.
- **Lynx AMR and O12 have their first single-projectile damage checkpoint at 2 m**, rather than 0 m. The point-blank TTK panel does not automatically extend their 2 m values to 0 m.
- **Four shotguns** have recorded pellet damage cutoffs: DBS 70 m; S686 80 m; S12K 70 m; Sawn-off 50 m. The published input is damage per pellet, not actual pellets connecting with a player.
- The public recoil curve section is incomplete by design. Individual recoil constants are **not** a measured shot-by-shot spray.
- Attachment modifier percentages in `ATTACH_MOD` are generic to all classes, attachment access is largely assigned from `slotsFor` class logic, and `extendedCapFor` falls back to +5 rounds or +30% for unsourced magazine capacities.
- The RPD reload input is marked as a 3.5 s placeholder; it is deliberately excluded from TTK including reload.
- `BP_THROW` currently uses 18 inventory-space units for both Frag Grenade and Molotov Cocktail.

## Promising source discovered: pubg.gs / source.gs

- https://source.gs/pubg/
- https://pubg.gs/about/
- https://pubg.gs/weapons/
- https://pubg.gs/ballistics/
- https://pubg.gs/attachments/
- https://pubg.gs/gear/
- https://pubg.gs/consumables/
- https://pubg.gs/throwables/
- Official current patch: https://www.pubg.com/en/news/11136

**Build metadata:** These fan-maintained pages state they were generated from **PUBG PC Update 43.2, Steam build 26072644, extracted 2026-10-21**. The extractor says it uses weapon item tables, weapon-gun data assets, trajectory/recoil data, and item space tables; some fields are missing because it cannot decode them. The files may include event or alternative-mode duplicates, so choose the actual standard-mode item IDs.

## 1. Recoil — substantial recoverable fields

**RPD — full toolkit record absent:** https://pubg.gs/weapons/rpd/

Extracted recoil parameters on source: 2 shots per horizontal direction switch; horizontal minimum scalar 0.25; crouch modifier 0.7; prone modifier 0.32; horizontal speed 11; vertical speed 15.5; climb 0.7; fall 2.2; vertical recovery speed 7; max vertical recoil 7.5; vertical minimum 0.05; vertical variation 0.1; vertical recovery clamp 5; vertical recovery max 4.5; recovery modifier 0.55. It also lists a recoil curve with 4 keys. Map each field to the toolkit's exact `RECOIL_RAW` semantics before inserting.

**G18C — all 8 source slots blank:** PUBG's extract names the weapon **P18C**, but the game tag is `G18`: https://pubg.gs/weapons/p18c/

Its recoil entry includes 1 bullet per direction switch; minimum horizontal scalar 0.15; prone modifier 0.7; horizontal speed 12; vertical speed 15; climb 0.18; fall 2; vertical recovery speed 11; vertical variation 0.05; recovery clamp 8; recovery maximum 2; recovery modifier 0.2; 2 recoil curve keys. Not all toolkit fields have a matching source field.

**Other specific examples:**
- Groza: https://pubg.gs/weapons/groza/ — horizontal minimum scalar 0.35, speed 11, vertical speed 14; useful for its blank direction/tendency fields, though a missing heading/direction must not be invented.
- O12: https://pubg.gs/weapons/o12/ — min horizontal scalar 0.5, horizontal speed 12, vertical speed 13, and related curves.
- PUBG Planet also publishes versioned, named recoil fields and original record dates: https://pubgplanet.com/wiki/weapons/rpd

**Caveat:** These sources provide original recoil constants, not the exact recoil motion on shots 1–30 without faithfully interpreting the engine's curves, accumulation, randomness and stance mechanics. Best near-term improvement: fill accurately mapped weapon-level recoil blanks, but keep the Coming Soon full-pattern notice until a validated simulator is available.

## 2. Attachments — stronger evidence than generic percentages

https://pubg.gs/attachments/ publishes **51 attachments** and attaches applicable weapon names based on slot tags, with in-game tooltip effect percentages. This could replace the current class-default compatibility matrix and most of `ATTACH_MOD`.

Examples from the 43.2 extraction:
- **AR/DMR/S12K compensator:** +15% vertical recoil control and +10% horizontal.
- **SMG compensator:** +25% vertical and +20% horizontal.
- **DMR/SR compensator:** +20% vertical and +20% horizontal.
- **Vertical Foregrip:** +15% vertical recoil control.
- **Halfgrip:** +16% horizontal and +8% vertical recoil control; also recoil recovery/sway tradeoffs.
- **Tilted Grip:** +12% vertical, +6% horizontal and +25% camera-shake control.
- **QuickDraw magazines:** +60% reload speed (tooltip), while extended quickdraw examples list +15%.

**Important:** The toolkit currently treats the compensator as -25% vertical / -20% horizontal regardless of weapon class, which is not the same as the class-specific values shown here. Different attachment names (including old/deprecated equipment and mode variants) require explicit item mapping. Do not assume every tooltip percentage corresponds to a direct multiplicative change to one gameplay parameter.

## 3. Magazines and attachment fit — exact tables available, validate actual magazines

https://pubg.gs/attachments/ distinguishes AR/DMR/LMG/S12K, SMG/Handgun, Handgun, and DMR/SR magazine families and lists supported weapons and inventory sizes. E.g. AR/DMR/LMG/S12K Extended Mag appears with **42 rounds**, Extended QuickDraw with **40 rounds**; a DMR/SR Extended Mag appears with **8 rounds** versus Extended QuickDraw with **7 rounds** in the source.

**Do not apply these as universal weapon capacities without checking each weapon/attachment pair.** There are weapon-specific exceptions and separate game fields. We can replace generic +30%/+5 heuristics once the applicability matrix and per-weapon override rules have been built and verified.

## 4. Muzzle velocities and ballistics — many more covered

https://pubg.gs/ballistics/ lists muzzle velocity, projectile hit damage, range modifier, reference distance and modeled flight-time estimates for **59 guns** (more than the toolkit's current 21 entries with drop tables).

Examples from the source for currently unpopulated weapons:
- Lynx AMR: muzzle 1,200 m/s, flight to 200 m listed as 0.177 s.
- O12: muzzle 625 m/s, flight to 200 m listed as 0.469 s.
- R1895: muzzle 330 m/s, flight to 200 m listed as 0.606 s.

The flight times are computed by this other website from game parameters, **not separately measured observations**. The toolkit may support a clearly defined modeled ballistics feature if the owner wants it, but **this does not fill the 24 blank observed-drop tables with directly observed measurements**. The game-data site also exposes ballistic curve keys useful for a future simulation.

## 5. RPD reload — candidate, not automatically verified as combat duration

https://pubg.gs/weapons/rpd/ currently lists **Reload 3.5 s**, matching the toolkit's original 3.5 s placeholder. But https://pubg.gs/about/ identifies its weapon reload source as `WeaponGunConfig.NoAnimReloadDuration`, so the displayed number may not equal a full real-world reload animation. The agreement does not independently validate the toolkit's TTK including reload. Prefer official gameplay timing or captured reload animation timing for that use case.

**Major data-field conflict:** The RPD detail page visibly lists top-level **Base damage 67** while the same page's ballistics section says **Projectile hit damage 43**; official PUBG Update 42.3 confirms 43 per shot: https://www.pubg.com/en/news/10885 . Similar dual-value discrepancies exist for other weapons. **Use projectile hit damage, not the page's headline base-damage field, for ballistic comparisons only after the relevant data mapping has been reviewed. Never bulk-import its top-level damage headline into the toolkit.**

## 6. Backpack — throwable weight discrepancy, source is stronger than old guess

https://pubg.gs/throwables/ lists standard-mode **Frag Grenade space 27** and **Molotov Cocktail space 16**; the current toolkit uses 18 for both. The source includes event-mode duplicate items with space 1, so only use ordinary PUBG item IDs. Also compare with existing game-mode settings before changing the backpack model.

https://pubg.gs/gear/ lists Jammer Pack capacity additions of **+150 / +200 / +250**, which match the toolkit's tier model once base character space is considered. The page also shows suspicious damage-reduction readings above 100% for some Jammer Pack rows; **do not copy those as genuine protection percentages**. https://pubg.gs/consumables/ has inventory space and use-time information, with duplicate event variants, useful for cross-checking healing items.

## 7. Remaining gaps that still need research or a deliberate owner-built model

- **Exact shot-by-shot recoil chart:** Source recoil and curve keys are promising, but no directly documented in-game trajectory for each bullet was established.
- **Observed shotgun pellet hit counts at range (and true TTK):** Source spread values are not direct impact data; measured pellet damage and theoretical minimum shells stay separate.
- **24 weapons missing published gravity-drop estimates:** Data-asset ballistic curves could support a new *modelled* trajectory tool, but the current estimated-gravity table remains 21/45.
- **Exact 0m damage points for Lynx AMR and O12:** Existing source begins at 2m; use modeled extrapolation only if the behavior is intentionally redesigned.
- **Attachment effect interactions on sustained recoil:** Tooltip percentages alone do not describe interactions and whether reductions stack additively or multiplicatively.

## Suggested implementation sequence

1. Reconcile source aliases/semantics (e.g. G18C ⇄ P18C; UMP9 ⇄ UMP, ACE 32 ⇄ ACE32, MK14 EBR ⇄ Mk14) and create importer tests.
2. Compare and fill precisely mapped missing weapon-level recoil values; keep original raw values for rollback and document build provenance.
3. Replace generic attachment compatibility and class-wide recoil effects with verified per-weapon slot maps and separate class-specific modifiers.
4. Audit magazine capacities and backpack item spaces (especially frag/molotov) against standard-mode ItemIDs and add regression tests.
5. Offer modeled bullet trajectories as a separate opt-in feature only after formula/curve validation.
6. Leave uncertain damage outcomes/shotgun real impacts unknown until reproducible testing exists.

**No public UI or calculator source values were changed by this audit.**
