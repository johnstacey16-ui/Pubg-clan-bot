# Official item artwork replacement

Owner request: use the proper PUBG catalogue pictures for weapons and utility items.

- [x] Inspect the publisher weapon catalogue and the official developer asset repository.
- [x] Match all 45 database weapons, including documented legacy-name aliases.
- [x] Replace representative optics, attachment, backpack, armour and supply drawings.
- [x] Add individual inventory icons and level-specific helmet and vest pictures.
- [x] Preserve existing calculations, compatibility rules, optional pictures and Model 2.
- [x] Record exact source URLs, hashes, publisher ownership and fan-site attribution.
- [x] Pass source, browser, responsive layout and image-decoding checks.
  - 182 Node tests and generated-source checks passed.
  - All eight tools, image decoding, cold image budget, hit-zone geometry and layouts from 320–1440px passed in CI run `40452513810`, tested head `3891bd595e3fd16f5ae318e91080b6b5e9b44606`.
  - Reviewed scope, backpack, Hit Zone, database and attachment captures; all 16 viewport captures are attached to the successful run.
- [x] Review screenshots, merge and verify the production deployment.
  - PR #48 merged as `65ee71ad366aa3f57e14c75ca50c41dcb94377c1`.
  - Vercel reported successful production deployment. A fresh production browser load confirmed the M416 publisher render decoded at 960×320, the Level 3 backpack image loaded, and Bandage had its individual inventory icon.
  - Live URL: https://help-clan-pubg-toolkit.vercel.app/

See `VISUAL_ARTWORK_CREDITS.md` for provenance and the media budget. This batch covers imagery. The wider calculator and database layout work remains tracked in the existing presentation roadmap.
