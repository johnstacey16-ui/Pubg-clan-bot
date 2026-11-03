# PUBG Clan Discord Bot

Discord interactions API hosted as a Vercel Node.js function, with saved stats in Supabase.

## Configuration

In Vercel, configure `DISCORD_PUBLIC_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY`. Keep keys secret and never commit them. Set Discord's Interactions Endpoint URL to `https://pubg-clan-bot.vercel.app/interactions` once the deployment succeeds.

## Commands

Register the two **guild** slash commands with `node scripts/register-commands.js` using `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID` in your local environment. Do **not** paste tokens into third-party request-testing websites. The script uses Discord's bulk overwrite endpoint, so it will replace other guild commands for this app.

- `/stats gamertag:<name>` shows saved stats.
- `/leaderboard` ranks saved players by kills.

Both commands display saved database records; automatic PUBG API sync is a separate feature still to implement. A successful Discord endpoint handshake does not prove stats have been imported.

## Security

Every incoming POST is verified with Discord's Ed25519 signature, the **raw** HTTP body, and a timestamp freshness check. The endpoint rejects unsigned requests. The tables should be protected with RLS or restricted database grants; only the backend should use the Supabase secret key. Rotate keys immediately if they have been disclosed.

## Deployment

Pushing to the production branch should trigger Vercel's Git integration when configured. Verify the deployment is ready before saving the interaction URL in Discord. Discord rejects requests whose initial response exceeds its deadline; the current commands avoid slow external AI calls.

## Console-only PUBG import

An import queue in Supabase holds 55 supplied Xbox/PlayStation player names. The backend endpoint `/api/sync` searches **only** `xbox` and `psn`, marks cross-platform name collisions as ambiguous, fetches lifetime overall stats for unambiguous accounts, and writes to `players`. It does not search PC or invent missing stats.

A Vercel Hobby-compatible cron runs the sync at 05:00 UTC daily, in batches of up to six pending names. This requires a sensitive **Production** environment variable named `CRON_SECRET` in addition to `PUBG_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY`. Requests must contain the header `Authorization: Bearer <CRON_SECRET>`; never share that secret or commit it. A persisted database lease prevents overlapping runs and imposes a minimum 90-second cooldown. One invocation makes at most eight PUBG rate-limited calls. PUBG API rate limits are shared with any other application using the same PUBG key.

Only verified players are added to `players`, so `/leaderboard` initially remains empty. The importer does not yet sync match history, refresh already-imported stats, resolve ambiguous names, or auto-enroll newly queried names. These are future improvements. The legacy `players`, `matches`, and `clan_records` tables still require a deliberate RLS/grants security policy decision.
