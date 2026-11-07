'use strict';
// Browser-only presentation of saved official data and isolated external CSV
// previews. Never posts imported rows to a database or third-party server.
(function(){
  var E=window.ClanAnalytics;
  if(!E)return;
  var state={data:null,progress:null,progressBusy:false,progressDone:false,
    progressDays:3,progressRequest:0,progressLoadingDays:null,
    progressError:false,progressCache:new Map(),
    before:null,after:null,sourceNames:{before:null,after:null}};
  var $=id=>document.getElementById(id);
  var html=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  var fmt=v=>v===null||v===undefined?'—':Number(v).toLocaleString('en-GB',{maximumFractionDigits:2});
  var dec=(v,d=2)=>v===null||v===undefined?'—':Number(v).toFixed(d);
  var date=s=>s&&Number.isFinite(Date.parse(s))?
    new Date(s).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'Not observed';
  var cohort=()=>state.data?.players||[];
  function minimum(){return Number($('cc-min-matches').value)||30;}
  function weight(){
    var amount=Number($('cc-team-weight').value)||100;
    return{assistPerMatch:0.11*amount/100,
      revivePerMatch:0.09*amount/100};
  }
  function renderAwards(){
    if(!state.data)return;
    var awards=E.awards(cohort(),minimum());
    $('cc-awards-note').textContent='Official clan only · minimum '+minimum()+
      ' lifetime matches · results use actual saved PUBG statistics';
    $('cc-awards-grid').innerHTML=awards.map((award,i)=>{
      var p=award.winner;
      return '<article class="cc-award"><span class="cc-award-icon">'+
        ['🎯','⚡','🤝','💊','🏆','🛡️'][i]+'</span>'+
        '<h3>'+html(award.title)+'</h3><p class="small muted">'+html(award.metricLabel)+'</p>'+
        (p?'<strong>'+html(p.name)+'</strong><p>'+dec(p.value,3)+
          (['winRate','top10Rate'].includes(award.metric)?' ratio':' per match')+
          ' · '+fmt(p.matches)+' matches</p>':
          '<p class="muted">No eligible real data yet</p>')+
        '<small>'+award.eligiblePlayers+' eligible profiles</small></article>';
    }).join('');
  }
  function renderScores(){
    if(!state.data)return;
    var ranked=E.score(cohort(),{minMatches:minimum(),weights:weight()});
    var valid=ranked.filter(p=>p.rating!==null);
    $('cc-score-note').textContent=valid.length+
      ' rated players · estimated 0–100 relative clan percentiles, not an official PUBG rating. '+
      'At least five eligible players and four real metrics are required.';
    $('cc-scores').innerHTML=ranked.map((p,i)=>{
      var rating=p.rating===null?'—':p.rating;
      return '<tr><td>'+(i+1)+'</td><td>'+html(p.name)+'</td><td>'+html(p.role)+
        '</td><td><strong>'+rating+'</strong></td><td>'+html(p.sampleBand)+
        '</td><td>'+p.observedMetrics+'/6</td></tr>';
    }).join('')||'<tr><td colspan="6">No verified players yet</td></tr>';
    var issues=E.quality(cohort());
    $('cc-quality-note').textContent=issues.length+' saved-data checks identified · these are review flags, not misconduct findings.';
    $('cc-quality').innerHTML=issues.slice(0,60).map(x=>
      '<tr><td>'+html(x.name)+'</td><td>'+html(x.issue)+'</td></tr>'
    ).join('')||'<tr><td colspan="2">No quality checks flagged</td></tr>';
    $('cc-data-integrity').textContent='Checked '+cohort().length+
      ' verified clan profiles. External files and unverified bot percentages are excluded.';
  }
  function setWindowLabel(){
    for(const id of ['cc-progress-window','cc-momentum-window']){
      var select=$(id);if(select)select.value=String(state.progressDays);
    }
  }
  function renderMomentum(){
    var target=$('cc-momentum-grid'),note=$('cc-momentum-note');
    if(!target||!note)return;
    setWindowLabel();
    if(state.progressBusy){
      note.textContent='Reading genuine '+state.progressDays+'-day snapshot comparisons…';
      target.innerHTML='';return;
    }
    if(!state.progressDone||state.progress?.windowDays!==state.progressDays){
      note.textContent=state.progressError?'Observed snapshot records temporarily unavailable.':
        'No genuine observed data loaded for this window.';
      target.innerHTML='';return;
    }
    var rows=E.progress(state.progress.rows);
    var awards=E.progressAwards(rows,3);
    var compared=rows.filter(r=>r.previousAt!==null).length;
    var eligible=awards[0]?.eligiblePlayers||0;
    note.textContent=compared+' verified players have actual snapshot pairs '+
      state.progress.minDays+'–'+state.progress.maxDays+' days apart · '+
      eligible+' have 3+ newly recorded games with valid nondecreasing counters. '+
      'Unofficial window-only momentum, not career consistency.';
    target.innerHTML=awards.map(item=>{
      var p=item.winner;
      var value=p?(item.key==='deltaKpr'?dec(p.deltaKpr,2):fmt(p[item.key])):'—';
      return '<article class="cc-award">'+
        '<h3>'+html(item.title)+'</h3>'+
        '<p class="small muted">'+html(item.unit)+'</p>'+
        (p?'<strong>'+html(p.name)+'</strong><p>'+value+
          ' · '+fmt(p.deltaMatches)+' added games</p>'+
          '<small>Observed '+html(date(p.previousAt))+' → '+
          html(date(p.latestAt))+'</small>':
          '<p class="muted">No eligible real result for this window</p>')+
        '<small>'+item.eligiblePlayers+' eligible players (min 3 new games)</small>'+
        '</article>';
    }).join('');
  }
  function renderProgress(){
    var target=$('cc-progress'),note=$('cc-progress-note');
    if(!target||!note)return;
    setWindowLabel();
    if(state.progressBusy){
      note.textContent='Reading genuine '+state.progressDays+'-day saved observations…';
      target.innerHTML='';return;
    }
    if(!state.progressDone||state.progress?.windowDays!==state.progressDays){
      note.textContent=state.progressError?'Observed snapshot records temporarily unavailable.':
        'History not loaded yet.';
      target.innerHTML='';return;
    }
    var rows=E.progress(state.progress.rows||[]);
    var observed=rows.filter(r=>r.state==='observed');
    var reset=rows.filter(r=>r.state==='counter_changed');
    var awaiting=rows.filter(r=>r.state==='baseline_only');
    note.textContent=observed.length+' players added genuine games with valid comparison pairs '+
      state.progress.minDays+'–'+state.progress.maxDays+' days apart · '+
      awaiting.length+' awaiting earlier snapshots · '+reset.length+
      ' counter changes need review. These are cumulative counter differences, not invented individual match stats.';
    target.innerHTML=rows.map(p=>
      '<tr><td>'+html(p.name)+'</td><td>'+
      (p.state==='observed'?fmt(p.deltaKills):'—')+'</td><td>'+
      (p.state==='observed'?fmt(p.deltaWins):'—')+'</td><td>'+
      (p.state==='observed'?fmt(p.deltaMatches):'—')+'</td><td>'+
      (p.deltaKpr===null?'—':dec(p.deltaKpr,2))+'</td><td>'+
      html(p.state.replaceAll('_',' '))+'</td><td>'+
      html(date(p.previousAt))+' → '+html(date(p.latestAt))+'</td></tr>'
    ).join('')||'<tr><td colspan="7">No saved lifetime observations yet</td></tr>';
  }
  async function getProgress(force){
    var days=state.progressDays;
    if(state.progressBusy&&state.progressLoadingDays===days&&!force)return;
    if(state.progressDone&&!force&&state.progress?.windowDays===days)return;
    var cached=state.progressCache.get(days);
    if(!force&&cached&&Date.now()-cached.cachedAt<90000){
      state.progress=cached.data;state.progressBusy=false;state.progressDone=true;
      renderProgress();renderMomentum();return;
    }
    var token=++state.progressRequest;
    state.progressLoadingDays=days;state.progressError=false;
    state.progressBusy=true;state.progressDone=false;
    state.progress=null;renderProgress();renderMomentum();
    try{
      var response=await fetch('/api/public-progress?days='+days,
        {cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('Observed progress HTTP '+response.status);
      var result=await response.json();
      if(result.schemaVersion!==1||result.kind!=='observed-progress'||
        result.windowDays!==days||!Array.isArray(result.rows))
        throw Error('Unexpected observed progress history');
      if(token!==state.progressRequest)return;
      state.progress=result;state.progressDone=true;state.progressError=false;
      state.progressCache.set(days,{data:result,cachedAt:Date.now()});
    }catch(error){
      if(token!==state.progressRequest)return;
      state.progressDone=false;state.progress=null;state.progressError=true;
    }finally{
      if(token===state.progressRequest){
        state.progressBusy=false;state.progressLoadingDays=null;
        renderProgress();renderMomentum();
      }
    }
  }
  function changeProgressWindow(value){
    var days=Number(value);
    if(![1,3,7,14].includes(days))return;
    if(days===state.progressDays)return;
    state.progressDays=days;state.progressDone=false;state.progressError=false;
    state.progress=null;setWindowLabel();
    void getProgress(false);
  }
  function drawRadar(target,a,b,mode,players){
    var host=$(target);
    if(!host||!a||!b||!E)return;
    var f1=E.features(a,mode),f2=E.features(b,mode);
    var eligible=(players||[]).map(p=>E.features(p,mode))
      .filter(f=>f&&f.matches>=minimum());
    var axis=E.FIELDS.map((field,i)=>{
      var vals=eligible.map(f=>f[field]).filter(x=>x!==null);
      var v1=f1?.[field],v2=f2?.[field];
      var a1=E.percentile(vals,v1),b1=E.percentile(vals,v2);
      return{field,value1:a1,value2:b1,angle:(-Math.PI/2)+i*2*Math.PI/E.FIELDS.length};
    }).filter(x=>x.value1!==null&&x.value2!==null);
    if(axis.length<3){
      host.innerHTML='<p class="small muted">Radar chart needs at least 3 shared real metrics and 2 saved comparison players. Missing axes are not estimated.</p>';
      return;
    }
    var cx=170,cy=150,r=105;
    var pt=(angle,level)=>{
      var rad=r*level/100;
      return[(cx+Math.cos(angle)*rad).toFixed(1),(cy+Math.sin(angle)*rad).toFixed(1)].join(',');
    };
    var labels={kpr:'Kills/match',damagePerMatch:'Damage/match',
      winRate:'Win rate',assistPerMatch:'Assists/match',
      revivePerMatch:'Revives/match',top10Rate:'Top 10 rate'};
    var grid=[25,50,75,100].map(level=>
      '<polygon points="'+axis.map(x=>pt(x.angle,level)).join(' ')+
      '" fill="none" stroke="#41536d" stroke-width="1"/>').join('');
    var spokes=axis.map(x=>
      '<line x1="'+cx+'" y1="'+cy+'" x2="'+pt(x.angle,100).replace(',','" y2="')+
      '" stroke="#41536d" stroke-width="1"/>').join('');
    var polygon=(field,stroke,fill)=>'<polygon points="'+
      axis.map(x=>pt(x.angle,x[field])).join(' ')+
      '" fill="'+fill+'" fill-opacity=".16" stroke="'+stroke+
      '" stroke-width="2.5" stroke-linejoin="round"/>';
    var labelsSvg=axis.map(x=>{
      var pos=pt(x.angle,124).split(',');
      return '<text x="'+pos[0]+'" y="'+pos[1]+
        '" text-anchor="middle" fill="#d2ddf0" font-size="11">'+html(labels[x.field])+'</text>';
    }).join('');
    host.innerHTML='<svg viewBox="0 0 340 310" role="img" aria-label="Relative clan percentile radar comparison of '+html(a.name)+' and '+html(b.name)+'">'+
      grid+spokes+polygon('value1','#3ce0be','#3ce0be')+
      polygon('value2','#a89eff','#a89eff')+labelsSvg+'</svg>'+
      '<p class="small muted">Percentiles within the saved clan cohort · '+
      '<span class="mint">'+html(a.name)+'</span> vs <span class="lavender">'+
      html(b.name)+'</span> · '+axis.length+' observed axes</p>';
  }
  function renderData(){
    if(!state.data)return;
    $('cc-export-note').textContent='Export '+cohort().length+
      ' verified clan profiles from existing saved PUBG lifetime data.';
    for(const name of ['before','after']){
      var source=state[name],label=$('cc-'+name+'-status');
      label.textContent=!source?'No local CSV loaded':
        'Local-only '+state.sourceNames[name]+' · '+source.rows.length+
        ' rows · '+source.warnings.length+' source warnings';
    }
    var body=$('cc-local-comparison');
    if(!state.before||!state.after){
      body.innerHTML='<tr><td colspan="6">Load two local CSV snapshots to compare them without changing the live clan database.</td></tr>';
      $('cc-scatter').innerHTML='';
      return;
    }
    var rows=E.compareSnapshots(state.before.rows,state.after.rows);
    body.innerHTML=rows.map(r=>
      '<tr><td>'+html(r.name)+'</td><td>'+html(r.state)+
      '</td><td>'+fmt(r.kills)+'</td><td>'+fmt(r.matches)+
      '</td><td>'+dec(r.kpr)+'</td><td>'+
      (r.botPctChange==null?'Unavailable':dec(r.botPctChange)+' percentage points (source only)')+
      '</td></tr>'
    ).join('');
    drawScatter();
  }
  function drawScatter(){
    var rows=state.after?.rows.filter(p=>p.botpct!==null&&
      p.botpct!==undefined&&p.matches>=1&&p.kills!==null)||[];
    var box=$('cc-scatter');
    if(!rows.length){
      box.innerHTML='<p class="small muted">No bot-exposure source column supplied. The official PUBG API does not provide this metric to this tool.</p>';
      return;
    }
    var max=Math.max(1,...rows.map(x=>x.kills/x.matches));
    var plots=rows.map(p=>{
      var x=46+490*p.botpct/100,y=220-175*(p.kills/p.matches)/max;
      return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+
        '" r="4" fill="#a89eff"><title>'+html(p.name)+' · Source-reported exposure '+
        p.botpct+'% · '+dec(p.kills/p.matches)+' kills/match</title></circle>';
    }).join('');
    box.innerHTML='<svg viewBox="0 0 580 260" role="img" aria-label="Local imported source exposure percentage against kills per round">'+
      '<line x1="46" y1="220" x2="536" y2="220" stroke="#8094b1"/>'+
      '<line x1="46" y1="35" x2="46" y2="220" stroke="#8094b1"/>'+
      plots+'<text x="290" y="248" text-anchor="middle" fill="#c7d5ec" font-size="12">Source-reported bot exposure (%)</text>'+
      '<text x="15" y="30" fill="#c7d5ec" font-size="11">Kills/match</text></svg>'+
      '<p class="small muted">External CSV values only; no PUBG verification, no bot-farmer or misconduct labels.</p>';
  }
  function download(name,csv){
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    try{
      var link=document.createElement('a');
      link.href=url;link.download=name;link.click();
    }finally{URL.revokeObjectURL(url);}
  }
  async function readLocal(kind,file){
    var label=$('cc-'+kind+'-status');
    if(!file){return;}
    if(file.size>256*1024){label.textContent='Rejected: CSV exceeds 256 KB';return;}
    try{
      var parsed=E.parseCSV(await file.text());
      if(parsed.errors.length){
        label.textContent='Rejected: '+parsed.errors.slice(0,3).join(' · ');
        state[kind]=null;renderData();return;
      }
      state[kind]=parsed;state.sourceNames[kind]=file.name.slice(0,120);
      renderData();
    }catch(error){label.textContent='Local CSV could not be read.';}
  }
  function init(){
    for(const id of ['cc-progress-window','cc-momentum-window']){
      $(id).addEventListener('change',function(){changeProgressWindow(this.value);});
    }
    for(const id of ['cc-min-matches','cc-team-weight']){
      $(id).addEventListener('input',function(){
        $('cc-min-output').textContent=minimum();
        $('cc-weight-output').textContent=$('cc-team-weight').value+'%';
        if(state.data){renderAwards();renderScores();}
      });
    }
    $('cc-export').addEventListener('click',function(){
      if(state.data)download('official-clan-saved-lifetime.csv',E.exportCSV(cohort()));
    });
    for(const kind of ['before','after']){
      $('cc-'+kind+'-file').addEventListener('change',function(){
        readLocal(kind,this.files?.[0]);
      });
    }
  }
  function render(page,data){
    state.data=data;
    if(page==='awards'){renderAwards();renderMomentum();void getProgress(false);}
    else if(page==='analysis'){
      renderScores();renderProgress();void getProgress(false);
    }else if(page==='data-tools')renderData();
  }
  init();
  window.CommandCentre={render,radar:drawRadar};
})();
