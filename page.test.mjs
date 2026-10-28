// page.test.mjs: the live page gated (the lesson of a page that stopped parsing while every kernel stayed green):
// page.mjs parses as a module, every name it imports exists, every element it reaches for is on the page, no id twice,
// every file it fetches is in the repository, and the page carries the six parts a stranger needs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname;
const html = readFileSync(join(ROOT, 'index.html'), 'utf8'), js = readFileSync(join(ROOT, 'page.mjs'), 'utf8');

test('page.mjs parses, and every name it imports exists in its module', async () => {
  const imports = [...js.matchAll(/^import \{([^}]+)\} from '([^']+)';$/gm)];
  assert.ok(imports.length >= 9);
  for (const [, names, from] of imports) {
    const mod = await import(new URL(from, 'file:///' + ROOT.replace(/\\/g, '/') + '/').href);
    for (const n of names.split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) assert.ok(n in mod, n + ' from ' + from);
  }
  assert.doesNotThrow(() => new Function(js.replace(/^import .*$/gm, '').replace(/\bawait\b/g, '')));
});

test('every element the script reaches for exists, and no id is used twice', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const [, id] of js.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), id);
  for (const id of ['b-dl', 'b-honest', 'b-drift', 'b-check', 'c-people', 'c-sessions', 'c-weeks', 'c-cost']) assert.ok(ids.includes(id), id);
});

test('every file the page fetches is in the repository', () => {
  for (const f of ['keys/kar.json', 'claims.json', 'manifest.json', 'sw.js', 'icon.svg', 'page.mjs', ...['v6.2', 'v3.0', 'nano', 'core', 'state'].map((s) => 'tokens/public.' + s + '.txt')]) assert.ok(existsSync(join(ROOT, f)), f);
  assert.ok(html.includes('<script type="module" src="page.mjs"></script>'));
  assert.ok(html.includes('window.__kpStarted') && js.includes('window.__kpStarted = true'), 'the boot guard');
});

test('the page explains itself: what it is, start here, how it works, blueprint, adoption, white paper, and the credits', () => {
  for (const id of ['what', 'start', 'try', 'how', 'blueprint', 'proof', 'business', 'paper', 'faq']) assert.ok(html.includes('<section id="' + id + '"'), id);
  for (const s of ['SYMBEYOND AI LLC', 'Powered by the Konomi architecture, created by Thomas Frumkin', 'AI Native Solutions', 'teslasolar', 'Risks, answered straight', 'The case for the board']) assert.ok(html.includes(s), s);
});
