// src/judge.test.mjs: each sealed rule holds exactly at its line and fails one step past it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, CLAIM_IDS } from './judge.mjs';

const held = (id, f) => judge(id, f).held;

test('the claims, in their sealed order; unknown ids and missing facts fail', () => {
  assert.deepEqual([...CLAIM_IDS], ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'K1', 'K2', 'B1', 'B2', 'B3', 'L1', 'G1', 'G2', 'G3']);
  assert.deepEqual(judge('X9', {}), { id: 'X9', held: false, why: 'no such claim' });
  assert.deepEqual(judge('toString', {}), { id: 'toString', held: false, why: 'no such claim' });
  for (const id of CLAIM_IDS) { assert.equal(held(id, null), false); assert.equal(judge(id, null).why, 'not measured'); assert.equal(held(id, {}), false); assert.equal(typeof judge(id, {}).why, 'string'); }
});

test('P1 to P7', () => {
  assert.equal(held('P1', { tokens: 3, pass: 3 }), true); assert.equal(held('P1', { tokens: 3, pass: 2 }), false); assert.equal(held('P1', { tokens: 0, pass: 0 }), false);
  assert.match(judge('P1', { tokens: 3, pass: 3 }).why, /every one of 3/); assert.match(judge('P1', { tokens: 3, pass: 2 }).why, /2 of 3/);
  assert.equal(held('P2', { corpus: 615, same: 615 }), true); assert.equal(held('P2', { corpus: 615, same: 614 }), false); assert.equal(held('P2', { corpus: 614, same: 614 }), false);
  assert.equal(held('P3', { tokens: 2, pass: 2, corpus: 404, same: 404 }), true);
  for (const f of [{ tokens: 2, pass: 1, corpus: 404, same: 404 }, { tokens: 2, pass: 2, corpus: 403, same: 403 }, { tokens: 2, pass: 2, corpus: 404, same: 403 }, { tokens: 0, pass: 0, corpus: 404, same: 404 }]) assert.equal(held('P3', f), false);
  assert.equal(held('P4', { tokens: 2, identical: 2, within: 2 }), true); assert.equal(held('P4', { tokens: 2, identical: 1, within: 2 }), false); assert.equal(held('P4', { tokens: 2, identical: 2, within: 1 }), false); assert.equal(held('P4', { tokens: 0, identical: 0, within: 0 }), false);
  const p5 = { tokens: 4, bytesBack: 4, models: 2, modelsBack: 2, sealed: 3, sealedBack: 3 };
  assert.equal(held('P5', p5), true);
  for (const k of ['bytesBack', 'modelsBack', 'sealedBack']) assert.equal(held('P5', { ...p5, [k]: p5[k] - 1 }), false, k);
  assert.equal(held('P5', { ...p5, tokens: 0, bytesBack: 0 }), false); assert.equal(held('P5', { ...p5, models: 0, modelsBack: 0 }), false);
  const p6 = { tokens: 2, tried: 10, refused: 10, contextOnRefusal: 0, untouchedOk: 2 };
  assert.equal(held('P6', p6), true);
  for (const f of [{ refused: 9 }, { contextOnRefusal: 1 }, { untouchedOk: 1 }, { tokens: 0, untouchedOk: 0 }, { tried: 0, refused: 0 }]) assert.equal(held('P6', { ...p6, ...f }), false, JSON.stringify(f));
  assert.match(judge('P6', p6).why, /^10 of 10/);
  assert.equal(held('P7', { drifted: 5, refusedNamed: 5, honestAccepted: true }), true);
  for (const f of [{ drifted: 5, refusedNamed: 4, honestAccepted: true }, { drifted: 5, refusedNamed: 5, honestAccepted: false }, { drifted: 0, refusedNamed: 0, honestAccepted: true }, { drifted: 5, refusedNamed: 5, honestAccepted: 'yes' }]) assert.equal(held('P7', f), false);
});

test('K1, K2, B1, B2, B3', () => {
  assert.equal(held('K1', { tokens: 15, ok: 15 }), true); assert.equal(held('K1', { tokens: 15, ok: 14 }), false); assert.equal(held('K1', { tokens: 14, ok: 14 }), false);
  const k2 = { fixtureClean: true, fixtureNamed: true, tokens: 10, hits: 0 };
  assert.equal(held('K2', k2), true);
  for (const f of [{ fixtureClean: false }, { fixtureNamed: false }, { tokens: 9 }, { hits: 1 }]) assert.equal(held('K2', { ...k2, ...f }), false, JSON.stringify(f));
  assert.equal(held('B1', { right: 8, declined: 4, leaked: 0 }), true);
  for (const f of [{ right: 7, declined: 4, leaked: 0 }, { right: 8, declined: 3, leaked: 0 }, { right: 8, declined: 4, leaked: 1 }]) assert.equal(held('B1', f), false);
  assert.match(judge('B1', { right: 9, declined: 5, leaked: 0 }).why, /^9\/10 right, 5\/5 declined, 0 leaked$/);
  assert.match(judge('B1', { right: 2, declined: 1, leaked: 1 }).why, /1 leaked$/);
  assert.equal(held('B2', { right: 8, declined: 2, leaked: 0 }), true);
  for (const f of [{ right: 7, declined: 2, leaked: 0 }, { right: 8, declined: 1, leaked: 0 }, { right: 8, declined: 2, leaked: 1 }]) assert.equal(held('B2', f), false);
  assert.match(judge('B2', { right: 2, declined: 1, leaked: 0 }).why, /^2\/10 right, 1\/3 declined, 0 leaked$/);
  assert.match(judge('B2', { right: 9, declined: 3, leaked: 0 }).why, /^9\/10 right, 3\/3 declined, 0 leaked$/);
  assert.equal(held('B3', { refusals: 4, calls: 0 }), true); assert.equal(held('B3', { refusals: 3, calls: 0 }), false); assert.equal(held('B3', { refusals: 4, calls: 1 }), false);
});

