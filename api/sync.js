'use strict';
const { createClient } = require('@supabase/supabase-js');
const { importPendingBatch } = require('../lib/import-batch');
const { collectClanSeasons } = require('../lib/clan-season-sync');
const channelDashboard = require('../lib/channel-dashboard');

// Vercel Hobby's daily cron is a fallback. /leaderboard can make progress
// immediately when people use the bot; both share the database API budget.
module.exports = async (req, res) => {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.CRON_SECRET;
  if (!secret || !process.env.PUBG_API_KEY ||
    !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({ error: 'Import environment is not configured' });
  if (req.headers.authorization !== 'Bearer ' + secret)
    return res.status(401).json({ error: 'Unauthorized' });

  const db = createClient(process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

  let result;
  try {
    result = await importPendingBatch(db);
  } catch (error) {
    console.error('Scheduled console import failed:', error.message);
    result = { status: 'import_failed' };
  }

  // The daily cron also updates every configured persistent Discord dashboard
  // card in place. A failed PUBG import must not prevent saved stats from being
  // displayed; a Discord permission failure must not lose the import result.
  try {
    result.dashboard = await channelDashboard.dailyUpdate(db);
  } catch (error) {
    console.error('Scheduled Discord dashboard update failed:', error.message);
    result.dashboard = { status: 'post_failed' };
  }
  // Gradually populate genuine season/ranked results for verified clan
  // members, after keeping the existing Discord dashboards up to date.
  try {
    result.seasonCollection=await collectClanSeasons(db);
  } catch (error) {
    console.error('Scheduled clan season collection failed:',error.message);
    result.seasonCollection={status:'collection_failed'};
  }
  // Pruning occurs on the existing secret-protected daily sync.
  try {
    const pruned=await db.rpc('prune_clan_match_archive');
    result.archive=pruned.error?{status:'prune_failed'}:
      {status:'ok',removed:Number(pruned.data)||0};
    if(pruned.error)console.error('Archive prune failed:',pruned.error.message);
  }catch(error){
    console.error('Archive maintenance unavailable:',error.message);
    result.archive={status:'prune_failed'};
  }
  // Purge compact season/ranked observations older than 18 months.
  // Runs through the existing secret-protected daily Vercel cron.
  try {
    const trimmed=await db.rpc('prune_player_season_snapshots');
    result.seasonHistory=trimmed.error?{status:'prune_failed'}:
      {status:'ok',removed:Number(trimmed.data)||0};
    if(trimmed.error)console.error('Season-history prune failed:',trimmed.error.message);
  }catch(error){
    console.error('Season-history maintenance unavailable:',error.message);
    result.seasonHistory={status:'prune_failed'};
  }
  const failed = result.status === 'import_failed' &&
    result.dashboard.status === 'post_failed';
  return res.status(failed ? 502 : 200).json(result);
};
