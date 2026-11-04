# Recoil conflict verification — 27 October 2026

The owner approved the following decisions after reviewing all four weapon-parameter and 28 attachment-axis differences. Published data extraction is distinct from an independent current-build Xbox measurement.

## Weapon decisions

| Weapon | Previous HELP | Accepted value | Evidence and limit |
| --- | ---: | ---: | --- |
| MP5K RPM | 900 | 901 | https://pubg.gs/weapons/mp5k/ lists 901 in PC 43.2. Extracted reference, not measured cadence. |
| Vector RPM | 1100 | 1101 | https://pubg.gs/weapons/vector/ lists 1101 in PC 43.2. Extracted reference, not measured cadence. |
| SLR horizontal tendency | -0.05 | -0.05 | https://pubg.gs/weapons/slr/ exposes -0.05 in its recoil fields. Retain HELP over reference -0.1. |
| MG3 default RPM | 700 | 700, disputed | https://pubg.gs/weapons/mg3/ displays 700, but KRAFTON published 660/990 modes. Retain existing timing with visible uncertainty; 990 remains an analyzer alternative. |

The MP5K/Vector shared weapon records now feed Combat Database, TTK and recoil sampling consistently. Their damage-derived, rounded DPS changes from 480/568 to 481/569. No other weapon numbers or original sensitivity equations change.

## All 28 attachment-axis decisions

Source: https://pubg.gs/attachments/ (published item-description effects). Retain HELP in every row. V/H are vertical/horizontal recoil reduction percentages; an absent direct reduction is 0% in our model.

| Group | HELP value retained | Number of differences |
| --- | --- | ---: |
| JS9, MP5K, UMP, Vector SMG compensator | V 25%, H 20% | 8 |
| SKS AR/DMR compensator | V 15%, H 10% | 2 |
| SKS DMR/SR compensator, disputed vertical field | V 20% | 1 |
| Dragunov, SLR, Mini14, Mk12 DMR/SR compensator, horizontal field | H 20% | 4 |
| MP5K, M249, RPD Tactical Stock, vertical field | V 0%; 5% single-shot recovery is separate | 3 |
| MP9, Micro Uzi Folding Stock | V 20%, H 0% | 4 |
| SKS, Dragunov, SLR Cheek Pad | V 20%, H 0% | 6 |
| Total | | 28 |

These are supported item-description mappings. They do not independently establish resulting spray displacement or convert recovery, muzzle rise, sway or camera shake into direct recoil-axis changes.

## Unresolved evidence

- **MG3 active-mode timing:** official release https://store.steampowered.com/news/posts/?appids=578080&enddate=1598338792 (19 August 2020) states 660/990. Newer extraction displays 700 but does not resolve active mode-specific intervals. Official 43.1 changes https://pubg.com/en/news/11057 concern handling, stance and vehicles; they do not establish a replacement fire rate. Need current active firing-mode logic or repeatable live measurements before choosing 660 versus 700 definitively.
- **Attachment stacking:** no verified paired-attachment game-logic or repeatable current-build measurement was located. Additive HELP and multiplicative PUBGIntel are model choices, not established engine rules. Keep additive calculations and disclose that combined reductions are estimates.

## Source provenance

https://pubg.gs/about/ identifies PC Update 43.2, Steam build 26072644, extracted 21 October 2026, and its weapon/recoil data assets. Its item percentages must not be mistaken for direct measured spray effects. PUBGIntel remains the accepted fallback curve reference; the original pinned import is unchanged.
