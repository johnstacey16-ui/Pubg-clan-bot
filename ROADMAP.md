# PUBG Console Platform — Roadmap

**Repository:** johnstacey16-ui/Pubg-clan-bot  
**Production target:** https://pubg-clan-bot.vercel.app  
**Services:** existing Vercel Hobby, Supabase, official PUBG console API, Discord bot  
**Rules:** free hosting where possible; never expose credentials; Xbox & PlayStation only; no 2D replays; complete checks only when tests pass.

## Completed in the initial web-app foundation (2026-11-03)

- [x] Audit current bot routes, Supabase schema, hosting and build configuration
- [x] Choose a shared-repo and shared-database architecture (no new paid service)
- [x] Save an original design system and editable SVG picture references in `design/`
- [x] Add a standalone responsive dark-theme website at `/`
- [x] Preserve existing Discord interaction, sync and health endpoints
- [x] Add a read-only public web API returning **official clan** data only
- [x] Keep service-role, Discord, Groq and PUBG API secrets on the server
- [x] Build overview, sortable leaderboard, searchable roster, per-player mode details and comparisons
- [x] Add visualizations from real stored mode data; no invented statistics
- [x] Test web response shaping, routes and sensitive-data exclusion with development checks (19/19 passed)
- [ ] Run all repository Node tests in independent CI (workflow installation currently blocked)

## Deployment and acceptance gates

- [x] Vercel deployment READY for initial web foundation commit f73041b; production alias confirmed
- [ ] Verify the homepage and `/api/public-stats` using a real HTTP/browser request (external HTTP inspection was blocked in the current environment)
- [ ] Confirm /interactions, /api/health, /api/sync and Discord dashboard still work
- [ ] Verify responsive layout in Chromium and phone screen size
- [ ] Verify browser security headers and safe public data with production responses

## Next development phases

### Phase 2 — Complete profiles and discovery
- [ ] Player search across tracked accounts with consent/public visibility policy
- [x] Add real advanced lifetime profile metrics and per-mode comparisons (damage, headshots, assists, knockdowns, revives and Top 10s)
- [ ] Add weapon-specific mastery and richer advanced charts
- [x] Shareable official-clan player links (`/#player/<encoded-gamertag>`) and per-player detail panels
- [x] Real daily snapshots from all PUBG player updates, including baseline captured at the real last-fetch timestamp
- [x] Read-only private-table-backed history API, with no player IDs or tracked outsiders exposed
- [x] Historical SVG charts that appear **only after two or more real snapshots**
- [ ] Full roster pagination, advanced filters and saved player favourites
- [ ] Verify a second genuine snapshot and resulting public chart after an actual PUBG refresh
- [x] Validate shareable profile links and real-history baseline/line-chart behaviour in a simulated browser
- [ ] Handle ambiguous platform names and missing accounts in an admin-only workflow

### Phase 3 — Match analysis (no replay features)
- [x] Read-only cached PUBG match-intelligence API (official players only; no public upstream calls)
- [x] Responsive Match Intelligence website tab with optional squad breakdown
- [x] Verify match-cache shape in Supabase; use existing Discord /recent to populate
- [x] Persistent verified-clan match archive, 180-day retention, daily pruning via the existing secret-protected cron
- [x] Backfill three genuine saved match reports without using the PUBG API
- [x] Private RLS and verified-roster access; public output uses an explicit field allowlist
- [ ] Confirm trigger archiving on the next newly retrieved PUBG match in production
- [x] Archived match details and squad breakdown on the website
- [ ] Opponent and recurring teammate analysis across archived games
- [ ] Weapon mastery views with documented PUBG field mapping
- [ ] Season and ranked histories and per-mode leaderboard measures

### Phase 4 — Secure updates and Discord integration
- [ ] Authenticated manager-only website refresh using existing budget and database lock
- [x] Discord dashboard **View full dashboard** link
- [ ] Configurable Discord clan membership management
- [x] Audit legacy Supabase grants and secure `players`, `matches`, `clan_records` (RLS enabled; anonymous/authenticated access revoked; service-role preserved)
- [ ] Accessibility and performance regression gate

### Phase 5 — Production hardening
- [ ] Run full automated regression suite and browser checks
- [ ] Error monitoring, stale-data indicators and backoff
- [ ] Confirm free-tier usage, hosting and API-request budgets
- [ ] Validate layout and interaction on Xbox browser (hardware acceptance separately)

## Asset provenance

The older inspiration images shown conversationally were externally selected illustrative searches, **not supplied source files or owned artwork**, so their exact image bytes aren't available for committing into GitHub. Instead, `design/` contains **new original editable SVG picture references** drawn for this project and an original UI theme. Those files are safe to version, inspect and adapt. No screenshots or fake PUBG data are represented as real stats.

## Architecture

```text
Website  /                 /assets/css/site.css, /assets/js/site.js
   |                      /design/*.svg original references
   | GET /api/public-stats  (sanitized, official roster only; read-only)
   v
Existing server-side Supabase service role --> saved verified statistics
Existing Discord /interactions & /api/sync --> shared rate-limited PUBG data collection
```

Website data reads **Supabase, not the upstream PUBG API**. Refreshing the page never spends PUBG API capacity. Admin-initiated PUBG refresh remains protected by existing Discord commands until web authentication is implemented. No 2D replays will be built.
