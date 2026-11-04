#!/usr/bin/env node
// tools/timecase-measure.mjs: the facts behind claims-timecase.json (T1 sourced, T2 gated), judged by the rules sealed
// there, written to receipts/timecase.json.
//   node tools/timecase-measure.mjs           measure and write the receipt (T2's witness run is read from local/t2.json)
//   node tools/timecase-measure.mjs --check   in CI: re-derive every fact here and fail if any differs from the receipt
// The witness itself runs as its own CI step on every push and fails the build on any survivor; local/t2.json records the
// run that measured T2 first.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, hex } from '../vendor/fall-kit-core/vendor/light/sha256.mjs';
import * as tc from '../src/timecase.mjs';
import { rng } from './fuzz.mjs';

const ROOT = join(import.meta.dirname, '..');
const CHECK = process.argv.includes('--check');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const sha = (b) => hex(sha256(new Uint8Array(b)));
const basis = JSON.parse(rd('vendor/basis/basis.json')), typing = JSON.parse(rd('data/typing-basis.json'));
const r2 = (x) => Math.round(x * 100) / 100;
const facts = {};

// T1 (a) the estate's basis: on disk against its pin, and the pin against the file at its commit
{
  const pin = JSON.parse(rd('vendor/SOURCES.json')).files.find((f) => f.local === 'vendor/basis/basis.json');
  const disk = sha(readFileSync(join(ROOT, 'vendor/basis/basis.json')));
  let atSource = false;
  if (pin) {
    const r = await fetch('https://raw.githubusercontent.com/' + pin.repo + '/' + pin.commit + '/' + pin.path);
    atSource = r.ok && sha(Buffer.from(await r.arrayBuffer())) === pin.sha256;
  }
  facts.basis = { pinned: !!pin && disk === pin.sha256, atSource, repo: pin ? pin.repo : '', commit: pin ? pin.commit.slice(0, 7) : '', path: pin ? pin.path : '' };
}
// (b) every typing entry the kernel reads names a source
facts.typingSourced = { entries: tc.TYPING_KEYS.length, sourced: tc.TYPING_KEYS.filter((k) => typing[k] && /^https:\/\/\S+$/.test(typing[k].source || '')).length };
// (e) the brief, from the committed public STATE passport
const brief = tc.briefOf(rd('tokens/public.state.txt'));
facts.brief = { from: 'tokens/public.state.txt', ok: brief.ok, lines: brief.lines, chars: brief.chars };
// (c) each figure changed by a quarter moves the result, with the page's default inputs
{
  const input = { chars: brief.chars };
  const base = JSON.stringify(tc.timeCase(basis, typing, input));
  const bump = (o, k) => ({ ...o, [k]: { ...o[k], value: o[k].value * 1.25 } });
  const moved = [];
  for (const k of tc.BASIS_KEYS) if (JSON.stringify(tc.timeCase(bump(basis, k), typing, input)) !== base) moved.push(k);
  for (const k of tc.TYPING_KEYS) if (JSON.stringify(tc.timeCase(basis, bump(typing, k), input)) !== base) moved.push(k);
  facts.moved = { figures: tc.BASIS_KEYS.length + tc.TYPING_KEYS.length, moved: moved.length, which: moved };
}
// (d) no figure typed into the page or the kernel: each figure written with a decimal point, the default working weeks it
// implies, and the participant count, as written and as a page would print them
{
  const decimals = [...tc.BASIS_KEYS.map((k) => basis[k].value), ...tc.TYPING_KEYS.map((k) => typing[k].value)].filter((v) => !Number.isInteger(v)).map(String);
  const weeks = String(r2(typing.weeksInYear.value - typing.leaveWeeks.value));
  const n = typing.participants.value;
  const literals = [...new Set([...decimals, weeks, String(n), n.toLocaleString('en-GB'), (Math.floor(n / 1000) * 1000).toLocaleString('en-GB')])];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const files = ['page.mjs', 'index.html', 'src/timecase.mjs'];
  const found = [];
  for (const f of files) { const t = rd(f); for (const l of literals) if (new RegExp('(?<![0-9.,])' + esc(l) + '(?![0-9])').test(t)) found.push(f + ': ' + l); }
  facts.literals = { searched: literals, files, found };
}
// what the page shows with its default inputs (the receipt carries the numbers the page computes)
{
  const r = tc.timeCase(basis, typing, { chars: brief.chars });
  facts.defaultCase = r.ok ? { inputs: r.inputs, minutesPerBrief: r.minutesPerBrief, hoursPerYear: r.hoursPerYear, valuePerYear: r.valuePerYear, valueOver: r.valueOver } : { why: r.why };
}

