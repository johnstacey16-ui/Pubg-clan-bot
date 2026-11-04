
// HELP Clan workspace navigation. Calculator scripts and existing content remain unchanged.
(function(){
  'use strict';
  const panelIds = ["panel-clan","panel-sensitivity","panel-combat","panel-hit-zone","panel-recoil2","panel-attach","panel-backpack"];
  const navButtons = Array.from(document.querySelectorAll('#app-toolnav [data-open-panel]'));
  // Seven real workspaces share the toolkit's sidebar and topbar.
  const toolCount=panelIds.length;
  const toggle = document.getElementById('mobile-nav-toggle');
  const scrim = document.getElementById('sidebar-scrim');
  const title = document.getElementById('active-tool-heading');
  const index = document.getElementById('active-tool-index');
  const root = document.body;
  let currentPanel = 'panel-sensitivity';
  let lastToolkitPanel = 'panel-sensitivity';
  const clanSections=new Set(['overview','leaderboard','players','modes','matches',
    'weapons','season','teammates','compare','awards','analysis','data-tools',
    'help','survival','sources','global','health','roadmap']);
  // Deep links to Combat subsections must activate the Combat tool, not Scope.
  const combatAnchors=new Set(['combat-database','compare-weapons','how-thresholds-work','armor-guide']);
  const sensitivityAnchors=new Set(['sensitivity-panel-scope','sensitivity-panel-vert','sensitivity-panel-res','current-sensitivities']);
  const labAnchors=new Set(['panel-range','panel-ttk','damage-guide','dg_calculation','dg_hit_area','dg_weapon_class','dg_combined']);
  const isAnchor=id=>combatAnchors.has(id)||sensitivityAnchors.has(id)||labAnchors.has(id);
  function panelForHash(id){
    const target = panelIds.includes(id) ? id : panelIds[0];
    if(id.startsWith('player/')||clanSections.has(id))return 'panel-clan';
    return combatAnchors.has(id)?'panel-combat':labAnchors.has(id)?'panel-hit-zone':sensitivityAnchors.has(id)?'panel-sensitivity':target;
  }
  function scrollCombatAnchor(id){
    if(!isAnchor(id))return;
    const anchor=document.getElementById(id);
    if(anchor && typeof anchor.scrollIntoView==='function')
      anchor.scrollIntoView({behavior:id==='damage-guide'||id.startsWith('dg_')?'instant':'auto',block:'start'});
  }

  function closeMenu(){
    root.classList.remove('sidebar-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open toolkit navigation');
  }
  function openMenu(){
    root.classList.add('sidebar-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close toolkit navigation');
  }
  function selectPanel(id, options = {}){
    if(!panelIds.includes(id)) return false;
    const changed = id !== currentPanel;
    currentPanel = id;
    if(id!=='panel-clan')lastToolkitPanel=id;
    document.querySelectorAll('.hub-main').forEach(panel=>{
      const active = panel.id === id;
      panel.classList.toggle('active', active);
      panel.setAttribute('aria-hidden', String(!active));
    });
    navButtons.forEach(button=>{
      const active = button.dataset.openPanel === id;
      button.classList.toggle('active', active);
      if(active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const button = navButtons.find(item=>item.dataset.openPanel===id);
    title.textContent = button ? button.querySelector('.nav-tool-name').textContent.trim() : '';
    const currentIndex = panelIds.indexOf(id)+1;
    index.innerHTML = String(currentIndex).padStart(2,'0')+' <i>/</i> '+String(toolCount).padStart(2,'0');
    index.setAttribute('aria-label','Tool '+currentIndex+' of '+toolCount);
    if(options.updateHistory && location.hash !== '#'+id) history.pushState({panel:id},'', id==='panel-clan'?'/dashboard/':'/#'+id);
    if(options.scroll && changed) window.scrollTo({top:0,behavior:'auto'});
    const wasOpen = root.classList.contains('sidebar-open');
    closeMenu();
    if(wasOpen && options.focus) title.focus({preventScroll:true});
    document.dispatchEvent(new CustomEvent('help:panel-changed',{detail:{id}}));
    return true;
  }
  navButtons.forEach(button=>{
    button.addEventListener('click',()=>selectPanel(button.dataset.openPanel,{updateHistory:true,scroll:true,focus:true}));
  });
  document.querySelectorAll('[data-return-tool]').forEach(link=>{
    link.addEventListener('click',event=>{
      event.preventDefault();
      selectPanel(lastToolkitPanel,{updateHistory:true,scroll:true,focus:true});
    });
  });
  toggle.addEventListener('click',()=>root.classList.contains('sidebar-open') ? closeMenu() : openMenu());
  scrim.addEventListener('click',closeMenu);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && root.classList.contains('sidebar-open')) {
      closeMenu();
      toggle.focus();
    }
  });
  window.addEventListener('resize',()=>{ if(window.innerWidth>900) closeMenu(); },{passive:true});
  function followHash(){
    const id=decodeURIComponent(location.hash.slice(1));
    const target=id?panelForHash(id):
      location.pathname.startsWith('/dashboard')?'panel-clan':'panel-sensitivity';
    if(target!==currentPanel)selectPanel(target,{scroll:!isAnchor(id)});
    if(isAnchor(id))scrollCombatAnchor(id);
  }
  window.addEventListener('popstate',followHash);
  window.addEventListener('hashchange',followHash);
  const initialHash=decodeURIComponent(location.hash.slice(1));
  selectPanel(initialHash?panelForHash(initialHash):
    location.pathname.startsWith('/dashboard')?'panel-clan':'panel-sensitivity');
  // DB subsection targets are generated by the next script. Scroll on load.
  window.addEventListener('load',()=>{
    const id=decodeURIComponent(location.hash.slice(1));
    if(isAnchor(id))scrollCombatAnchor(id);
  });
})();
