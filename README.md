# PUBG Console Clan Discord Bot

A Vercel serverless Discord bot using **PUBG API**, **Supabase**, and optional **Groq** AI commentary. It supports **Xbox and PlayStation only** (no PC). Match/season/mastery features are subject to actual PUBG API availability.

## Web dashboard (initial build)

The website and Discord bot now share **this repository, Vercel project, and Supabase**.

- Website: https://pubg-clan-bot.vercel.app/
- Read-only web API: `GET /api/public-stats`
- Existing Discord webhook: `POST /interactions` (unchanged)
- Existing scheduled sync: `GET /api/sync` (unchanged)
- Existing status route: `GET /api/health` (unchanged)

The website includes a mobile-friendly dark overview, official-clan lifetime leaderboards, paginated and sortable roster with favourites saved on each device, per-mode charts, verified profiles, comparisons and real history. Public Xbox/PlayStation player searches and explicit website PUBG refreshes now run through Vercel functions with an atomic Supabase cooldown and shared PUBG API rate limit. Ordinary reloads read saved data without spending PUBG API capacity. Favourites use browser storage only; they are not shared across devices.

This deployment uses Vercel's existing `builds` configuration plus explicit `@vercel/static` entries for `index.html`, `assets/**` and `design/**`. Preserve those static builds when modifying `vercel.json`. Secret environment variables are never supplied to browser code.

- [Project roadmap with status checkboxes](./ROADMAP.md)
- [Original overview picture](./design/overview-reference.svg)
- [Original leaderboard picture](./design/leaderboard-reference.svg)

The two SVGs are original editable design references. Their illustrated numbers are **not actual PUBG results**; the website itself requests verified data from Supabase.

### Commands

## Commands (16)

| Discord command | What it does |
|---|---|
| /stats gamertag | Fetch a verified console player, cache lifetime stats for two hours, display Groq commentary |
| /setup | Admin: save the channel where you run it and create eight permanent dashboard cards |
| /dashboard setup, refresh, status | Advanced dashboard setup, status and manual refresh |
| /leaderboard | Rank **official roster** players by saved lifetime kills and progressively import pending names |
| /roster [page] | View the 55 supplied clan names and import progress |
| /clan | Official clan totals and verified member counts |
| /compare player1 player2 | Compare two Xbox/PSN players using actual saved PUBG statistics |
| /modes gamertag [mode] | Detailed Solo/Duo/Squad lifetime statistics, including FPP modes |
| /recent gamertag [count] | Player's recent match IDs, placements, kills, damage and maps |
| /match gamertag matchid | Individual match result, player kills, placement, assists and more |
| /squad gamertag matchid | Squad breakdown for one match: teammates, kills, damage, assists and knocks |
| /teammates gamertag [count] | Most frequent teammates in the last 1–5 available matches |
| /mastery gamertag type | Weapon or survival mastery, if PUBG returns it |
| /season gamertag | Current-season game modes and results |
| /ranked gamertag | Current ranked tier, rank points and game results, where available |
| /help | Help and list of commands |

**How new commands appear:** After this release is deployed, run an already-registered /stats or /leaderboard command once in the clan Discord guild. The bot verifies the signed Discord interaction, then uses its existing secret Vercel DISCORD_BOT_TOKEN to register the full command list. Refresh Discord's slash-command menu if needed. Registration success appears at /api/health under discord_commands.registered. The local registration script also uses the exact same command definitions; it does a bulk overwrite. **If `/setup` is not visible immediately after a deploy, run `/stats` or `/leaderboard` once so the bot re-registers commands, then reopen the slash-command picker.**

## Official clan vs tracked players

The original 55 supplied names are marked as official clan members in player_import_queue.is_clan_member. Any new user-searched account is tracked and cached, but **not silently promoted to clan membership**. /leaderboard and /clan include only official clan members. /stats, /compare and other player commands work with both groups. Bulk imports focus on official clan names.

## PUBG data and caching

- The standard developer API limit is 10 requests/minute; an atomic Supabase RPC reserves at most 8 calls in 65 seconds across ALL functions, with headroom.
- Account identity search checks Xbox and PSN separately, in batches of up to 10 names.
- The next import step downloads lifetime mode stats for identified account IDs; failed attempts remain queued rather than creating invented zeros.
- /stats checks Supabase first and refreshes when older than two hours.
- A new pubg_endpoint_cache stores player recent-match indexes (15 minutes), season IDs (30 days), mastery (3 hours), season/ranked stats (2 hours), and full match objects (24 hours). Stale data can be shown during API outages with a clear status.
- PUBG match objects are fetched through the **console** shard, are not rate-limited, and are normally available only for 14 days.
- Groq writes optional commentary; the underlying PUBG numeric data always remains the authority.
- /api/sync is an authenticated daily Vercel Hobby fallback (05:00 UTC). It shares the same import queue and rate limit. CRON_SECRET is required.

