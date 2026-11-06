// src/sha256.test.mjs: the seal's SHA-256 (fall-kit's small pure function, vendor/fall-kit-core/vendor/light/sha256.mjs,
// pinned by its own hash in vendor/SOURCES.json) checked against an independent implementation: Node's own, from OpenSSL.
// The standard test messages of FIPS 180-2, every length from 0 to 300 bytes (each padding boundary), random bytes, and
// every committed passport and protocol file, as text and as bytes. A buyer's security team asked how a hand-written
// hash is known to be right (6 November 2026); this is the answer, on every push.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, hex } from '../vendor/fall-kit-core/vendor/light/sha256.mjs';
import { shaOf } from './seal.mjs';
import { rng } from '../tools/fuzz.mjs';

const ROOT = join(import.meta.dirname, '..');
const theirs = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ours = (bytes) => hex(sha256(bytes));
const enc = new TextEncoder();

test('the FIPS 180-2 test messages', () => {
  for (const m of ['', 'abc', 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu', 'a'.repeat(1000000)]) {
    const b = enc.encode(m);
    assert.equal(ours(b), theirs(b), m.length + ' bytes');
  }
});

test('every length from 0 to 300 bytes, and random bytes up to 5,000', () => {
  const r = rng(256);
  for (let n = 0; n <= 300; n++) {
    const b = new Uint8Array(n).map(() => Math.floor(r() * 256));
    assert.equal(ours(b), theirs(b), n + ' bytes');
  }
  for (let k = 0; k < 40; k++) {
    const b = new Uint8Array(Math.floor(r() * 5000)).map(() => Math.floor(r() * 256));
    assert.equal(ours(b), theirs(b), b.length + ' random bytes');
  }
});

test('every committed passport and protocol file, as the seal hashes it', () => {
  const files = [...readdirSync(join(ROOT, 'tokens')).map((f) => join(ROOT, 'tokens', f)),
    join(ROOT, 'vendor', 'symbfer', 'symbeyond', 'SYMB-FER_v6.2_PROTOCOL_2026-06-01_1015H.txt')];
  assert.ok(files.length >= 6);
  for (const f of files) {
    const bytes = readFileSync(f), text = bytes.toString('utf8');
    assert.equal(ours(bytes), theirs(bytes), f);
    assert.equal(shaOf(text), theirs(enc.encode(text)), f + ' through shaOf');
  }
});
