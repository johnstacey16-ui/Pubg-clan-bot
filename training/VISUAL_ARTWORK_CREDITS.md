# HELP Clan PUBG Toolkit — Artwork credits

Updated 2026-10-27 for the owner-requested replacement of representative item drawings with PUBG artwork.

## Publisher artwork

Weapons, optics, attachments, ammunition, throwables, healing supplies, boosts, backpacks, helmets and vests use PUBG / KRAFTON artwork. Copyright and other rights remain with their respective owners. This is an unofficial fan toolkit; no endorsement is implied.

Sources:

- [PUBG weapon catalogue](https://d3tpthp8lq9ou3.cloudfront.net/en/game-info/weapons/ar), including its weapon, ammunition and attachment images hosted on `wstatic-prod.pubg.com`.
- [Official PUBG developer asset repository](https://github.com/pubg/api-assets), pinned to commit `32b13b51128b8d8909ae5e77f3b833e01230b24d`, for equipment and utility icons absent from the catalogue.
- [PUBG content creation guidelines](https://d3tpthp8lq9ou3.cloudfront.net/en/clause/content_creation_guideline). These publisher assets are not claimed as original toolkit artwork, public domain or an open licence.

Every publisher image has its exact original URL, original-file SHA-256, source label and rights note in `assets/visual-manifest.json`. Images are served locally, without third-party image requests. Catalogue WebP bytes are unchanged. PNG icons are losslessly encoded as WebP. Existing SVG filenames wrap the raster pixels in a transparent, aspect-preserving viewport; the viewport removes transparent margins without cropping visible content.

## Matching and presentation

All 45 database weapons have distinct, name-matched artwork in `visual-catalog.js`. Existing database labels remain unchanged: G18C uses the catalogue P18C, and the legacy UMP9 label uses its current UMP catalogue image. These image aliases do not establish historical model or ammunition equivalence. No statistics, compatibility rules or calculator values were imported from the artwork sources.

`official-art-catalog.js` maps attachment options to their weapon-specific catalogue images and inventory items to their own icons. Unsupported artwork has no misleading fallback. The Emergency Cover Flare, Emergency Support Flare and Mini Smoke Grenade inventory entries remain readable text where a matching source icon was unavailable. Helmet and vest controls display the selected level's image and hide equipment when None is selected.

Weapon, range, TTK, recoil, equipment and comparison pictures are displayed without artwork toggles. Database rows include weapon thumbnails, and the card gallery, weapon libraries and compatible attachment libraries show their images. Pictures can still change with the selected item; None does not depict equipped hardware. Inactive tools defer their image sources and off-screen images use native lazy loading. Decorative icons have empty alternatives beside the item name; informative images have descriptive alternatives.

## Retained original graphics

The approved Model 2 Hit Zone portrait remains unchanged. Abstract range, timer and recoil diagrams and the iron-sight interface symbol remain original toolkit graphics. These diagrams are explanatory, not publisher ballistic measurements or weapon renders.

## Synthetic media limits

The 127 image files total 8,308,510 bytes; the default Scope image is 6,738 bytes. The local collection has an 8 MiB ceiling, with a 512 KiB ceiling per item icon or thumbnail. It is not fetched as one download. Browser checks enforce at most eight images and 64 KiB of transferred image bodies on the initial Scope screen, plus stable scope preview dimensions. These checks do not claim real-device network speed or measured field Web Vitals.
