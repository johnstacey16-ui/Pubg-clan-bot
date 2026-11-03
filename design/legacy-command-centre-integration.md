# Legacy Clan Command Centre integration

A user-provided 1,740-line React/Recharts JSX app was reviewed on
2026-11-03. Its historical fixture players, unverified PUBGClans.net bot
badges and ban labels were not imported into the official project.

Implemented in the existing architecture:
- Six calculated official-clan lifetime awards with match minimums
- Experimental playstyle roles and sample-gated percentile ratings
- Lightweight percentiles radar comparisons based on observed mode data
- Saved, observed lifetime changes from a real 6–14-day pair of snapshots
- Stale, duplicate, missing and inconsistent data-review alerts
- Adjustable what-if scoring policy with no upstream side effects
- Offline CSV import validation and previous/current snapshot differences
- CSV export of official verified saved lifetime fields
- External source bot-exposure scatter, local-only and labelled unverified
- Glossary showing calculations, evidence requirements and limitations

Still gated on safe provenance or data sufficiency:
- Consistency awards need multiple separate real observation days
- Persistent third-party data imports require verified manager auth and audit
- Live Chromium, Android and Xbox acceptance still needs device tests
