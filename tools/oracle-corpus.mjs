#!/usr/bin/env node
// tools/oracle-corpus.mjs: runs SYMBEYOND's and teslasolar's own Python (tools/oracle.py) over the P2/P3 corpus and
// writes what they said to fixtures/oracle/. --check re-runs the Python and fails if any verdict differs from the file.
//   v6.2: the 14 tests of SYMB-FER_6_2/tests, the v6.2 template, and 600 seeded mutants of those 15
//   v3.0: the fork's 4 tests and 400 seeded mutants of those
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { mutate } from './fuzz.mjs';
import { baseCorpus, tierCases, edgeCases } from './corpus.mjs';

const ROOT = join(import.meta.dirname, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');

export async function corpus() {
  const { v62, v30 } = await baseCorpus();
  const items = [];
  for (const [kind, bases, n, seed0] of [['v62', v62, 600, 1000], ['v30', v30, 400, 5000]]) {
    for (const b of bases) items.push({ kind, id: b.id, bytes: b.bytes });
    for (let k = 0; k < n; k++) { const b = bases[k % bases.length]; items.push({ kind, id: b.id + '#' + (seed0 + k), base: b.id, seed: seed0 + k, bytes: mutate(b.bytes, seed0 + k) }); }
  }
  return items;
}

export function runOracle(items) {
  const dir = join(tmpdir(), 'kar-passport-oracle-' + process.pid);
  mkdirSync(dir, { recursive: true });
  const jobs = items.map((it, i) => { const p = join(dir, i + '.txt'); writeFileSync(p, it.bytes); return { kind: it.kind, path: p }; });
  try {
    return JSON.parse(execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', join(ROOT, 'tools', 'oracle.py')], { input: JSON.stringify({ jobs }), maxBuffer: 1 << 28 }).toString('utf8')).results;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const items = await corpus();
  const res = runOracle(items);
  const cases = await tierCases();
  const gen = JSON.parse(execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', join(ROOT, 'tools', 'oracle.py')], { input: JSON.stringify({ jobs: cases.map((c) => ({ kind: 'gen', tier: c.tier, ts: c.ts, state: c.state })) }) }).toString('utf8')).results;
  const tiers = cases.map((c, i) => ({ id: c.id, tier: c.tier, ts: c.ts, state: c.state, text: gen[i].text }));
  const rows = items.map((it, i) => ({ kind: it.kind, id: it.id, sha256: sha(it.bytes), status: res[i].status, passes: res[i].passes || [], warnings: res[i].warnings || [], failures: res[i].failures || [] }));
  const edges = await edgeCases();
  const eres = runOracle(edges);
  const erows = edges.map((it, i) => ({ kind: it.kind, id: it.id, sha256: sha(it.bytes), status: eres[i].status, passes: eres[i].passes || [], warnings: eres[i].warnings || [], failures: eres[i].failures || [] }));
  const efile = join(ROOT, 'fixtures', 'oracle', 'edges.json');
  const etext = JSON.stringify({ kind: 'kar-passport.oracle.edges', rows: erows }, null, 1) + '\n';
  const file = join(ROOT, 'fixtures', 'oracle', 'verdicts.json'), tfile = join(ROOT, 'fixtures', 'oracle', 'tiers.json');
  const ttext = JSON.stringify({ kind: 'kar-passport.oracle.tiers', note: 'What SYMBEYOND\'s symb_fer_generator.py wrote for each state (tools/oracle-corpus.mjs).', tiers }, null, 1) + '\n';
  const text = JSON.stringify({ kind: 'kar-passport.oracle', note: 'What SYMBEYOND\'s validate_v6_2.py and teslasolar\'s symbfer_engine.py said about each corpus token (tools/oracle-corpus.mjs).', rows }, null, 0).replace(/\},\{/g, '},\n{') + '\n';
  if (process.argv[2] === '--check') {
    if (readFileSync(file, 'utf8') !== text || readFileSync(tfile, 'utf8') !== ttext || readFileSync(efile, 'utf8') !== etext) { console.error('the Python oracle now says something else than fixtures/oracle/verdicts.json'); process.exit(1); }
    console.log('oracle: ' + rows.length + ' verdicts reproduce');
  } else {
    mkdirSync(join(ROOT, 'fixtures', 'oracle'), { recursive: true });
    writeFileSync(file, text);
    writeFileSync(tfile, ttext);
    writeFileSync(efile, etext);
    const by = (k) => rows.filter((r) => r.kind === k).reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
    console.log('wrote ' + rows.length + ' verdicts', JSON.stringify(by('v62')), JSON.stringify(by('v30')));
  }
}
