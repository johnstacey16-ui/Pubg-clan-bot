# HELP Clan PUBG Toolkit — Calculation and Reference Notes

## Project approach: developer-built models are allowed

The HELP Clan toolkit includes original formulas, manual calibrations and calculations designed by its creator. **These are intentional features, not automatically invalid because they are not published by KRAFTON.** The previous blanket requirement to use only verified official measurements has been retired at the owner's request.

Keep this distinction **in the repository documentation**, without filling the public interface with lengthy methodology:

- **Published measurements:** retain the source, patch and any known coverage limits.
- **Custom or empirical calculators:** may use the creator's original formulas, fitted coefficients and practical assumptions. Keep the maths and intended behavior in source control; clearly note important limitations here for maintainers.
- **Unknown measurements:** an absence of data is not the same as zero. Where a feature explicitly promises recorded values (such as the existing shotgun damage-distance tables), continue respecting the table's known endpoints. A separate modeled calculator can exist when intentionally designed.
- **Avoid accidental changes to proven user-created maths:** interface improvements should not replace or silently remove working sensitivity and scope-matching formulas.

### Core custom sensitivity calculations

The Scope Sensitivity Matcher uses owner-supplied scope-specific A/B constants and two mathematical functions:
`pixel_speed = 3840 × (C + B) / ((A/60) × (10+B))` and
`matched_sensitivity = (A/60) × (10+B) × pixel_speed / 3840 − B`.
The over-the-shoulder **Aim** option uses the owner-supplied 15× constants (A=53, B=0.2), including the same calibration range. The current-sensitivity checker uses the same forward function independently for every entered setting. All px/s results use the existing 3840-pixel reference width, rather than detecting the visitor’s display.

These are **deliberately used empirical conversion formulas**, not a claim to reproduce an official game-engine implementation. They remain in the app and can be the default opening calculator.

## Hit Zone Explorer: gun-config damage vs projectile hit damage

A **2026-10-25** source audit distinguishes two separate PUBG PC Update 43.2 extracted fields: `WeaponGunConfig.BaseDamage` and `TrajectoryConfig.HitDamage`. They can be **very different** for one weapon. Five cross-checked examples (M416, AKM, AUG, Dragunov, RPD) show that the toolkit's existing recorded **0m projectile hit values** match the trajectory **HitDamage** field, not the gun configuration's separately labelled base value. See [the field audit](docs/hit-zone-damage-field-audit.md), with patch-specific links and regression tests. Do **not** bulk replace the toolkit's per-distance damage tables with the other field just because its display name says “Base damage”.

The class-wide DMR head factor in the PC game-file table is ×2.35; the toolkit's **Dragunov-specific ×2.80** is sourced from an independent weapon page observed for an earlier patch, with official qualitative confirmation of a special higher-headshot behaviour. The exact per-weapon override in the current 43.2 game build has **not** been independently verified. Preserve that distinction and do not present every calculated value as a direct current-engine measurement.

## Effective Range — current recorded-distance behavior

