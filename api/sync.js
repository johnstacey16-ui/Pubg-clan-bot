'use strict';
const { createClient } = require('@supabase/supabase-js');
const { importPendingBatch } = require('../lib/import-batch');

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

  try {
    const result = await importPendingBatch(db);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Scheduled console import failed:', error.message);
    return res.status(502).json({ error: 'Scheduled import failed' });
  }
};
