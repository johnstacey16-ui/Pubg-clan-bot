# Remaining recoil and gravity evidence gaps — 25 October 2026

**Live repo snapshot:** PUBG 43.2 extracted gun assets vs the toolkit's specific display fields. This document is **not a claim that every missing field is recoverable**. There are 45 recoil records; 28 contain at least one null field. Null means *unavailable for that field*, not 0. Note that the crouch modifier and derived crouch percentage are stored separately and generally missing together. Signed horizontal direction is not derivable from an unsigned horizontal tendency scalar.

Source-family provenance: https://pubg.gs/about/ (Steam build 26072644, extracted 21 October 2026); individual weapons at https://pubg.gs/weapons/ . An individual weapon's recoil curve key count is **not** a per-bullet empirical spray measurement. The tool maintains its explicit "No data" behaviour and does not extrapolate shot-by-shot recoil, aim-direction, or missing posture modifiers.

## Recoil metadata gaps (28 of 45 records)

| Weapon | Unknown fields in RECOIL_RAW |
|---|---|
| Desert Eagle | Vertical recoil maximum |
| UMP9 | Vertical recoil maximum, Crouch modifier, Crouch percent |
| Kar98k | Crouch modifier, Crouch percent, Minimum horizontal recoil |
| M24 | Crouch modifier, Crouch percent, Minimum horizontal recoil |
| AWM | Crouch modifier, Crouch percent, Minimum horizontal recoil |
| O12 | Crouch modifier, Crouch percent |
| Mk12 | Vertical recoil maximum |
| MP5K | Vertical recoil maximum, Crouch modifier, Crouch percent |
| JS9 | Vertical recoil maximum |
| Tommy Gun | Vertical recoil maximum, Crouch modifier, Crouch percent |
| Vector | Vertical recoil maximum, Crouch modifier, Crouch percent |
| Groza | Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar |
| M16A4 | Horizontal bias direction, Horizontal tendency scalar |
| MK47 Mutant | Horizontal bias direction, Horizontal tendency scalar |
| VSS Vintorez | Horizontal bias direction, Horizontal tendency scalar |
| Micro Uzi | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar |
| MP9 | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar |
| P90 | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar |
| Skorpion | Vertical recoil maximum, Horizontal bias direction, Horizontal tendency scalar |
| M249 | Horizontal bias direction, Horizontal tendency scalar |
| MG3 | Vertical recoil maximum, Horizontal bias direction, Horizontal tendency scalar |
| S686 | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar |
| DBS | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar |
| Sawn-off | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar, Minimum horizontal recoil |
| P92 | Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar, Minimum horizontal recoil |
| R1895 | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar, Minimum horizontal recoil |
| G18C | Vertical recoil maximum, Crouch modifier, Crouch percent, Horizontal bias direction, Horizontal tendency scalar |
| RPD | Horizontal bias direction, Horizontal tendency scalar |

For weapons not yet re-read individually from the current 43.2 pages, these are repository blanks, **not** a proof that a value is absent in the raw asset. Prioritise a verified matching field before changing. Checked directly this pass: UMP (https://pubg.gs/weapons/ump/), Vector (https://pubg.gs/weapons/vector/), MP5K (https://pubg.gs/weapons/mp5k/), P18C/G18C (https://pubg.gs/weapons/p18c/), MG3 (https://pubg.gs/weapons/mg3/), Sawed-Off (https://pubg.gs/weapons/sawed-off/), R1895 (https://pubg.gs/weapons/r1895/), Kar98k (https://pubg.gs/weapons/kar98k/), M24 (https://pubg.gs/weapons/m24/), and RPD (https://pubg.gs/weapons/rpd/). These pages show several vertical maximum / crouch / signed horizontal fields truly absent from their published extracted columns. Do not use generic class averages to fill them.

## Gravity telemetry still not published for 15 weapons

- Lynx AMR
- O12
- R1895
- Desert Eagle
- SLR
- Tommy Gun
- P92
- JS9
- DBS
- Micro Uzi
- S686
- S12K
- G18C
- Skorpion
- Sawn-off

Current coverage is **30/45**. Existing estimates are WinnerMeta's flight-time-derived **gravity-only** 50m-bin aggregates, not measured point of impact or sight holdover. Fan-modeled time-of-flight from the PUBG item files must not be inserted into the directly observed telemetry table. Source audit: docs/gravity-drop-evidence-2026-10-25.md.

## Patch cross-check

- Official 43.1 (https://www.pubg.com/en/news/11057) reduced LMG standing/crouched/prone recoil control under specific conditions. Extracted 43.2 fields are later than this balance change; **do not stack patch-note percentage changes on top of their current values.**
- Official 43.2 (https://www.pubg.com/en/news/11136) added two console controller presets without publishing a new sensitivity-matching formula. No alteration to the creator's Scope Sensitivity Matcher was justified.

## Attachment scoring boundaries

https://pubg.gs/attachments/ lists compatible item families and effects; the existing optimizer's exhaustive 45-weapon tests check only its declared additive recoil score. It is **not a measured shooting-range outcome** and cannot validate secondary ADS, hipfire, camera-shake or recoil-pattern changes without ground-truth trials. A selected accessory's non-scored effects now appear in the attachment note, without blending into the preset's vertical/horizontal score.

## Access limitations and practical research stop rules (25 October clarification)

The author's observation that some weapon recoil parameters may live in inaccessible or encrypted files is a plausible explanation, especially for incomplete SMG, shotgun and special/crate weapons. It is **not confirmed per-field** from the public extractor alone, so documentation should say *not exposed by currently available source* rather than *proven encrypted*.

Audit of existing `RECOIL_RAW` nulls grouped by toolkit class (nulls in any one of eight fields):

| Class | Incomplete records | Total weapons |
|---|---:|---:|
| SMG | 9 | 9 |
| Shotgun (SG) | 4 | 5 |
| MG/LMG | 3 | 3 |
| Sniper rifle (SR) | 3 | 4 |
| Pistol | 4 | 4 |
| DMR | 2 | 7 |
| AR | 3 | 13 |
| **Total** | **28** | **45** |

Source: `src/combat/00-weapon-data-armor.part` current `RECOIL_RAW`, reconciled against `WEAPONS`. The game-file reader at https://pubg.gs/about/ exposes RecoilConfig fields for some weapons, but does not guarantee every property or the actual per-shot curve. Keep nulls absent until a patch-matched, exact-field source is found. Record provenance; stop unproductive repeated searches rather than pretending decryption is trivial.

Separately, the ACE32 magazine 40/42 pair has now been mapped to Extended QuickDraw 40 / Extended 42 based on official Update 15.1's magazine-type trade-off and the 43.2 item table. Dragunov's 18/20 pair still requires family-specific validation. See `DATA_ACCURACY_POLICY.md`.