- Each weapon has its own list of *published distance checkpoints*. The range slider selects those actual source points only.
- **DBS** pellet damage: recorded 0–70m; **S686**: 0–80m; **S12K**: 0–70m; **Sawn-off**: 0–50m (pubgstatistics.com, checked October 2026).
- These shotgun measurements are **base damage per pellet**, **not** the number of pellets that strike a player. Neither a historical spread cone nor an assumed target width establishes current hip-fire or ADS hits.
- The UI now calculates **theoretical best-case shotgun hits-to-kill**, displayed as **minimum shells (all pellets hit)** at the recorded checkpoints only. It multiplies recorded damage **per pellet** by the supplied pellet count and the chosen body part/class/armour factors, then divides 100 HP by the resulting full-connection shot damage and rounds up. This is **not** measured HTK in a match.
- Every pellet in every shell must land on the selected body area for the illustrated lower-bound scenario. Pellet spread, partial pellet hits, missed shots, armour durability changes, target health differences and player movement are not simulated. Real fights can require more shells; because armour degradation also isn't simulated, treat this as a fixed-armour idealisation, not an absolute guarantee.
- Actual damage to a real target and pellet shotgun **TTK remain No data**; the tool continues to show base per-pellet damage separately and never plots values beyond the shotgun source's last checkpoint.
- **Sawn-off pellet count discrepancy:** the historical toolkit used 8, and some community websites still say 8. PUBG's PC Update 4.3 patch notes explicitly increased the Sawn-off from 8 to 9 pellets, supported by other weapon databases; use 9 for the ideal-case calculation. This is a historical official change, not a fresh independent in-game verification of the October 2026 patch. Primary notes: https://store.steampowered.com/news/posts/?appids=578080&enddate=1565443536 (PUBG's update 4.3 release, September 2019). Compare https://pubg.gs/weapons/sawed-off/ and conflicting https://www.pubgsearch.com/weapons/sawed-off.
- Non-shotgun damage is displayed only at the source's published distances; hitbox/armor results are clearly labeled as calculations from those points.
- WinnerMeta gravity-drop estimates are derived from telemetry flight times (½gt²), not measured point-of-impact drop or scope holdover. Published values refer to **50m buckets** (e.g., 200–250m), not exact point distances. The Range panel identifies the bin and approximates any equivalent angle from its midpoint; do not treat this as a sight correction. Show only published distance buckets, without interpolation or extension.
- Flight time from *muzzle velocity* alone is not reliable beyond the muzzle, so effective-range flight time is **No data** rather than a fabricated constant-speed figure.
- Even a line drawn between measured endpoints can imply false confidence. This toolkit uses individual plotted markers for measured checkpoints.

## Recoil Analyzer — accepted reference curves and intentional simulation

On 27 October 2026, the owner approved PUBGIntel's Per-Shot Analyzer as a solid fallback reference unless it conflicts with existing HELP values. We import its 27 numeric curve sets, variation settings, stance records and alternate MG3 rate. Existing non-null HELP parameters, compatible attachments and additive attachment math take precedence. The other 18 weapons retain an explicit missing-curve state.

The current analyzer samples the reference's recorded curve segments at each weapon's resolved firing interval, displays fixed 10-shot averages and all 30 numeric samples, and offers randomized visual sprays. It does not reinstate the retired universal 5%-per-shot growth formula. Curve values are inputs to an intentional model; simulated paths are not a claim to reproduce exact in-game impacts.

See [the reference audit](docs/recoil-reference-audit.md), `data/recoil-reference.json` and `data/recoil-conflicts.json` for the pinned source hash, two remaining field conflicts, attachment differences, alias mappings, held-tail estimates and full simulation assumptions. The imported reference recovery keys are retained but are not applied as an extra recoil-growth factor. The approved follow-up updates shared MP5K/Vector rates to 901/1101 RPM, with rounded DPS 481/569. Existing attachment effects and SLR tendency remain. MG3 rate and attachment stacking are explicitly unresolved; see [the conflict verification](docs/recoil-conflict-verification-2026-10-27.md).

## Other models and known limitations

The following existing features include custom estimates or incomplete inputs. They can remain useful tools, including when they are the creator's own original work. Track their assumptions here so future code changes don't accidentally alter their behavior:

1. **Supplied recoil parameters** — several weapon-level fields lack independent current-patch validation; do not use them as exact per-shot recoil.
2. **Attachment estimates** — approximate community modifier percentages where no patch-confirmed figure is available.
3. **Magazine capacities** — generic extended-magazine estimates for weapons lacking exact values.
4. **Armor crossovers** — derivations from fixed source tables; distinguish mathematical model outputs from live/current-patch observation.
5. **RPD reload value** — explicitly marked as a placeholder in the original dataset. TTK including that placeholder is now withheld; examine other calculators that still reference reload.

When a model is deliberately included by the creator, retain it and document its assumptions here. Keep the main UI practical and compact; surface a short warning only where it materially changes how a result should be interpreted.

## Verification

