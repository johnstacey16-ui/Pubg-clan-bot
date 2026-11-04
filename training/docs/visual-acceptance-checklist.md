# HELP Clan Visual Upgrade — Owner Acceptance Checklist

**Status: FINISHED AND OWNER-APPROVED (current illustrated scope), 2026-10-26.** PRs #41–#44 are merged into `main`; post-merge CI passed and [production](https://help-clan-pubg-toolkit.vercel.app/) is READY. The owner approved the appearance and requested closeout. **Actual Xbox, phone, accessibility hardware and field-performance testing remains optional, unchecked future QA.**

## Goal

Keep **statistics before pictures**, never show a gun thumbnail in the Combat DB table, and make all eight tools usable on Xbox Series S Edge, mobile and desktop. All art is original, representative concept art, not official PUBG imagery or verified game evidence.

## Automated screenshot evidence (for comparison, not approval)

**Design finding corrected and verified (2026-10-26):** the initial captures showed a very dim Scope panel during an entrance fade. Fixed it to render fully legible immediately and inspected the replacement phone screenshot from [Actions #40281996396](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/actions/runs/40281996396).


The final PR #41 GitHub Actions run captured **16 first-viewport screenshots** using headless Chromium: each of the eight tools at requested 390×900 phone and 1280×900 desktop sizes. Download the [verified **help-clan-visual-review** artifact from Actions #40280605037](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/actions/runs/40280605037/artifacts/12631734018). It contains all 16 PNG images and a capture manifest; the run succeeded on October 26, 2026. Its `capture-manifest.json` records screenshot dimensions and actual file sizes.

These images show the top viewport and are **not real Xbox TV screenshots**, full scroll captures, or an automatic human design review. Compare them against the actual feature-branch Vercel preview and the device checklist below. The owner still needs to inspect weapon detail popup, open optional reference art, actual phone and Xbox controller focus, and any scrolling/clipping.

## Xbox Series S — Edge

- [ ] If doing optional Xbox field QA, open the [current production site](https://help-clan-pubg-toolkit.vercel.app/) on Xbox Edge (PRs #41–#44 are merged; no outstanding preview release).
- [ ] At launch the Scope Sensitivity Matcher shows its result and 3× optic. Use the controller/keyboard to reach Scope, Vertical Multiplier and Resolution tabs with Left/Right/Home/End; verify obvious focus outlines and values unchanged when switching tabs.
- [ ] Open **Combat DB**: the 45 weapon rows are **text and numbers only**. Select an individual gun to see artwork inside the popup. Close with Escape or its close button; focus returns to the selected row. Search and sort without weapon photos filling the table.
- [ ] Open **Model 2 Hit Zone Explorer**: the existing approved figure and all 13 zones remain aligned; helmet and vest choices update values without obscuring targets.
- [ ] Open **Effective Range**, **TTK** and **Recoil**: figures and evidence appear first. Images are optional, closed initially, and appear only when their section is expanded. Shotgun TTK remains **No data**; minimum shells are clearly theoretical. Recoil does not fabricate shot-by-shot curves.
- [ ] Open **Attachments**: choose an equipped sight, grip and suppressor; each category image follows the choice, and **None** displays no equipped art.
- [ ] Open **Backpack**: inventory + and − buttons are easy to select, show 44px-or-larger targets, and totals change correctly without accidental multiple presses.
- [ ] Check screen edges at your normal TV scaling for clipped numbers, horizontal scrolling, unreadable labels or weak focus indicators.

## Phone and desktop

- [ ] On Android Chrome at actual phone size, inspect all eight tools; image previews must not push critical numbers off-screen or cause unexpected sideways scrolling.
- [ ] Test device orientation and text zoom where practical; check tables scroll intentionally instead of clipping.
- [ ] Check keyboard-only access, screen-reader names where available, high-contrast mode and reduced-motion mode.
- [ ] Inspect missing-image recovery: if art fails to load, headings, calculations and controls remain visible.
- [ ] Inspect load smoothness, layout movement and actual device network performance. Record real-user LCP/CLS only with a suitable measurement tool; **the synthetic Chromium budget is not a field performance metric**.

## Reporting and approval

Record **device/browser**, **which tool**, **what went wrong**, and ideally a screenshot. Prioritise overlap, hard-to-read statistics, unwanted artwork, inaccurate labels, focus navigation failures or significant lag. A screenshot is especially useful for an Xbox TV-specific issue.

The current illustrated visual upgrade is live and visually approved by the owner. **Keep physical Xbox/phone field-review and photography/licensing tasks unchecked** until actually performed; they are optional future work, not a claim of release incompleteness. Record any identified issue and fix it in a new pull request rather than silently editing the already-merged feature history.

### Automated baseline — already checked

GitHub Actions [#40278458470](https://github.com/johnstacey16-ui/HELP-Clan-PUBG-Toolkit/actions/runs/40278458470) passed source sync, Node regression tests, all eight tools in real headless Chrome and responsive checks for seven illustrated tools plus Model 2. The 79 image files total 199,252 bytes (excluding their manifest). Default 3× scope artwork is 1,047 bytes; the initial-view synthetic budget is at most 8 image requests / 64 KiB decoded bytes. These tests do **not** replace the device steps above.
