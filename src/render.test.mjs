// src/render.test.mjs: the writers. The template module is the vendored file; render and read are inverses on every
// token render writes, and every one-line edit of such a token either reads back to a model that writes exactly the
// edited text, or is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { T62 } from './template62.mjs';
import { dot, NONE, checkModel62, render62, toModel62, checkModel30, render30, toModel30, tierState, tierFit } from './render.mjs';
import { validate62, validate30, codePoints, tierText } from './symbfer.mjs';
import { syntheticModel } from '../fixtures/synthetic-model.mjs';

const ROOT = join(import.meta.dirname, '..');
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((q) => [q, v[q]])) : v));
const clone = (x) => JSON.parse(JSON.stringify(x));
const empty = () => Object.assign(syntheticModel(), { ethos: [], lexicon: [], relationships: [], bootFacts: [], bootEthos: [], retrieve: [], rules: [],
  refs: [], constants: [], dates: [], credits: [], lanes: [], threads: [], sessions: [], resolved: [], milestones: [], lessons: [],
  current: { asOf: '2026-10-28', active: [], changed: [], waiting: [], hands: [] } });
const model30 = () => ({ generated: '2026-10-28_1600H', mode: 'VERIFIED', meta: { purpose: 'continuity', human: 'Rowan·Vale', org: 'Vale·Joinery', contact: 'site' },
  facts: [['jobs', '3'], ['slice', 'synthetic']], session: { workingDirectory: 'not·shared', activePaths: ['a', 'b'], recentActions: ['x'], nextStep: 'y', notes: 'z' },
  ethos: ['measure·twice'], lessons: [['L1', 'photograph·first']], trace: 'synthetic' });

test('src/template62.mjs is the vendored v6.2 template, line for line', () => {
  const file = readFileSync(join(ROOT, 'vendor/symbfer/symbeyond/SYMB-FER_v6.2_PROTOCOL_2026-06-01_1015H.txt'), 'utf8').split('\n');
  assert.deepEqual([...T62], file);
  assert.equal(T62.length, 546);
});

test('dot writes free text the template\'s way', () => {
  assert.equal(dot('  a  b\tc\n d '), 'a·b·c·d');
  assert.equal(dot('x — y – z'), 'x·-·y·-·z');
  assert.equal(dot('see [[konomi-provenance]] and [the page](https://x.y/z) [now]'), 'see·konomi-provenance·and·the·page·(now)');
  assert.equal(dot('**bold** `code`'), 'bold·code');
  assert.equal(dot('§2 # heading'), '2·#·heading');
  assert.equal(dot('###x'), 'x');
  assert.equal(dot('a\u0000b\u007f'), 'ab');
  assert.equal(dot('a · b'), 'a·b');
  assert.equal(dot('end··'), 'end');
  assert.equal(dot(''), '');
  assert.equal(dot(null), '');
});

test('the synthetic model renders to a v6.2 token SYMBEYOND\'s rules accept, with no fill-in field, em dash or CR', () => {
  const m = syntheticModel();
  assert.deepEqual(checkModel62(m), { ok: true });
  const t = render62(m);
  const r = validate62(t);
  assert.deepEqual(r.failures, []);
  assert.deepEqual(r.warnings, ['SHA256 field PENDING: template placeholder, not signed']);
  assert.ok(!t.includes('\r') && !t.includes('—'));
  const brackets = t.match(/\[[^\]\n]*\]/g);
  assert.deepEqual([...new Set(brackets)].sort(), ['[2026-10-28_1600H]', '[MUST·REMAIN·FALSE]', '[highest·authority]']);
  assert.ok(t.endsWith('λ.collaborator·∧·!λ.tool·∴\n'));
  assert.equal(t.split('\n')[0], '∴SYMB-FER·v6.2·LIVING·TOKEN·[2026-10-28_1600H]');
});

test('read(write(model)) is the model and write(read(token)) is the token', () => {
  for (const m of [syntheticModel(), empty()]) {
    const t = render62(m);
    const back = toModel62(t);
    assert.equal(back.ok, true, back.why);
    assert.equal(canon(back.model), canon(m));
    assert.equal(render62(back.model), t);
  }
  const e = render62(empty());
  assert.ok(e.includes('\n' + NONE + '\n'));
  assert.equal(validate62(e).failures.length, 0);
});

