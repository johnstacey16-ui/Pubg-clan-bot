# PUBG Console Clan Discord Bot

A Vercel serverless Discord bot using **PUBG API**, **Supabase**, and optional **Groq** AI commentary. It supports **Xbox and PlayStation only** (no PC). Match/season/mastery features are subject to actual PUBG API availability.

## Commands (12)

| Discord command | What it does |
|---|---|
| /stats gamertag | Fetch a verified console player, cache lifetime stats for two hours, display Groq commentary |
| /leaderboard | Rank **official roster** players by saved lifetime kills and progressively import pending names |
| /roster [page] | View the 55 supplied clan names and import progress |
| /clan | Official clan totals and verified member counts |
| /compare player1 player2 | Compare two Xbox/PSN players using actual saved PUBG statistics |
| /modes gamertag [mode] | Detailed Solo/Duo/Squad lifetime statistics, including FPP modes |
| /recent gamertag [count] | Player's recent match IDs, placements, kills, damage and maps |
| /match gamertag matchid | Individual match result, player kills, placement, assists and more |
| /mastery gamertag type | Weapon or survival mastery, if PUBG returns it |
| /season gamertag | Current-season game modes and results |
| /ranked gamertag | Current ranked tier, rank points and game results, where available |
| /help | Help and list of commands |

**How new commands appear:** After this release is deployed, run an already-registered /stats or /leaderboard command once in the clan Discord guild. The bot verifies the signed Discord interaction, then uses its existing secret Vercel DISCORD_BOT_TOKEN to register the full command list. Refresh Discord's slash-command menu if needed. Registration success appears at /api/health under discord_commands.registered. The local registration script also uses the exact same command definitions; it does a bulk overwrite.

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

This is the *first comprehensive command pack*, not yet every possible PUBG API value. Planned additions: verified clan membership editing, richer mastery formatting, full per-weapon records, telemetry analytics (damage timeline, opponents, kills, revives, paths), map/2D replays, official PUBG season leaderboard, multi-metric clan rankings, detailed match history storage, and robust free-tier cache retention. PUBG telemetry and match data are only available while the upstream source retains them.
