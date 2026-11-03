'use strict';
// Run locally: DISCORD_BOT_TOKEN=... DISCORD_CLIENT_ID=... DISCORD_GUILD_ID=... node scripts/register-commands.js
const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  console.error('Set DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID in your local environment.');
  process.exit(1);
}
const url = 'https://discord.com/api/v10/applications/' + encodeURIComponent(DISCORD_CLIENT_ID) +
  '/guilds/' + encodeURIComponent(DISCORD_GUILD_ID) + '/commands';
const commands = [
  { name: 'stats', description: 'Show saved PUBG stats for a player', type: 1,
    options: [{ name: 'gamertag', description: 'PUBG gamertag', type: 3, required: true }] },
  { name: 'leaderboard', description: 'Show the clan leaderboard by kills', type: 1 }
];
(async () => {
  const result = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: 'Bot ' + DISCORD_BOT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!result.ok) {
    const message = await result.text();
    throw new Error('Discord returned ' + result.status + ': ' + message.slice(0, 500));
  }
  const registered = await result.json();
  console.log('Registered guild commands:', registered.map(command => '/' + command.name).join(', '));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
