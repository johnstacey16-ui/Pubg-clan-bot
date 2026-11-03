const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Load environment variables from Vercel
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

// Discord interaction verification
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

module.exports = async (req, res) => {
  // Handle Discord PING (required handshake)
  if (req.body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // Handle Slash Commands
  if (req.body.type === 2) {
    const command = req.body.data.name;
    
    // ---------------- /stats COMMAND ----------------
    if (command === 'stats') {
      const gamertag = req.body.data.options[0].value;
      
      // 1. Check Supabase for existing player
      let { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('gamertag', gamertag)
        .single();
      
      // 2. If no player found
      if (!player) {
        return res.status(200).json({
          type: 4,
          data: { content: `🔍 No data found for **${gamertag}**. Use /refresh first or check the gamertag.` }
        });
      }
      
      // 3. Get their match history
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('player_id', player.id)
        .order('match_date', { ascending: false })
        .limit(10);
      
      // 4. Ask Groq to write a nice summary
      const summaryText = `
Player: ${gamertag}
Platform: ${player.platform}
Total Kills: ${player.total_kills}
Total Wins: ${player.total_wins}
Matches Played: ${player.matches_played}
K/D Ratio: ${player.matches_played > 0 ? (player.total_kills / player.matches_played).toFixed(2) : 'N/A'}
Recent Matches: ${matches ? matches.length : 0} loaded

Write this as a friendly, easy-to-read PUBG stats summary for Discord with emojis. Keep it short and clean.
      `;
      
      const aiResponse = await openai.chat.completions.create({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: summaryText }]
      });
      
      return res.status(200).json({
        type: 4,
        data: { content: aiResponse.choices[0].message.content }
      });
    }

    // ---------------- /leaderboard COMMAND ----------------
    if (command === 'leaderboard') {
      const { data: topPlayers } = await supabase
        .from('players')
        .select('gamertag, total_kills, total_wins, matches_played')
        .order('total_kills', { ascending: false })
        .limit(10);
      
      if (!topPlayers || topPlayers.length === 0) {
        return res.status(200).json({
          type: 4,
          data: { content: '📊 No player data yet. Add some players first!' }
        });
      }
      
      let leaderboardText = '🏆 **CLAN LEADERBOARD — Top Kills** 🏆\n\n';
      topPlayers.forEach((p, i) => {
        leaderboardText += `${i + 1}. **${p.gamertag}** — Kills: ${p.total_kills} • Wins: ${p.total_wins}\n`;
      });
      
      return res.status(200).json({
        type: 4,
        data: { content: leaderboardText }
      });
    }

    // Unknown command fallback
    return res.status(200).json({
      type: 4,
      data: { content: "✅ Bot is working! Command received." }
    });
  }
  
  res.status(200).json({ status: 'ok' });
};
