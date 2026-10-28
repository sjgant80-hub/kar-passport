// tools/corpus.mjs: the base tokens of claims P2 and P3, read from vendor/ (SYMBEYOND's and teslasolar's own files).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = join(import.meta.dirname, '..');
const V62 = 'vendor/symbfer/symbeyond/SYMB-FER_6_2/tests', V30 = 'vendor/symbfer/teslasolar/source/SYMB-FER_3_0/tests';
const TEMPLATE = 'vendor/symbfer/symbeyond/SYMB-FER_v6.2_PROTOCOL_2026-06-01_1015H.txt';
const read = (p) => new Uint8Array(readFileSync(join(ROOT, p)));
export async function baseCorpus() {
  const v62 = readdirSync(join(ROOT, V62)).sort().map((f) => ({ id: f, bytes: read(V62 + '/' + f) }));
  v62.push({ id: 'template', bytes: read(TEMPLATE) });
  const v30 = readdirSync(join(ROOT, V30)).sort().map((f) => ({ id: f, bytes: read(V30 + '/' + f) }));
  return { v62, v30 };
}

/** The tier cases of claim P4's port check: the states the codec makes, and the corners of the generator's own rules. */
export async function tierCases() {
  const { syntheticModel } = await import('../fixtures/synthetic-model.mjs');
  const { tierFit } = await import('../src/render.mjs');
  const m = syntheticModel();
  const states = ['nano', 'core', 'state'].map((t) => tierFit(m, t, m.generated).state);
  states.push({}, { greeting: 'one\ntwo\nthree  ' }, { _meta: { instance: '  Ann' }, state: { immediate_mission: ['a', 'b'] } },
    { _meta: { instance: 'I', operator: 'O', organization: 'G' }, state: { immediate_mission: ['m'], shipped: ['s1', 's2'], open_threads: ['t'],
      repo_status: ['r'], personal: ['p'] }, protocol: { boot_sequence: ['x', 'y'] }, vocabulary: ['', 'v'], greeting: 'g' },
    { state: { shipped: [], open_threads: ['only'] }, vocabulary: [], protocol: { boot_sequence: [] }, greeting: '' });
  const cases = [];
  states.forEach((state, i) => ['nano', 'core', 'state'].forEach((tier) => cases.push({ id: 'tier-' + i + '-' + tier, tier, ts: '2026-10-28_1600H', state })));
  return cases;
}

/** Edge tokens the seeded fuzz did not reach, each judged by the Python oracle (fixtures/oracle/edges.json). */
export async function edgeCases() {
  const enc = new TextEncoder();
  const v30 = new TextDecoder().decode(readFileSync(join(ROOT, V30, 'test_valid_3_0.txt'))).replace(/\r\n/g, '\n');
  const hex = 'ab'.repeat(32);
  const signed = v30.replace('SHA256:\n§SIG·END', 'SHA256: ' + hex + '\n§SIG·END');
  const v62 = new TextDecoder().decode(readFileSync(join(ROOT, V62, 'test_valid_v6_2.txt')));
  const cases = [
    ['v30', 'sig-first-line', '§SIG·BEGIN\nMODE: A\nSTATUS: B\nSHA256:\n§SIG·END\nx·y'],
    ['v30', 'sig-end-first', '§SIG·END\nx·y\n§SIG·BEGIN\nMODE: A\nSTATUS: B\nSHA256:\n§SIG·END'],
    ['v30', 'signed', signed],
    ['v30', 'two-sig-last-blank', signed + '\n§SIG·BEGIN\nMODE: STANDARD\nSTATUS: TEST\nSHA256:\n§SIG·END\n'],
    ['v30', 'odd-rule-line', signed.replace('§TEST·TRACE·END', 'RULE: no dots here\n§TEST·TRACE·END')],
    ['v30', 'sha-above-sig', signed.replace('SHA256: ' + hex + '\n§SIG·END', '§SIG·END').replace('§SIG·BEGIN', 'SHA256: ' + hex + '\n§SIG·BEGIN')],
    ['v30', 'colon-key', signed.replace('MODE: STANDARD\nSTATUS: TEST', ': x\nMODE:STANDARD\nSTATUS:  TEST ')],
    ['v30', 'no-dots', 'plain\ntext'],
    ['v62', 'no-dots', 'plain\ntext'],
    ['v62', 'sig-first', '§SIG·BEGIN\nSHA256: ' + hex + '\n§SIG·END'],
    ['v62', 'crlf', v62.replace(/\n/g, '\r\n')],
    ['v62', 'tabs-around-sha', v62.replace(/SHA256: [0-9a-f]{64}/, 'SHA256:\t' + hex + ' \u3000')],
    ['v62', 'unicode-break-in-meta', v62.replace('§META·END', 'x\u2028y\n§META·END')],
  ];
  return cases.map(([kind, id, text]) => ({ kind, id: 'edge-' + kind + '-' + id, bytes: enc.encode(text) }));
}
