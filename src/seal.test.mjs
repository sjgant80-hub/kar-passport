// src/seal.test.mjs: seal, verify, verify-before-parse. Keys are PUBLIC TEST KEYS (seeds of one repeated byte); Kar's
// real key never enters a test. The exhaustive one-bit flip over every byte of every token is measure.mjs (claim P6);
// here every 61st byte is enough to hold each refusal path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seal, verify, verifyBytes, parseToken, shapeOf, shaOf, BOOT62 } from './seal.mjs';
import { render62, render30, tierFit } from './render.mjs';
import { canonical, withSig, sigOf, TIER_SIG } from './symbfer.mjs';
import { makeIdentity } from '../vendor/fall-kit-core/identity.mjs';
import { syntheticModel } from '../fixtures/synthetic-model.mjs';

const ROOT = join(import.meta.dirname, '..');
const key = (b) => makeIdentity(new Uint8Array(32).fill(b));
const enc = new TextEncoder();
const m30 = { generated: '2026-10-28_1600H', mode: 'VERIFIED', meta: { purpose: 'continuity', human: 'Rowan·Vale', org: 'Vale·Joinery', contact: 'site' },
  facts: [['jobs', '3']], session: { workingDirectory: 'not·shared', activePaths: ['a'], recentActions: ['x'], nextStep: 'y', notes: 'z' },
  ethos: ['measure·twice'], lessons: [['L1', 'photograph·first']], trace: 'synthetic' };

async function tokens(id) {
  const m = syntheticModel();
  const out = { v62: await seal(render62(m), id), v30: await seal(render30(m30), id) };
  for (const t of ['nano', 'core', 'state']) out[t] = await seal(tierFit(m, t, m.generated).text + TIER_SIG, id);
  return out;
}

test('a sealed token of every shape verifies under its key, and parses', async () => {
  const id = await key(7);
  const all = await tokens(id);
  for (const [k, t] of Object.entries(all)) {
    const v = await verify(t, { trust: [id.id] });
    assert.deepEqual(v, { ok: true, format: k === 'v62' ? 'v6.2' : k === 'v30' ? 'v3.0' : k, key: id.id, sha: shaOf(canonical(t)) }, k);
    const p = await parseToken(t, { trust: [id.id] });
    assert.equal(p.ok, true, k);
    assert.deepEqual(p.context.boot, BOOT62);
  }
  const p62 = await parseToken(all.v62, { trust: [id.id] });
  assert.equal(p62.context.model.identity.callname, 'Rowan');
  assert.equal((await parseToken(all.v30, { trust: [id.id] })).context.model.trace, 'synthetic');
  assert.ok((await parseToken(all.nano, { trust: [id.id] })).context.text.startsWith('∴ SYMB-FER v2.0 · '));
  assert.equal(sigOf(all.v62).key, id.id);
});

test('sealing is deterministic: the same text and key give the same bytes', async () => {
  const id = await key(7);
  const t = render62(syntheticModel());
  assert.equal(await seal(t, id), await seal(t, id));
  assert.equal(await seal(await seal(t, id), id), await seal(t, id));
});

