# Per-shot recoil reference audit

Source: https://www.pubgintel.com/pubg-per-shot-analyzer

Accessed: 2026-10-27. HTML SHA-256: `a3632210ca93d5871460451aaece2118cd7a2a208f77489cd7b8405a06d0568d`. The owner approved PUBGIntel as a fallback reference on 27 October 2026. This acceptance does not make simulated bullet positions official measurements. The numeric literals were imported; the HELP sampler, UI and animation are implemented independently.

## Coverage and precedence

All 27 reference weapons map to existing HELP names; HK416 → M416, ACE32 → ACE 32, FAMAS G2 → FAMAS, Mutant → MK47 Mutant, QBZ → QBZ95, Thompson → Tommy Gun, Uzi → Micro Uzi, Dragunov → SVD Dragunov and Mini14 → Mini 14. The other 18 HELP weapons retain their parameter records and an explicit missing-curve state.

Existing non-null HELP RPM, stance, minimum horizontal scalar, horizontal tendency and direction-switch values take priority. Absent fields use the reference. The established Attachments calculator supplies compatibility and individual effects through one read-only adapter. It combines attachment changes additively; the reference multiplies them. Both tools therefore continue to give the same HELP attachment result. The approved verification follow-up updates MP5K to 901 RPM and Vector to 1101 RPM in the shared weapon registry; rounded DPS is 481 and 569. Their timing flows into the analyzer and TTK. All 28 attachment differences remain in favour of HELP item-description values, and SLR tendency remains −0.05. See [the evidence review](recoil-conflict-verification-2026-10-27.md).

Standing defaults to ×1 unless a value exists. A missing crouch value follows the reference's ×1 assumption and is disclosed in the UI. Prone without a value in either dataset is unavailable. MG3 keeps HELP's 700 RPM default over the reference's 660; the additional reference 990 RPM mode is available in this analyzer only. Its active slow-mode rate is disputed: KRAFTON published 660/990, while the PC 43.2 extraction displays 700. The UI discloses this conflict. Additive versus multiplicative attachment stacking is unresolved; this implementation retains additive estimates without claiming engine verification.

## Field conflicts (2)

| Weapon | Field | HELP | Reference | Used |
| --- | --- | ---: | ---: | ---: |
| SLR | tendency | -0.05 | -0.1 | -0.05 |
| MG3 | rpm | 700 | 660 | 700 |

## Attachment effect differences (28)

Values are multipliers, not percent deltas. HELP's effect wins. Exact availability differences are recorded in data/recoil-conflicts.json. A missing reference option does not remove an existing compatible option.

| Weapon | Attachment | Axis | HELP | Reference | Used |
| --- | --- | --- | ---: | ---: | ---: |
| JS9 | muzzle / Compensator | v | 0.75 | 0.8 | 0.75 |
| JS9 | muzzle / Compensator | h | 0.8 | 0.75 | 0.8 |
| MP5K | muzzle / Compensator | v | 0.75 | 0.8 | 0.75 |
| MP5K | muzzle / Compensator | h | 0.8 | 0.75 | 0.8 |
| MP5K | stock / Tactical Stock | v | 1 | 0.95 | 1 |
| MP9 | stock / Folding Stock | v | 0.8 | 1 | 0.8 |
| MP9 | stock / Folding Stock | h | 1 | 0.8 | 1 |
| UMP9 | muzzle / Compensator | v | 0.75 | 0.8 | 0.75 |
| UMP9 | muzzle / Compensator | h | 0.8 | 0.75 | 0.8 |
| Micro Uzi | stock / Folding Stock | v | 0.8 | 1 | 0.8 |
| Micro Uzi | stock / Folding Stock | h | 1 | 0.8 | 1 |
| Vector | muzzle / Compensator | v | 0.75 | 0.8 | 0.75 |
| Vector | muzzle / Compensator | h | 0.8 | 0.75 | 0.8 |
| SKS | muzzle / Compensator (AR/DMR) | v | 0.85 | 1 | 0.85 |
| SKS | muzzle / Compensator (AR/DMR) | h | 0.9 | 0.8 | 0.9 |
| SKS | muzzle / Compensator | v | 0.8 | 1 | 0.8 |
| SKS | stock / Cheek Pad | v | 0.8 | 0.9 | 0.8 |
| SKS | stock / Cheek Pad | h | 1 | 0.9 | 1 |
| SVD Dragunov | muzzle / Compensator | h | 0.8 | 0.9 | 0.8 |
| SVD Dragunov | stock / Cheek Pad | v | 0.8 | 0.9 | 0.8 |
| SVD Dragunov | stock / Cheek Pad | h | 1 | 0.8 | 1 |
| SLR | muzzle / Compensator | h | 0.8 | 0.9 | 0.8 |
| SLR | stock / Cheek Pad | v | 0.8 | 0.9 | 0.8 |
| SLR | stock / Cheek Pad | h | 1 | 0.8 | 1 |
| Mini 14 | muzzle / Compensator | h | 0.8 | 0.9 | 0.8 |
| Mk12 | muzzle / Compensator | h | 0.8 | 0.9 | 0.8 |
| M249 | stock / Tactical Stock | v | 1 | 0.95 | 1 |
| RPD | stock / Tactical Stock | v | 1 | 0.95 | 1 |

## Sampling and simulation

Linear, constant and unweighted cubic Hermite segments use the reference time, value, arrival and leave tangents. Shots sample at (shot−1) × 60/RPM. Values beyond an axis's final key hold its last value; EST is marked when either axis is held. This is deliberately more explicit than the reference's combined end-time flag.

The 1–10, 11–20 and 21–30 windows always use the first 30 shot samples and the same per-axis maximum for normalization. Saved values are percentage points of that maximum. These display windows are not claimed as discrete game mechanics. The imported recovery keys are retained but do not scale the kick curves, matching the reference's current sampler.

Random sprays use the resolved tendency, horizontal minimum, switch cadence and reference vertical variation. First shot is at the crosshair; recoil acts on the following shot. The tendency-to-left-chance mapping is a simulator rule, not a verified engine probability. Lean onset is an estimate (switch cadence / absolute tendency). Timing uses elapsed timestamps, and reduced-motion or unchecked animation renders immediately. The viewport scale is calculated from the unmodified curve rather than refitted to each build. Sprays are capped at five; setup changes cancel animation and reset them. This does not simulate recovery between shots, player counter-pull, sensitivity, camera shake, target hits or game-engine accuracy.

## Reproducing the audit

Download the public source page and run `node scripts/import-recoil-reference.cjs downloaded-page.html`, then `node scripts/recoil-audit.cjs`. Imports parse isolated data literals without executing website scripts, validate numeric keyframes and pin a source hash. Tests compare the generated reference file with its JSON, preserve the existing weapon registry and compare the sampler with the reference equations.
