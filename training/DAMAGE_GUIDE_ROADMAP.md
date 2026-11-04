> **28 October 2026 update:** The owner has replaced the earlier portrait requirement with neutral standard training models. All sixteen placements, including Model 2, now use one original vector mannequin. The historical checklist below describes the original guide release.

# Visual damage guide — 27 October 2026

Owner request: add PUBGStatistics-style Damage Calculation, Hit Area Modifier, Weapon Class Modifier and Combined Multipliers sections, using distinct photorealistic fictional adult women in fitted going-out outfits for every new model.

- [x] Compare the reference's presentation and data with the existing engine.
- [x] Expose the existing thirteen hit regions and seven class profiles without replacing numbers.
- [x] Add a worked damage calculation linked to Combat Lab weapon, distance, gear and selected region.
- [x] Display one hit-area model, seven class models and seven combined models, all visible.
- [x] Generate fifteen distinct adult portraits and optimize them to WebP; keep model labels as live SVG text.
- [x] Start combined gear at Level 2 / Level 2; support independent gear changes and copying Combat Lab gear.
- [x] Preserve Dragunov's weapon-specific head multiplier, LMG pelvis factor, unknown checkpoints and shotgun limits.
- [x] Add accessible numeric equivalents, mobile layouts, image registration and deferred inactive-tool requests.
- [x] Pass 198 unit checks and generated-source validation.
- [x] Pass real-browser and responsive CI; inspect phone/desktop guide screenshots.
  - Green run `40497573807`, tested head `077f996958ae3439426559c3b588a3e6db13ba95`.
  - All fifteen images decode; independent gear controls, live formula, guide navigation and six responsive widths pass.
  - Eight section screenshots reviewed; the capture fixture presents unchanged production sections at the top to avoid Chromium CLI long-scroll compositor artifacts.
- [ ] Publish and verify the production guide.

See [design and data decisions](docs/damage-guide-design-and-data.md).

## Neutral-model replacement — 28 October 2026

- [x] Replace the interactive Model 2 underlay and all fifteen guide portraits with the standard vector mannequin.
- [x] Match the existing thirteen interactive anatomical regions and retain numerical overlays.
- [x] Remove the sixteen photographic assets and obsolete image-prompt catalogue.
- [x] Pass all 198 unit checks and generated-source validation; review the rendered vector mannequin.
- [ ] Run browser/responsive/screenshot checks: GitHub run `40639845505` failed before any job steps on both attempts, with no job logs; the local Chrome runner also could not launch. These are unavailable checks, not passing results.
- [x] Publish replacement. PR #56 merged as `0ca6344da417c0598a5a6cbf72ab33466043013e`; Vercel reports success.
  - Live desktop browser verified all sixteen model image references use the mannequin, all thirteen interactive regions remain present, Head selection shows 94.0 for unarmoured M416 at 0m, and AR combined head factor changes 235% → 141% between no helmet and Level 2.
  - Interactive and combined views visually reviewed on production. Automated responsive coverage remains unavailable as noted above.
