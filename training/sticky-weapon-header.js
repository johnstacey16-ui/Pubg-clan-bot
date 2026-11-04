/*
 * HELP Clan weapon database — sticky column headings.
 *
 * The full weapon table must scroll horizontally on phones and smaller displays.
 * CSS position:sticky cannot follow the page's vertical scroll when an ancestor
 * scrolls horizontally (overflow-x:auto also creates vertical scroll containment).
 * This lightweight mirrored header follows page scroll and stays horizontally
 * aligned with the original table. No weapon rows, values or sort logic change.
 */
(() => {
  'use strict';

  const table = document.getElementById('wTable');
  const panel = document.getElementById('panel-combat');
  const topbar = document.getElementById('app-topbar');
  if (!table || !panel || !topbar) return;

  const scroller = table.parentElement;
  const dock = document.createElement('div');
  dock.id = 'weapon-table-sticky-header';
  dock.className = 'weapon-table-sticky-header';
  dock.setAttribute('aria-label', 'Weapon database column headings');
  dock.hidden = true;

  const viewport = document.createElement('div');
  viewport.className = 'weapon-table-sticky-viewport';
  const copy = document.createElement('table');
  copy.className = 'weapon-table-sticky-copy';
  viewport.appendChild(copy);
  dock.appendChild(viewport);
  document.body.appendChild(dock);

  let headingHeight = 0;
  let pendingLayout = false;
  let pendingRebuild = false;

  function rebuildHeader() {
    const group = table.querySelector('tr.grouprow');
    const names = table.querySelector('tr.colheader');
    if (!group || !names) {
      dock.hidden = true;
      headingHeight = 0;
      return;
    }

    // Column widths are measured from the *real* table, so a wide table with
    // horizontally scrolling content remains aligned on mobile and desktop.
    const cells = Array.from(names.cells);
    const colgroup = document.createElement('colgroup');
    for (const cell of cells) {
      const col = document.createElement('col');
      col.style.width = cell.getBoundingClientRect().width + 'px';
      colgroup.appendChild(col);
    }

    const thead = document.createElement('thead');
    thead.append(group.cloneNode(true), names.cloneNode(true));
    copy.replaceChildren(colgroup, thead);
    copy.style.width = table.getBoundingClientRect().width + 'px';

    headingHeight =
      group.getBoundingClientRect().height +
      names.getBoundingClientRect().height;
    dock.style.setProperty('--weapon-sticky-group-h',
      group.getBoundingClientRect().height + 'px');
    viewport.scrollLeft = scroller.scrollLeft;
  }

  function positionHeader() {
    // Only show the extra header while the user is actually *within* the
    // database. Other cards and other toolkit panels stay entirely unaffected.
    if (!panel.classList.contains('active') || !headingHeight) {
      dock.hidden = true;
      return;
    }

    const tableRect = table.getBoundingClientRect();
    const scrollRect = scroller.getBoundingClientRect();
    const stickyTop = Math.max(0, topbar.getBoundingClientRect().bottom);
    const crossedTop = tableRect.top + headingHeight <= stickyTop;
    const beforeEnd = tableRect.bottom > stickyTop + headingHeight;
    const onscreen = scrollRect.right > 0 &&
      scrollRect.left < window.innerWidth && scrollRect.width > 0;

    if (!crossedTop || !beforeEnd || !onscreen) {
      dock.hidden = true;
      return;
    }

    dock.style.top = stickyTop + 'px';
    dock.style.left = scrollRect.left + 'px';
    dock.style.width = scrollRect.width + 'px';
    viewport.scrollLeft = scroller.scrollLeft;
    dock.hidden = false;
  }

  function queueLayout(rebuild = false) {
    pendingRebuild ||= rebuild;
    if (pendingLayout) return;
    pendingLayout = true;
    requestAnimationFrame(() => {
      pendingLayout = false;
      if (pendingRebuild) {
        pendingRebuild = false;
        rebuildHeader();
      }
      positionHeader();
    });
  }

  // Keep sorting working when clicking a visible mirrored column heading.
  // The original headings keep their existing sort handlers and keyboard logic.
  dock.addEventListener('click', event => {
    const heading = event.target.closest('th[data-key]');
    if (!heading) return;
    const matchingHeading = Array.from(
      table.querySelectorAll('tr.colheader th[data-key]')
    ).find(cell => cell.dataset.key === heading.dataset.key);
    if (matchingHeading) matchingHeading.click();
  });
  dock.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const heading = event.target.closest('th[data-key]');
    if (!heading) return;
    event.preventDefault();
    heading.click();
  });

  window.addEventListener('scroll', () => queueLayout(), {passive:true});
  scroller.addEventListener('scroll', () => queueLayout(), {passive:true});
  window.addEventListener('resize', () => queueLayout(true), {passive:true});

  // The existing calculator rebuilds the table when filtering/sorting, and
  // produces fresh heading DOM nodes. Mirror each new set of headings.
  new MutationObserver(() => queueLayout(true))
    .observe(table, {childList:true});

  // Switching between tool panels must immediately hide the copied header.
  new MutationObserver(() => queueLayout())
    .observe(panel, {attributes:true,attributeFilter:['class']});

  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(() => queueLayout(true));
    resizeObserver.observe(table);
    resizeObserver.observe(scroller);
    resizeObserver.observe(topbar);
  }

  queueLayout(true);
})();
