'use strict';
const { player, opt, label } = require('./commands-core');
const { playerEndpoint, matchEndpoint } = require('./pubg-endpoints');
const { parseMatch } = require('./commands-extra');

// A fixed trusted website link, never a guessed per-match Bridge deep link.
const BRIDGE_URL = 'https://bridge.pubg.com/';
function bridgeButton(content) {
  return {
    content: String(content).slice(0, 1900),
    components: [{
      type: 1,
      components: [{
        type: 2, style: 5, label: 'Open official PUBG 2D replays',
        url: BRIDGE_URL
      }]
    }]
  };
}
function intro() {
  return [
    '🗺️ **Official PUBG 2D Replays — PUBG Bridge**',
    'Open Bridge and sign in with your KRAFTON ID linked to Xbox or PlayStation.',
    'Choose a match from your history to view its 2D replay.',
    'PUBG can also provide a browser-view link or QR code from its Career match history.',
    '_This opens the official website, not an embedded player or an invented match-specific URL._'
  ].join('\n');
}
async function replay(db, body) {
  const name = String(opt(body, 'gamertag', '')).trim();
  if (!name) return bridgeButton(intro());
  const resolved = await player(db, name);
  if (resolved.message)
    return bridgeButton(intro() + '\n\n' + resolved.message);
  const p = resolved.player;
  const matches = await playerEndpoint(db, p, '', 15 * 60);
  if (!matches.data)
    return bridgeButton(intro() + '\n\n**' + label(p.gamertag) +
      '** — Recent matches unavailable (' + matches.state + ').');
  const id = (matches.data.data?.relationships?.matches?.data || [])
    .map(x => x.id).find(Boolean);
  if (!id)
    return bridgeButton(intro() + '\n\n**' + label(p.gamertag) +
      '** — No recent replay candidates returned by PUBG.');
  const details = await matchEndpoint(db, id);
  const lines = [
    '🗺️ **PUBG 2D Replay — ' + label(p.gamertag) + '**',
    'Platform: ' + (p.platform === 'xbox' ? 'Xbox' : 'PlayStation')
  ];
  if (details.data) {
    const m = parseMatch(details.data, p.pubg_account_id);
    lines.push(
      'Latest match: ' + m.map + ' · ' + m.mode,
      'Placement: ' + (m.s?.winPlace ? '#' + m.s.winPlace : 'not available') +
        ' · Kills: ' + (m.s ? (Number(m.s.kills) || 0) : 'not available')
    );
  } else {
    lines.push('Match details are not currently available (' + details.state + ').');
  }
  lines.push(
    'PUBG match ID: ' + id,
    '',
    'Use the button to open PUBG Bridge, sign in with your linked KRAFTON account,',
    'then choose the match from your own history.',
    '_A PUBG API match ID is not a verified Bridge replay URL; availability depends on the official site._'
  );
  return bridgeButton(lines.join('\n'));
}
module.exports = { BRIDGE_URL, bridgeButton, replay };
