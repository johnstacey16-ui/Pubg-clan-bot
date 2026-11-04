// Vercel Web Analytics smoke tests for this plain HTML/JS site.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script } = require('node:vm');

const html = require('./toolkit-test-source.cjs')();

test('installs exactly one first-party Vercel Analytics script in the document head', () => {
  const tag = '<script defer src="/_vercel/insights/script.js"></script>';
  assert.equal(html.split(tag).length - 1, 1, 'Script must only be injected once');
  const headEnd = html.indexOf('</head>');
  const bodyStart = html.indexOf('<body');
  assert.ok(headEnd > 0 && bodyStart > headEnd, 'Expected valid head/body structure');
  assert.ok(html.indexOf(tag) > html.indexOf('<head>') && html.indexOf(tag) < headEnd,
    'Analytics must be loaded once in the head');
  assert.ok(tag.includes('defer'), 'Analytics must not block page parsing');
  assert.doesNotMatch(html, /@vercel\/analytics\/next|@vercel\/analytics\/react|<Analytics\s*\/>/,
    'This is a static HTML project, not a React/Next app');
});

test('keeps all five original inline JavaScript sections and custom maths intact', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.equal(scripts.length, 5, 'Do not alter existing calculator script structure');
  scripts.forEach((script, i) => assert.doesNotThrow(() => new Script(script), 'script ' + i));
  for (const fn of ['pixelSpeed', 'matchedSens', 'shotgunMinShellsAt', 'dropAtRange']) {
    assert.match(html, new RegExp('function ' + fn + '\\('));
  }
  assert.match(html, /id="panel-sensitivity"/);
  assert.match(html, /id="panel-backpack"/);
  assert.match(html, /id="panel-combat"/);
});