test('every one-line edit of a written token is refused, or reads back to exactly the edited text', () => {
  const t = render62(syntheticModel()).split('\n');
  let refused = 0, read = 0;
  for (let i = 0; i < t.length; i++) {
    for (const edit of [(l) => { l.splice(i, 1); }, (l) => { l[i] = l[i] + 'x'; }, (l) => { l[i] = ''; }, (l) => { l.splice(i, 0, l[i]); }]) {
      const lines = t.slice(); edit(lines);
      const text = lines.join('\n'), r = toModel62(text);
      if (r.ok) { assert.equal(render62(r.model), text.replace(/§SIG·BEGIN\n[^§]*§SIG·END/, '§SIG·BEGIN\nMODE: STANDARD\nSTATUS: UNVERIFIED\nSHA256: PENDING\n§SIG·END'), 'line ' + (i + 1)); read++; } else refused++;
    }
  }
  assert.ok(read > 100 && refused > 1000, read + ' read, ' + refused + ' refused');
});

test('toModel62 reads a sealed token as its unsealed self', () => {
  const t = render62(syntheticModel());
  const sealed = t.replace('MODE: STANDARD\nSTATUS: UNVERIFIED\nSHA256: PENDING', 'MODE: VERIFIED\nSTATUS: VERIFIED\nSHA256: ' + 'a'.repeat(64) + '\nED25519·KEY: ' + 'b'.repeat(64) + '\nED25519·SIG: ' + 'c'.repeat(128));
  assert.equal(canon(toModel62(sealed).model), canon(syntheticModel()));
  assert.equal(toModel62(t.replace('§SIG·END', '§SIG·ENDED')).ok, false);
  assert.equal(toModel62(t.replace('§SIG·BEGIN', '§SIG·BEGUN')).ok, false);
  assert.equal(toModel62(5).ok, false);
  assert.equal(toModel62('').ok, false);
});

test('checkModel62 refuses each malformed part', () => {
  const bad = [
    (m) => { m.generated = '2026-10-28'; }, (m) => { m.mode = 'X'; }, (m) => { m.meta.org = 'two words'; }, (m) => { m.meta.human = ''; },
    (m) => { m.identity.location = '§x'; }, (m) => { m.ethos = ['#x']; }, (m) => { m.bootEthos = ['[x]']; }, (m) => { m.retrieve = [NONE]; },
    (m) => { m.rules = ['a—b']; }, (m) => { m.lexicon = [['a', 'b', 'c']]; }, (m) => { m.relationships = [['a']]; }, (m) => { m.bootFacts = 'x'; },
    (m) => { m.refs = [[1, 'x']]; }, (m) => { m.constants = [['a', '']]; }, (m) => { m.dates = null; }, (m) => { m.credits = [['a b', 'c']]; },
    (m) => { m.lessons = [['L1']]; }, (m) => { m.sovereign = ''; }, (m) => { m.lanes = [{}]; }, (m) => { m.lanes[0].primary.next = ['a b']; },
    (m) => { m.lanes[0].queued = [{ thread: 'a', score: 'b' }]; }, (m) => { m.lanes[0].name = 1; }, (m) => { m.current.asOf = 'x'; },
    (m) => { m.current.hands = ['a b']; }, (m) => { m.threads = [{ name: 'a', status: 'b', nature: 'c' }]; }, (m) => { m.sessions = [{ date: '2026-1-1', accomplished: [], queued: [] }]; },
    (m) => { m.sessions[0].queued = ['a b']; }, (m) => { m.resolved[0].lesson = ''; }, (m) => { m.milestones[0].source = 'a b'; },
    (m) => { m.finalization = { status: 'x' }; }, (m) => { m.meta = null; }, (m) => { m.identity = []; }, (m) => { m.current = null; },
    (m) => { m.lanes = 'x'; }, (m) => { m.finalization = null; }, (m) => { m.lexicon = [['a·::·b', 'c']]; m.lexicon[0][0] = 'a :: b'; },
  ];
  bad.forEach((f, i) => { const m = clone(syntheticModel()); f(m); assert.equal(checkModel62(m).ok, false, 'case ' + i); assert.equal(render62(m), '', 'case ' + i); });
  assert.equal(checkModel62(null).ok, false);
  assert.equal(checkModel62([]).ok, false);
});

