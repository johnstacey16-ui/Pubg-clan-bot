'use strict';
const { importPendingBatch } = require('./import-batch');
const { getStats, FRESH_MS } = require('./live-stats');
const { checked, loadSnapshot } = require('./channel-dashboard-data');
const { REFRESH_BUTTON, SECTIONS, renderDashboard } = require('./channel-dashboard-render');

const GUILD = '1411949587299569788';
const COOLDOWN_MS = 90 * 1000;
const isSnowflake = value => /^\d{16,22}$/.test(String(value));

function canManage(body) {
  try {
    const p = BigInt(body.member?.permissions || '0');
    return Boolean((p & 8n) || (p & 16n));
  } catch { return false; }
}
async function discord(method, route, payload) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('Bot token is not configured in Vercel');
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await fetch('https://discord.com/api/v10' + route, {
      method,
      headers: {
        Authorization: 'Bot ' + token,
        ...(payload ? { 'Content-Type': 'application/json' } : {})
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(10000)
    });
    if (result.status === 429 && attempt < 2) {
      const body = await result.json().catch(() => ({}));
      const retrySeconds = Number(body.retry_after) ||
        Number(result.headers?.get('retry-after')) || 1;
      await new Promise(resolve => setTimeout(resolve,
        Math.min(5000, Math.max(300, retrySeconds * 1000))));
      continue;
    }
    if (!result.ok) {
      const e = new Error('Discord API HTTP ' + result.status);
      e.status = result.status;
      throw e;
    }
    return result.status === 204 ? null : result.json();
  }
  throw new Error('Discord API rate limit exceeded');
}
async function storedDashboard(db) {
  return checked(db.from('discord_dashboard_channels')
    .select('guild_id,channel_id,messages,last_rendered_at,last_api_check_at,locked_until')
    .eq('guild_id', GUILD).maybeSingle(), 'Read persistent dashboard');
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
    if (newlyCreated && (name==='overview' || name==='leaderboard')) {
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
// Vercel Hobby runs this once daily through the existing authenticated sync
// cron. It edits the permanent dashboard cards, never flooding the channel
// with a new leaderboard message each day.
async function dailyUpdate(db) {
  const state = await storedDashboard(db);
  if (!state) return { status: 'not_configured' };
  const now = Date.now();
  const lock = await checked(db.from('discord_dashboard_channels').update({
    locked_until: new Date(now + 120_000).toISOString()
  }).eq('guild_id', GUILD)
    .lt('locked_until', new Date(now).toISOString())
    .select('guild_id').maybeSingle(), 'Claim scheduled dashboard update');
  if (!lock) return { status: 'busy' };
  try {
    const output = await publish(db, state);
    return { status: 'updated', ...output };
  } finally {
    await checked(db.from('discord_dashboard_channels').update({
      locked_until: new Date(0).toISOString(),
      last_api_check_at: new Date().toISOString()
    }).eq('guild_id', GUILD).select('guild_id'), 'Release scheduled dashboard lock');
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
  setup,refresh,status,command,storedDashboard,dailyUpdate};
