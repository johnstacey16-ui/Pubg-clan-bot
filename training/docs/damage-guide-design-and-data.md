# Damage guide — design, data and artwork

Reviewed https://pubgstatistics.com/weapons on 27 October 2026 (page identifies PUBG 43.2 and 17 October 2026 data update).

## Useful presentation ideas adopted

- Separate the formula, fixed hit-area factors, class defaults and combined gear factors into four named sections.
- Put values directly beside the corresponding body region on a model, with live SVG leader lines and readable percentage labels.
- Show all seven class profiles together rather than burying factors in optional calculation details.
- Add independent helmet/vest controls, explicit distance exclusion, numeric table equivalents and mobile wrapping.
- Put yellow jump links at the top of Combat Lab and above the guide.

This is an independently implemented interface and original artwork. No source website scripts, styling or portraits were copied.

## Numerical decisions

The requested factor tables already exist in `src/calculators/00-damage-ballistics.part`. A read-only `PT.DAMAGE_GUIDE` adapter exposes them; no class or region factors are replaced. Each new combined label equals the existing class factor × hit-area factor × gear remaining. No distance factor is included in combined diagrams. Class diagrams represent defaults, with Dragunov's ×2.80 head/neck exception explicitly explained; the live formula uses the actual selected weapon exception.

The source prose says five factors but lists base damage plus four multipliers. The guide describes it accurately as base × distance × armour remaining × hit area × class. Distance factor is the existing recorded distance damage divided by the selected base damage; it does not interpolate or extend missing checkpoints. Unknown values remain No data. Pellet shotguns retain unavailable actual whole-shell damage.

The reference's measured rates (e.g. Vector 1110, Groza 740, SLR 320) differ from our extracted or existing rates. Their measured-versus-extracted methodology needs separate reconciliation; this visual upgrade does not overwrite them or re-open the approved MP5K/Vector rate decision. The reference also exposes custom firing cadence, bolt-action ADS timing, additional weapon pages and patch histories; these are research candidates, not silently imported data. We already provide damage/HTK/TTK modes, weapon comparison, equipment selections and exact recorded-distance results.

## Artwork — updated 28 October 2026

At the owner's request, every photographic model has been replaced, including the old interactive Model 2. All sixteen model placements now use one original neutral, faceless vector training mannequin: `assets/damage-training-mannequin.svg`.

The mannequin uses the same thirteen anatomical paths as the existing interactive map, so the decorative figure and focusable hit regions align. Metallic gradients, subtle facets and joint seams provide depth while staying readable at phone sizes. Main-map equipment overlays and every live numerical label remain independent of the art.

The original sixteen portrait WebP files and their obsolete prompt catalogue are removed. No third-party artwork or website character model is copied. The shared vector is under 20 KB, requested only when Combat Lab opens, and the catalogue's 8 MiB budget and 64 KiB landing-media gate are restored/preserved. Damage values and calculator formulas are unchanged.
