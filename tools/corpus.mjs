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