## Configuration and security

Production Vercel environment variables: DISCORD_PUBLIC_KEY, DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, PUBG_API_KEY, CRON_SECRET, optionally GROQ_API_KEY. Never print, paste into chat, or commit secret values. Set Discord Interactions Endpoint URL to https://pubg-clan-bot.vercel.app/interactions. The bot validates Ed25519 signatures over the raw Discord request body before processing or registering commands. The backend acknowledges slash commands immediately and edits the deferred reply after fetching data.

Important: the legacy public.players, public.matches and public.clan_records Supabase tables **still have RLS disabled**. Restrict their access using deliberate grants/RLS policies before treating the system as fully secured; avoid enabling RLS blindly without reviewing client access.

## Validation and roadmap

Run npm test and npm run check. Verify deployments and /api/health, then exercise commands inside Discord.

This is the *first comprehensive command pack*, not yet every possible PUBG API value. Planned additions: verified clan membership editing, richer mastery formatting, full per-weapon records, telemetry analytics (damage timeline, opponents, kills, revives, paths), match and telemetry-based analysis, official PUBG season leaderboard, multi-metric clan rankings, detailed match history storage, and robust free-tier cache retention. PUBG telemetry and match data are only available while the upstream source retains them.

## Phase 2 — Shareable verified player profiles and real history

Any saved Xbox/PlayStation player can have a shareable platform-aware hash link, such as
`https://pubg-clan-bot.vercel.app/#player/DrBeryl762`.
The site opens the profile on any browser without logging into Discord. The
player profile shows available lifetime mode details, a copyable link and a
metric selector for **kills, wins and matches over time**.

**History is genuine, not backfilled fiction.** The private
`public.player_stat_snapshots` table is seeded only with each player's
actual most recent saved PUBG lookup; a PostgreSQL trigger captures future bot
and importer updates once per UTC day. The chart displays a line only when two
or more real observations exist. A single point is labelled as a baseline,
not a fabricated trend.

`GET /api/player-history?name=<gamertag>` resolves exact verified
official-clan membership before querying the private snapshot table. The
service-role key stays exclusively in Vercel. The anonymous client only sees
allowlisted timestamps and numeric totals — no internal player IDs, account
IDs or tracked outsiders. The snapshot table has RLS enabled, no
`anon`/`authenticated` privileges and an explicit service-role grant, as
required by the Supabase October 2026 table exposure changes.

## Dedicated Discord dashboard channel

1. Create a text channel in the clan Discord server (for example `#clan-stats`). Make it read-only for members if you want only the bot to post there. Ensure the bot has View Channel, Send Messages, and Embed Links permissions. Optional Pin Messages permission lets it pin each card automatically.
2. As a member with Manage Channels or Administrator permission, run **`/setup`** (or `/dashboard setup`) **inside that channel**. The bot creates eight permanent cards: **overview, lifetime leaderboard, six game-mode totals, roster/import progress, and saved records/recent updates, and three full member-stat pages**. Message IDs and the channel are recorded in Supabase; running setup again edits existing messages instead of flooding the channel.
3. Any member can tap **Refresh dashboards** on a card. The bot checks for pending roster imports and up to two stale players, uses the existing atomic PUBG API budget, saves any available changes in Supabase, then edits the original eight posts. A global 90-second click cooldown and database lock prevent duplicate requests. The user gets a private confirmation instead of a new public chat message.
4. `/dashboard status` (channel managers) reports the configured location and last refresh. `/dashboard refresh` also triggers a refresh without using a button. **Each day, the existing Vercel Hobby cron also edits the saved dashboard cards automatically after the scheduled import at approximately 05:00 UTC (Vercel may execute at any time within that hour).** It does not send eight new messages every day.

Dashboard cards show **saved Supabase data immediately**, without wasting API calls every time someone opens Discord. Detailed player, match, and weapon reports remain available from the other slash commands. New account identities continue to be imported in batches within rate limits. This is a message dashboard (Discord embeds), not an arbitrary interactive website embedded in a Discord message.

If dashboard setup fails, verify that the bot is installed in the server and can send embeds in the chosen channel. Dashboard data is not publicly exposed through Supabase; only the signed Discord bot backend uses its service key.

### Modern Discord Components V2 layout

The permanent dashboard messages use **Discord Components V2** rather than old plain embeds. Coloured containers, grouped typography, separators, ranking sections, roster-completion bars and the same Refresh button make the cards easier to scan on desktop and mobile. Existing eight dashboard message IDs are edited in place on the next /dashboard setup, /dashboard refresh or Refresh button (without creating new posts). The migration explicitly clears old content and embeds while setting the immutable IS_COMPONENTS_V2 flag (32768). A real dashboard web app or Discord Activity would be necessary for fully custom interactive charts; this channel layout does not embed HTML/CSS.


