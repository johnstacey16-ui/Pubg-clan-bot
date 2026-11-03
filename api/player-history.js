'use strict';
const { createClient } = require('@supabase/supabase-js');
const { escapeLike } = require('../lib/pubg-utils');

// Saved Xbox and PlayStation players are eligible, including non-clan accounts.
// Never expose internal player IDs, PUBG account IDs, or raw database records.
async function playerHistory(db, suppliedName) {
  const name = String(suppliedName || '').trim();
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f,]/.test(name))
    return { status: 400, data: { error: 'Invalid player name' } };
  const match = rows => (rows || []).find(x =>
    x.gamertag?.toLowerCase() === name.toLowerCase());
  const saved = await db.from('players')
    .select('id,gamertag,platform')
    .ilike('gamertag', escapeLike(name)).limit(10);
  if (saved.error) throw new Error('Cannot read verified player');
  const player = match(saved.data);
  if (!player || !['xbox','psn'].includes(player.platform))
    return { status: 404, data: { error: 'Saved console player not found' } };

  const history = await db.from('player_stat_snapshots')
    .select('observed_at,kills,wins,matches')
    .eq('player_id', player.id)
    .order('observed_at', { ascending: false })
    .limit(120);
  if (history.error) throw new Error('Cannot read player history');
  const points = (history.data || []).reverse().map(x => ({
    date: x.observed_at,
    kills: Math.max(0, Number(x.kills) || 0),
    wins: Math.max(0, Number(x.wins) || 0),
    matches: Math.max(0, Number(x.matches) || 0)
  }));
  return { status: 200, data: {
    schemaVersion: 1,
    name: player.gamertag,
    platform: player.platform,
    metric: 'Lifetime totals, sampled after verified PUBG refreshes',
    points,
    note: points.length < 2
      ? 'Only a genuine baseline is available. History grows as the website or Discord bot refreshes PUBG statistics.'
      : 'Each point is a saved PUBG lifetime total. Changes between points may span multiple sessions.'
  } };
}
module.exports = async (req,res) => {
  if (req.method !== 'GET') return res.status(405).json({ error:'Method not allowed' });
  res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options','nosniff');
  const name = req.query?.name;
  if (typeof name !== 'string' || !name.trim() || name.length > 100 ||
      /[\u0000-\u001f\u007f,]/.test(name))
    return res.status(400).json({ error:'Invalid player name' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(503).json({ error:'Data source unavailable' });
  try {
    const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{
      auth:{autoRefreshToken:false,persistSession:false}
    });
    const result=await playerHistory(db,name);
    return res.status(result.status).json(result.data);
  } catch(error) {
    console.error('Public player history read failed:',error.message);
    return res.status(503).json({error:'Player history temporarily unavailable'});
  }
};
module.exports.playerHistory = playerHistory;
