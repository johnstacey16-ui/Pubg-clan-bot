'use strict';
// Pure calculations adapted from the user's older Clan Command Centre.
// Historical example players, unverifiable third-party status badges and
// unsupported claims are not shipped or used in official analysis.
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ClanAnalytics=api;
})(typeof window!=='undefined'?window:null,function(){
  var FIELDS=['kpr','damagePerMatch','winRate','assistPerMatch','revivePerMatch','top10Rate'];
  var WEIGHTS={kpr:0.29,damagePerMatch:0.24,winRate:0.19,
    assistPerMatch:0.11,revivePerMatch:0.09,top10Rate:0.08};
  var HEADERS=['name','platform','matches','kills','wins','damage','assists',
    'revives','top10','longestKill','botPct'];
  function number(x){
    if(x===null||x===undefined||x===''||typeof x==='boolean')return null;
    var v=Number(x);
    return Number.isFinite(v)&&v>=0?v:null;
  }
  function rate(x,denominator){
    var a=number(x),b=number(denominator);
    return a===null||b===null||b<=0?null:a/b;
  }
  function median(numbers){
    var values=numbers.filter(x=>Number.isFinite(x)).slice().sort((a,b)=>a-b);
    if(!values.length)return null;
    var half=Math.floor(values.length/2);
    return values.length%2?values[half]:(values[half-1]+values[half])/2;
  }
  function winsorise(numbers,limit=0.95){
    var sorted=numbers.filter(x=>Number.isFinite(x)).slice().sort((a,b)=>a-b);
    if(!sorted.length)return[];
    var upper=sorted[Math.max(0,Math.ceil(sorted.length*limit)-1)];
    return numbers.map(x=>Number.isFinite(x)?Math.min(x,upper):null);
  }
  function percentile(numbers,value){
    var arr=numbers.filter(x=>Number.isFinite(x)),v=number(value);
    if(v===null||arr.length<2)return null;
    var lower=arr.filter(x=>x<v).length,equal=arr.filter(x=>x===v).length;
    return Math.round(100*(lower+equal/2)/arr.length);
  }
  function pick(player,mode){
    if(mode&&mode!=='all'){
      var s=player?.modes?.[mode];
      if(!s)return null;
      return{matches:number(s.roundsPlayed),kills:number(s.kills),
        wins:number(s.wins),damage:number(s.damageDealt),
        assists:number(s.assists),revives:number(s.revives),
        top10:number(s.top10s),longestKill:number(s.longestKill)};
    }
    return{matches:number(player?.matches),kills:number(player?.kills),
      wins:number(player?.wins),damage:number(player?.advanced?.damage),
      assists:number(player?.advanced?.assists),
      revives:number(player?.advanced?.revives),
      top10:number(player?.advanced?.top10),
      longestKill:number(player?.advanced?.longestKill)};
  }
  function features(p,mode='all'){
    var raw=pick(p,mode);
    if(!raw)return null;
    return Object.assign({},raw,{
      kpr:rate(raw.kills,raw.matches),
      damagePerMatch:rate(raw.damage,raw.matches),
      winRate:rate(raw.wins,raw.matches),
      assistPerMatch:rate(raw.assists,raw.matches),
      revivePerMatch:rate(raw.revives,raw.matches),
      top10Rate:rate(raw.top10,raw.matches)
    });
  }
  function classify(item,cohort){
    var f=item.features;
    if(f.matches===0)return 'Inactive';
    if(f.matches===null||f.matches<25)return 'Insufficient data';
    var reference=cohort.filter(x=>x.features.matches>=25);
    if(reference.length<5||f.kpr===null||f.assistPerMatch===null||
      f.revivePerMatch===null||f.top10Rate===null)return 'Insufficient data';
    var k=median(reference.map(x=>x.features.kpr));
    var a=median(reference.map(x=>x.features.assistPerMatch));
    var r=median(reference.map(x=>x.features.revivePerMatch));
    if(k===null||a===null||r===null)return 'Insufficient data';
    if(f.kpr>k*1.25 && f.assistPerMatch<=a*1.1)return 'Fragger';
    if(f.revivePerMatch>r*1.3||f.assistPerMatch>a*1.5)return 'Support';
    if(f.top10Rate>0.50&&f.kpr<k*0.9)return 'Survivor';
    return 'Hybrid';
  }
  function score(players,options={}){
    var mode=options.mode||'all';
    var minMatches=Number.isFinite(+options.minMatches)?
      Math.max(10,Math.min(500,Number(options.minMatches))):30;
    var weights=Object.assign({},WEIGHTS,options.weights||{});
    var cohort=(Array.isArray(players)?players:[]).filter(p=>
      p&&typeof p.name==='string'&&['xbox','psn'].includes(p.platform))
      .map(p=>({name:p.name,platform:p.platform,updatedAt:p.updatedAt||null,
        features:features(p,mode)})).filter(p=>p.features);
    var eligible=cohort.filter(p=>p.features.matches>=minMatches &&
      p.features.kpr!==null&&p.features.winRate!==null &&
      FIELDS.filter(k=>p.features[k]!==null).length>=4);
    var columns=Object.fromEntries(FIELDS.map(k=>[k,eligible.map(x=>x.features[k])
      .filter(x=>x!==null)]));
    return cohort.map(p=>{
      var f=p.features,qualifies=eligible.includes(p),metrics=[],sum=0,total=0;
      if(qualifies&&eligible.length>=5){
        for(const field of FIELDS){
          if(f[field]===null||columns[field].length<2)continue;
          var points=percentile(columns[field],f[field]),w=Number(weights[field]);
          if(points!==null&&Number.isFinite(w)&&w>0){
            metrics.push({metric:field,percentile:points});
            sum+=points*w;total+=w;
          }
        }
      }
      var sampleBand=f.matches===null?'Unknown':
        f.matches>=300?'Large':f.matches>=100?'Medium':
        f.matches>=minMatches?'Limited':'Below minimum';
      return Object.assign({},p,{
        role:classify(p,cohort),
        rating:qualifies&&eligible.length>=5&&metrics.length>=4&&total>0?
          Math.round(sum/total):null,
        eligible:qualifies&&eligible.length>=5,
        metrics,sampleBand,
        observedMetrics:FIELDS.filter(k=>f[k]!==null).length
      });
    }).sort((a,b)=>(b.rating??-1)-(a.rating??-1)||
      (b.features.kills??0)-(a.features.kills??0)||a.name.localeCompare(b.name));
  }
  function awards(players,minMatches=30){
    var cohort=score(players,{minMatches});
    var candidates=cohort.filter(p=>(p.features.matches??0)>=minMatches);
    var categories=[
      ['Sharpshooter','Kills per match','kpr'],
      ['Heavy hitter','Damage per match','damagePerMatch'],
      ['Team player','Assists per match','assistPerMatch'],
      ['Medic','Revives per match','revivePerMatch'],
      ['Winner','Win rate','winRate'],
      ['Survivor','Top 10 rate','top10Rate']
    ];
    return categories.map(c=>{
      var ranked=candidates.filter(p=>p.features[c[2]]!==null)
        .sort((a,b)=>b.features[c[2]]-a.features[c[2]]||
          b.features.matches-a.features.matches||a.name.localeCompare(b.name));
      return{title:c[0],metricLabel:c[1],metric:c[2],
        winner:ranked[0]?{
          name:ranked[0].name,platform:ranked[0].platform,
          value:ranked[0].features[c[2]],matches:ranked[0].features.matches
        }:null,eligiblePlayers:ranked.length};
    });
  }
  function quality(players,referenceDate=Date.now()){
    var errors=[],names=new Set(),list=Array.isArray(players)?players:[];
    for(const p of list){
      var name=String(p?.name||'').trim(),key=name.toLowerCase();
      if(!name){errors.push({name:'Unknown',issue:'Missing player name'});continue;}
      if(names.has(key))errors.push({name,issue:'Duplicate gamertag in saved view'});
      names.add(key);
      var f=features(p);
      if(!f||f.matches===null)errors.push({name,issue:'Missing match count'});
      else if(f.matches===0)errors.push({name,issue:'No recorded lifetime matches'});
      if(f&&f.matches!==null&&f.wins!==null&&f.wins>f.matches)
        errors.push({name,issue:'Wins exceed reported matches'});
      if(f&&f.matches!==null&&f.kills!==null&&f.kills>0&&f.matches===0)
        errors.push({name,issue:'Kills with zero matches'});
      if(f&&['damage','assists','revives','top10'].every(k=>f[k]===null))
        errors.push({name,issue:'Advanced lifetime metrics not saved'});
      var at=Date.parse(p.updatedAt);
      if(Number.isFinite(at)&&referenceDate-at>14*86400000)
        errors.push({name,issue:'Last lifetime update older than 14 days'});
      if(!Number.isFinite(at))
        errors.push({name,issue:'No trustworthy refresh timestamp'});
    }
    return errors;
  }
  function progress(rows){
    return(Array.isArray(rows)?rows:[]).filter(r=>
      r&&typeof r.name==='string'&&['xbox','psn'].includes(r.platform)&&
      Number.isFinite(Date.parse(r.latestAt))).map(r=>{
      var current={kills:number(r.latestKills),wins:number(r.latestWins),
        matches:number(r.latestMatches)};
      var before={kills:number(r.previousKills),wins:number(r.previousWins),
        matches:number(r.previousMatches)};
      var hasPast=Number.isFinite(Date.parse(r.previousAt));
      var differences={};
      for(const key of ['kills','wins','matches'])differences[key]=
        hasPast&&current[key]!==null&&before[key]!==null?
          current[key]-before[key]:null;
      var reset=Object.values(differences).some(x=>x!==null&&x<0);
      var valid=hasPast&&!reset&&differences.matches>0&&
        differences.kills!==null;
      return{
        name:r.name,platform:r.platform,latestAt:r.latestAt,
        previousAt:hasPast?r.previousAt:null,
        deltaKills:reset?null:differences.kills,
        deltaWins:reset?null:differences.wins,
        deltaMatches:reset?null:differences.matches,
        deltaKpr:valid?differences.kills/differences.matches:null,
        state:reset?'counter_changed':!hasPast?'baseline_only':
          !valid?'no_new_matches':'observed'
      };
    }).sort((a,b)=>(b.deltaKpr??-1)-(a.deltaKpr??-1)||
      a.name.localeCompare(b.name));
  }
  // Informal interval momentum awards; never lifetime consistency claims.
  // Require at least three genuinely added rounds and nondecreasing counters,
  // and do not treat missing wins or kills as evidence.
  function progressAwards(rows,minNewMatches=3){
    var eligible=(Array.isArray(rows)?rows:[]).filter(p=>
      p&&p.state==='observed'&&
      Number.isFinite(p.deltaMatches)&&p.deltaMatches>=minNewMatches&&
      Number.isFinite(p.deltaKills)&&p.deltaKills>=0&&
      Number.isFinite(p.deltaWins)&&p.deltaWins>=0&&
      Number.isFinite(p.deltaKpr)&&p.deltaKpr>=0&&
      typeof p.name==='string'&&p.name.trim());
    var categories=[
      {key:'deltaKills',title:'Most kills added',unit:'kills'},
      {key:'deltaKpr',title:'Highest interval kills / game',unit:'kills per new match'},
      {key:'deltaWins',title:'Most wins added',unit:'wins'},
      {key:'deltaMatches',title:'Most games added',unit:'games'}
    ];
    return categories.map(def=>{
      var ranked=eligible.filter(p=>p[def.key]>0).slice().sort((a,b)=>
        b[def.key]-a[def.key]||b.deltaMatches-a.deltaMatches||
        a.name.localeCompare(b.name));
      return{...def,winner:ranked[0]||null,
        eligiblePlayers:eligible.length,
        contenders:ranked.length};
    });
  }
  function splitCSVLine(line,delimiter){
    var fields=[],field='',quoted=false;
    for(var i=0;i<line.length;i++){
      var c=line[i];
      if(quoted){
        if(c==='"'&&line[i+1]==='"'){field+='"';i++;}
        else if(c==='"')quoted=false;
        else field+=c;
      }else if(c==='"'){quoted=true;}
      else if(c===delimiter){fields.push(field);field='';}
      else field+=c;
    }
    fields.push(field);
    return{fields,unclosed:quoted};
  }
  function parseCSV(csv){
    var text=String(csv||'');
    if(text.length>256*1024)return{rows:[],errors:['File exceeds the 256 KB local preview limit'],warnings:[]};
    var lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
    if(lines.length<2)return{rows:[],errors:['A header and at least one data row are required'],warnings:[]};
    if(lines.length>201)return{rows:[],errors:['Maximum 200 players per snapshot'],warnings:[]};
    var delimiter=lines[0].includes('\t')?'\t':',';
    var headers=splitCSVLine(lines[0],delimiter).fields.map(x=>x.trim().toLowerCase().replace(/[^a-z0-9]/g,''));
    var aliases={gamertag:'name',player:'name',rounds:'matches',games:'matches',roundsplayed:'matches',
      damageDealt:'damage',dmg:'damage',top10s:'top10',topten:'top10',botpercent:'botpct'};
    headers=headers.map(x=>aliases[x]||x);
    var errors=[],warnings=[],rows=[],seen=new Set();
    if(!headers.includes('name'))errors.push('Missing required name column');
    if(!headers.includes('matches'))errors.push('Missing required matches or rounds column');
    if(!headers.includes('kills'))errors.push('Missing required kills column');
    if(headers.length!==new Set(headers).size)errors.push('Duplicate column headers');
    if(errors.length)return{rows:[],errors,warnings};
    var integerFields=new Set(['matches','kills','wins','assists','revives','top10']);
    var numeric=/^\d+(?:\.\d+)?$/;
    for(var i=1;i<lines.length;i++){
      var line=splitCSVLine(lines[i],delimiter);
      if(line.unclosed||line.fields.length!==headers.length){
        errors.push('Line '+(i+1)+': malformed column count or quoting');continue;
      }
      var row={},bad=false;
      headers.forEach((h,j)=>{
        if(!HEADERS.map(x=>x.toLowerCase()).includes(h))return;
        var raw=line.fields[j].trim();
        if(h==='name'||h==='platform'){row[h]=raw;return;}
        if(raw===''){row[h]=null;return;}
        var n=Number(raw);
        if(!numeric.test(raw)||!Number.isFinite(n)||
          (integerFields.has(h)&&!Number.isInteger(n))||
          (h==='botpct'&&n>100)){
          errors.push('Line '+(i+1)+': invalid '+h+' number');bad=true;
        }else row[h]=n;
      });
      var name=String(row.name||'').trim(),key=name.toLowerCase();
      if(!name||name.length>100||/[\u0000-\u001f\u007f]/.test(name)){
        errors.push('Line '+(i+1)+': invalid name');bad=true;
      }
      if(seen.has(key)){errors.push('Duplicate player name: '+name);bad=true;}
      seen.add(key);
      if(!bad){
        row.name=name;
        row.platform=['xbox','psn'].includes(String(row.platform).toLowerCase())?
          String(row.platform).toLowerCase():null;
        if(row.botpct!==null&&row.botpct!==undefined)
          warnings.push('Imported bot exposure is unverified source data, not official PUBG statistics.');
        rows.push(row);
      }
    }
    if(errors.length)return{rows:[],errors,warnings};
    return{rows,errors,warnings:[...new Set(warnings)]};
  }
  function csvEscape(value){
    var s=String(value??'');
    // Disarm user-controlled gamertags that spreadsheet apps treat as formulas.
    if(typeof value==='string'&&/^\s*[=+@-]/.test(s))s="'"+s;
    return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }
  function exportCSV(players){
    var columns=['name','platform','matches','kills','wins','damage','assists','revives','top10','longestKill'];
    var lines=[columns.join(',')];
    for(const p of players||[]){
      var f=features(p);
      if(!f||!p.name||!['xbox','psn'].includes(p.platform))continue;
      lines.push(columns.map(k=>csvEscape(k==='name'?p.name:
        k==='platform'?p.platform:f[k])).join(','));
    }
    return lines.join('\r\n');
  }
  function compareSnapshots(previous,current){
    var old=new Map((previous||[]).map(x=>[x.name.toLowerCase(),x]));
    var latest=new Set((current||[]).map(x=>x.name.toLowerCase()));
    var rows=[];
    for(const p of current||[]){
      var before=old.get(p.name.toLowerCase());
      if(!before){rows.push({name:p.name,state:'New in uploaded snapshot'});continue;}
      var a=number(p.kills),b=number(before.kills);
      var games=number(p.matches),prior=number(before.matches);
      if(a===null||b===null||games===null||prior===null)
        rows.push({name:p.name,state:'Insufficient fields'});
      else if(a<b||games<prior)
        rows.push({name:p.name,state:'Cumulative counters decreased — inspect source'});
      else rows.push({name:p.name,state:'Observed imported change',
        kills:a-b,matches:games-prior,
        kpr:games>prior?(a-b)/(games-prior):null,
        botPctChange:p.botpct!=null&&before.botpct!=null?
          p.botpct-before.botpct:null});
    }
    for(const p of previous||[])if(!latest.has(p.name.toLowerCase()))
      rows.push({name:p.name,state:'Absent from newer upload — membership unconfirmed'});
    return rows;
  }
  return{number,rate,median,winsorise,percentile,features,score,awards,
    quality,progress,progressAwards,parseCSV,exportCSV,compareSnapshots,FIELDS,WEIGHTS};
});