## Phase 3 — Cached match intelligence (no 2D replays)

The website's **Match Intelligence** tab reads detailed match data **only from
already-saved Supabase cache entries**. It does not make public PUBG API calls,
does not reserve PUBG request budget, and never returns telemetry URLs or
internal PUBG account IDs.

- Select a verified clan player, or choose **View saved match analysis** from
  that player's profile.
- Review map, mode, placement, kills, damage, assists, headshots, knockdowns,
  revives, heals and the squad's reported performance.
- Use the Discord \`/recent gamertag\` command to fetch available recent matches
  within the shared rate limit; reload the web tab afterwards.
- Match data exists for about 14 days in PUBG; this first public viewer
  exposes at most eight indexed and previously cached detailed matches.
- Public endpoint: \`GET /api/public-matches?name=...\` checks exact verified
  official-clan membership before reading cache and returns only safe fields.
- No match history or opponents are fabricated when the cache is empty.

The long-term archive, additional match collection and protected site refresh
remain roadmap tasks.


## Advanced lifetime profiles and comparisons

The existing /api/public-stats response includes allowlisted advanced metrics from the official PUBG lifetime game modes: damage, headshot kills, assists, knockdowns, revives, Top 10 finishes, heals, boosts and longest kill. Additive values are summed over Solo/Duo/Squad TPP/FPP modes. Longest kill is the maximum across modes. Missing fields display a dash, not a fabricated zero.

Leaderboards can rank by advanced metrics and player comparisons can select a specific TPP/FPP mode. These are Supabase-cache reads and do not make additional PUBG requests.


## Persistent PUBG match archive

The private Supabase `clan_match_archive` table stores sanitised summaries for saved Xbox and PlayStation accounts, populated automatically when the existing bot caches a PUBG match response. It contains no raw PUBG JSON, account IDs or telemetry URLs. Three previously cached genuine match reports were backfilled without new PUBG requests.

Retention is **180 days from the match date**. The existing secret-protected Vercel cron calls `prune_clan_match_archive` during its daily run. If a scheduled run fails, the next successful run resumes pruning. The archive uses RLS and service-role-only grants.

The website's `GET /api/public-matches?name=...` now prioritises up to 30 archived match summaries for a verified clan member. If the archive is empty, it falls back to the temporary PUBG cache. The backend checks roster membership before reading the archive and allowlists every field returned to public viewers.


## Weapon mastery and teammate intelligence

The website now includes **Weapon Mastery** and **Teammate Insights**, using
the read-only, cache-only `GET /api/public-insights?kind=weapons|teammates&name=<gamertag>`
endpoint. Both views verify exact official-clan membership before reading
any Supabase data. Neither requires additional upstream PUBG API requests.

The weapon response is mapped from
`data.attributes.weaponSummaries`, including
`StatsTotal`, `OfficialStatsTotal` and
`CompetitiveStatsTotal` as distinct categories. PUBG keys
`Kills`, `HeadShots`,
`DamagePlayer`, `Groggies`,
`LevelCurrent`, `TierCurrent` and
`XPTotal` are mapped directly; missing fields display an
unavailable dash instead of a false zero. Only one player's mastery
response is currently cached; use the bot's `/mastery`
command to populate additional players without bypassing the rate budget.

Teammate statistics group previously archived squad members by name, counting
games played together, wins together, the partner's kills, damage, assists
and knockdowns, and most recent archived match. The summary reflects
**archived games only**, not guaranteed full PUBG career coverage, and
does not imply that opponents are identified as rivals.


### Expanded saved-player access

All saved Xbox and PlayStation accounts, including people outside the official clan, can use the individual history, match, weapon and teammate views. The 180-day match archive trigger now accepts every saved console player instead of checking clan membership. Official clan totals are deliberately calculated only from the 55-name roster. The private `web_refresh_guard` table and RPC are versioned in `supabase/migrations/` and never accessible to browser-side Supabase credentials.


## Search any console player and refresh from PUBG

The home page now searches **any Xbox or PlayStation PUBG account**:
`GET /api/player-lookup?name=...&platform=xbox|psn` reads saved
statistics and `POST /api/player-lookup` accepts
`{"name":"gamertag","platform":"xbox"}` to refresh
lifetime stats from PUBG. The POST is same-origin and server-side only.
It never exposes the PUBG or Supabase service-role API keys.

The service-role-only Supabase `reserve_web_refresh` RPC
throttles public web refreshes globally (90 seconds) and per player (15
minutes). The Discord bot, importer and website also share the existing
atomic `reserve_pubg_requests` PUBG budget.
The website uses cached stats if they were refreshed in the last 15
minutes. Newly searched accounts are saved with
`is_clan_member=false` by default.

Website player profiles, weapon mastery, history, teammate and match
views now accept all saved Xbox/PSN accounts. Official clan totals
and rankings remain separate. The private match archive can also
store summarised games for any saved player.

**Console discovery:** Auto-detect is the default. For a previously unseen
gamertag, the server searches Xbox and PlayStation, records the one
confirmed account (platform + PUBG account ID), and uses that saved
identity for later updates. Searches of already-saved names need no
additional platform lookup. If the same gamertag resolves to distinct
accounts on both shards, the site asks which console is intended rather
than guessing. The legacy schema intentionally stores one account per
gamertag; it never silently overwrites another console's saved identity.
Supporting unrelated accounts with identical names is only worth a
database migration if users actually need it.

**Scope clarification (2026-11-03):** A player's membership in the 55-name official clan is not required for individual profile, history, match, weapon or teammate reads. The only clan-only figures are the official clan overview, roster, mode totals and clan leaderboard. Lifetime PUBG refreshes can be requested through the website with the shared server-side budget.


### Console detection update

Auto-detect is selected by default in the web search panel. Once an Xbox or PlayStation account has been confirmed, the selector changes to that console and later refreshes reuse the stored account ID. A previously shared player link without a platform also resolves saved data automatically. A duplicate name across genuinely different console identities triggers a choice rather than adding duplicate records.


## Website refresh: weapon mastery, recent matches and seasons

Website visitors can refresh the selected saved console player's **weapon mastery,
recent match index, current season, or ranked season** from the relevant page.
They must first use the homepage to find and save the real Xbox/PSN account;
subsequent refreshes reuse that confirmed platform and account ID. The website
never searches both consoles again for known players.

- `POST /api/player-refresh` (same-origin, JSON body
  `{"name":"<gamertag>","platform":"auto|xbox|psn","scope":"weapons|matches|season|ranked"}`)
  requires a saved account, reserves the global web refresh cooldown and
  a **per-player, per-scope 15-minute cooldown** through Supabase.
- The same existing `reserve_pubg_requests` database RPC remains
  the authority for PUBG's shared rate limit across the website and Discord.
  No browser receives `PUBG_API_KEY` or Supabase credentials.
- Weapon refresh calls the genuine console `weapon_mastery`
  endpoint. Recent matches refresh the saved player match index (one
  rate-limited call) and fetch up to five unique, valid console match
  reports, which PUBG does not charge against the normal API limit.
  Supabase's existing archive trigger saves compact reports.
- Current season and ranked each refresh the platform's current season list
  and that player's season/ranked statistics. Both are bounded to two
  rate-limited API requests per refresh; a season change can be detected
  even if the previous season list had a 30-day cache TTL.
- `GET /api/public-season?name=...&type=season|ranked` reads
  and allowlists already saved mode stats. It never fetches PUBG and never
  returns account IDs, raw cache entries, credentials or telemetry.

The **Reload saved** buttons never contact PUBG. The separate **Refresh
from PUBG** buttons are explicit, rate limited, and preserve stored data if
PUBG returns a temporary error. This is the current season viewer, not a
fabricated historical season graph; longitudinal season history remains
future work.


## Real season and ranked progression (2026-11-03)

The private Supabase `player_season_snapshots` table stores one
**genuine PUBG observation per player, season, mode, type and hour**.
Entries retain only observed match counts, kills, wins, damage, rank
points, the current tier/subtier and the original `fetched_at`
timestamp. No raw PUBG response, account ID, telemetry or credentials
are copied into this historical table. The `archive_pubg_season_cache`
database trigger captures future updates from **both Discord and the
website** without extra upstream PUBG calls. The first migration backfilled
six mode-level rows from one genuine previously cached ranked response;
it did **not** invent historical data for other days or seasons.

Data is retained for **18 months**, with hourly deduplication and the
existing secret-protected daily sync calling
`prune_player_season_snapshots`. RLS blocks anonymous and
authenticated database access; only the server-side service role reads it.
The public `GET /api/public-season` returns at most 240
sanitised season/mode observations for an individual saved player and
statistic type, alongside current season stats and a list of archived season
IDs. All private player IDs and PUBG account identifiers are excluded.

On the Season & Ranked page, visitors can select an archived season and
a game mode to inspect **real kills or ranked RP progression**. A single
observation shows an honest baseline and an explanation; only two or more
actual captured observations produce a line chart. Historic seasons remain
available in the compact archive even after the current-season cache
changes. No estimates or synthetic pre-refresh history are drawn.
