// kar/trust.test.mjs: the keys a clone's checks accept (kar/trust.mjs, claims-trust.json R2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyOf, nameOk, trustOf } from './trust.mjs';

const key = (id) => JSON.stringify({ kind: 'kar-passport.key', id, note: 'a public half' }, null, 1) + '\n';
const A = 'ab'.repeat(32), B = 'cd'.repeat(32), C = '01'.repeat(32);
const NOT_KEY = 'not a key file: it has no "id" of 64 lowercase hexadecimal characters';

test('keyOf: the id a key file pins, and nothing that is not one', () => {
  assert.deepEqual(keyOf(key(A)), { ok: true, id: A });
  assert.deepEqual(keyOf('{"id":"' + C + '"}'), { ok: true, id: C });
  for (const bad of ['{"id":"zz"}', '{"id":5}', '{}', '[]', '5', '"x"', 'null', 'true', '{"id":"' + A.toUpperCase() + '"}', '{"id":"' + A.slice(1) + '"}', '{"id":"' + A + 'a"}', '{"id":" ' + A + '"}', '{"key":"' + A + '"}'])
    assert.deepEqual(keyOf(bad), { ok: false, why: NOT_KEY }, bad);
  for (const bad of ['', '{', 'not json', undefined, null, 5, {}]) {
    const k = keyOf(bad);
    assert.equal(k.ok, false, String(bad));
    assert.match(k.why, /^not a key file: ./, String(bad));
  }
});

test('nameOk: a plain file name, at most 64 characters, not one Windows reserves', () => {
  for (const ok of ['a', 'rowan', 'Rowan-Vale', 'A1.b_c-d', '7', 'x'.repeat(64), 'console', 'conx', 'nullable', 'com', 'lpt', 'aux2'])
    assert.equal(nameOk(ok), true, ok);
  for (const bad of ['', 'x'.repeat(65), '.hidden', '-x', '_x', '../x', 'a/b', 'a\\b', 'a b', 'a:b', 'con', 'CON', 'con.txt', 'Nul', 'prn', 'aux', 'aux.json', 'com1', 'COM9', 'lpt1', 'lpt9.x', 'ä', 5, null, undefined, ['a'], { toString: () => 'a' }])
    assert.equal(nameOk(bad), false, String(bad));
});

test('trustOf: your own key first, then each colleague\'s in the order given, with names', () => {
  assert.deepEqual(trustOf(key(A), [['b', key(B)], ['c', key(C)]]), { ids: [A, B, C], names: { [A]: 'you', [B]: 'b', [C]: 'c' }, skipped: [] });
  assert.deepEqual(trustOf(key(A), []), { ids: [A], names: { [A]: 'you' }, skipped: [] });
  assert.deepEqual(trustOf(key(A)), { ids: [A], names: { [A]: 'you' }, skipped: [] });
  assert.deepEqual(trustOf(key(A), 'b'), { ids: [A], names: { [A]: 'you' }, skipped: [] });
});

test('trustOf: no own key, a key twice, a bad name and a file that is not a key are left out, each with its reason', () => {
  const none = trustOf('', [['b', key(B)]]);
  assert.deepEqual(none.ids, [B]);
  assert.deepEqual(none.names, { [B]: 'b' });
  assert.equal(none.skipped.length, 1);
  assert.equal(none.skipped[0].name, 'you');
  assert.match(none.skipped[0].why, /^not a key file: ./);
  assert.deepEqual(trustOf(key(A), [['b', key(B)], ['b2', key(B)], ['me', key(A)]]).skipped, [{ name: 'b2', why: 'the same key as b' }, { name: 'me', why: 'the same key as you' }]);
  assert.deepEqual(trustOf(key(A), [['../b', key(B)], [5, key(B)], 'b', null, ['c', '{"id":"zz"}'], ['d', key(C)]]), {
    ids: [A, C], names: { [A]: 'you', [C]: 'd' },
    skipped: [{ name: '../b', why: 'not a plain file name' }, { name: 'number', why: 'not a plain file name' }, { name: 'undefined', why: 'not a plain file name' },
      { name: 'undefined', why: 'not a plain file name' }, { name: 'c', why: NOT_KEY }],
  });
});

test('trustOf: a list that throws when read keeps what was read before it, and says so', () => {
  const bad = [['b', key(B)], null];
  Object.defineProperty(bad, 1, { get() { throw new Error('toxic'); } });
  assert.deepEqual(trustOf(key(A), bad), { ids: [A, B], names: { [A]: 'you', [B]: 'b' }, skipped: [{ name: '', why: 'the pinned keys could not be read' }] });
});

test('total on garbage: every export, every hostile input, no throw', () => {
  const toxic = { get id() { throw new Error('toxic'); }, toString() { throw new Error('toxic'); } };
  const garbage = [undefined, null, 0, NaN, '', 'x', '{"id":1}', key(A), [], [[]], [['a']], [[toxic, toxic]], toxic, Symbol('s'), 10n, () => 1, new Uint8Array([1]), Object.create(null)];
  for (const fn of [keyOf, nameOk, trustOf]) for (const a of garbage) for (const b of garbage) assert.doesNotThrow(() => fn(a, b));
});
