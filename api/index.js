'use strict';
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

// Discord requires a response within three seconds. The core commands intentionally
// use deterministic formatting rather than waiting for an external AI completion.
const allowedSkewSeconds = 300;
const response = (content, ephemeral = false) => ({
  type: 4,
  data: { content: String(content).slice(0, 2000), allowed_mentions: { parse: [] }, ...(ephemeral ? { flags: 64 } : {}) }
});
const supabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function verifySignature(raw, headers, publicKeyHex) {
  const signature = headers['x-signature-ed25519'];
  const timestamp = headers['x-signature-timestamp'];
  if (typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature) ||
      typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) ||
      typeof publicKeyHex !== 'string' || !/^[a-f0-9]{64}$/i.test(publicKeyHex)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > allowedSkewSeconds) return false;
  try {
    const key = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki'
    });
    return crypto.verify(null, Buffer.concat([Buffer.from(timestamp), raw]), key, Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function handleCommand(body) {
  const name = body.data?.name;
  const db = supabase();
  if (name === 'stats') {
    const gamertag = String(body.data?.options?.find(o => o.name === 'gamertag')?.value || '').trim();
    if (!gamertag || gamertag.length > 100) return response('Please provide a valid gamertag.', true);
    const { data: players, error } = await db.from('players')
      .select('id,gamertag,platform,total_kills,total_wins,matches_played,last_checked')
      .ilike('gamertag', gamertag).limit(5);
    if (error) throw error;
    const player = players?.find(p => p.gamertag.toLowerCase() === gamertag.toLowerCase());
    if (!player) return response('No saved stats for that gamertag yet. PUBG syncing has not been enabled.', true);
    const { data: matches, error: matchError } = await db.from('matches')
      .select('match_id,kills,win,match_date')
      .eq('player_id', player.id).order('match_date', { ascending: false }).limit(5);
    if (matchError) throw matchError;
    const games = Number(player.matches_played) || 0;
    const kills = Number(player.total_kills) || 0;
    const lastSync = player.last_checked ? new Date(player.last_checked).toISOString().slice(0, 10) : 'Not yet synced';
    return response([
      '🎮 **PUBG Player Stats**',
      '**' + player.gamertag.replaceAll('*', '\\*') + '** (' + player.platform + ')',
      'Kills: **' + kills + '** · Wins: **' + (player.total_wins || 0) + '** · Matches: **' + games + '**',
      'Kills per match: **' + (games ? (kills / games).toFixed(2) : 'N/A') + '**',
      'Recent matches saved: **' + (matches?.length || 0) + '** · Last sync: ' + lastSync,
      '_These are saved statistics, not a live PUBG API lookup._'
    ].join('\n'));
  }
  if (name === 'leaderboard') {
    const { data, error } = await db.from('players')
      .select('gamertag,total_kills,total_wins')
      .order('total_kills', { ascending: false }).limit(10);
    if (error) throw error;
    if (!data?.length) return response('📊 No players saved yet. The leaderboard will appear after the first import.');
    return response('🏆 **Clan leaderboard — kills**\n' + data.map((p, i) =>
      (i + 1) + '. **' + p.gamertag.replaceAll('*', '\\*') + '** — ' + (p.total_kills || 0) +
      ' kills · ' + (p.total_wins || 0) + ' wins').join('\n'));
  }
  return response('Unknown command.', true);
}
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let raw;
  try { raw = await readBody(req); }
  catch { return res.status(413).json({ error: 'Invalid request body' }); }
  if (!verifySignature(raw, req.headers, process.env.DISCORD_PUBLIC_KEY)) {
    return res.status(401).json({ error: 'Invalid Discord signature' });
  }
  let body;
  try { body = JSON.parse(raw.toString('utf8')); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  if (body.type === 1) return res.status(200).json({ type: 1 });
  if (body.type !== 2) return res.status(200).json(response('Unsupported interaction.', true));
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) throw new Error('Missing database configuration');
    return res.status(200).json(await handleCommand(body));
  } catch (error) {
    console.error('Discord interaction failed:', error.message);
    return res.status(200).json(response('The stats service is temporarily unavailable. Please try again.', true));
  }
};

module.exports.config = { api: { bodyParser: false } };
