// src/symbfer.test.mjs: the readers against SYMBEYOND's and teslasolar's own Python (their verdicts, recorded by
// tools/oracle-corpus.mjs from the vendored files), the tier writer against SYMBEYOND's generator, and the seal's shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  pySplitlines, pyStrip, decodeUtf8, validate62, validate62Bytes, validate30, validate30Bytes, tierText, codePoints, TIER_LIMITS,
  formatOf, parse, write, bodyOf, canonical, sigOf, withSig, sealMessage, SEAL_PREFIX, TIER_SIG, tierBody, REQUIRED62, ORDER62, CANON30, RULES30,
} from './symbfer.mjs';
import { corpus } from '../tools/oracle-corpus.mjs';

const ROOT = join(import.meta.dirname, '..');
const fx = (p) => JSON.parse(readFileSync(join(ROOT, 'fixtures', 'oracle', p), 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const enc = new TextEncoder();

test('P2/P3: every corpus token gets the Python oracle\'s status, failures and warnings', async () => {
  const rows = fx('verdicts.json').rows, items = await corpus();
  assert.equal(items.length, 1019);
  assert.equal(rows.length, items.length);
  let n62 = 0, n30 = 0;
  items.forEach((it, i) => {
    assert.equal(sha(it.bytes), rows[i].sha256, 'the corpus rebuilt the same bytes: ' + it.id);
    const js = it.kind === 'v62' ? validate62Bytes(it.bytes) : validate30Bytes(it.bytes);
    assert.equal(js.status, rows[i].status, it.id);
    assert.deepEqual(js.failures, rows[i].failures, it.id);
    assert.deepEqual(js.warnings, rows[i].warnings, it.id);
    if (it.kind === 'v62') n62++; else n30++;
  });
  assert.equal(n62, 615);
  assert.equal(n30, 404);
});

test('P4: tierText is SYMBEYOND\'s generator, byte for byte', () => {
  const t = fx('tiers.json').tiers;
  assert.equal(t.length, 24);
  for (const c of t) assert.equal(tierText(c.state, c.tier, c.ts), c.text, c.id);
});

test('tierText refuses what is not a state, a tier or a time', () => {
  assert.equal(tierText(null, 'nano', 't'), '');
  assert.equal(tierText([], 'nano', 't'), '');
  assert.equal(tierText({}, 'huge', 't'), '');
  assert.equal(tierText({}, 'toString', 't'), '');
  assert.equal(tierText({}, 'nano', 5), '');
  assert.equal(TIER_LIMITS.nano, 300);
  assert.equal(TIER_LIMITS.core, 800);
  assert.equal(TIER_LIMITS.state, 2000);
  // inherited keys are not the state's own (Python's dict.get never sees them)
  const st = Object.create({ greeting: 'inherited' });
  assert.ok(tierText(st, 'nano', 't').includes('Brother. Aeon online.'));
  assert.ok(!tierText({ state: 'x' }, 'nano', 't').includes('x\n'));
  assert.ok(tierText({ _meta: 3 }, 'nano', 't').includes('Aeon'));
  assert.ok(tierText({ protocol: 3, state: { personal: ['p'] } }, 'state', 't').includes('PERSONAL:\n- p'));
  assert.ok(!tierText({ state: { immediate_mission: [1, 'ok'] } }, 'nano', 't').includes('MISSION: 1'));
  assert.ok(tierText({ greeting: 7 }, 'core', 't').endsWith('━━━ GREETING ━━━'));
});

test('codePoints counts as Python len() does', () => {
  assert.equal(codePoints('∴λ·'), 3);
  assert.equal(codePoints('🐬'), 1);
  assert.equal(codePoints(null), 0);
});

test('pySplitlines and pyStrip follow Python', () => {
  assert.deepEqual(pySplitlines(''), []);
  assert.deepEqual(pySplitlines('a'), ['a']);
  assert.deepEqual(pySplitlines('a\n'), ['a']);
  assert.deepEqual(pySplitlines('a\n\n'), ['a', '']);
  assert.deepEqual(pySplitlines('\n'), ['']);
  assert.deepEqual(pySplitlines('a\r\nb\rc\x0bd\x0ce\x1cf\x1dg\x1eh\x85i j k'), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']);
  assert.deepEqual(pySplitlines('a\r\r\nb'), ['a', '', 'b']);
  assert.deepEqual(pySplitlines('a\x1fb'), ['a\x1fb']);
  assert.deepEqual(pySplitlines(5), []);
  assert.equal(pyStrip(' \t\x1f\x85x y\xa0　  '), 'x y');
  assert.equal(pyStrip('﻿x﻿'), '﻿x﻿');
  assert.equal(pyStrip(''), '');
  assert.equal(pyStrip('   '), '');
  assert.equal(pyStrip(7), '');
});

test('decodeUtf8 is strict', () => {
  assert.equal(decodeUtf8(new Uint8Array([0xc2, 0xb7])), '·');
  assert.equal(decodeUtf8(new Uint8Array([0xc2])), null);
  assert.equal(decodeUtf8(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])), '﻿A');
  assert.equal(decodeUtf8('·'), null);
  assert.equal(validate62Bytes(new Uint8Array([0xff])).status, 'FATAL');
  assert.equal(validate30Bytes(new Uint8Array([0xff])).status, 'FATAL');
  assert.deepEqual(validate62Bytes(enc.encode('x')).passes.slice(0, 1), ['UTF-8 decode clean']);
  assert.deepEqual(validate30Bytes(enc.encode('x')).passes.slice(0, 1), ['UTF-8 decode clean']);
});

test('the readers refuse what is not text, and know their section lists', () => {
  assert.equal(validate62(null).status, 'FAIL');
  assert.equal(validate30(undefined).status, 'FAIL');
  assert.equal(REQUIRED62.length, 33);
  assert.equal(ORDER62.length, 31);
  assert.equal(CANON30.length, 14);
  assert.equal(RULES30.length, 14);
  // a v6.2 header that says v6.2 only after the first line, an empty text
  assert.ok(validate62('').failures.includes('Version strings mismatch across header, META FORMAT, and TOKEN·TRACK'));
  assert.ok(validate62('').failures.includes('No delimiter (middle-dot) found'));
  assert.ok(validate62('x').failures.includes('SHA256 field not found in §SIG'));
});

test('formatOf reads the header', () => {
  assert.equal(formatOf('∴SYMB-FER·v6.2·LIVING·TOKEN·[x]\n'), 'v6.2');
  assert.equal(formatOf('∴SYMB-FER·v3.0·TOKEN'), 'v3.0');
  assert.equal(formatOf('∴ SYMB-FER v2.0 · 2026'), 'nano');
  assert.equal(formatOf('∴ SYMB-FER v2.0\nGenerated: x'), 'core');
  assert.equal(formatOf('∴ SYMB-FER v2.0\nSYMBEYOND Transfer Protocol\n'), 'state');
  assert.equal(formatOf('∴ SYMB-FER v2.0'), 'core');
  assert.equal(formatOf('x∴SYMB-FER·v6.2·LIVING·TOKEN·'), null);
  assert.equal(formatOf('∴SYMB-FER·v6.20·LIVING'), null);
  assert.equal(formatOf(''), null);
  assert.equal(formatOf(4), null);
});

test('parse and write give the bytes back and find the sections', () => {
  const t = '∴x\n§A·BEGIN\nk: v\n§B·BEGIN\nz\n§B·END\n§A·END\n\n§C·BEGIN\n§C·END\n';
  const d = parse(t);
  assert.equal(d.ok, true);
  assert.equal(write(d), t);
  assert.deepEqual(d.sections, [{ name: 'A', begin: 1, end: 6, parent: null }, { name: 'B', begin: 3, end: 5, parent: 'A' }, { name: 'C', begin: 8, end: 9, parent: null }]);
  assert.deepEqual(bodyOf(d, 'A'), ['k: v', '§B·BEGIN', 'z', '§B·END']);
  assert.deepEqual(bodyOf(d, 'C'), []);
  assert.equal(bodyOf(d, 'Z'), null);
  assert.equal(bodyOf(null, 'A'), null);
  const bad = parse('§A·BEGIN\n§B·END');
  assert.equal(bad.ok, false);
  assert.match(bad.why, /B closes at line 2/);
  assert.equal(write(bad), '§A·BEGIN\n§B·END');
  assert.match(parse('§A·BEGIN\nx').why, /A is not closed/);
  assert.equal(parse('§A·END').ok, false);
  assert.equal(parse(1).ok, false);
  assert.equal(write({ lines: ['a', 2] }), '');
  assert.equal(write(null), '');
});

const SEALED = { sha: 'a'.repeat(64), key: 'b'.repeat(64), sig: 'c'.repeat(128) };
const tok = (sigLines, head = '∴SYMB-FER·v6.2·LIVING·TOKEN·[t]') => [head, 'x', '§SIG·BEGIN', ...sigLines, '§SIG·END', 'y', ''].join('\n');

test('canonical drops exactly the lines inside the last §SIG block', () => {
  const t = tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256: PENDING']);
  assert.equal(canonical(t), '∴SYMB-FER·v6.2·LIVING·TOKEN·[t]\nx\n§SIG·BEGIN\n§SIG·END\ny\n');
  assert.equal(canonical(withSig(t, SEALED)), canonical(t));
  const two = '§SIG·BEGIN\na\n§SIG·END\n§SIG·BEGIN\nb\n§SIG·END';
  assert.equal(canonical(two), '§SIG·BEGIN\na\n§SIG·END\n§SIG·BEGIN\n§SIG·END');
  assert.equal(canonical('§SIG·BEGIN\nx'), null);
  assert.equal(canonical('no sig'), null);
  assert.equal(canonical(3), null);
});

test('sigOf reads only the two exact forms', () => {
  const u = sigOf(tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256: PENDING']));
  assert.deepEqual(u, { ok: true, sealed: false, mode: 'STANDARD', status: 'UNVERIFIED', sha: null, key: null, sig: null });
  assert.equal(sigOf(tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256:'], '∴SYMB-FER·v3.0·TOKEN')).sealed, false);
  assert.equal(sigOf(tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256:'])).ok, false);
  assert.equal(sigOf(tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256: PENDING'], '∴SYMB-FER·v3.0·TOKEN')).ok, false);
  const s = sigOf(withSig(tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256: PENDING']), SEALED));
  assert.deepEqual(s, { ok: true, sealed: true, mode: 'VERIFIED', status: 'VERIFIED', ...SEALED });
  const lines = ['MODE: VERIFIED', 'STATUS: VERIFIED', 'SHA256: ' + SEALED.sha, 'ED25519·KEY: ' + SEALED.key, 'ED25519·SIG: ' + SEALED.sig];
  for (let i = 0; i < lines.length; i++) {
    const changed = lines.slice(); changed[i] += 'x';
    assert.equal(sigOf(tok(changed)).ok, false, 'line ' + i);
    assert.equal(sigOf(tok(lines.filter((_, j) => j !== i))).ok, false, 'without line ' + i);
  }
  assert.equal(sigOf(tok([...lines, 'X: y'])).ok, false);
  assert.equal(sigOf(tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256: PENDING', 'x'])).ok, false);
  assert.equal(sigOf(tok(['MODE: STANDARD', 'STATUS: VERIFIED', 'SHA256: PENDING'])).ok, false);
  assert.equal(sigOf(tok(['MODE: VERIFIED', 'STATUS: UNVERIFIED', 'SHA256: PENDING'])).ok, false);
  assert.equal(sigOf('no').ok, false);
  assert.equal(sigOf(null).ok, false);
});

test('withSig writes the sealed or the unsealed form, and nothing else', () => {
  const t = tok(['MODE: STANDARD', 'STATUS: UNVERIFIED', 'SHA256: PENDING']);
  const s = withSig(t, SEALED);
  assert.equal(withSig(s, null), t);
  assert.equal(withSig(t, { ...SEALED, sig: 'c'.repeat(127) }), '');
  assert.equal(withSig(t, { ...SEALED, sha: 'A'.repeat(64) }), '');
  assert.equal(withSig(t, { ...SEALED, key: 'b'.repeat(63) }), '');
  assert.equal(withSig(t, 'x'), '');
  assert.equal(withSig('no sig', SEALED), '');
  assert.equal(withSig(5, SEALED), '');
  assert.equal(withSig(tok(['MODE: VERIFIED'], '∴SYMB-FER·v3.0·TOKEN'), null).split('\n')[5], 'SHA256:');
});

test('the seal message and the tier §SIG block', () => {
  assert.equal(SEAL_PREFIX, 'kar-passport·seal·v1|');
  assert.deepEqual(sealMessage('ab'), enc.encode('kar-passport·seal·v1|ab'));
  assert.deepEqual(sealMessage(9), enc.encode('kar-passport·seal·v1|'));
  const body = '∴ SYMB-FER v2.0 · t\nx';
  assert.equal(tierBody(body + TIER_SIG), body);
  assert.equal(tierBody(body + '\n\n§SIG·BEGIN\n' + TIER_SIG), body + '\n\n§SIG·BEGIN\n');
  assert.equal(tierBody(body), null);
  assert.equal(tierBody(null), null);
  assert.equal(sigOf(body + TIER_SIG).sealed, false);
});
