// Run with: node --test tests/sticky-header.test.cjs
// Dependency-free regression test for the weapon database's sticky heading dock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const root = resolve(__dirname, '..');
const html = require('./toolkit-test-source.cjs')();
const stylesheet = readFileSync(resolve(root, 'app-shell.css'), 'utf8');
const script = readFileSync(resolve(root, 'sticky-weapon-header.js'), 'utf8');

test('sticky header loads and preserves the full original weapon database', () => {
  assert.match(html, /<table id="wTable"><\/table>/);
  assert.match(html, /<script src="sticky-weapon-header\.js" defer><\/script>/);
  assert.match(stylesheet, /#weapon-table-sticky-header\[hidden\]\s*\{\s*display:\s*none !important/);
  assert.match(stylesheet, /#weapon-table-sticky-header\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(stylesheet, /z-index:\s*94/);
  assert.doesNotThrow(() => new vm.Script(script));
});

function element(tag, id = '') {
  const classes = new Set();
  const attrs = {};
  const events = {};
  return {
    tagName: tag.toUpperCase(), id, attrs, events,
    hidden: false, children: [], style: {
      setProperty(key, value) { this[key] = value; }
    },
    scrollLeft: 0,
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
      contains(value) { return classes.has(value); }
    },
    setAttribute(key, value) { attrs[key] = value; },
    addEventListener(key, callback) { events[key] = callback; },
    appendChild(node) { this.children.push(node); return node; },
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    getBoundingClientRect() { return this.rect || { top:0,left:0,right:0,bottom:0,width:0,height:0 }; },
    cloneNode() { return element(this.tagName); }
  };
}

test('headings follow vertical scroll, horizontal scroll and hide after the table', () => {
  const group = element('tr'), names = element('tr');
  group.rect = {height:30};
  names.rect = {height:48};
  names.cells = Array.from({ length: 3 }, () => {
    const cell = element('th'); cell.rect = {width:120}; return cell;
  });
  const originalSort = element('th');
  originalSort.dataset = {key:'name'};
  let sorts = 0;
  originalSort.click = () => { sorts++; };

  const table = element('table','wTable');
  table.rect = {top:300,bottom:1400,width:360,left:240,right:600};
  table.querySelector = selector => ({
    'tr.grouprow':group,
    'tr.colheader':names
  })[selector] || null;
  table.querySelectorAll = selector => selector==='tr.colheader th[data-key]'
    ? [originalSort] : [];
  const scroller = element('div');
  scroller.rect = {left:240,right:600,width:360};
  table.parentElement = scroller;

  const panel = element('div','panel-combat');
  panel.classList.add('active');
  const topbar = element('header','app-topbar');
  topbar.rect = {bottom:86};
  const body = element('body');
  const document = {
    body,
    getElementById(id) {
      return ({wTable:table,'panel-combat':panel,'app-topbar':topbar})[id];
    },
    createElement(tag) { return element(tag); }
  };
  const window = {
    innerWidth:1200,
    events:{},
    addEventListener(key, callback) { this.events[key] = callback; }
  };
  const observers = [];
  class MutationObserver {
    constructor(callback) {this.callback=callback; observers.push(this);}
    observe(target) {this.target=target;}
  }
  class ResizeObserver {
    constructor(callback) {this.callback=callback;}
    observe() {}
  }
  vm.runInNewContext(script,{
    document,window,MutationObserver,ResizeObserver,
    requestAnimationFrame(callback){callback();}
  });
  const dock = body.children.find(child => child.id === 'weapon-table-sticky-header');
  assert.ok(dock,'dock should be added to the page');
  assert.equal(dock.hidden, true,'dock hidden before reaching database');

  table.rect.top = -40;
  scroller.scrollLeft = 75;
  window.events.scroll();
  assert.equal(dock.hidden,false,'dock visible once headings scroll above topbar');
  assert.equal(dock.style.top,'86px');
  assert.equal(dock.style.left,'240px');
  assert.equal(dock.style.width,'360px');
  assert.equal(dock.children[0].scrollLeft,75,'horizontal alignment follows table');

  const mirroredSortable = element('th');
  mirroredSortable.dataset = {key:'name'};
  dock.events.click({target:{closest:()=>mirroredSortable}});
  assert.equal(sorts,1,'mirrored heading uses original sort handler');

  panel.classList.remove('active');
  observers.find(o=>o.target===panel).callback();
  assert.equal(dock.hidden,true,'dock hidden when leaving the combat panel');
  panel.classList.add('active');
  table.rect.bottom=100;
  window.events.scroll();
  assert.equal(dock.hidden,true,'dock hidden after scrolling beyond database');
});
