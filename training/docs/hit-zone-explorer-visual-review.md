# Hit Zone Explorer visual and accessibility review

Date: 2026-10-25 | Branch: `feature/hit-zone-explorer-visual` | PR: [#39](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/pull/39)

## Evidence inspected

Actual **integrated toolkit** renders (not mock anatomy art) produced in real headless Chrome and inspected at:

- **Mobile: 390 × 1600** screenshot from [Actions run 40180519016](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/actions/runs/40180519016).
- **Desktop: 1440 × 1100** screenshot from [Actions run 40180604834](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/actions/runs/40180604834).

The screenshots were reviewed before removing the temporary CI screenshot-log step. The reusable `tests/hit-zone-visual-capture.cjs` helper remains in the repository for future design audits but is not part of regular CI.

## Observations and outcomes

1. On mobile, the single front-only figure, all 13 two-line labels, source-status banner, weapon/distance/helmet/vest/mode controls, and optional selected-zone detail card are visible and legible without tapping. The equivalent 13-row table begins below the fold and remains scrollable.
2. The SVG is rendered inside the existing HELP CLAN navy/cyan/amber theme, not a mismatched stock photograph. Body regions are individually outlined. Mirrored limbs share the same data.
3. On desktop, the new eighth navigation item fits the existing sidebar, controls line up in one row, and the figure and detail card appear side by side. The body extends below the initial 1100px viewport; normal page scrolling exposes legs and feet.
4. The reticle design and leader lines do not obscure the numeric cards. A selected region is highlighted in amber; this is not a separate armour calculation or vest-equipment graphic.
5. The layout CI independently checks all 13 callout-card rectangles at 390px and 1280px, text clipping, no document horizontal overflow, and keyboard-focusable zones. The integrated browser smoke test also verifies helmet/vest numeric changes, the 13-row accessible table and keyboard activation.
6. Two limitations remain: (a) the stylized vector soldier is a modelled silhouette, not a photorealistic PUBG character; (b) actual manual Android/iOS device testing or assistive-technology screen-reader testing has not been carried out. Neither affects arithmetic, but these are future polish opportunities.

## Release decision criteria

- Must keep damage evidence distinctions and shotgun theoretical mode disclaimers.
- Must keep standard-intact-gear assumption and no limb armour.
- Must pass source bundle check, all Node tests, integrated browser smoke and isolated 390px/1280px SVG QA **after the final change**.
- Production Vercel deployment remains unverified until after merge; do not claim the new tool is visible on the live URL before checking it.
