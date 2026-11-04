
// ---- Sensitivity Calculator logic ----
(function(){
 
const sections=[['scope','Scope matcher'],['vert','Vertical multiplier'],['res','Resolution']];
const tabsEl=document.getElementById('tabs');
for(const [id,label] of sections){
 const panel=document.querySelector('#panel-sensitivity .panel[data-panel="'+id+'"]');
 panel.id='sensitivity-panel-'+id;panel.classList.add('active');
 panel.setAttribute('role','region');panel.setAttribute('aria-label',label);panel.tabIndex=-1;
 const link=document.createElement('a');link.href='#'+panel.id;link.textContent='↓ '+label;
 link.addEventListener('click',()=>panel.focus({preventScroll:true}));tabsEl.append(link);
}

const $ = id => document.getElementById(id);
const fmt = (n, d=3) => isFinite(n) ? (Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toString() : '–';
 
/* ---------- 01 Vertical Multiplier ---------- */
function calcVert(){
  const cur = parseFloat($('v_cur_ads').value);
  const vm = parseFloat($('v_cur_vm').value);
  const tgt = parseFloat($('v_tgt_ads').value);
  if(!isFinite(cur)||!isFinite(vm)||!isFinite(tgt)) return;
  const diff = tgt - cur;
  const ratio = Math.pow(10, diff/50);
  const tvm = vm / ratio;
  $('v_diff').textContent = (diff>=0?'+':'')+diff;
  $('v_ratio').textContent = fmt(ratio,4)+'×';
  $('v_tvm').textContent = fmt(tvm,4);
  $('v_round').textContent = fmt(Math.round(tvm),0);
  $('v_floor').textContent = fmt(Math.floor(tvm),0);
  let advice = '';
  if(diff>0) advice = `Raising ADS sensitivity by ${diff} speeds up horizontal rotation, so vertical multiplier is scaled down to roughly hold your original recoil-control feel. Test AR and vehicle sprays after applying.`;
  else if(diff<0) advice = `Lowering ADS sensitivity by ${Math.abs(diff)} slows horizontal rotation, so vertical multiplier is scaled up to roughly hold your original recoil-control feel. Test AR sprays after applying.`;
  else advice = `No change in ADS sensitivity — vertical multiplier stays the same.`;
  if(cur<0||cur>20||tgt<0||tgt>20){
    advice += ` <b style="color:var(--rust);">Warning: ADS sensitivity in PUBG only goes from 0 to 20 — one of your values is outside that range.</b>`;
  }
  if(vm<50||vm>150){
    advice += ` <b style="color:var(--rust);">Warning: vertical multiplier in PUBG only goes from 50 to 150 — check your input.</b>`;
  }
  $('v_advice').innerHTML = advice;
}
['v_cur_ads','v_cur_vm','v_tgt_ads'].forEach(id=>$(id).addEventListener('input', calcVert));
 
/* ---------- 05 pixel-speed scope matcher ---------- */
const SCOPE_CONST = {
  'aim': {A:53, B:0.2, range:[1.3,14.7]},
  '1x':  {A:64, B:2,   range:[0.1,19.1]},
  '2x':  {A:54, B:0.6, range:[0.9,15.1]},
  '3x':  {A:70, B:0.6, range:[1.4,19.8]},
  '4x':  {A:50, B:0.6, range:[0.8,14]},
  '6x':  {A:35, B:0.6, range:[0.4,9.6]},
  '8x':  {A:35, B:0.6, range:[0.4,9.6]},
  '15x': {A:53, B:0.2, range:[1.3,14.7]},
};
function pixelSpeed(C, A, B){
  return (3840*(C+B)) / ((A/60)*(10+B));
}
function matchedSens(speed, A, B){
  return ((A/60)*(10+B)*speed)/3840 - B;
}
const scopeLabel=key=>key==='aim'?'Aim (over the shoulder)':key==='1x'?'1x · Red Dot / Holo / Iron':key;
function calcScope(){
  const refKey = $('px_scope').value;
  const C = parseFloat($('px_sens').value);
  const ref = SCOPE_CONST[refKey];
  if(!Number.isFinite(C)||C<0||C>20||!ref){
    $('px_speed').textContent='–';document.querySelector('#px_table tbody').replaceChildren();updateCurrentSpeeds();return;
  }
  const speed = pixelSpeed(C, ref.A, ref.B);
  $('px_speed').textContent = fmt(speed,0);
 
  const tbody = document.querySelector('#px_table tbody');
  tbody.innerHTML = '';
  Object.keys(SCOPE_CONST).forEach(key=>{
    const sc = SCOPE_CONST[key];
    const sens = matchedSens(speed, sc.A, sc.B);
    const inRange = sens >= sc.range[0] && sens <= sc.range[1];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${scopeLabel(key)}${key===refKey?' <span class="badge">ref</span>':''}</td>
      <td>${sc.A}</td><td>${sc.B}</td>
      <td style="color:${key===refKey?'#e8a33d':'#e9e7dc'};font-weight:${key===refKey?'700':'400'};">${fmt(sens,2)}</td>
      <td style="color:${inRange?'#8fae5c':'#c8593d'};">${inRange?'Yes':'Out of range'}</td>`;
    tbody.appendChild(tr);
  });
  updateCurrentSpeeds();
}
const currentInputs=new Map();
function summarizeSpeeds(entries){
 if(entries.length<2)return null;
 const slowest=entries.reduce((a,b)=>a.speed<=b.speed?a:b);
 const fastest=entries.reduce((a,b)=>a.speed>=b.speed?a:b);
 const gap=fastest.speed-slowest.speed;
 return {slowest,fastest,gap,percent:gap/slowest.speed*100};
}
function updateCurrentSpeeds(){
 const validEntries=[];
 for(const [key,row] of currentInputs){
  const value=Number.parseFloat(row.input.value),valid=Number.isFinite(value)&&value>=0&&value<=20;
  const speed=valid?pixelSpeed(value,SCOPE_CONST[key].A,SCOPE_CONST[key].B):null;
  row.speed.textContent=speed==null?'–':fmt(speed,0);
  row.delta.textContent=speed==null?(row.input.value===''?'–':'Enter 0–20'):'–';
  row.input.setAttribute('aria-invalid',String(row.input.value!==''&&!valid));
  if(valid)validEntries.push({key,speed});
 }
 const spread=summarizeSpeeds(validEntries),summary=$('current_speed_spread');
 if(!spread){summary.textContent='Enter at least two current sensitivities to compare their speeds.';return;}
 for(const entry of validEntries)currentInputs.get(entry.key).delta.textContent='+'+fmt(entry.speed-spread.slowest.speed,0)+' px/s';
 summary.textContent=spread.gap<1e-8?'Your entered aiming modes match: no pixel-speed difference.':
  'Largest mismatch: '+fmt(spread.gap,0)+' px/s ('+fmt(spread.percent,1)+'% faster than your slowest setting). '+
  scopeLabel(spread.fastest.key)+' is fastest at '+fmt(spread.fastest.speed,0)+' px/s; '+scopeLabel(spread.slowest.key)+' is slowest at '+fmt(spread.slowest.speed,0)+' px/s.';
}
for(const key of Object.keys(SCOPE_CONST)){
 const tr=document.createElement('tr'),name=document.createElement('th');name.scope='row';name.textContent=scopeLabel(key);tr.append(name);
 const input=document.createElement('input');input.type='number';input.min='0';input.max='20';input.step='0.1';input.placeholder='0–20';input.id='current_sens_'+key;input.setAttribute('aria-label','Current '+scopeLabel(key)+' sensitivity');
 const speed=document.createElement('output');speed.setAttribute('for',input.id);speed.setAttribute('aria-label',scopeLabel(key)+' pixel speed');
 const delta=document.createElement('span');
 for(const item of [input,speed,delta]){const td=document.createElement('td');td.append(item);tr.append(td);}
 input.addEventListener('input',updateCurrentSpeeds);currentInputs.set(key,{input,speed,delta});
 document.querySelector('#current_sensitivity_table tbody').append(tr);
}
['px_scope','px_sens'].forEach(id=>$(id).addEventListener('input', calcScope));
$('px_scope').addEventListener('change', calcScope);
 
/* ---------- 03 resolution converter ---------- */
const CONV = {
  '169to1610': {sensDelta:0, vmOp:'mul', vmFactor:1.11},
  '1610to169': {sensDelta:0, vmOp:'div', vmFactor:1.11},
  '169to219':  {sensDelta:0, vmOp:'mul', vmFactor:0.85},
  '219to169':  {sensDelta:0, vmOp:'div', vmFactor:0.85},
  '169to43':   {sensDelta:3, vmOp:'mul', vmFactor:1.166},
  '43to169':   {sensDelta:-3, vmOp:'div', vmFactor:1.166},
};
function calcRes(){
  const sens = parseFloat($('r_sens').value);
  const vm = parseFloat($('r_vm').value);
  const c = CONV[$('r_conv').value];
  if(!isFinite(sens)||!isFinite(vm)||!c) return;
  const newSens = sens + c.sensDelta;
  const newVm = c.vmOp==='mul' ? vm*c.vmFactor : vm/c.vmFactor;
  $('r_sensout').textContent = (c.sensDelta===0? 'No change' : (newSens+ ' (' + (c.sensDelta>0?'+':'') + c.sensDelta + ')'));
  $('r_vmout').textContent = fmt(newVm,4);
}
['r_sens','r_vm','r_conv'].forEach(id=>$(id).addEventListener('input', calcRes));
$('r_conv').addEventListener('change', calcRes);
 
/* init all */
calcVert(); calcScope(); calcRes(); updateCurrentSpeeds();
 
})();