// T2: 2,000 garbage inputs to every exported function; the witness run from local/t2.json
{
  const r = rng(91), pick = (a) => a[Math.floor(r() * a.length)];
  const toxic = { get value() { throw new Error('toxic'); } };
  const garbage = [null, undefined, 0, -1, NaN, 1e309, -1e309, '', ' ', '- a', '§SIG·BEGIN', [], [null], {}, { chars: 5 }, { value: 3 }, { wageMedianHourly: toxic, cpi: toxic },
    () => 1, Symbol.iterator, new Uint8Array([0xff]), 'a'.repeat(5000), Object.create(null), 10n];
  const PER = 2000;
  let functions = 0, inputs = 0, throws = 0;
  for (const fn of Object.values(tc)) {
    if (typeof fn !== 'function') continue;
    functions++;
    for (let k = 0; k < PER; k++) { inputs++; try { fn(pick(garbage), pick(garbage), pick(garbage), pick(garbage)); } catch { throws++; } }
  }
  const t2 = existsSync(join(ROOT, 'local', 't2.json')) ? JSON.parse(rd('local/t2.json')) : null;
  facts.gate = { fuzzFunctions: functions, fuzzPerFunction: PER, fuzzInputs: inputs, fuzzThrows: throws, witness: t2 ? t2.witness : null };
}

// the rules sealed in claims-timecase.json
const f = facts, w = f.gate.witness;
const verdicts = [
  { id: 'T1', held: f.basis.pinned && f.basis.atSource && f.typingSourced.sourced === f.typingSourced.entries && f.moved.moved === f.moved.figures && f.literals.found.length === 0 && f.brief.ok,
    why: 'basis ' + (f.basis.pinned && f.basis.atSource ? 'byte-identical to its pin and its source' : 'NOT matching its pin or source') + '; ' + f.typingSourced.sourced + ' of ' + f.typingSourced.entries + ' typing figures sourced; ' +
      f.moved.moved + ' of ' + f.moved.figures + ' figures move the result; ' + f.literals.found.length + ' typed in; brief ' + f.brief.chars + ' characters in ' + f.brief.lines + ' lines' },
  { id: 'T2', held: !!w && w.clean === true && w.capped === false && w.baselined === 0 && f.gate.fuzzThrows === 0 && f.gate.fuzzFunctions > 0,
    why: (w ? 'witness ' + w.killed + '/' + w.total + (w.clean ? ' clean' : ' NOT clean') + (w.capped ? ', capped' : '') + ', ' + w.baselined + ' baselined' : 'no witness run recorded') + '; ' +
      f.gate.fuzzInputs + ' fuzz inputs to ' + f.gate.fuzzFunctions + ' functions, ' + f.gate.fuzzThrows + ' throws' },
];
const receipt = { kind: 'kar-passport.receipt.timecase', claims: 'claims-timecase.json', facts, verdicts, held: verdicts.filter((v) => v.held).length, of: verdicts.length };
for (const v of verdicts) console.log((v.held ? 'HELD   ' : 'FAILED ') + v.id + '  ' + v.why);
const path = join(ROOT, 'receipts', 'timecase.json');
if (CHECK) {
  const old = JSON.parse(readFileSync(path, 'utf8'));
  if (JSON.stringify({ facts: old.facts, verdicts: old.verdicts }) !== JSON.stringify({ facts, verdicts })) {
    console.error('the time case receipt does not reproduce');
    for (const k of Object.keys(facts)) if (JSON.stringify(old.facts[k]) !== JSON.stringify(facts[k])) console.error('  ' + k + ': ' + JSON.stringify(old.facts[k]) + ' → ' + JSON.stringify(facts[k]));
    process.exit(1);
  }
  console.log('the time case receipt reproduces');
} else writeFileSync(path, JSON.stringify(receipt, null, 1) + '\n');
