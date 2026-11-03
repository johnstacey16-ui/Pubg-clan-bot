'use strict';
const { safeDiscord, MODES } = require('./pubg-utils');
const { importPendingBatch } = require('./import-batch');
const { getStats, FRESH_MS } = require('./live-stats');

const GUILD = '1411949587299569788';
const REFRESH_BUTTON = 'pubg:dashboard:refresh:v1';
const COOLDOWN_MS = 90 * 1000;
const SECTIONS = ['overview', 'leaderboard', 'modes', 'roster', 'records'];
const int = n => Number(n) || 0;
const number = n => int(n).toLocaleString('en-GB');
const userName = n => safeDiscord(n);
const isSnowflake = value => /^\d{16,22}$/.test(String(value));

async function checked(query, description) {
  const r = await query;
  if (r.error) throw new Error(description + ': ' + r.error.message);
  return r.data;
}
function canManage(body) {
  try {
    const p = BigInt(body.member?.permissions || '0');
    return Boolean((p & 8n) || (p & 16n));
  } catch { return false; }
}
async function discord(method, route, payload) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('Bot token is not configured in Vercel');
  const result = await fetch('https://discord.com/api/v10' + route, {
    method,
    headers: {
      Authorization: 'Bot ' + token,
      ...(payload ? { 'Content-Type': 'application/json' } : {})
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(10000)
  });
  if (!result.ok) {
    const e = new Error('Discord API HTTP ' + result.status);
    e.status = result.status;
    throw e;
  }
  return result.status === 204 ? null : result.json();
}
async function storedDashboard(db) {
  return checked(db.from('discord_dashboard_channels')
    .select('guild_id,channel_id,messages,last_rendered_at,last_api_check_at,locked_until')
    .eq('guild_id', GUILD).maybeSingle(), 'Read persistent dashboard');
}
async function loadSnapshot(db) {
  const [roster, players, details, records] = await Promise.all([
    db.from('player_import_queue')
      .select('gamertag,is_clan_member,status,platform,pubg_account_id').limit(1000),
    db.from('players')
      .select('id,gamertag,platform,total_kills,total_wins,matches_played,last_checked').limit(1000),
    db.from('player_lifetime_details')
      .select('player_id,game_mode_stats').limit(1000),
    db.from('clan_records')
      .select('record_name,value,holder_gamertag,achieved_date').limit(30)
  ]);
  for (const [name, response] of [['roster',roster],['players',players],['mode stats',details],['records',records]])
    if (response.error) throw new Error('Dashboard '+name+' read failed: '+response.error.message);
  const clan = (roster.data || []).filter(x => x.is_clan_member);
  const verifiedNames = new Set(clan.filter(x => x.status === 'matched')
    .map(x => x.gamertag.toLowerCase()));
  const verified = (players.data || [])
    .filter(p => ['xbox','psn'].includes(p.platform) &&
      verifiedNames.has(p.gamertag.toLowerCase()));
  const ids = new Set(verified.map(x => x.id));
  const totals = verified.reduce((o,p)=>({
    kills:o.kills+int(p.total_kills),
    wins:o.wins+int(p.total_wins),
    matches:o.matches+int(p.matches_played)
  }),{kills:0,wins:0,matches:0});
  const breakdown = Object.fromEntries(MODES.map(m => [m,{rounds:0,kills:0,wins:0,damage:0,assists:0}]));
  for (const row of details.data || []) {
    if (!ids.has(row.player_id)) continue;
    for (const mode of MODES) {
      const m = row.game_mode_stats?.[mode];
      if (!m) continue;
      const total = breakdown[mode];
      total.rounds+=int(m.roundsPlayed);
      total.kills+=int(m.kills);
      total.wins+=int(m.wins);
      total.damage+=int(m.damageDealt);
      total.assists+=int(m.assists);
    }
  }
  const states = clan.reduce((o,row) => {
    o[row.status] = (o[row.status]||0)+1;
    if (row.status === 'pending' && row.pubg_account_id) o.identified++;
    return o;
  },{pending:0,matched:0,ambiguous:0,not_found:0,error:0,identified:0});
  const lastChecked = verified.map(p => Date.parse(p.last_checked||'')).filter(Number.isFinite);
  return {
    clan, verified, tracked:(roster.data||[]).filter(x=>!x.is_clan_member).length,
    states, totals, breakdown, records:records.data||[],
    lastChecked:lastChecked.length?Math.max(...lastChecked):null
  };
}
function embed(title, description, fields=[]) {
  return {
    title, description: description.slice(0,3900), color:0x263c5c,
    fields: fields.slice(0,20).map(f => ({name:f.name.slice(0,250),value:f.value.slice(0,1000),inline:f.inline??false})),
    footer:{text:'Xbox + PlayStation only · Saved Supabase statistics · Updates subject to PUBG API limits'}
  };
}
function renderDashboard(s, now = new Date()) {
  const leader = [...s.verified].sort((a,b)=>int(b.total_kills)-int(a.total_kills));
  const last = s.lastChecked ? new Date(s.lastChecked).toISOString().slice(0,16).replace('T',' ')+' UTC' : 'Not synced';
  const figures = [
    '**'+s.clan.length+'** official roster names · **'+s.verified.length+'** verified · **'+s.tracked+'** tracked outside clan',
    '**'+number(s.totals.kills)+'** kills · **'+number(s.totals.wins)+'** wins · **'+number(s.totals.matches)+'** summed player matches',
    'Xbox: **'+s.verified.filter(p=>p.platform==='xbox').length+
      '** · PlayStation: **'+s.verified.filter(p=>p.platform==='psn').length+'**',
    'Most recent saved PUBG update: '+last,
    '',
    'Use **Refresh dashboards** to check the API, save available updates to Supabase and update these five messages.',
    '_Player totals count each player separately; squad matches may be included for multiple clan members._'
  ].join('\n');
  const leaderboard = leader.slice(0,10).map((p,i)=>
    '**'+(i+1)+'. '+userName(p.gamertag)+'** '+(p.platform==='xbox'?'(Xbox)':'(PS)')+
    ' — '+number(p.total_kills)+' kills · '+number(p.total_wins)+' wins').join('\n') || 'No verified console players yet.';
  const modeRows = MODES.map(m=>{
    const d=s.breakdown[m];
    const rate=d.rounds?(d.kills/d.rounds).toFixed(2):'N/A';
    return '**'+m.toUpperCase()+'** — '+number(d.rounds)+' played · '+
      number(d.kills)+' kills · '+number(d.wins)+' wins · '+rate+' K/game';
  }).join('\n');
  const states=s.states;
  const roster = [
    'Verified: **'+states.matched+'** / '+s.clan.length,
    'Pending names: **'+(states.pending-states.identified)+'** · Identified (stats pending): **'+states.identified+'**',
    'Ambiguous Xbox/PSN names: **'+states.ambiguous+'** · Not found: **'+states.not_found+'**',
    'Additional tracked players: **'+s.tracked+'** (excluded from official clan totals)',
    '',
    'To see each member: \`/roster\` · To search: \`/stats\` · To compare: \`/compare\`'
  ].join('\n');
  const recordRows=(s.records||[]).slice(0,8).map(r=>
    '• **'+userName(r.record_name||'Record')+'** — '+String(r.value??'N/A').slice(0,35)+
    ' · '+userName(r.holder_gamertag||'Unknown')).join('\n');
  const recent=leader.filter(p=>p.last_checked)
    .sort((a,b)=>Date.parse(b.last_checked)-Date.parse(a.last_checked))
    .slice(0,5).map(p=>'• '+userName(p.gamertag)+' — '+new Date(p.last_checked).toISOString().slice(0,16).replace('T',' ')+' UTC')
    .join('\n');
  const components=[{type:1,components:[{
    type:2,style:1,label:'Refresh dashboards',emoji:{name:'🔄'},custom_id:REFRESH_BUTTON
  }]}];
  const items=[
    embed('🎮 Clan dashboard · Overview',figures),
    embed('🏆 Clan dashboard · Lifetime leaderboard',leaderboard+'\n\nUse \`/leaderboard\` for live import progress.'),
    embed('📊 Clan dashboard · Game modes',modeRows+'\n\nAll figures are sums from verified member lifetime-mode data. \`/modes\` shows individual detail.'),
    embed('👥 Clan dashboard · Roster and import progress',roster),
    embed('🎖️ Clan dashboard · Records and recent syncs',
      '**Saved clan records**\n'+(recordRows||'No custom clan records saved yet.')+
      '\n\n**Recent player updates**\n'+(recent||'None recorded')+
      '\n\nOther commands: \`/recent\`, \`/match\`, \`/squad\`, \`/mastery\`, \`/season\`, \`/ranked\`')
  ];
  return Object.fromEntries(SECTIONS.map((name,i)=>[name,{
    embeds:[items[i]],components,allowed_mentions:{parse:[]}
  }]));
}
async function publish(db, state) {
  const snapshot=await loadSnapshot(db);
  const cards=renderDashboard(snapshot);
  const messages={...(state.messages||{})};
  let created=0, edited=0;
  for (const name of SECTIONS) {
    const body=cards[name];
    let result, newlyCreated=false;
    if (messages[name]) {
      try {
        result=await discord('PATCH','/channels/'+state.channel_id+'/messages/'+messages[name],body);
        edited++;
      } catch (e) {
        if (e.status !== 404) throw e;
        delete messages[name];
      }
    }
    if (!messages[name]) {
      result=await discord('POST','/channels/'+state.channel_id+'/messages',body);
      if (!result?.id) throw new Error('Discord did not return a dashboard message ID');
      messages[name]=result.id;
      created++;
      newlyCreated=true;
    }
    await checked(db.from('discord_dashboard_channels').update({
      messages,last_rendered_at:new Date().toISOString()
    }).eq('guild_id',GUILD).select('guild_id'),'Save persistent message IDs');
    if (newlyCreated) {
      try {
        await discord('PUT','/channels/'+state.channel_id+'/messages/pins/'+result.id);
      } catch(e) {
        // Channel still works without PIN_MESSAGES permission.
        console.error('Dashboard pin unavailable:',e.message);
      }
    }
  }
  return {created,edited,players:snapshot.verified.length,roster:snapshot.clan.length};
}
async function setup(db, body) {
  if (!canManage(body)) return 'Only members with Manage Channels or Administrator permission can set up dashboards.';
  if (body.guild_id !== GUILD || !isSnowflake(body.channel_id))
    return 'Run /dashboard setup inside a text channel in your clan server.';
  if (!process.env.DISCORD_BOT_TOKEN) return 'Discord bot token is not configured for channel posting.';
  let state=await storedDashboard(db);
  if (state && state.channel_id !== body.channel_id) return 'A dashboard is already configured in <#'+state.channel_id+
    '>. Run this command there to update it; no extra dashboard was created.';
  if (!state) {
    state=await checked(db.from('discord_dashboard_channels')
      .insert({guild_id:GUILD,channel_id:body.channel_id})
      .select('guild_id,channel_id,messages').single(),'Set up Discord dashboard');
  }
  const result=await publish(db,state);
  return '✅ Dashboard ready in <#'+state.channel_id+'>. '+
    result.created+' message(s) created, '+result.edited+' updated. '+
    result.players+' verified clan players displayed. You can now click **Refresh dashboards** on any dashboard card.';
}
async function refresh(db, body, fromButton=false) {
  const state=await storedDashboard(db);
  if (!state) return 'No dashboard configured. Use /dashboard setup in your chosen Discord channel.';
  if (state.channel_id!==body.channel_id) return 'Dashboard is configured in <#'+state.channel_id+'>.';
  if (fromButton && !Object.values(state.messages||{}).includes(body.message?.id))
    return 'That dashboard message is no longer active. Use the current dashboard posts.';
  if (!fromButton && !canManage(body)) return 'Only channel managers can use this slash command; anyone can use the dashboard Refresh button.';
  const now=Date.now();
  if (state.last_api_check_at && now-Date.parse(state.last_api_check_at)<COOLDOWN_MS)
    return '⏳ The dashboards were checked recently. Wait about 90 seconds before requesting another PUBG update.';
  const lock=await checked(db.from('discord_dashboard_channels').update({
    locked_until:new Date(now+90_000).toISOString(),
    last_api_check_at:new Date(now).toISOString()
  }).eq('guild_id',GUILD).lt('locked_until',new Date(now).toISOString())
    .select('guild_id').maybeSingle(),'Lock dashboard refresh');
  if (!lock) return '⏳ Another dashboard refresh is already running.';
  let summary={imported:0,refreshed:0,importStatus:'not_started'};
  try {
    const pending=await importPendingBatch(db);
    summary.imported=pending.matched||0;
    summary.importStatus=pending.status;
    // Import pending players first, then spend leftover API budget on two stale members.
    const roster=await checked(db.from('player_import_queue')
      .select('gamertag').eq('is_clan_member',true).eq('status','matched').limit(1000),'Find clan members');
    const names=roster.map(row=>row.gamertag);
    if (names.length) {
      const old=await checked(db.from('players')
        .select('gamertag,last_checked').in('gamertag',names)
        .order('last_checked',{ascending:true}).limit(2),'Find stale clan stats');
      for (const p of old||[]) {
        if (p.last_checked && now-Date.parse(p.last_checked)<FRESH_MS) continue;
        try {
          const result=await getStats(db,p.gamertag);
          if (result.source==='live') summary.refreshed++;
        } catch(e) { console.error('Dashboard stale player refresh failed:',e.message); }
      }
    }
    const published=await publish(db,state);
    summary={...summary,...published};
    return '✅ Dashboard updated in <#'+state.channel_id+'>. '+
      'Newly imported: '+summary.imported+' · Stale players refreshed: '+summary.refreshed+
      ' · Verified clan members displayed: '+summary.players+'.'+
      (summary.importStatus==='rate_limited'?' PUBG API budget temporarily exhausted.':'');
  } finally {
    await db.from('discord_dashboard_channels').update({
      locked_until:new Date(0).toISOString(),last_api_result:summary
    }).eq('guild_id',GUILD);
  }
}
async function status(db) {
  const state=await storedDashboard(db);
  if (!state) return 'Dashboard not configured. Run /dashboard setup inside the desired channel.';
  return '📊 Dashboard channel: <#'+state.channel_id+'>\n' +
    'Cards: '+Object.keys(state.messages||{}).length+'/'+SECTIONS.length+
    '\nLast displayed: '+(state.last_rendered_at||'Never')+
    '\nLast API refresh attempted: '+(state.last_api_check_at||'Never')+
    '\nUse the channel Refresh button to update stats without posting new messages.';
}
async function command(db,body) {
  const action=body.data?.options?.[0]?.name;
  if (action==='setup') return setup(db,body);
  if (action==='refresh') return refresh(db,body);
  if (action==='status') return canManage(body)?status(db):'Only channel managers can inspect dashboard configuration.';
  return 'Use /dashboard setup, /dashboard refresh or /dashboard status.';
}
module.exports={GUILD,REFRESH_BUTTON,SECTIONS,canManage,loadSnapshot,renderDashboard,
  squadlessRefresh:refresh,setup,refresh,status,command,storedDashboard};
