# Combat workspace upgrade

Scope approved 27 October 2026: make weapon data quicker to read and connect Hit Zone, Effective Range and TTK. Preserve Model 2, HELP styling, sensitivity maths and sourced data. Weapon pictures stay out of the statistics table.

- [x] Inspect current production and the battlegrounds.party reference layout.
- [x] Compact Hit Zone: body, equipment, distance and results together; optional calculation details folded away.
- [x] Visible helmet, vest and supported display-mode buttons.
- [x] Searchable weapon browser with optional thumbnails loaded only while open.
- [x] Combat DB Core / Damage / Handling / All stats views, retaining sort and filters.
- [x] Reduce combat headings and panel padding.
- [x] Link weapon, exact recorded distance and appropriate helmet/vest across Hit Zone, Range and TTK.
- [x] Add recorded distance to TTK; unavailable checkpoints remain unavailable.
- [x] Verify source build, automated regression suite, desktop/mobile layouts and keyboard interactions.
- [x] Publish a reviewed PR with preview and validation evidence.
- [x] Confirm release status; distinguish preview from production.

Physical Xbox Series S Edge review remains a device check; browser automation cannot verify controller behavior on that hardware.

## Verification evidence

Implementation merged in [PR #46](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/pull/46) as `5405396213d3d4154a312794a3f942c3413fe55c`.

[PR validation run](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/actions/runs/40445319941) passed on the exact final code commit `45348689bc544254c8ff2b360965d5a5d8577bd8`: generated source check, 180 Node tests, Chrome interaction checks including linked gear/range/search, hit-zone rendering at five widths, media layouts at six widths (320, 360, 390, 768, 1280 and 1440), and 16 phone/desktop screenshots. Desktop Hit Zone and phone TTK captures were visually inspected. Source data and the sensitivity calculation file are unchanged.

## Production release

Verified live on 27 October 2026 at https://help-clan-pubg-toolkit.vercel.app/. Vercel reported successful production deployment of merge commit `5405396213d3d4154a312794a3f942c3413fe55c`. After a full reload, the production UI exposed the new equipment buttons, compact workspace, recorded-distance TTK and linked scenario. A live check carried AKM / 100 m / Helmet 3 / Vest 2 from Hit Zone to TTK and showed Chest / Level 2 / 30.0 damage / 4 hits / 0.30 s TTK.

All implementation and automated verification items above are complete. Remaining physical Xbox review is explicitly unverified and is not a prerequisite for this completed software batch.
