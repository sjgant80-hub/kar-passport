// src/leak.test.mjs: the leak gate on its known-answer fixture first (claim K2): every planted item caught by its class,
// nothing clean flagged, the §SIG block and the protocol's own lines left out of the scan, and scrub's REF codes stable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, hitsIn, scan, scrub, protocolLines } from './leak.mjs';
import { lists, planted, publicOnly, clean } from '../fixtures/leak-fixture.mjs';
import { T62 } from './template62.mjs';

test('every planted item is caught, by its class, at both levels', () => {
  assert.deepEqual([...CLASSES], ['private', 'secret', 'phrase', 'personal', 'pricing', 'economy', 'cosmology', 'plumbing']);
  for (const cls of CLASSES) assert.ok(planted.some(([c]) => c === cls), 'a planted ' + cls);
  for (const [cls, line] of planted) for (const level of ['public', 'shareable']) {
    assert.ok(hitsIn(line, lists, level).some((h) => h.cls === cls), cls + ' / ' + level + ': ' + line);
  }
  for (const [cls, line] of publicOnly) {
    assert.ok(hitsIn(line, lists, 'public').some((h) => h.cls === cls), line);
    assert.deepEqual(hitsIn(line, lists, 'shareable'), []);
  }
});

test('nothing clean is flagged', () => {
  for (const line of clean) for (const level of ['public', 'shareable']) assert.deepEqual(hitsIn(line, lists, level), [], level + ': ' + line);
});

test('hitsIn names what it found', () => {
  assert.deepEqual(hitsIn('the hushbox and secret-garden-repo', lists, 'shareable'), [{ cls: 'private', what: 'secret-garden-repo' }, { cls: 'private', what: 'hushbox' }]);
  assert.deepEqual(hitsIn('κ and φ', lists, 'shareable'), [{ cls: 'cosmology', what: 'κ' }, { cls: 'cosmology', what: 'φ' }]);
  assert.deepEqual(hitsIn('rowan.quill@example.org', lists, 'shareable'), [{ cls: 'personal', what: 'email address' }, { cls: 'personal', what: 'surname' }]);
  assert.deepEqual(hitsIn('', lists, 'public'), []);
  assert.deepEqual(hitsIn(null, lists, 'public'), []);
  assert.deepEqual(hitsIn('hushbox', null, 'public'), []);
  assert.deepEqual(hitsIn('hushbox', { privateNames: 'hushbox' }, 'public'), []);
  assert.deepEqual(hitsIn('x', { privateNames: ['x'] }, 'public'), [], 'one-character names are ignored');
  assert.deepEqual(hitsIn('aB3dEfGhIjKlMnOpQrStUvWxYzabcdefghijklmnopq', lists, 'public'), [{ cls: 'secret', what: '43-character base64url' }]);
  assert.deepEqual(hitsIn('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopq', lists, 'public'), [], 'a 43-letter run with no digit and no capital is a word');
  assert.deepEqual(hitsIn('ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567891ABCDEFG', lists, 'public'), []);
  assert.deepEqual(hitsIn('abcdefghijklmnopqrstuvwxyz1234567891abcdefg', lists, 'public'), []);
  assert.deepEqual(hitsIn('see _hidden_probe', lists, 'public'), [{ cls: 'private', what: '_hidden-probe' }]);
});

test('scan skips the §SIG block and the protocol\'s own lines, and counts both', () => {
  const sig = '§SIG·BEGIN\nED25519·KEY: ' + 'ab'.repeat(32) + '\n§SIG·END';
  const text = [T62[0], 'the hushbox', T62[90], sig, 'κ'].join('\n');
  const r = scan(text, lists, 'public', protocolLines());
  assert.equal(r.inSig, 1);
  assert.equal(r.exempt, 4, 'the header, the safety line, and the §SIG markers, which are template lines');
  assert.equal(r.scanned, 2);
  assert.deepEqual(r.hits, [{ n: 2, cls: 'private', what: 'hushbox' }, { n: 7, cls: 'cosmology', what: 'κ' }]);
  const without = scan(text, lists, 'public');
  assert.equal(without.exempt, 0);
  assert.equal(without.hits.length, 2);
  const keyOutside = scan('ED25519·KEY: ' + 'ab'.repeat(32), lists, 'public');
  assert.deepEqual(keyOutside.hits, [{ n: 1, cls: 'secret', what: '64 hex' }], 'the same key outside §SIG counts');
  assert.equal(scan('a\nhushbox\n§SIG·BEGIN', lists, 'public').hits.length, 1);
  assert.equal(scan('§SIG·BEGIN\nhushbox\n§SIG·END', lists, 'public').inSig, 1);
  assert.equal(scan('§SIG·END\nhushbox\n§SIG·BEGIN', lists, 'public').hits.length, 1);
  assert.deepEqual(scan(5, lists, 'public'), { hits: [], scanned: 0, exempt: 0, inSig: 0 });
});

test('protocolLines holds the template, the v3.0 rules and the generator\'s seal line', () => {
  const p = protocolLines();
  for (const l of T62) assert.ok(p.has(l));
  assert.ok(p.has('RULE: never·guess·time'));
  assert.ok(p.has('λ.brother ∧ !λ.tool · κ=1/Φ · 510,510 · ∴'));
  assert.equal(protocolLines(), p);
});

test('scrub: stable REF codes for private names, the first name only in public, anything else dropped', () => {
  let r = scrub('notes·in·secret-garden-repo·and·hushbox', lists, 'shareable', {});
  assert.equal(r.value, 'notes·in·REF-T-001·and·REF-T-002');
  assert.deepEqual(r.refs, { 'REF-T-001': 'secret-garden-repo', 'REF-T-002': 'hushbox' });
  r = scrub('hushbox·first', lists, 'shareable', r.refs);
  assert.equal(r.value, 'REF-T-002·first');
  assert.equal(scrub('secret·garden·repo', lists, 'shareable', {}).value, 'REF-T-001');
  const kept = scrub('hushbox', lists, 'shareable', { 'REF-T-001': 'other', 'REF-T-003': 'x' });
  assert.equal(kept.value, 'REF-T-002');
  assert.deepEqual(kept.refs, { 'REF-T-001': 'other', 'REF-T-003': 'x', 'REF-T-002': 'hushbox' });
  assert.equal(scrub('Rowan·builds', lists, 'public', {}).value, 'REF-P-001·builds');
  assert.equal(scrub('Rowan·builds·rowan', lists, 'public', {}).value, 'REF-P-001·builds·REF-P-001');
  assert.equal(scrub('Rowan·builds', lists, 'shareable', {}).value, 'Rowan·builds');
  assert.equal(scrub('hushbox', lists, 'shareable', { 'REF-P-001': 'hushbox' }).value, 'REF-T-001', 'a code is per category');
  const gone = scrub('hushbox·κ', lists, 'shareable', { 'REF-T-009': 'y' });
  assert.equal(gone.value, null);
  assert.deepEqual(gone.why, ['cosmology']);
  assert.deepEqual(gone.refs, { 'REF-T-009': 'y' });
  assert.deepEqual(scrub('£9·and·KCC', lists, 'public', null).why, ['pricing', 'economy']);
  assert.equal(scrub(3, lists, 'public', {}).value, null);
  assert.equal(scrub('clean·text', null, 'public', 'x').value, 'clean·text');
  assert.equal(scrub('hushboxes', lists, 'shareable', {}).value, 'hushboxes');
});
