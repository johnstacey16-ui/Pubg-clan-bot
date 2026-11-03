'use strict';
(function () {
  var data = null;
  var current = 'overview';
  var compareA = null;
  var compareB = null;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (v) { return Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-GB') : '—'; };
  var dec = function (v) { return v === null || v === undefined ? '—' : Number(v).toFixed(2); };
  var escapeHtml = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  }); };
  var modeName = function (s) { return String(s).replace('-fpp',' FPP').toUpperCase(); };
  var dateText = function (s) { return s ? new Date(s).toLocaleString('en-GB', {dateStyle:'medium',timeStyle:'short'}) : 'Not available'; };
  var findPlayer = function (name) { return data && data.players.find(function (p) { return p.name === name; }); };
  function go(page) {
    if (['overview','leaderboard','players','modes','compare','roadmap'].indexOf(page) === -1) return;
    current = page;
    document.querySelectorAll('.page').forEach(function (el) { el.hidden = el.id !== 'page-' + page; });
    document.querySelectorAll('[data-page]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.page === page);
      if (el.dataset.page === page) el.setAttribute('aria-current','page');
      else el.removeAttribute('aria-current');
    });
    $('crumb').textContent = {overview:'Overview',leaderboard:'Leaderboards',players:'Player roster',modes:'Game modes',compare:'Compare',roadmap:'Roadmap'}[page];
    try { history.replaceState(null, '', page === 'overview' ? '/' : '/#' + page); } catch (e) {}
    window.scrollTo(0,0);
  }
  function chart(target, totals, modes) {
    var max = Math.max.apply(null, [1].concat(modes.map(function (m) { return totals[m] ? totals[m].kills : 0; })));
    $(target).innerHTML = modes.map(function (m) {
      var v = totals[m] ? totals[m].kills : 0;
      var h = Math.max(2, Math.round(v / max * 135));
      return '<div class="bar-wrap" title="' + escapeHtml(modeName(m)) + ' · ' + fmt(v) + ' kills">' +
        '<span class="bar-value">' + fmt(v) + '</span>' +
        '<span class="bar-actual" style="height:' + h + 'px"></span>' +
        '<span class="bar-label">' + escapeHtml(modeName(m)) + '</span></div>';
    }).join('');
  }
  function playerLink(p) {
    return '<button class="player-button" type="button" data-profile="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</button>';
  }
  function renderOverview() {
    $('kills').textContent = fmt(data.totals.kills);
    $('wins').textContent = fmt(data.totals.wins);
    $('matches').textContent = fmt(data.totals.matches);
    $('verified').textContent = data.roster.verified + ' / ' + data.roster.total;
    var pct = data.roster.total ? Math.round(100 * data.roster.verified / data.roster.total) : 0;
    $('verified-caption').textContent = pct + '% of the official roster';
    $('snapshot').textContent = 'Latest saved player update · ' + dateText(data.lastSync);
    $('roster-percent').textContent = pct + '%';
    $('roster-fraction').textContent = data.roster.verified + ' / ' + data.roster.total + ' players';
    $('roster-progress').style.width = pct + '%';
    $('roster-status').textContent = (data.roster.states.pending || 0) + ' pending · ' +
      (data.roster.states.ambiguous || 0) + ' ambiguous · ' + (data.roster.states.not_found || 0) + ' not found';
    $('xbox-count').textContent = fmt(data.platforms.xbox);
    $('ps-count').textContent = fmt(data.platforms.psn);
    chart('overview-chart', data.modeTotals, data.modeOrder);
    $('top-five').innerHTML = data.players.slice(0,5).map(function (p,i) {
      return '<div class="leader-row"><span class="rank">' + String(i+1).padStart(2,'0') + '</span>' +
        '<div class="leader-player"><strong>' + playerLink(p) + '</strong><small>' +
        (p.platform === 'xbox' ? 'Xbox' : 'PlayStation') + ' · ' + fmt(p.wins) + ' wins</small></div>' +
        '<div class="leader-kills">' + fmt(p.kills) + '<small>KILLS</small></div></div>';
    }).join('') || '<p class="empty">No verified clan players yet.</p>';
  }
  function renderLeaderboard() {
    if (!data) return;
    var platform = $('leader-console').value;
    var key = $('sort').value;
    var players = data.players.filter(function (p) { return platform === 'all' || platform === p.platform; });
    players.sort(function (a,b) { return Number(b[key] == null ? -1 : b[key]) - Number(a[key] == null ? -1 : a[key]) || b.kills - a.kills; });
    $('ranking-table').innerHTML = players.map(function (p,i) {
      return '<tr><td><strong>' + String(i+1).padStart(2,'0') + '</strong></td><td>' + playerLink(p) +
        ' <span class="badge">' + (p.platform==='xbox'?'Xbox':'PS') + '</span></td>' +
        '<td><strong>' + fmt(p.kills) + '</strong></td><td>' + fmt(p.wins) + '</td><td>' + fmt(p.matches) +
        '</td><td>' + dec(p.kd) + '</td><td>' + (p.winRate==null?'—':dec(p.winRate)+'%') + '</td></tr>';
    }).join('') || '<tr><td class="empty" colspan="7">No players for this filter.</td></tr>';
  }
  function renderRoster() {
    if (!data) return;
    var q = $('search').value.trim().toLowerCase(), platform = $('player-console').value, status = $('player-status').value;
    var byName = new Map(data.players.map(function (p) { return [p.name.toLowerCase(),p]; }));
    var roster = data.roster.entries.filter(function (p) {
      return (!q || p.name.toLowerCase().includes(q)) &&
        (platform === 'all' || (platform === 'unknown' ? !p.platform : p.platform === platform)) &&
        (status === 'all' || (status === 'verified' ? p.verified : p.status === status));
    });
    $('roster-count').textContent = 'Showing ' + roster.length + ' of ' + data.roster.total + ' official clan members';
    $('roster-table').innerHTML = roster.map(function (r) {
      var p = byName.get(r.name.toLowerCase()), st = r.verified ? 'verified' : r.status;
      var label = {verified:'✓ Verified',pending:'⏳ Pending',ambiguous:'? Ambiguous',not_found:'! Not found'}[st] || st;
      return '<tr><td>' + (p ? playerLink(p) : '<strong>'+escapeHtml(r.name)+'</strong>') +
        '</td><td>' + (r.platform === 'xbox' ? 'Xbox' : r.platform === 'psn' ? 'PlayStation' : '—') +
        '</td><td><span class="badge ' + escapeHtml(st) + '">' + escapeHtml(label) + '</span></td>' +
        '<td>' + (p?fmt(p.kills):'—') + '</td><td>' + (p?fmt(p.wins):'—') + '</td><td>' + (p?fmt(p.matches):'—') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="empty">No players match the chosen filters.</td></tr>';
  }
  function renderModes() {
    if (!data) return;
    chart('modes-chart', data.modeTotals, data.modeOrder);
    $('modes-table').innerHTML = data.modeOrder.map(function (m) {
      var s = data.modeTotals[m], rate = s.matches ? (s.kills/s.matches).toFixed(2) : '—';
      return '<tr><td><strong>' + escapeHtml(modeName(m)) + '</strong></td><td>' + fmt(s.matches) +
        '</td><td><strong>' + fmt(s.kills) + '</strong></td><td>' + fmt(s.wins) +
        '</td><td>' + rate + '</td><td>' + fmt(s.damage) + '</td><td>' + fmt(s.assists) + '</td></tr>';
    }).join('');
  }
  function renderCompare() {
    if (!data) return;
    var names = data.players.map(function (p) { return p.name; });
    if (!names.length) { $('compare-output').textContent = 'No verified clan players yet.'; return; }
    if (!names.includes(compareA)) compareA=names[0];
    if (!names.includes(compareB)) compareB=names[Math.min(1,names.length-1)];
    [['compare-one',compareA],['compare-two',compareB]].forEach(function (pair) {
      $(pair[0]).innerHTML = names.map(function (name) {
        return '<option value="' + escapeHtml(name) + '"' + (name===pair[1]?' selected':'') + '>' + escapeHtml(name) + '</option>';
      }).join('');
    });
    var a=findPlayer(compareA), b=findPlayer(compareB);
    var rows=[['Lifetime kills','kills'],['Wins','wins'],['Matches','matches'],['Kills per match','kd'],['Win rate','winRate']];
    $('compare-output').innerHTML =
      '<div class="compare-grid"><strong>' + escapeHtml(a.name) + '</strong><span>VS</span><strong>' + escapeHtml(b.name) + '</strong></div>' +
      rows.map(function (row) {
        var aa=Number(a[row[1]] || 0),bb=Number(b[row[1]] || 0),decimal=row[1]==='kd'||row[1]==='winRate';
        return '<div class="compare-grid"><strong class="' + (aa>bb?'winner':'') + '">' + (decimal?dec(a[row[1]]):fmt(a[row[1]])) +
          '</strong><span>' + escapeHtml(row[0]) + '</span><strong class="' + (bb>aa?'winner':'') + '">' +
          (decimal?dec(b[row[1]]):fmt(b[row[1]])) + '</strong></div>';
      }).join('') +
      '<p class="small muted">Values are from actual stored PUBG stats. Kills per match uses kills ÷ player matches.</p>';
  }
  function openProfile(name) {
    var p=findPlayer(name);if(!p)return;
    $('profile-name').textContent=p.name;
    $('profile-console').textContent=p.platform==='xbox'?'Xbox':'PlayStation';
    $('profile-body').innerHTML = '<div class="profile-stats">' +
      [['KILLS',p.kills],['WINS',p.wins],['MATCHES',p.matches]].map(function (r) {
        return '<div class="profile-stat"><small>'+r[0]+'</small><strong>'+fmt(r[1])+'</strong></div>';
      }).join('') + '</div><p><span class="badge verified">' + dec(p.kd) + ' kills/match</span> <span class="badge">' +
      dec(p.winRate) + '% win rate</span></p><h3>Lifetime game mode details</h3>' +
      (data.modeOrder.map(function (m) {
        var s=p.modes[m];
        if(!s||!s.roundsPlayed)return'';
        return '<div class="profile-mode"><strong>'+escapeHtml(modeName(m))+'</strong><span>'+fmt(s.roundsPlayed)+
          ' matches · '+fmt(s.kills)+' kills · '+fmt(s.wins)+' wins</span></div>';
      }).join('') || '<p class="muted">No mode details saved yet.</p>') +
      '<p class="small muted">Last saved player update: '+escapeHtml(dateText(p.updatedAt))+'. Upstream PUBG refresh is managed through the Discord dashboard.</p>';
    if(typeof $('profile').showModal==='function')$('profile').showModal();
    else $('profile').setAttribute('open','');
  }
  async function reload() {
    $('reload').disabled=true;
    $('notice').hidden=false;
    $('notice').textContent='Loading real saved PUBG statistics from Supabase…';
    try {
      var r=await fetch('/api/public-stats',{cache:'no-store',headers:{Accept:'application/json'}});
      if(!r.ok)throw Error('Data API returned HTTP '+r.status);
      var result=await r.json();
      if(!result || result.schemaVersion!==1 || !Array.isArray(result.players))throw Error('Unsupported response');
      data=result;
      renderOverview();renderLeaderboard();renderRoster();renderModes();renderCompare();
      $('notice').hidden=true;
    } catch(error) {
      $('notice').textContent='Could not load saved statistics: '+error.message+'. The existing Discord bot is unaffected.';
    } finally { $('reload').disabled=false; }
  }
  document.querySelectorAll('[data-page]').forEach(function (b) { b.addEventListener('click',function () {go(b.dataset.page);}); });
  document.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click',function () {go(b.dataset.go);}); });
  document.addEventListener('click',function (e) {var b=e.target.closest&&e.target.closest('[data-profile]');if(b)openProfile(b.dataset.profile);});
  $('profile-close').addEventListener('click',function () { $('profile').close(); });
  $('profile').addEventListener('click',function(e) {if(e.target===$('profile'))$('profile').close();});
  ['sort','leader-console'].forEach(function (id) {$(id).addEventListener('change',renderLeaderboard);});
  ['player-console','player-status'].forEach(function (id) {$(id).addEventListener('change',renderRoster);});
  $('search').addEventListener('input',renderRoster);
  $('compare-one').addEventListener('change',function(e){compareA=e.target.value;renderCompare();});
  $('compare-two').addEventListener('change',function(e){compareB=e.target.value;renderCompare();});
  $('reload').addEventListener('click',reload);
  var hash=location.hash.slice(1);
  go(['overview','leaderboard','players','modes','compare','roadmap'].includes(hash)?hash:'overview');
  reload();
})();