test('L1, G1, G2, G3', () => {
  const l1 = { accepted: true, allLinesInPlan: true, regeneratedPass: true, carriesSession: true, carriesMilestone: true, undoIdentical: true };
  assert.equal(held('L1', l1), true);
  for (const k of Object.keys(l1)) assert.equal(held('L1', { ...l1, [k]: false }), false, k);
  const g1 = { clean: [true, true], fuzzThrows: 0, fuzzInputs: 2000 };
  assert.equal(held('G1', g1), true);
  for (const f of [{ clean: [true, false] }, { clean: [] }, { fuzzThrows: 1 }, { fuzzInputs: 1999 }]) assert.equal(held('G1', { ...g1, ...f }), false, JSON.stringify(f));
  assert.match(judge('G1', g1).why, /2000 fuzz inputs, 0 throws/);
  const g2 = { publicVerified: true, changedRefused: true, syntheticPass: true, syntheticVerified: true };
  assert.equal(held('G2', g2), true);
  for (const k of Object.keys(g2)) assert.equal(held('G2', { ...g2, [k]: false }), false, k);
  assert.equal(held('G3', { files: 3, hits: 0, pageScanned: true }), true);
  for (const f of [{ files: 0, hits: 0, pageScanned: true }, { files: 3, hits: 1, pageScanned: true }, { files: 3, hits: 0, pageScanned: false }]) assert.equal(held('G3', f), false);
  assert.match(judge('G3', { files: 3, hits: 0, pageScanned: true }).why, /^3 files and the live page: 0 hits$/);
  assert.match(judge('K1', { tokens: 15, ok: 15 }).why, /^15 tokens/); assert.match(judge('K1', { tokens: 15, ok: 3 }).why, /^3 of 15/);
  assert.match(judge('B3', { refusals: 4, calls: 0 }).why, /^4 refusals, 0 model calls$/);
  assert.match(judge('L1', l1).why, /^accepted, merged/);
  assert.match(judge('G2', g2).why, /^verified, refused and generated/);
  assert.match(judge('P7', { drifted: 5, refusedNamed: 5, honestAccepted: true }).why, /^5 drifted tokens refused by name/);
  assert.match(judge('K2', { fixtureClean: true, fixtureNamed: true, tokens: 10, hits: 0 }).why, /^fixture caught by class; 0 hits in the 10 tokens$/);
  assert.match(judge('P2', { corpus: 615, same: 615 }).why, /all 615/); assert.match(judge('P2', { corpus: 615, same: 1 }).why, /^1 of 615 agree$/);
  assert.match(judge('P3', { tokens: 2, pass: 2, corpus: 404, same: 404 }).why, /^2 codec v3.0 tokens PASS; the engine agrees on all 404$/);
  assert.match(judge('P4', { tokens: 2, identical: 2, within: 2 }).why, /^all 2 byte-identical/);
  assert.match(judge('P5', { tokens: 4, bytesBack: 4, models: 2, modelsBack: 2, sealed: 3, sealedBack: 3 }).why, /^4 tokens and 2 models round-trip$/);
});

test('the message follows the verdict: a failed G3 lists where, B1 and B2 always say all three counts', () => {
  assert.equal(judge('G3', { files: 3, hits: 2, where: ['a.mjs: secret@3', 'b.json: pricing@9'], pageScanned: true }).why, '2 hits: a.mjs: secret@3; b.json: pricing@9');
  assert.equal(judge('G3', { files: 3, hits: 1, where: 'x', pageScanned: true }).why, '1 hits: ');
  assert.equal(judge('B1', { right: 9, declined: 2, leaked: 0 }).why, '9/10 right, 2/5 declined, 0 leaked');
  assert.equal(judge('B2', { right: 9, declined: 3, leaked: 0 }).why, '9/10 right, 3/3 declined, 0 leaked');
  assert.equal(judge('P1', { tokens: 3, pass: 3 }).why, 'every one of 3 is PASS');
  assert.equal(judge('P1', { tokens: 0, pass: 0 }).why, '0 of 0 PASS');
  assert.equal(judge('P5', { tokens: 0 }).why, '{"tokens":0}');
  const cyclic = { tokens: 1, pass: 0 }; cyclic.self = cyclic;
  assert.equal(judge('P6', cyclic).why, 'facts that cannot be read');
  assert.equal(judge('P6', cyclic).held, false);
});
