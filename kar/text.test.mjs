// kar/text.test.mjs: the command line's text reader, on the bytes each shell and editor writes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textOf, jsonOf } from './text.mjs';
import def from './text.mjs';

const KEY = '{\r\n "kind": "kar-passport.key",\r\n "id": "ab12"\r\n}\r\n';
const le = (s) => Uint8Array.from([0xff, 0xfe, ...Buffer.from(s, 'utf16le')]);
const be = (s) => { const b = Buffer.from(s, 'utf16le'); for (let i = 0; i < b.length; i += 2) [b[i], b[i + 1]] = [b[i + 1], b[i]]; return Uint8Array.from([0xfe, 0xff, ...b]); };

test('Windows PowerShell 5.1: `>` writes UTF-16 little-endian with its mark', () => {
  assert.equal(textOf(le(KEY)), KEY);
  assert.equal(textOf(Buffer.from(le(KEY))), KEY, 'a Buffer, as readFileSync gives it');
  assert.equal(jsonOf(textOf(le(KEY))).value.id, 'ab12');
});

test('UTF-16 big-endian with its mark', () => {
  assert.equal(textOf(be(KEY)), KEY);
  assert.equal(textOf(be('·§é')), '·§é');
});

test('UTF-8 with a mark (PowerShell with a UTF-8 profile, older Notepad) and without one', () => {
  assert.equal(textOf(Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from(KEY)])), KEY);
  assert.equal(textOf(Buffer.from(KEY)), KEY);
  assert.equal(textOf(Buffer.from('§SIG·BEGIN — ok')), '§SIG·BEGIN — ok');
  assert.equal(textOf(new Uint8Array(0)), '');
});

test('only a whole mark switches the encoding: one byte of it alone is read as UTF-8', () => {
  assert.equal(textOf(Uint8Array.from([0xff, 0x41])), '\uFFFDA');
  assert.equal(textOf(Uint8Array.from([0x41, 0xfe])), 'A\uFFFD');
  assert.equal(textOf(Uint8Array.from([0xfe, 0x41])), '\uFFFDA');
  assert.equal(textOf(Uint8Array.from([0x41, 0xff])), 'A\uFFFD');
  assert.equal(textOf(Uint8Array.from([0xff])), '\uFFFD');
  assert.equal(textOf(Uint8Array.from([0xfe])), '\uFFFD');
});

test('not bytes: empty text, never a throw', () => {
  for (const x of [undefined, null, 0, 1, '', 'text', '\uFEFF{}', [0xff, 0xfe], {}, () => 1, Symbol('x'), new ArrayBuffer(4)]) assert.equal(textOf(x), '');
  assert.equal(textOf(), '');
});

test('jsonOf: the value, or JSON.parse\'s own reason', () => {
  assert.deepEqual(jsonOf('{"memory":"/srv/notes"}'), { ok: true, value: { memory: '/srv/notes' } });
  assert.deepEqual(jsonOf('[1,2]'), { ok: true, value: [1, 2] });
  assert.deepEqual(jsonOf('0'), { ok: true, value: 0 });
  for (const bad of ['{ "memory": "\\\\server\\share" }', '', '﻿{}', '{', undefined]) {
    let why; try { JSON.parse(bad); } catch (e) { why = e.message; }
    const r = jsonOf(bad);
    assert.equal(r.ok, false, String(bad));
    assert.equal(r.why, why);
    assert.ok(r.why.length > 0);
    assert.equal(Object.keys(r).length, 2);
  }
  assert.equal(Object.keys(jsonOf('1')).length, 2);
});

test('the default export carries both', () => {
  assert.equal(def.textOf, textOf);
  assert.equal(def.jsonOf, jsonOf);
});
