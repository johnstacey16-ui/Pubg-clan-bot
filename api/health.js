'use strict';
const { createClient } = require('@supabase/supabase-js');
const { VERSION, commands } = require('../lib/command-definitions');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({ status: 'not_configured' });
  try {
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const [queue, players, run, registered] = await Promise.all([
      db.from('player_import_queue').select('status,is_clan_member').limit(1000),
      db.from('players').select('id', { count: 'exact', head: true }),
      db.from('pubg_sync_control').select('last_run_at').eq('id', 1).maybeSingle(),
      db.from('bot_metadata').select('value').eq('setting', 'guild_commands:1411949587299569788').maybeSingle()
    ]);
    if (queue.error || players.error || run.error || registered.error) throw new Error('Database query failed');
    const counts = (queue.data || []).reduce((result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    }, {});
    return res.status(200).json({
      status: 'ok', platforms: ['xbox', 'psn'], imported: players.count || 0,
      clan_roster: (queue.data || []).filter(x => x.is_clan_member).length,
      tracked_names: (queue.data || []).filter(x => !x.is_clan_member).length,
      discord_commands: { expected: commands.length, registered: registered.data?.value === VERSION },
      queue: { pending: counts.pending || 0, matched: counts.matched || 0,
        ambiguous: counts.ambiguous || 0, not_found: counts.not_found || 0,
        error: counts.error || 0 },
      last_sync_attempt: run.data?.last_run_at || null
    });
  } catch (error) {
    console.error('Import status failed:', error.message);
    return res.status(503).json({ status: 'unavailable' });
  }
};
