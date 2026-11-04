// Static-site smoke checks: no build tools, packages or network required.
// Run with: node --test tests/ui-smoke.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = require('./toolkit-test-source.cjs')();
const shell = fs.readFileSync(path.join(root, 'app-shell.css'), 'utf8');
const legacy = fs.readFileSync(path.join(root, 'design-refresh.css'), 'utf8');

const panelIds = [
  'panel-sensitivity', 'panel-combat', 'panel-hit-zone', 'panel-recoil2', 'panel-attach', 'panel-backpack'
];
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

test('all eight toolkit panels and their navigation links exist', () => {
  for (const id of panelIds) {
    assert.match(html, new RegExp('id="' + id + '" class="hub-main'));
    assert.match(html, new RegExp('data-open-panel="' + id + '"'));
  }
  assert.equal((html.match(/data-open-panel="panel-/g) || []).length, 6);
  assert.doesNotMatch(html, /id="panel-data"|data-open-panel="panel-data"/);
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'No duplicate element IDs');
});

test('tool logic is present, the browser scripts compile, and CSS files are linked', () => {
  assert.equal(scripts.length, 5);
  scripts.forEach(script => assert.doesNotThrow(() => new vm.Script(script)));
  assert.ok(html.includes('href="design-refresh.css"'));
  assert.ok(html.includes('href="app-shell.css"'));
});

test('active panel is not hidden by the legacy higher-specificity CSS rule', () => {
  assert.match(legacy, /\.hub-main\.active\s*\{\s*display:\s*block/);
  assert.ok(shell.includes(').hub-main.active {\n  display: block;'));
  assert.ok(shell.includes('#app-workspace > .hub-main:not(.active) { display: none; }'));
});

function createElement(id) {
  const state = new Set();
  return {
    id, attrs: {}, events: {}, dataset: {},
    classList: {
      add(key) { state.add(key); },
      remove(key) { state.delete(key); },
      toggle(key, enabled) { enabled ? state.add(key) : state.delete(key); },
      contains(key) { return state.has(key); }
    },
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    addEventListener(key, fn) { this.events[key] = fn; },
    focus() { this.focused = true; }
  };
}

test('desktop, mobile, back navigation and Escape all select the correct panel', () => {
  const panels = panelIds.map(id => createElement(id));
  const labels = [
    'Sensitivity Studio', 'Combat DB', 'Combat Lab', 'Recoil Analyzer', 'Attachments', 'Tactical Loadout & Gear'
  ];
  const buttons = panelIds.map((id, i) => {
    const button = createElement('button-' + id);
    button.dataset.openPanel = id;
    button.querySelector = () => ({ textContent: labels[i] });
    return button;
  });
  const nodes = Object.fromEntries([
    'mobile-nav-toggle', 'sidebar-scrim', 'active-tool-heading',
    'active-tool-index'
  ].map(id => [id, createElement(id)]));
  const body = createElement('body');
  const document = {
    body, events: {},
    querySelectorAll(selector) {
      if (selector === '.hub-main') return panels;
      if (selector === '#app-toolnav [data-open-panel]') return buttons;
      throw Error('Unexpected selector: ' + selector);
    },
    getElementById(id) { return nodes[id] || panels.find(p => p.id === id); },
    addEventListener(type, handler) { this.events[type] = handler; }
  };
  const location = { hash: '' };
  const history = { pushState(_data, _title, fragment) { location.hash = fragment; } };
  const window = {
    innerWidth: 1200,
    events: {},
    scrollTo() {},
    addEventListener(type, handler) { this.events[type] = handler; }
  };
  vm.runInNewContext(scripts[0], { document, window, location, history });
  // Blank URL must open directly to the new first tool.
  assert.deepEqual(panels.filter(p => p.classList.contains('active')).map(p => p.id), ['panel-sensitivity']);
  assert.equal(buttons[0].attrs['aria-current'], 'page');
  assert.equal(nodes['active-tool-heading'].textContent, 'Sensitivity Studio');
  assert.equal(nodes['active-tool-index'].attrs['aria-label'], 'Tool 1 of 6');
  assert.equal(location.hash, '', 'Default landing should not add a URL fragment');

  for (const [i, id] of panelIds.entries()) {
    buttons[i].events.click();
    assert.deepEqual(panels.filter(p => p.classList.contains('active')).map(p => p.id), [id]);
    assert.equal(buttons[i].attrs['aria-current'], 'page');
    assert.equal(location.hash, '#' + id);
  }
  nodes['mobile-nav-toggle'].events.click();
  assert.equal(body.classList.contains('sidebar-open'), true);
  document.events.keydown({ key: 'Escape' });
  assert.equal(body.classList.contains('sidebar-open'), false);
  location.hash = '#panel-ttk';
  window.events.popstate();
  assert.equal(panels.find(p => p.id === 'panel-hit-zone').classList.contains('active'), true);
});

// Explicitly regress the three Combat anchors that used to open the Scope tab.
test('Combat sub-anchor hashes select Combat rather than Scope',()=>{
  const nav = fs.readFileSync(path.join(root,'js/app-navigation.js'),'utf8');
  for(const key of ['combat-database','compare-weapons','how-thresholds-work']){
    assert.match(nav,new RegExp("'"+key+"'"));
    assert.match(html,new RegExp('id="'+key+'"'));
  }
  assert.match(nav,/return combatAnchors\.has\(id\)\?'panel-combat'/);
  assert.match(nav,/window\.addEventListener\('load'/);
  assert.match(nav,/scrollCombatAnchor\(id\)/);
});
