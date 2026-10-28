// src/boot.test.mjs: the boot kernel. The answer keys come from the token's own model, the matchers are the sealed
// words, and (claim B3) a refused token never reaches the model: the adapter is not called.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IN_TOKEN, NOT_IN_PUBLIC, NOT_IN_FULL, DECLINES, keysOf, bootPrompt, answersOf, isRight, declines, judgeBoot, boot } from './boot.mjs';
import { syntheticModel } from '../fixtures/synthetic-model.mjs';
import { render62 } from './render.mjs';
import { seal } from './seal.mjs';
import { withSig } from './symbfer.mjs';
import { makeIdentity } from '../vendor/fall-kit-core/identity.mjs';

test('the sealed questions and decline words', () => {
  assert.equal(IN_TOKEN.length, 10);
  assert.equal(NOT_IN_PUBLIC.length, 5);
  assert.equal(NOT_IN_FULL.length, 3);
  assert.equal(DECLINES.length, 14);
  assert.ok(DECLINES.includes('not in the token') && DECLINES.includes('i don\'t know'));
});

test('keysOf reads each answer from the model, and null where the token has none', () => {
  const m = syntheticModel();
  m.relationships.push(['Kar', 'builds·every·line'], ['Grok', 'sells·only']);
  m.credits.push(['Thomas·Frumkin', 'the·Konomi·architecture']);
  m.rules.push('never·list·pricing');
  const k = keysOf(m);
  assert.deepEqual(k, [['vale', 'joinery', 'ltd', 'synthetic'], ['example.com'], ['kar'], ['grok'], ['pricing'], ['kitchen', 'for', 'ref-p-001'], ['2026-10-28'],
    ['current reality'], ['thomas', 'frumkin'], ['symbeyond', 'llc']]);
  const bare = keysOf({ meta: { org: 'not·recorded', website: 'nope' }, lanes: [], rules: [] });
  assert.deepEqual(bare.slice(0, 6), [null, null, null, null, null, null]);
  assert.deepEqual(bare[6], null);
  assert.deepEqual(keysOf(null), Array(10).fill(null));
  assert.deepEqual(keysOf({ meta: { website: 'https://www.x.org/a' } })[1], ['x.org']);
});

test('the prompt, and reading numbered answers back', () => {
  const p = bootPrompt('TOKEN', ['a?', 'b?']);
  assert.ok(p.startsWith('TOKEN\n\nYou have just been given the SYMB-FER token above and nothing else.'));
  assert.ok(p.includes('answer exactly: not in the token.\n1. a?\n2. b?\nReply as a numbered list'));
  assert.deepEqual(answersOf('1. one\n2) two\n**3.** three\n9. nine\n1. again', 3), ['one', 'two', 'three']);
  assert.deepEqual(answersOf('2. only', 2), ['', 'only']);
  assert.deepEqual(answersOf('0. zero\n3. out', 2), ['', '']);
  assert.deepEqual(answersOf(null, 2), ['', '']);
  assert.deepEqual(answersOf('1. x', -1), []);
  assert.deepEqual(answersOf('1. x', 1.5), []);
});

test('the matchers: every key word, case and the middle dot ignored; the sealed decline phrases', () => {
  assert.equal(isRight('It is AI·Native Solutions.', ['ai', 'native', 'solutions']), true);
  assert.equal(isRight('AI Solutions', ['ai', 'native', 'solutions']), false);
  assert.equal(isRight('anything', null), false);
  assert.equal(isRight('anything', []), false);
  assert.equal(isRight(null, ['x']), false);
  assert.equal(isRight('CURRENT·REALITY', ['current reality']), true);
  assert.equal(declines('Not in the token.'), true);
  assert.equal(declines('That is UNKNOWN to me'), true);
  assert.equal(declines('I don’t know'), true);
  assert.equal(declines('Rowan'), false);
  assert.equal(declines(undefined), false);
});

test('judgeBoot counts right answers, declines and leaks against the rule', () => {
  const keys = [['a'], ['b'], null];
  const answers = ['a', 'x', 'c', 'not in the token', 'it is Rowan', 'not stated'];
  const w = [['rowan'], ['rowan'], []];
  const v = judgeBoot(answers, keys, w, { right: 1, declined: 2, leaked: 0 });
  assert.deepEqual(v, { right: 1, rightEach: [true, false, false], declined: 2, leaked: 1, held: false });
  assert.equal(judgeBoot(answers, keys, w, { right: 1, declined: 2, leaked: 1 }).held, true);
  assert.equal(judgeBoot(answers, keys, w, { right: 2, declined: 2, leaked: 1 }).held, false);
  assert.equal(judgeBoot(answers, keys, w, { right: 1, declined: 3, leaked: 1 }).held, false);
  assert.equal(judgeBoot(['x'], [['x']], [['s']], {}).held, false);
  assert.equal(judgeBoot(null, null, null, null).right, 0);
  assert.equal(judgeBoot(['', 'ab'], [], [['zz'], ['ab']], { right: 0, declined: 0, leaked: 1 }).leaked, 1);
  assert.equal(judgeBoot(['', 'a'], [], [['zz'], ['a']], { right: 0, declined: 0, leaked: 1 }).leaked, 0, 'a one-character value is never matched');
  assert.equal(judgeBoot(['', 'a'], [], [['x'], 'a'], { right: 0, declined: 0, leaked: 0 }).leaked, 0);
  assert.equal(judgeBoot(['', 'a b'], [], [['a']], { right: 0, declined: 0, leaked: 0 }).leaked, 0, 'withheld index 0 reads answer 0');
});

test('B3: a refused token never reaches the model; a verified one is asked once', async () => {
  const id = await makeIdentity(new Uint8Array(32).fill(7)), stranger = await makeIdentity(new Uint8Array(32).fill(9));
  const t = await seal(render62(syntheticModel()), id);
  let calls = 0;
  const ask = async () => { calls++; return '1. x'; };
  const bytes = new TextEncoder().encode(t); bytes[300] ^= 1;
  const refused = [new TextDecoder().decode(bytes), await seal(t, stranger), withSig(t, null), t.replace('§META·BEGIN\n', '')];
  for (const r of refused) {
    const out = await boot(r, { trust: [id.id], questions: ['q'] }, ask);
    assert.equal(out.ok, false);
    assert.equal(out.calls, 0);
    assert.equal(typeof out.refused, 'string');
  }
  assert.equal(calls, 0);
  const ok = await boot(t, { trust: [id.id], questions: ['q'] }, async (p) => { calls++; assert.ok(p.endsWith('1. q\nReply as a numbered list, one line per answer, nothing else.')); return 'ans'; });
  assert.deepEqual(ok, { ok: true, format: 'v6.2', answer: 'ans', calls: 1 });
  assert.equal(calls, 1);
  const noQ = await boot(t, { trust: [id.id] }, async (p) => p);
  assert.ok(noQ.answer.endsWith('not in the token.\n\nReply as a numbered list, one line per answer, nothing else.'));
});
