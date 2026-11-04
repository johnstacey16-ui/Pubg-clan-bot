# Per-shot recoil analyzer

Owner request: include all functionality from the PUBGIntel Per-Shot Analyzer; accept its reference data unless existing HELP data conflicts.

- [x] Import 27 numeric curve sets with original source URL, retrieval date and SHA-256.
- [x] Record aliases, four parameter conflicts, attachment differences and compatibility differences; retain existing HELP values.
- [x] Show class/weapon selection, fire rate/interval and first/maximum curve values.
- [x] Add standing/crouched/prone controls, available attachment picture choices and build multipliers.
- [x] Add three fixed 10-shot stages, stock/build curves, savings and held-tail estimate labels.
- [x] Add all 30 numeric samples, accessible tables and CSV export.
- [x] Add MG3 alternate rate and reference LMG stance-update values.
- [x] Add five independent random sprays, reset, input-change cancellation, stable baseline scale and elapsed-time cadence; honour reduced motion.
- [x] Preserve parameter records and honest missing-curve states for the other 18 weapons.
- [x] Pass unit/browser/responsive checks and review updated screenshots.
  - 195 unit checks plus generated-source verification passed.
  - All-weapon coverage, build effects, five-spray cap/reset, MG3 rate changes, animated cadence and image decoding passed in real Chrome.
  - Responsive checks passed at 320, 360, 390, 768, 1280 and 1440px; phone/desktop recoil screenshots reviewed.
  - Green run `40486952744`, tested head `15e9a231f90029cb53869b7c6dc8c5a7b42fd980`.
- [x] Merge and verify production.
  - PR #51 merged as `498fdd114a002109b0855d26f85e4029155c881c`; Vercel deployment reported success.
  - Production AKM curves, three stages, 30-shot table and two independent spray overlays verified at `https://help-clan-pubg-toolkit.vercel.app/#panel-recoil2`.

## Approved conflict-verification follow-up — 27 October 2026

- [x] Adopt extracted MP5K 901 / Vector 1101 reference RPM; update their rounded DPS to 481 / 569.
- [x] Retain all 28 item-effect values and SLR tendency −0.05.
- [x] Mark MG3 timing and attachment stacking unresolved where calculations are presented.
- [x] Regenerate conflict audit: two remaining weapon conflicts and 28 attachment differences.
- [x] Pass all 195 unit checks.
- [x] Pass browser/responsive CI and verify production.
  - Green run `40489147712`, PR #52 merged as `b983a2605de95415cfae7c4c44d5847fbfce6dee`.
  - Production shows MP5K 901 RPM, Vector 1101 RPM and extracted-rate provenance. MG3 shows 700 disputed / 990 and the unresolved slow-mode notice. Additive stacking disclosure is visible.
