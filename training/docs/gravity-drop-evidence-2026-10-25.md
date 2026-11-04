# WinnerMeta gravity-drop evidence recovery — 25 October 2026

This is a **source audit of 50-metre telemetry bins**, not independently measured impact displacement or in-game scope holdover. WinnerMeta derives estimated gravity movement from flight time (½gt²). Its source bins shown as `200–250m` and `400–450m` are saved under **start-of-bin identifiers** 200 and 400 in the legacy `DROP_TABLES`. The Range tool explicitly labels the bin and calculates an **approximate** angle using the bin midpoint, rather than implying 200m is an exact measurement. Data is shown at existing selected distance checkpoints that coincide with a bin start, never interpolated.

| Toolkit weapon | 200–250m (cm) | 400–450m (cm) | 600–650m (cm) | WinnerMeta page | Telemetry window |
|---|---:|---:|---:|---|---|
| RPD | 45.9 | 203.2 | — | https://www.winnermeta.win/pubg/weapon/RPD | 2026-10-18 to 2026-10-22 |
| ACE 32 | 58.7 | 317.1 | — | https://www.winnermeta.win/pubg/weapon/ACE32 | 2026-10-20 to 2026-10-24 |
| M16A4 | 35.2 | 177.0 | — | https://www.winnermeta.win/pubg/weapon/M16A4 | 2026-09-11 to 2026-09-25 |
| MK14 EBR | 35.2 | 158.6 | — | https://www.winnermeta.win/pubg/weapon/Mk14 | 2026-10-19 to 2026-10-23 |
| SVD Dragunov | 44.1 | 183.5 | 512.8 | https://www.winnermeta.win/pubg/weapon/Dragunov | 2026-10-16 to 2026-10-20 |
| MK47 Mutant | 54.7 | 265.4 | — | https://www.winnermeta.win/pubg/weapon/Mk47Mutant | 2026-09-14 to 2026-09-28 |
| P90 | 66.4 | — | — | https://www.winnermeta.win/pubg/weapon/P90 | 2026-10-19 to 2026-10-23 |
| MP5K | 219.3 | — | — | https://www.winnermeta.win/pubg/weapon/MP5K | 2026-10-20 to 2026-10-24 |
| FAMAS | 34.9 | — | — | https://www.winnermeta.win/pubg/weapon/FAMASG2 | 2026-10-20 to 2026-10-24 |

**Verification scope:** Values and named bucket intervals read from the corresponding WinnerMeta public weapon pages; weapon-name aliases checked against toolkit records. The display is a snapshot of rolling match-telemetry analysis, not version-locked game-client physics. No missing bucket, shotgun pellet connection, 30-shot recoil pattern or extra weapon was filled with extrapolation.

**Additional source review:** PUBG PC 43.2 extracted data (Steam build 26072644): https://pubg.gs/ and https://pubg.gs/about/. Checked recoil pages for UMP, Vector, MP5K, MP9, JS9, Groza, MG3, P18C, RPD, Kar98k, M24, AWM, R1895, Sawed-Off, S686 and DBS. The current toolkit already has many matching values in `RECOIL_RAW` and all 45 mapped supplemental records in `RECOIL_DETAIL_43_2`. Other null values (e.g. unsupported vertical recoil maximum, unknown signed horizontal tendency, missing crouch modifier) remain null where the extracted data does not expose that exact field. A recoil curve key count is not a measured per-bullet displacement series. See https://pubg.gs/weapons/ and the individual weapon pages.

**Other missing data:** 15 of the toolkit's 45 weapons still lack published WinnerMeta gravity-drop bins after this snapshot. The older 24-weapon count in the 2026-10-24 audit is historical; other independently sourced muzzle velocity fields do not establish gravity-drop bins. Keep source date and game patch distinct.