Run `node --test tests/*.test.cjs` after updating the toolkit. The `range-evidence.test.cjs` suite checks shotgun source boundaries, other-weapon distance bounds, missing sample distances, bullet-drop limits and browser script syntax.

## Source

- Weapon damage and published falloff checkpoints: https://pubgstatistics.com/weapons
- The source explicitly states damage outside its recorded range is unknown.
- WinnerMeta telemetry-derived gravity estimates: https://winnermeta.win

These notes describe current decisions and are not a ban on future owner-authored formulas or modeled calculations. Preserve the source maths and update this file whenever behavior changes.

## 25 October 2026: vest capacity, item weights, and attachment effects

Update 28.2 folded the Utility Belt +50 into character base carrying capacity (70), but **not** the equipped vest's +50. Standard and Jammer packs each provide +150/+200/+250: totals are **270/320/370 wearing a vest** and **220/270/320 without one**. The calculator defaults to vest equipped but lets players choose. Sources: https://pubg.com/en/news/7083 , https://pubg.gs/gear/ .

PC 43.2 game-file sources: https://pubg.gs/ammo/ , https://pubg.gs/consumables/ , https://pubg.gs/throwables/ ; Steam build 26072644, extracted 2026-10-21. Existing common weights match. Newly covered: .50 Caliber 1/round; BZ Grenade 23, Decoy 12, Sticky Bomb 20, Spike Trap 18, Mini Smoke Grenade 10, Emergency Cover Flare 27, Emergency Support Flare 35. Exclude event/test duplicates (e.g. a 1-unit Frag or Molotov). Some items are limited to particular maps/modes.

PUBG item effects from https://pubg.gs/attachments/ : 43.2 item tooltip reductions largely match existing vertical/horizontal/recovery data. Attachment Optimizer score **excludes** ADS, hip-fire accuracy, initial-shot control, camera shake and sway. Display those secondary effects in the selected-attachment note rather than fabricating conversions into simulated spray. Keep the creator's sensitivity formulas and current preset scoring unchanged.

Official Update 43.2: https://pubg.com/en/news/11136 (PC Oct 14, Console Oct 22). New console controller presets do not publish an alternative sensitivity-conversion equation. Official Update 43.1: https://pubg.com/en/news/11057 . LMG posture changes are already subsequent to the earlier tuning and are captured by the source's 43.2 game-file recoil parameters; **do not apply the 43.1 nerfs a second time**. 43.1 console hitbox improvements explicitly did not rebalance weapon damage, recoil or rate of fire.

## 25 October 2026: dual-family magazine audit and Chrome checks

Game-file attachment slot compatibility at https://pubg.gs/attachments/ (PC 43.2) confirms that Dragunov, SLR, Mini14, Mk12, Mk14, SKS and VSS can equip **both AR/DMR and DMR/SR magazine item families**. The UI now exposes the alternatives for these seven DMRs rather than only for Mk14. Where the toolkit already has supported weapon-loaded counts for both, it reuses them. Mk14's explicitly distinct 22/20 DMR/SR and 20/20 AR-family variants remain independent. The attachment item labels "42 rounds" or "8 rounds" **cannot be applied to every compatible weapon**.

ACE32 40/42 and Dragunov 18/20 conflicting capacity variants remain **unknown** until their exact family and game version are demonstrated; https://pubg.fandom.com/wiki/Extended_Mag_%28AR%2C_DMR%2C_S12K%29 , https://pubg.gs/weapons/ace32/ and https://pubg.gs/weapons/dragunov/ confirm base magazines but do not resolve loaded extension by family. The toolkit now tells the player that variants disagree when one is selected, without substituting a fabricated result.

The GitHub smoke workflow additionally runs **real headless Chrome** over a local static HTTP server with no npm packages or internet: validates the seven panels, default Scope Sensitivity Matcher, range/TTK/recoil output, DMR magazine family switching, ambiguous ACE32, backlink state, and Jammer capacity with and without a vest. This tests committed static JS and HTML in a real browser but **does not** prove the hosted Vercel deployment is current. Official console Update 43.2 https://www.pubg.com/en/news/11136 retains Type A/B/C and Custom alongside the two new console presets; does not justify altering the owner's sensitivity formula.

