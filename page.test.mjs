// page.test.mjs: the live page gated (the lesson of a page that stopped parsing while every kernel stayed green):
// page.mjs parses as a module, every name it imports exists, every element it reaches for is on the page, no id twice,
// every file it fetches is in the repository, the page carries the six parts a stranger needs, the counts its prose states
// are the code's, and every kind of match the G3 receipt names has a reading on the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { CLASSES } from './src/leak.mjs';
import { TARGETS } from './src/notes.mjs';

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
  for (const id of ['b-dl', 'b-honest', 'b-drift', 'b-check', 'c-people', 'c-sessions', 'c-weeks', 'c-cost', 'c-years', 'c-chars', 'c-sources', 'gates', 'receipt-tc', 'receipt-notes', 'notes-status', 'notes-run', 'failures', 'walks', 'sizes', 'own-machine']) assert.ok(ids.includes(id), id);
  for (const cls of ['made-on', 'tier-nano', 'tier-core', 'tier-state', 'sections62', 'corpus']) assert.ok(html.includes('class="' + cls + '"'), cls + ' on the page');
  for (const sel of ["'.made-on'", "'.sections62'", "'.tier-' + t", "'.corpus'"]) assert.ok(js.includes(sel), sel + ' filled by the script');
});

test('every file the page fetches is in the repository', () => {
  const fetched = [...js.matchAll(/'((?:vendor|data|receipts|local|keys|tokens)\/[^']+\.(?:json|txt))'/g)].map((m) => m[1]);
  assert.ok(fetched.length >= 7, 'the page fetches its records');
  for (const f of ['keys/kar.json', 'claims.json', 'claims-timecase.json', 'claims-notes.json', 'claims-trust.json', 'manifest.json', 'sw.js', 'icon.svg', 'page.mjs', 'style.css', 'boot-note.js',
    'receipts/passport.json', 'receipts/timecase.json', 'receipts/notes.json', 'receipts/trust.json', ...fetched,
    'vendor/symbfer/symbeyond/LICENSE', 'vendor/symbfer/teslasolar/source/LICENSE', ...['v6.2', 'v3.0', 'nano', 'core', 'state'].map((s) => 'tokens/public.' + s + '.txt')]) assert.ok(existsSync(join(ROOT, f)), f);
  for (const [, href] of html.matchAll(/href="([^"#:]+)"/g)) assert.ok(existsSync(join(ROOT, href)), 'link ' + href);
  assert.ok(html.includes('<script type="module" src="page.mjs"></script>'));
  assert.ok(html.includes('<script src="boot-note.js"></script>') && readFileSync(join(ROOT, 'boot-note.js'), 'utf8').includes('window.__kpStarted') && js.includes('window.__kpStarted = true'), 'the boot guard');
});

test('the content security policy: this site\'s own files only, no inline script, no inline style, no handler attributes', () => {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
  assert.ok(m, 'a content security policy');
  assert.ok(html.indexOf(m[0]) < html.indexOf('<link') && html.indexOf(m[0]) < html.indexOf('<script'), 'before anything it governs');
  const csp = Object.fromEntries(m[1].split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  for (const d of ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src', 'worker-src', 'manifest-src']) assert.deepEqual(csp[d], ["'self'"], d);
  for (const d of ['object-src', 'base-uri', 'form-action']) assert.deepEqual(csp[d], ["'none'"], d);
  assert.ok(!/unsafe-|\*|https?:|data:|blob:/.test(m[1]), 'nothing wider than self');
  assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(html), 'no inline script');
  assert.ok(!/<style[\s>]/.test(html), 'no inline style block');
  for (const src of [html, js]) {
    assert.ok(!/\sstyle="/.test(src), 'no style attribute');
    assert.ok(!/<[a-z][^>]*\son[a-z]+=/i.test(src), 'no handler attribute');
    assert.ok(!/javascript:/i.test(src), 'no javascript: link');
  }
  assert.ok(!/\beval\(|new Function\(/.test(js), 'no eval in the page script');
});

test('the offline cache holds every file the page needs, from the first visit', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const shell = new Function('return ' + /const SHELL = (\[[\s\S]*?\]);/.exec(sw)[1])();
  assert.ok(/addEventListener\('install'[^\n]*addAll\(SHELL/.test(sw), 'the shell is cached on install');
  for (const f of shell) assert.ok(f === './' || existsSync(join(ROOT, f)), f + ' is in the repository');
  assert.equal(new Set(shell).size, shell.length, 'no file twice');
  // what the page needs: the files index.html loads, page.mjs and every module it imports (transitively), every file it fetches
  const need = new Set(['./']), walk = (rel) => {
    if (need.has(rel)) return;
    need.add(rel);
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const [, to] of src.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+'(\.{1,2}\/[^']+)'/gm)) walk(relative(ROOT, join(ROOT, dirname(rel), to)).replace(/\\/g, '/'));
  };
  for (const [, f] of html.matchAll(/<(?:link|script)[^>]+(?:href|src)="([^"#:]+)"/g)) if (f.endsWith('.mjs')) walk(f); else need.add(f);
  for (const [, f] of js.matchAll(/'((?:vendor|data|receipts|local|keys|tokens)\/[^']+\.(?:json|txt))'/g)) need.add(f);
  for (const [, f] of js.matchAll(/get\('([a-z-]+\.json)'\)/g)) need.add(f);
  for (const s of ['v6.2', 'v3.0', 'nano', 'core', 'state']) need.add('tokens/public.' + s + '.txt');
  assert.ok(need.size >= 30, 'the page needs its modules and records');
  for (const f of need) assert.ok(shell.includes(f), f + ' is cached on install');
});

test('the page explains itself: what it is, start here, how it works, blueprint, adoption, white paper, and the credits', () => {
  for (const id of ['what', 'start', 'try', 'how', 'blueprint', 'proof', 'business', 'paper', 'faq']) assert.ok(html.includes('<section id="' + id + '"'), id);
  for (const s of ['SYMBEYOND AI LLC', 'Powered by the Konomi architecture, created by Thomas Frumkin', 'AI Native Solutions', 'teslasolar', 'Risks, answered straight', 'The case for the board',
    'Gate status, organ by organ', 'Where every figure comes from', 'Buyer walkthroughs', '<b>Exit.</b>', 'liability', 'CEO or owner', 'CFO and finance', 'COO and operations', 'CTO / CISO', 'Procurement', 'The teams',
    'Deployment and roll-out', 'Supplier, support and ownership', 'Check the proof yourself', 'What your notes look like', 'node kar/passport.mjs key &gt; keys/kar.json', 'node kar/passport.mjs notes', '<b>Sub-processors.</b>', 'A colleague\'s passport', 'node kar/passport.mjs trust &lt;their file&gt;', 'untrust', 'Is the page accessible?']) assert.ok(html.includes(s), s);
  assert.ok(html.includes('<svg') && html.includes('class="diagram"'), 'the diagram, in its scroller');
});

test('the counts the page states in words are the code\'s', () => {
  const words = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const sources = JSON.parse(readFileSync(join(ROOT, 'vendor', 'SOURCES.json'), 'utf8')).files;
  const claimsOf = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8')).claims.length;
  const shapes = ['v6.2', 'v3.0', 'nano', 'core', 'state'].filter((s) => existsSync(join(ROOT, 'tokens', 'public.' + s + '.txt'))).length;
  const stated = [
    [/\beight kinds of leak/i, CLASSES.length], [/\b8 kinds of leak/, CLASSES.length], [/\bthree slices/i, TARGETS.length], [/\bfive shapes/i, shapes],
    [/\btwo fall-kit modules/, sources.filter((x) => x.repo === 'sjgant80-hub/fall-kit').length],
    [/cost section has two claims of its own/, claimsOf('claims-timecase.json')], [/notes<\/a> have two claims of their own|own machine<\/a> have two claims of their own/, claimsOf('claims-notes.json')],
    [/(?<=handover between two people has )\w+(?= claims of its own)/, claimsOf('claims-trust.json')], [/(?<=then Kar playing four, )\w+(?= times)/, ['walk-2026-11-04', 'walk-2026-11-05', 'walk-2026-11-05b', 'walk-2026-11-06'].filter((w) => existsSync(join(ROOT, 'local', w + '.json'))).length],
  ];
  for (const [re, n] of stated) {
    assert.ok(re.test(html), 'the page states ' + re);
    const said = (re.exec(html)[0].match(/\b(\d+|none|one|two|three|four|five|six|seven|eight|nine|ten)\b/i) || [])[1];
    assert.equal(/^\d+$/.test(said) ? Number(said) : words.indexOf(said.toLowerCase()), n, re + ' against the code');
  }
});

test('every kind of match the G3 receipt names has a plain reading on the page', () => {
  const m = /const G3_READ = (\[[\s\S]*?\n\]);/.exec(js);
  assert.ok(m, 'G3_READ in page.mjs');
  const read = new Function('return ' + m[1])();
  assert.equal(read.length, CLASSES.length, 'one reading per kind, in the order of CLASSES');
  assert.ok(read.every((r) => Array.isArray(r) && r.length === 2 && r.every((x) => typeof x === 'string') && r[1].length > 20), 'each a plain label and a reading');
  const g3 = JSON.parse(readFileSync(join(ROOT, 'receipts', 'passport.json'), 'utf8')).facts.G3;
  const kinds = new Set(g3.where.flatMap((w) => w.replace(/^[^:]*:\s*/, '').split(',').map((h) => h.split('@')[0])));
  for (const k of kinds) assert.ok(CLASSES.includes(k) && read[CLASSES.indexOf(k)], k + ' has a reading');
});
