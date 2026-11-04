# PUBG Console Platform — Roadmap

**Repository:** johnstacey16-ui/Pubg-clan-bot  
**Production target:** https://pubg-clan-bot.vercel.app  
**Services:** existing Vercel Hobby, Supabase, official PUBG console API, Discord bot  
**Rules:** free hosting where possible; never expose credentials; Xbox & PlayStation only; real telemetry 2D replays are permitted (no invented paths); complete checks only when tests pass.

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
- [x] Run all repository Node tests in independent GitHub Actions CI (last verified GitHub Actions run on 2026-11-03; workflow installs pinned backend dependencies)

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
- [x] Add real cached weapon-mastery table, level/tier/XP, detailed stats and visual kill bars
- [ ] Expand weapon-mastery coverage across clan players and additional advanced charts
- [x] Shareable console player links (`/#player/xbox/<name>` or `/#player/psn/<name>`) and per-player detail panels
- [x] Real daily snapshots from all PUBG player updates, including baseline captured at the real last-fetch timestamp
- [x] Read-only private-table-backed history API for saved console players, without revealing database IDs
- [x] Historical SVG charts that appear **only after two or more real snapshots**
- [x] Roster pagination, name/kills/wins/favourites sorting, console/status/favourites filters and on-device saved clan favourites (no account or database required)
- [ ] Verify a second genuine snapshot and resulting public chart after an actual PUBG refresh
- [x] Validate shareable profile links and real-history baseline/line-chart behaviour in a simulated browser
- [x] Handle ambiguous platform searches openly, requesting a console choice only if both shards return a matching gamertag

### Phase 2B — Public console player discovery and protected website refresh
- [x] Search any saved Xbox or PlayStation gamertag from the website
- [x] Web-based lifetime PUBG refresh using the existing shared Discord API budget
- [x] Global and per-player website cooldowns through a private atomic Supabase RPC
- [x] Individual profile, weapon, match and history views for saved players outside the clan
- [x] Retain official clan-only totals and separately track searched outsiders
- [x] Shareable platform-specific links for arbitrary saved players
- [x] Auto-detect a new player's console, save that one account, and reuse its confirmed platform/account ID on future refreshes
- [x] Preserve official clan membership labels when the player is found through Auto-detect
- [x] Accept omitted platform on website API requests as Auto-detect (no second account required)
- [x] If both console shards return matching names, request a manual console choice instead of creating duplicate profiles
- [ ] Evaluate genuinely distinct Xbox and PSN accounts sharing an identical displayed name only if this becomes a real requirement
- [x] Website PUBG refresh for weapon mastery, recent matches, current season and ranked
- [x] Per-player, per-refresh-type 15-minute cooldown plus shared 90-second global web limit
- [x] Bound recent match detail refresh to five match IDs; use PUBG's non-rate-limited console matches endpoint
- [x] Explicit season-list revalidation so stale 30-day season indexes do not hide new seasons
- [x] Current Season & Ranked page using sanitised cached statistics and honest empty states
- [x] Store observed PUBG season/ranked stats per mode in a compact private hourly archive (18-month retention)
- [x] Capture new observations automatically whenever Discord or the website caches a genuine season or ranked response
- [x] Backfill one real cached ranked response at its original fetch timestamp (six mode records; **not six dates**)
- [x] Show only real observed season kills / ranked points on the Season & Ranked page, with no line until two observations exist
- [x] Preserve older season IDs when the current PUBG season changes
- [ ] Verify progression charts with two different genuine refresh timestamps from PUBG production
- [ ] End-to-end production browser, Android and Xbox validation