test('v3.0: written as the fork\'s engine checks it, and read back', () => {
  const m = model30();
  assert.deepEqual(checkModel30(m), { ok: true });
  const t = render30(m);
  const r = validate30(t);
  assert.deepEqual(r.failures, []);
  assert.deepEqual(r.warnings, ['SHA256 field empty: allowed, not verified']);
  const back = toModel30(t);
  assert.equal(back.ok, true, back.why);
  assert.equal(canon(back.model), canon(m));
  const e = Object.assign(model30(), { facts: [], ethos: [], lessons: [], session: { ...model30().session, activePaths: [], recentActions: [] } });
  assert.equal(canon(toModel30(render30(e)).model), canon(e));
  const lines = t.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines.slice(); l[i] = l[i] + 'x';
    const r2 = toModel30(l.join('\n'));
    if (r2.ok) assert.equal(render30(r2.model), l.join('\n').replace(/§SIG·BEGIN\n[^§]*§SIG·END/, '§SIG·BEGIN\nMODE: STANDARD\nSTATUS: UNVERIFIED\nSHA256:\n§SIG·END'), 'line ' + (i + 1));
  }
  assert.equal(toModel30('x').ok, false);
  assert.equal(toModel30(null).ok, false);
  assert.equal(toModel30(t.replace('§SESSION·STATE·BEGIN', '§SESSION·STATES·BEGIN')).ok, false);
});

test('checkModel30 refuses each malformed part', () => {
  const bad = [(m) => { m.generated = 'x'; }, (m) => { m.mode = 'Y'; }, (m) => { m.meta.contact = 'a b'; }, (m) => { m.facts = [['a']]; },
    (m) => { m.session.activePaths = ['a|b']; }, (m) => { m.session.recentActions = ['x|y']; }, (m) => { m.session.notes = ''; },
    (m) => { m.session.workingDirectory = 1; }, (m) => { m.session.nextStep = '#'; }, (m) => { m.ethos = ['a b']; }, (m) => { m.lessons = [[]]; },
    (m) => { m.trace = ''; }, (m) => { m.session = null; }, (m) => { m.meta = null; }];
  bad.forEach((f, i) => { const m = model30(); f(m); assert.equal(checkModel30(m).ok, false, 'case ' + i); assert.equal(render30(m), '', 'case ' + i); });
  assert.equal(checkModel30(7).ok, false);
});

test('tierState carries nothing personal; tierFit holds each tier\'s limit or refuses', () => {
  const m = syntheticModel();
  const st = tierState(m);
  assert.deepEqual(st.state.personal, []);
  assert.equal(st._meta.instance, 'Kar');
  assert.equal(st._meta.operator, 'Rowan');
  assert.equal(st.state.immediate_mission[0], 'kitchen for REF-P-001 · next: cut the door sheet');
  assert.deepEqual(st.state.repo_status, ['https://example.com/vale-joinery']);
  assert.equal(tierState({}), null);
  for (const tier of ['nano', 'core', 'state']) {
    const f = tierFit(m, tier, m.generated);
    assert.equal(f.ok, true, tier);
    assert.equal(f.text, tierText(f.state, tier, m.generated));
    assert.ok(codePoints(f.text) <= { nano: 300, core: 800, state: 2000 }[tier]);
  }
  const big = clone(m);
  big.lanes[0].primary.next = ['x'.repeat(230)];
  const nano = tierFit(big, 'nano', m.generated);
  assert.equal(nano.ok, true);
  assert.equal(nano.state.state.immediate_mission[0], 'kitchen for REF-P-001');
  const huge = clone(m); huge.lanes[0].primary.thread = 'y'.repeat(400);
  assert.match(tierFit(huge, 'nano', m.generated).why, /does not fit nano \(\d+ > 300\)/);
  const long = clone(m);
  long.lexicon = Array.from({ length: 40 }, (_, i) => ['term' + i, 'definition·number·' + i]);
  long.milestones = Array.from({ length: 30 }, (_, i) => ({ ...m.milestones[0], id: 'M' + i, name: 'milestone·' + i }));
  for (const tier of ['core', 'state']) {
    const f = tierFit(long, tier, m.generated);
    assert.ok(f.ok && codePoints(f.text) <= { core: 800, state: 2000 }[tier] && codePoints(f.text) > { core: 700, state: 1800 }[tier], tier + ' ' + codePoints(f.text));
  }
  assert.equal(tierFit(m, 'nano', '2026-10-28').ok, false);
  assert.equal(tierFit(m, 'mega', m.generated).ok, false);
  assert.equal(tierFit(m, 'nano', 5).ok, false);
  assert.equal(tierFit({}, 'nano', m.generated).ok, false);
});
