'use strict';
// Preserve pre-toolkit dashboard bookmarks and player-profile shares.
// Root and /training/ now render the HELP toolkit. A legacy clan hash belongs
// to /dashboard/, while #panel-* and calculator anchors belong to the toolkit.
(function(){
  if(typeof window==='undefined'||!window.location)return;
  var hash=window.location.hash.slice(1);
  var pages=new Set(['overview','leaderboard','players','modes','matches',
    'weapons','season','teammates','compare','awards','analysis','data-tools',
    'help','survival','sources','global','health','roadmap']);
  if(hash.startsWith('player/')||pages.has(hash))
    window.location.replace('/dashboard/'+window.location.hash);
})();
