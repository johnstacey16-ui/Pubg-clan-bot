# Calculator and weapon presentation upgrade

Requested 27 October 2026 after inspecting PUBG Intel's weapon database, weapon browser, range, TTK, attachment and backpack interfaces. Adapt interaction ideas using original HELP code and existing assets. Keep source data, Model 2, sensitivity calculations and source limits.

- [x] Inspect reference layouts and compare with the released HELP workspace.
- [x] Weapon database: crate filter, filtered leaders, numeric comparison bars and optional weapon cards with routes to comparison/calculators.
- [x] Armour: quick threshold checker backed by the existing head/chest crossover records.
- [x] Effective Range: selectable reference weapon, checkpoint overlays and exact-distance comparison values.
- [x] TTK and calculators: compact result/controls grouping, class filters and clear comparison context.
- [x] Attachments: compatible choices grouped by actual slots, current selections and presets retained.
- [x] Backpack: category/search filters, packed-items summary, remove controls and visible capacity feedback.
- [x] Recoil: clearer parameter presentation while preserving the Coming Soon status and No data for exact spray paths.
- [x] Run source checks, regression tests and real Chrome interaction/layout checks; inspect screenshots.
- [x] Merge and verify production; record release evidence.

Reference patterns only: no copied page code, logos, illustrations, prose or new game statistics. No telemetry, player-stat, map or synthetic combat simulation expansion in this presentation batch.

## Validation

[Final PR checks](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/actions/runs/40448658180) passed on code commit `e9ea8ce9af12cd093bcef16f7eb2ce2d79e2fc70`: generated-source check, 180 Node tests, Chrome interactions for all eight tools including the new filters/cards/thresholds/overlays/slots/packed items, hit-zone rendering at five widths, and media geometry at six widths from 320 to 1440 pixels. Sixteen screenshots were captured. Phone Combat DB/TTK and desktop Attachments/Range were inspected after final spacing refinements.

The original weapon data, falloff readings, attachment rules, carrying weights, scope sensitivity functions, and Model 2 asset are unchanged. The chart renderer's horizontal domain now spans all compared checkpoint series; plotted values remain exact checkpoints with no connecting curves.

## Release

Merged in [PR #47](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/pull/47) as `2760363f9a7df74b1b72355d693ef8880fa23de8`. Vercel reported a successful production deployment. A full reload of https://help-clan-pubg-toolkit.vercel.app/#panel-combat on 27 October 2026 showed the new title, crate filter, numeric bars, Weapon cards/Leaders controls and armour checker. Searching AKM and switching to cards showed its correct class/ammunition/base damage/RPM and Details, Compare and Hit zones routes, with pictures off by default.

All items in this presentation batch are complete. Automated Chrome checks do not claim physical Xbox Series S Edge/controller verification.
