'use strict';
(function () {
  var data = null;
  var current = 'overview';
  var compareA = null;
  var compareB = null;
  var matchName = null;
  var matchRequest = 0;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (v) { return Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-GB') : '—'; };
  var dec = function (v) { return v === null || v === undefined ? '—' : Number(v).toFixed(2); };
  var escapeHtml = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  }); };
  var modeName = function (s) { return String(s).replace('-fpp',' FPP').toUpperCase(); };
  var dateText = function (s) { return s ? new Date(s).toLocaleString('en-GB', {dateStyle:'medium',timeStyle:'short'}) : 'Not available'; };
  var findPlayer = function (name) { return data && data.players.find(function (p) { return p.name === name; }); };
  function go(page, preserveHash) {
    if (['overview','leaderboard','players','modes','matches','compare','roadmap'].indexOf(page) === -1) return;
    current = page;
    document.querySelectorAll('.page').forEach(function (el) { el.hidden = el.id !== 'page-' + page; });
    document.querySelectorAll('[data-page]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.page === page);
      if (el.dataset.page === page) el.setAttribute('aria-current','page');
      else el.removeAttribute('aria-current');
    });
    $('crumb').textContent = {overview:'Overview',leaderboard:'Leaderboards',players:'Player roster',modes:'Game modes',compare:'Compare',matches:'Match intelligence',roadmap:'Roadmap'}[page];
    try { if(!preserveHash) history.replaceState(null, '', page === 'overview' ? '/' : '/#' + page); } catch (e) {}
    window.scrollTo(0,0);
    if(page==='matches' && data)loadCachedMatches();
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

  function chooseMatchPlayer(preferred) {
    if(!data)return;
    var names=data.players.map(function(p){return p.name;});
    if(preferred && names.indexOf(preferred)!==-1)matchName=preferred;
    if(names.indexOf(matchName)===-1)matchName=names[0]||null;
    $('match-player').innerHTML=names.map(function(name){
      return '<option value="'+escapeHtml(name)+'"'+(name===matchName?' selected':'')+'>'+escapeHtml(name)+'</option>';
    }).join('');
    $('match-player').disabled=!matchName;
    $('match-reload').disabled=!matchName;
    if(current==='matches')loadCachedMatches();
  }
  async function loadCachedMatches() {
    if(!matchName)return;
    var request=++matchRequest,name=matchName;
    $('match-note').textContent='Reading saved console match data for '+name+'…';
    $('match-results').innerHTML='';
    try{
      var response=await fetch('/api/public-matches?name='+encodeURIComponent(name),{
        cache:'no-store',headers:{Accept:'application/json'}
      });
      if(!response.ok)throw Error('Match API HTTP '+response.status);
      var result=await response.json();
      if(request!==matchRequest || matchName!==name)return;
      $('match-note').textContent=(result.note||'Saved PUBG matches only')+
        ' · '+result.availableCount+' detailed match(es) stored';
      if(!result.matches?.length){
        $('match-results').innerHTML='<p class="match-empty">No detailed match records are stored yet for this player. '+
          'Use the Discord <strong>/recent</strong> command with their gamertag to populate the shared cache, then reload here.</p>';
        return;
      }
      $('match-results').innerHTML=result.matches.map(function(m){
        var team=Array.isArray(m.squad)?m.squad:[];
        return '<article class="match-card">'+
          '<header class="match-heading"><div><span class="match-map">'+escapeHtml(m.map)+'</span>'+
          '<span class="badge">'+escapeHtml(m.mode)+'</span></div>'+
          '<span class="small muted">'+escapeHtml(dateText(m.playedAt))+'</span></header>'+
          '<div class="match-metrics">'+
          '<div><small>PLACEMENT</small><strong>'+(m.placement?'#'+fmt(m.placement):'—')+'</strong></div>'+
          '<div><small>KILLS</small><strong>'+fmt(m.kills)+'</strong></div>'+
          '<div><small>DAMAGE</small><strong>'+fmt(m.damage)+'</strong></div>'+
          '<div><small>ASSISTS</small><strong>'+fmt(m.assists)+'</strong></div>'+
          '</div>'+
          '<div class="match-secondary">Headshots '+fmt(m.headshots)+' · Knocks '+fmt(m.knocks)+
          ' · Revives '+fmt(m.revives)+' · Heals '+fmt(m.heals)+
          ' · Boosts '+fmt(m.boosts)+' · Longest kill '+fmt(m.longestKillMeters)+'m</div>'+
          '<details class="match-squad"><summary>Squad details · '+team.length+' player(s)</summary>'+
          (team.length?team.map(function(member){
            return '<div class="match-teammate"><strong>'+(member.isSelf?'★ ':'')+
              escapeHtml(member.name)+'</strong><span>'+fmt(member.kills)+' kills · '+
              fmt(member.damage)+' damage · '+fmt(member.assists)+' assists</span></div>';
          }).join(''):'<p class="small muted">No roster details were saved for this match.</p>')+
          '</details></article>';
      }).join('');
    }catch(error){
      if(request!==matchRequest)return;
      $('match-note').textContent='Saved match data is temporarily unavailable.';
      $('match-results').innerHTML='<p class="match-empty">The website could not read saved match records. Try Reload saved matches.</p>';
    }
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

  var profileRequest = 0;
  function makeHistoryChart(points, metric) {
    var w=620,h=205,left=44,right=14,top=16,bottom=31;
    var values=points.map(function(p){return Math.max(0,Number(p[metric])||0);});
    var lo=Math.min.apply(null,values),hi=Math.max.apply(null,values);
    var span=Math.max(1,hi-lo),usableW=w-left-right,usableH=h-top-bottom;
    var mapped=values.map(function(n,i){
      return {x:left+(points.length===1?usableW/2:i*usableW/(points.length-1)),
        y:top+(hi-n)*usableH/span};
    });
    var route=mapped.map(function(p){return p.x.toFixed(1)+','+p.y.toFixed(1);}).join(' ');
    var circles=mapped.filter(function(p,i){return i===0||i===mapped.length-1||mapped.length<=12;})
      .map(function(p){return '<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="3.7" fill="#39e4c3"/>';}).join('');
    return '<svg viewBox="0 0 620 205" role="img" aria-label="Verified lifetime '+escapeHtml(metric)+' history chart">'+
      '<line x1="'+left+'" y1="'+(h-bottom)+'" x2="'+(w-right)+'" y2="'+(h-bottom)+'" stroke="#43556d" stroke-width="1"/>'+
      '<line x1="'+left+'" y1="'+top+'" x2="'+left+'" y2="'+(h-bottom)+'" stroke="#43556d" stroke-width="1"/>'+
      '<text x="5" y="'+(top+5)+'" fill="#a1b5d1" font-size="12">'+fmt(hi)+'</text>'+
      '<text x="5" y="'+(h-bottom)+'" fill="#a1b5d1" font-size="12">'+fmt(lo)+'</text>'+
      '<polyline fill="none" stroke="#39e4c3" stroke-linejoin="round" stroke-linecap="round" stroke-width="3" points="'+route+'"/>'+
      circles+'</svg>';
  }
  async function loadProfileHistory(name) {
    var id=++profileRequest,element=$('profile-history');
    if(!element)return;
    element.textContent='Loading actual saved PUBG snapshots…';
    try {
      var response=await fetch('/api/player-history?name='+encodeURIComponent(name),{headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('History API returned HTTP '+response.status);
      var result=await response.json();
      if(id!==profileRequest || $('profile-name').textContent!==name)return;
      var points=Array.isArray(result.points)?result.points:[];
      if(points.length<2) {
        element.innerHTML='<p class="history-empty">📈 Only the first verified snapshot is saved so far. The chart will grow as the bot refreshes this player from PUBG.</p>'+
          (points[0]?'<p class="small muted">Baseline saved: '+escapeHtml(dateText(points[0].date))+'</p>':'');
        $('history-metric').disabled=true;
        return;
      }
      $('history-metric').disabled=false;
      function paint() {
        var key=$('history-metric').value,first=Number(points[0][key])||0,last=Number(points[points.length-1][key])||0;
        element.innerHTML='<div class="history-meta"><strong>'+fmt(last-first)+' '+escapeHtml(key)+' change</strong><span>'+
          points.length+' verified daily points · '+escapeHtml(dateText(points[0].date))+' to '+escapeHtml(dateText(points[points.length-1].date))+'</span></div>'+
          '<div class="history-chart">'+makeHistoryChart(points,key)+'</div>'+
          '<p class="small muted">Recorded lifetime totals, not per-match performance. A point is added only after a PUBG update.</p>';
      }
      $('history-metric').addEventListener('change',paint);
      paint();
    } catch(error) {
      if(id===profileRequest && element) element.textContent='Saved history is temporarily unavailable. Lifetime statistics above are unaffected.';
    }
  }

  function openProfile(name, fromLink) {
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
      '<p><button class="secondary" type="button" data-match-player="'+escapeHtml(p.name)+'">⚑ View saved match analysis</button></p>'+
      '<p class="small muted">Last saved player update: '+escapeHtml(dateText(p.updatedAt))+'. Upstream PUBG refresh is managed through the Discord dashboard.</p>'+
      '<div class="profile-history"><div class="profile-history-header"><h3>📈 Actual lifetime progress</h3><label>Metric <select id="history-metric">'+
      '<option value="kills">Kills</option><option value="wins">Wins</option><option value="matches">Matches</option></select></label></div>'+
      '<div id="profile-history" aria-live="polite">Loading history…</div></div>';
    if(!fromLink) history.pushState(null,'','/#player/'+encodeURIComponent(p.name));
    if(typeof $('profile').showModal==='function') {
      if(!$('profile').open)$('profile').showModal();
    } else $('profile').setAttribute('open','');
    loadProfileHistory(p.name);
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
      renderOverview();renderLeaderboard();renderRoster();renderModes();renderCompare();chooseMatchPlayer(matchName);
      $('notice').hidden=true;
    } catch(error) {
      $('notice').textContent='Could not load saved statistics: '+error.message+'. The existing Discord bot is unaffected.';
    } finally { $('reload').disabled=false; }
  }
  document.querySelectorAll('[data-page]').forEach(function (b) { b.addEventListener('click',function () {go(b.dataset.page);}); });
  document.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click',function () {go(b.dataset.go);}); });
  document.addEventListener('click',function (e) {
    var b=e.target.closest&&e.target.closest('[data-profile]');
    if(b)openProfile(b.dataset.profile);
    var match=e.target.closest&&e.target.closest('[data-match-player]');
    if(match) {
      chooseMatchPlayer(match.dataset.matchPlayer);
      if($('profile').open)$('profile').close();
      go('matches');
    }
  });
  $('profile-close').addEventListener('click',function () { $('profile').close(); });
  $('profile').addEventListener('close',function(){
    profileRequest++;
    if(location.hash.startsWith('#player/')) history.replaceState(null,'',current==='overview'?'/':'/#'+current);
  });
  $('share-profile').addEventListener('click',async function(){
    var name=$('profile-name').textContent;
    var url=location.origin+'/#player/'+encodeURIComponent(name);
    try {
      if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      this.textContent='✓ Link copied';
    } catch (error) {
      window.prompt('Copy this player profile link:',url);
    }
  });
  $('profile').addEventListener('click',function(e) {if(e.target===$('profile'))$('profile').close();});
  ['sort','leader-console'].forEach(function (id) {$(id).addEventListener('change',renderLeaderboard);});
  ['player-console','player-status'].forEach(function (id) {$(id).addEventListener('change',renderRoster);});
  $('search').addEventListener('input',renderRoster);
  $('compare-one').addEventListener('change',function(e){compareA=e.target.value;renderCompare();});
  $('compare-two').addEventListener('change',function(e){compareB=e.target.value;renderCompare();});
  $('reload').addEventListener('click',reload);
  $('match-player').addEventListener('change',function(e){matchName=e.target.value;loadCachedMatches();});
  $('match-reload').addEventListener('click',loadCachedMatches);
  var hash=location.hash.slice(1);
  var sharedName=null;
  if(hash.startsWith('player/')){
    try { sharedName=decodeURIComponent(hash.slice(7)); } catch(error) {}
  }
  go(sharedName?'players':(['overview','leaderboard','players','modes','matches','compare','roadmap'].includes(hash)?hash:'overview'),Boolean(sharedName));
  reload().then(function(){
    if(sharedName) {
      if(findPlayer(sharedName))openProfile(sharedName,true);
      else if(data){$('notice').hidden=false;$('notice').textContent='This profile is not part of the verified public clan roster.';}
    }
  });
})();