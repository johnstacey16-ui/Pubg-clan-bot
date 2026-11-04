# Damage field audit — PUBG PC Update 43.2

Review date: **2026-10-25**. Linked from the [Hit Zone Explorer roadmap](../HIT_ZONE_EXPLORER_ROADMAP.md).

## Main finding — two distinct fields, not interchangeable

Community extraction of PUBG's PC Steam build **26072644** (extracted **2026-10-21**, Update 43.2) distinguishes:

| Field | Game-file area | Meaning used for this audit |
|---|---|---|
| `WeaponGunConfig.BaseDamage` | `*_WeaponGunData` weapon gun configuration | A distinct gun-data field; shown as **Base damage** on the source's weapon page and used by its derived zone preview |
| `TrajectoryConfig.HitDamage` | `*_WeaponTrajectoryData` ballistics configuration | **Projectile hit damage** displayed under **Ballistics**; closely matches the existing toolkit's 0m recorded-damage input for the checked examples |
| Toolkit `FALLOFF_TABLES` | `src/calculators/00-damage-ballistics.part` | Recorded *per-distance* projectile damage from an independent match-derived source; the hit-zone explorer applies class, bone and intact-equipment multipliers to that checkpoint |

**Do not replace the toolkit's recorded 0m base-damage inputs by copying the gun-config `BaseDamage` column**. These are different game fields. A game-file value alone still does **not** prove the entire runtime damage pipeline or a weapon's actual damage in every situation.

Source methodology: [pubg.gs/about](https://pubg.gs/about/) — separate gun-data and trajectory-data objects; [pubgstatistics.com weapons](https://pubgstatistics.com/weapons) — observed per-distance damage tables, 2026-10-17 update.

## Five independently cross-checked examples

These page pairs show why the earlier audit's apparent weapon-damage conflict should not trigger a blind replacement:

| Weapon (toolkit name) | Game-file gun `BaseDamage` | Game-file projectile `HitDamage` | Toolkit / recorded 0m | Game-file link |
|---|---:|---:|---:|---|
| M416 | 39 | **40** | **40** | [M416](https://pubg.gs/weapons/m416/) |
| AKM | 40 | **48** | **48** | [AKM](https://pubg.gs/weapons/akm/) |
| AUG A3 (source name AUG) | 20 | **40** | **40** | [AUG](https://pubg.gs/weapons/aug/) |
| SVD Dragunov (source name Dragunov) | 46 | **53** | **53** | [Dragunov](https://pubg.gs/weapons/dragunov/) |
| RPD | 67 | **43** | **43** | [RPD](https://pubg.gs/weapons/rpd/) |

**Interpretation:** At least for these five weapons, the **projectile-hit field** matches the 0m toolkit reference; the conflicting **gun-config base field** is not the value the explorer claims to display. This distinguishes fields, **not** a proof that all weapons or downstream modifiers match exactly.

## Dragunov head damage — exception has separate evidence

The game-file **generic DMR** head class multiplier is **×2.35**, not the weapon's per-instance special headshot treatment. The toolkit intentionally stores the **Dragunov-specific ×2.80 override** because its [independent weapon page](https://pubgstatistics.com/weapons/dragunov) shows **53 × 2.80 = 148.4** damage to an unarmoured head at 0m (that published page was observed for Update 42.2), distinct from the default DMR factor.

[KRAFTON's official Update 25.2 notes](https://pubg.com/en/news/6616) confirm the Dragunov was designed to deal *higher headshot damage than other DMRs*, but do **not** state the exact numeric 2.80 in those notes.

**Status:** Keep the creator's existing 2.80 override as a sourced weapon-page model. The precise mechanism and exact value in PC Update 43.2 remain **not independently verified from a per-weapon current build override**, so do not label the 2.80 as a separately proven 43.2 engine constant.

## Not yet verified

- A per-weapon, per-field audit of the remaining **40 of the toolkit's 45 weapons**.
- Whether all per-weapon special head/body handling and trajectory damage curves in the current build are reflected by the sourced point tables, including variants, penetrations and falling damage.
- Current-43.2 gameplay impact of the Dragunov's special head multiplier, falloff, damage caps, damage-type handling and armour durability.

## Maintenance guardrails

- Preserve the original toolkit's recorded falloff data and armour maths unless current-patch evidence is stronger.
- Do not infer intermediate distance results from one end point.
- Keep per-pellet shotgun values distinct from actual whole-shell damage.
- For any new source comparison, identify **the game property/measurement method, patch, variant and distance** explicitly.
- Tests in `tests/hit-zone-adapter.test.cjs` lock the five *source-checked* 0m inputs and their expected zone outcomes to guard against accidental use of `WeaponGunConfig.BaseDamage`.

This audit clarifies the **field mismatch** noted in [hit-zone-source-check-2026-10-25.md](hit-zone-source-check-2026-10-25.md) while keeping the unresolved weapon-by-weapon verification task open.
