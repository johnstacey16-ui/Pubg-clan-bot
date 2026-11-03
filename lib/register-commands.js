'use strict';
const { commands, VERSION } = require('./command-definitions');
const GUILD = '1411949587299569788';

// Register after an authenticated, signed interaction from the clan guild.
// The bot token remains in Vercel; users never have to paste it into Discord.
async function ensureGuildCommands(db) {
  const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
    console.error('Discord auto-registration not configured');
    return false;
  }
  const key = 'guild_commands:' + GUILD;
  try {
    const current = await db.from('bot_metadata')
      .select('value,updated_at').eq('setting', key).maybeSingle();
    if (current.error) throw current.error;
    if (current.data?.value === VERSION) return true;
    const updated = current.data?.updated_at ? Date.parse(current.data.updated_at) : 0;
    // Avoid repeated registrations if Discord credentials are temporarily bad.
    if (current.data?.value === 'retry:' + VERSION &&
        Date.now() - updated < 5 * 60_000) return false;
    const mark = await db.from('bot_metadata').upsert({
      setting: key, value: 'retry:' + VERSION, updated_at: new Date().toISOString()
    }, { onConflict: 'setting' }).select('setting');
    if (mark.error) throw mark.error;

    const uri = 'https://discord.com/api/v10/applications/' +
      encodeURIComponent(DISCORD_CLIENT_ID) + '/guilds/' + GUILD + '/commands';
    const response = await fetch(uri, {
      method: 'PUT',
      headers: {
        Authorization: 'Bot ' + DISCORD_BOT_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      // Only log the status code; never log token-bearing headers or bodies.
      throw new Error('Discord command registration HTTP ' + response.status);
    }
    const registered = await response.json();
    if (!Array.isArray(registered) || registered.length !== commands.length)
      throw new Error('Discord returned an unexpected command registration result');

    const saved = await db.from('bot_metadata').upsert({
      setting: key, value: VERSION, updated_at: new Date().toISOString()
    }, { onConflict: 'setting' }).select('setting');
    if (saved.error) throw saved.error;
    console.log('Registered ' + commands.length + ' clan Discord commands');
    return true;
  } catch (error) {
    console.error('Command registration failed:', error.message);
    return false;
  }
}
module.exports = { ensureGuildCommands };