### Phase 3 — Match intelligence and recorded-coordinate replays
- [x] Read-only cached PUBG match-intelligence API for saved console players (no public upstream calls)
- [x] Responsive Match Intelligence website tab with optional squad breakdown
- [x] Verify match-cache shape in Supabase; use existing Discord /recent to populate
- [x] Persistent match archive for all saved Xbox/PS players, 180-day retention, daily pruning through protected cron
- [x] Backfill three genuine saved match reports without using the PUBG API
- [x] Private RLS and verified console-player lookup; public output uses an explicit field allowlist
- [ ] Confirm trigger archiving on the next newly retrieved PUBG match in production
- [x] Archived match details and squad breakdown on the website
- [x] Recurring teammate analysis from real archived squads (games, wins, kills, damage and last played)
- [ ] Opponent and rival analysis after safe source fields are available
- [x] Weapon mastery views documenting StatsTotal, OfficialStatsTotal, CompetitiveStatsTotal, LevelCurrent, TierCurrent and XPTotal (separate categories)
- [x] Real historical season/ranked snapshots and per-mode progression charts
- [x] Historical season/ranked clan leaderboards from latest genuine per-player, per-mode, per-season observations with source timestamps (server-only SQL RPC, API, and website)
- [x] Add persistent, budget-limited daily season/ranked collection for verified clan players through the existing Vercel cron (two players per run)
- [ ] Verify historical clan leaderboard on live website with multiple real player snapshots
- [ ] Observe and verify the next genuine production daily season/ranked collection

### Legacy console dashboard migration

- [x] Import and attribute seven pinned publisher dictionaries without private player data or another API
- [x] Add public-safe saved PUBG source explorer for profile, seasons, ranked, mastery, survival and match fields, including typed nested paths and safe JSON download
- [x] Integrate bounded real match-local combat, event-level rival analysis and 2D sampled-coordinate replay (secure publisher-only telemetry URL, shared web cooldown, persistent derived Supabase cache, no extra API key)
- [ ] Verify actual telemetry processing and replay on a newly fetched production match
- [x] Official regional/season leaderboard page with exact API rank/metric fields, saved cache reuse, 90-second shared web cooldown and atomic shared PUBG requests; corrected for the post-Season-7 no-page-filter endpoint
- [ ] Validate official regional leaderboard live against a genuine returned production response
- [ ] Complete telemetry source browsing, player activity, sample and tournament resources
- [ ] Verify migrated features using production API, Chromium and console browsers
- [ ] Retain old private source until feature parity and acceptance; no deletion

- [x] Safe on-demand Data Health page with real Supabase cache and budget summaries (8 reserved API calls per 65 seconds); no new Vercel function
- [ ] Complete final old-dashboard migration matrix and browser/device acceptance

### Phase 4 — Secure updates and Discord integration
- [ ] Authenticated manager-only website refresh using existing budget and database lock
- [x] Discord dashboard **View full dashboard** link
- [ ] Configurable Discord clan membership management
- [x] Audit legacy Supabase grants and secure `players`, `matches`, `clan_records` (RLS enabled; anonymous/authenticated access revoked; service-role preserved)
- [x] Adapt legacy Command Centre awards, experimental roles, optional clan percentile ratings and What-if policy controls
- [x] Add an SVG percentile comparison radar based on actual saved mode data
- [x] Show real 6–14 day snapshot progress through a private Supabase RPC; flag counter resets and missing baselines
- [x] Add local-only validated CSV historical comparison, official CSV export, labelled source-only bot scatter, data quality flags, and analytics glossary
- [ ] Add genuine multi-observation consistency awards when enough historical samples exist
- [ ] Add authenticated manager-only persistent CSV imports with auditable source provenance
- [ ] Verify the new Command Centre views in production browsers, Android and Xbox
- [ ] Accessibility and performance regression gate

### Phase 5 — Production hardening
- [x] Full automated Node regression suite: regression suite checked via GitHub Actions on 2026-11-03
- [ ] Complete live desktop, Android and Xbox browser checks
- [ ] Error monitoring, stale-data indicators and backoff
- [x] Consolidate new API handlers into the existing 12 Hobby-compatible Vercel functions (no paid upgrade or separate backend)
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

Ordinary website reads use saved Supabase data and never spend PUBG API capacity. Explicit **Refresh from PUBG** requests run through a server-side Vercel function, an additional web cooldown and the same atomic shared PUBG request limit as Discord. Unknown gamertags are checked on Xbox and PSN once; known account IDs and platforms are reused. No 2D replays will be built.