test('a changed byte, a stranger\'s key, an unsealed token and a broken shape are refused, with no context', async () => {
  const id = await key(7), stranger = await key(9);
  const all = await tokens(id);
  for (const [k, t] of Object.entries(all)) {
    const bytes = enc.encode(t);
    for (let i = 0; i < bytes.length; i += 61) {
      const b = bytes.slice(); b[i] ^= 1;
      const v = await verifyBytes(b, { trust: [id.id] });
      assert.equal(v.ok, false, k + ' byte ' + i);
      assert.equal(typeof v.why, 'string');
    }
    const resealed = await seal(t, stranger);
    assert.match((await verify(resealed, { trust: [id.id] })).why, /^wrong signer/, k);
    assert.equal((await verify(resealed, { trust: [id.id, stranger.id] })).ok, true, k);
    const unsealed = withSig(t, null);
    const u = await parseToken(unsealed, { trust: [id.id] });
    assert.deepEqual(u, { ok: false, refused: 'unsealed: SHA256 PENDING and no signature', context: null }, k);
    assert.match((await verify(t, {})).why, /^wrong signer/);
    assert.match((await verify(t)).why, /^wrong signer/);
  }
  const s = sigOf(all.v62);
  const forged = withSig(all.v62, { sha: s.sha, key: s.key, sig: s.sig.slice(0, 127) + (s.sig[127] === '0' ? '1' : '0') });
  assert.equal((await verify(forged, { trust: [id.id] })).why, 'the Ed25519 signature does not verify');
  const otherSha = withSig(all.v62, { sha: 'f'.repeat(64), key: s.key, sig: s.sig });
  assert.match((await verify(otherSha, { trust: [id.id] })).why, /^changed: /);
  const lines = all.v62.split('\n');
  const noMeta = lines.filter((l) => l !== '§META·BEGIN').join('\n');
  assert.match((await verify(noMeta, { trust: [id.id] })).why, /^SYMBEYOND's v6\.2 rules say FAIL/);
  const p = await parseToken(noMeta, { trust: [id.id] });
  assert.equal(p.context, null);
  assert.match(p.refused, /FAIL/);
});

test('shapeOf: the shape\'s own rules, LF only, the tier\'s limit', async () => {
  const id = await key(7);
  const all = await tokens(id);
  assert.equal(shapeOf('hello').ok, false);
  assert.match(shapeOf(all.v62.replace('\n', '\r\n')).why, /carriage return/);
  assert.match(shapeOf(withSig(all.v62, null)).why, /rules say WARN/);
  assert.match(shapeOf(all.v30.replace('RULE: never·guess·time', 'RULE: guess')).why, /v3\.0 engine says FAIL/);
  assert.match(shapeOf(withSig(all.v30, null)).why, /v3\.0 engine says WARN/);
  assert.match(shapeOf(all.nano.split('\n\n§SIG·BEGIN')[0]).why, /without its §SIG block/);
  const fat = all.core.replace('━━━ GREETING ━━━', 'x'.repeat(900) + '\n━━━ GREETING ━━━');
  assert.match(shapeOf(fat).why, /longer than the core tier \(\d+ > 800\)/);
  const exact = '∴ SYMB-FER v2.0 · t\n' + 'x'.repeat(280);
  assert.equal(shapeOf(exact + TIER_SIG).ok, true);
  assert.equal(shapeOf(exact + 'x' + TIER_SIG).ok, false);
  assert.match(shapeOf('∴ SYMB-FER v2.0\nGenerated' + TIER_SIG.replace('\n\n§SIG', '\n§SIG')).why, /without its §SIG block/);
  // a STATE token without its second line reads as CORE; only the seal can tell, and it does
  const demoted = all.state.replace('SYMBEYOND Transfer Protocol\n', '');
  assert.equal(shapeOf(demoted).format, 'core');
  assert.match((await verify(demoted, { trust: [id.id] })).why, /^changed: /);
});

test('verify and parse never throw, on anything', async () => {
  const id = await key(7);
  for (const x of [null, undefined, 3, {}, [], '', '∴SYMB-FER·v6.2·LIVING·TOKEN·', '§SIG·BEGIN\n§SIG·END']) {
    assert.equal((await verify(x, { trust: [id.id] })).ok, false);
    assert.equal((await parseToken(x, { trust: [id.id] })).context, null);
  }
  assert.equal((await verifyBytes(new Uint8Array([0xc3]), { trust: [] })).why, 'not UTF-8');
  assert.equal((await verifyBytes('x', { trust: [] })).why, 'not UTF-8');
  assert.equal(await seal('no sig', id), '');
  assert.equal(await seal(render62(syntheticModel()), null), '');
  assert.equal(await seal(render62(syntheticModel()), { id: 'x' }), '');
  assert.equal(await seal(render62(syntheticModel()), { id: 'a'.repeat(64), sign: async () => { throw new Error('x'); } }), '');
  assert.equal(await seal(render62(syntheticModel()), { id: 'a'.repeat(64), sign: async () => new Uint8Array(10) }), '');
});

test('a verified token this codec did not write is refused, not guessed at', async () => {
  const id = await key(7);
  const upstream = readFileSync(join(ROOT, 'vendor/symbfer/symbeyond/SYMB-FER_6_2/tests/test_valid_v6_2.txt'), 'utf8');
  const sealed = await seal(upstream.replace(/SHA256: [0-9a-f]{64}/, 'SHA256: PENDING').replace('MODE: STANDARD\nSTATUS: UNVERIFIED\nSHA256: PENDING\n§SIG·END', 'MODE: STANDARD\nSTATUS: UNVERIFIED\nSHA256: PENDING\n§SIG·END'), id);
  assert.equal((await verify(sealed, { trust: [id.id] })).ok, true);
  const p = await parseToken(sealed, { trust: [id.id] });
  assert.equal(p.ok, false);
  assert.match(p.refused, /^verified, but not a token this codec wrote/);
  assert.equal(p.context, null);
});