## 25 October 2026 — magazine TYPE versus magazine FAMILY reconciliation

PUBG's official Update 15.1 [https://www.pubg.com/en/news/1727] explicitly distinguishes three benefits: QuickDraw = faster reload without more rounds; Extended = maximum magazine capacity; Extended QuickDraw = faster reload plus a slightly smaller expansion. **Its documented M416 example** is 30 base / 30 QuickDraw / 42 Extended / 40 Extended QuickDraw. This is not a universal rule for each weapon's *numerical* loaded-round capacity.

The ACE32's published 30 base and **40/42 extended-capacity pair** (https://pubg.fandom.com/wiki/ACE32) matches that distinction and Update 43.2's AR-magazine item 42 Extended vs 40 Extended QuickDraw (https://pubg.gs/attachments/). The toolkit therefore assigns ACE32 **42 Extended / 40 Extended QuickDraw**, with a brief note that this is a multi-source reconciliation rather than an independent October 2026 Xbox in-game measurement.

The Dragunov's published **18/20** range (https://pubg.fandom.com/wiki/Dragunov) is *consistent* with 20 Extended and 18 Extended QuickDraw, but the weapon accepts **two magazine families** (AR/DMR and DMR/SR: https://pubg.gs/weapons/dragunov/). Those pages do not establish the exact combination of type + family + weapon-loaded count at Update 43.2. All Dragunov extended capacities stay unknown pending a direct weapon-specific check. Do not use the generic 42/40 or 8/7 attachment-item tooltip for its loaded magazine.

Legacy wiki pages list 40 for many 30-round ARs even under 'Extended'; PC 43.2 item data shows 42 but cannot alone prove every firearm's loaded capacity. **Other weapon-specific rows are left intact** until supported. Do not blanket-change every Ext/Extended QuickDraw pair.

### Recoil asset accessibility

Game assets and extractors have **coverage limitations**; this is a real reason to stop chasing unavailable measurements. It is plausible that packaging/encryption and undecoded internal formats restrict access, but no reviewed source attributes every individual missing field to encryption. As of the current source audit, every toolkit SMG (9/9), four of five SG/shotguns, all three MGs, and three of four snipers contain at least one missing raw recoil parameter (others too). **This does not mean zero usable metadata**: all 45 weapons have at least some recoil parameters, and the supplemental 43.2 metadata records are present. See docs/remaining-gaps-2026-10-25.md.

Do not infer unknown signed horizontal tendency, exact per-bullet paths or missing crouch modifiers from generic class values, older patches, or a recoil curve's key count. Reserve genuine per-bullet analysis for accessible decoded patterns or independently repeatable controlled in-game measurements. Do not attempt to bypass encryption or expose protected game assets as part of the calculator's ordinary accuracy work.

## Evidence integrity regression — 25 October 2026

PR follow-up after the Extended vs Extended QuickDraw explanation: the source now keeps an explicit `MAG_CAP_EVIDENCE` declaration recording that **M416** is an official worked example, **ACE32** is a cross-source mapping rather than directly measured Xbox 43.2 capacity, **Mk14** uses weapon-and-magazine-family tables, and **Dragunov** remains unresolved across two attachment families. The older `MAG_CAP_VERIFIED` variable name is retained for source compatibility but **must not be construed as universal direct verification**.

Automated Node regression now checks all 45 weapons, nonnegative integer capacities, Extended QuickDraw never exceeding Extended where both are numeric, and the unresolved Dragunov combinations. It separately protects known gaps in current SMG, shotgun, MG and pistol recoil metadata as `null`, not guessed zeros; future source-backed additions should update those assertions with evidence. Headless Chrome also switches through **every weapon's magazine options** and **every weapon's recoil explorer**, asserting the same limits in actual browser UI. These are integrity checks only; they do not decrypt unavailable proprietary curves.

Live Vercel deployment confirmation is separate from GitHub tests and remains unverified where deployment-list permissions are absent.
