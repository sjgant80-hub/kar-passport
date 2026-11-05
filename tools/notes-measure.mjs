#!/usr/bin/env node
// tools/notes-measure.mjs: the facts behind claims-notes.json (N1 a team's own notes make passports by the page's steps, N2
// the team-notes organ gated), judged by the rules sealed there, written to receipts/notes.json.
//   node tools/notes-measure.mjs           measure and write the receipt (N2's witness run is read from local/n2.json)
//   node tools/notes-measure.mjs --check   in CI: re-derive every fact here and fail if any differs from the receipt
// N1 runs the page's steps as a stranger would, with the command line itself, in a fresh copy of the committed repository
// (git archive of HEAD) and a fresh home folder, on a copy of the made-up team's notes in fixtures/team-notes/. The witness
// itself runs as its own CI step on every push and fails the build on any survivor; local/n2.json records the first run.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { verify } from '../src/seal.mjs';
import { dot } from '../src/render.mjs';
import * as organ from '../src/notes.mjs';
import { honestUpdate, driftedCases } from '../fixtures/drift-cases.mjs';
import { rng } from './fuzz.mjs';

const ROOT = join(import.meta.dirname, '..');
const CHECK = process.argv.includes('--check');
const FIX = join(ROOT, 'fixtures', 'team-notes');
const SHAPES = ['v6.2', 'v3.0', 'nano', 'core', 'state'], SLICES = ['full', 'shareable', 'public'];
const facts = {};

// the committed tree, from git archive of HEAD (a plain ustar stream: a header block per entry, its bytes in 512-byte blocks)
function extract(tar, to) {
  let at = 0, files = 0;
  const str = (a, b) => tar.subarray(at + a, at + b).toString('utf8').replace(/\0.*$/s, '');
  while (at + 512 <= tar.length && tar[at] !== 0) {
    const name = str(0, 100), prefix = str(345, 500), size = parseInt(str(124, 136).trim() || '0', 8), kind = String.fromCharCode(tar[at + 156]);
    const path = (prefix ? prefix + '/' : '') + name;
    if (kind === '0' || kind === '\0') { mkdirSync(join(to, dirname(path)), { recursive: true }); writeFileSync(join(to, path), tar.subarray(at + 512, at + 512 + size)); files++; }
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const tmp = mkdtempSync(join(tmpdir(), 'kp-notes-'));
try {
  const copy = join(tmp, 'repo'), home = join(tmp, 'home'), mem = join(tmp, 'notes');
  mkdirSync(copy); mkdirSync(home);
  const copied = extract(execFileSync('git', ['archive', '--format=tar', 'HEAD'], { cwd: ROOT, maxBuffer: 1 << 28 }), copy);
  cpSync(FIX, mem, { recursive: true });
  const env = { ...process.env, KAR_PASSPORT_DIR: home };
  const cli = (...a) => spawnSync(process.execPath, [join(copy, 'kar', 'passport.mjs'), ...a], { cwd: copy, env, encoding: 'utf8', maxBuffer: 1 << 26 });

  // (1) config.json: memory, about and private, from the fixture
  const fx = JSON.parse(readFileSync(join(FIX, 'config.json'), 'utf8'));
  writeFileSync(join(home, 'config.json'), JSON.stringify({ memory: mem, about: fx.about, private: fx.private }, null, 1) + '\n');
  // (2) the key, its output written to keys/kar.json (Kar's key is read first: the repository's own pin)
  const karKey = JSON.parse(readFileSync(join(copy, 'keys', 'kar.json'), 'utf8')).id;
  const k = cli('key');
  writeFileSync(join(copy, 'keys', 'kar.json'), k.stdout);
  const pinned = (() => { try { return JSON.parse(k.stdout).id; } catch { return ''; } })();
  // (3) the notes command
  const NOW1 = '2026-11-05_1200H', NOW2 = '2026-11-05_1300H';
  const g = cli('notes', '--now', NOW1);
  const sum = (() => { try { return JSON.parse(g.stdout); } catch { return { tokens: [] }; } })();
  const out1 = join(home, 'tokens', NOW1), file = (dir, s, sh) => join(dir, s + '.' + sh + '.txt');
  const written = sum.tokens.filter((t) => t.written), withheld = sum.tokens.filter((t) => !t.written);
  facts.copy = { fromHead: copied > 0, keyPinned: /^[0-9a-f]{64}$/.test(pinned) && pinned !== karKey, notesExit: g.status };
  facts.written = { tokens: written.length, withheld: withheld.length, why: withheld.map((t) => t.target + '.' + t.shape + ': ' + t.why) };
  // (4) verify every token written with the pinned key (the command), and against Kar's key (the repository's pin)
  let verified = 0, refusedByKar = 0;
  for (const t of written) {
    const f = file(out1, t.target, t.shape);
    if (/^VERIFIED /.test(cli('verify', f).stdout)) verified++;
    if (!(await verify(readFileSync(f, 'utf8'), { trust: [karKey] })).ok) refusedByKar++;
  }
  facts.verify = { verified, refusedByKar };
  // (5) SYMBEYOND's v6.2 validator and teslasolar's v3.0 engine, through tools/oracle.py unchanged
  {
    const jobs = [...SLICES.map((s) => ({ kind: 'v62', path: file(out1, s, 'v6.2') })), ...SLICES.map((s) => ({ kind: 'v30', path: file(out1, s, 'v3.0') }))];
    let res = [];
    try { res = JSON.parse(execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', join(ROOT, 'tools', 'oracle.py')], { input: JSON.stringify({ jobs }) }).toString('utf8')).results; } catch {}
    facts.oracle = { v62: res.slice(0, 3).filter((r) => r && r.status === 'PASS').length, v30: res.slice(3).filter((r) => r && r.status === 'PASS').length, of: SLICES.length };
  }
  // (6) the content: every note's description where it belongs, and no planted value in a token that leaves
  {
    const notes = readdirSync(FIX).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').sort().map((f) => organ.noteOf(readFileSync(join(FIX, f), 'utf8')));
    const planted = JSON.parse(readFileSync(join(FIX, 'planted.json'), 'utf8')).planted;
    const rd = (s, sh) => (existsSync(file(out1, s, sh)) ? readFileSync(file(out1, s, sh), 'utf8') : '');
    const holds = (s, n) => rd(s, 'v6.2').includes(dot(n.description));
    const found = [];
    for (const s of ['shareable', 'public']) for (const sh of SHAPES) for (const p of planted) if (rd(s, sh).includes(p.value) || rd(s, sh).includes(dot(p.value))) found.push(s + '.' + sh + ': ' + p.kind + ' (' + p.note + ')');
    facts.content = {
      notes: notes.length, full: notes.filter((n) => holds('full', n)).length,
      shareable: notes.filter((n) => n.type !== 'user' && holds('shareable', n)).length, shareableOf: notes.filter((n) => n.type !== 'user').length,
      userInShareable: notes.filter((n) => n.type === 'user' && holds('shareable', n)).length,
      public: notes.filter((n) => n.public && holds('public', n)).length, publicOf: notes.filter((n) => n.public).length,
      otherInPublic: notes.filter((n) => !n.public && holds('public', n)).length,
      planted: planted.length, kinds: [...new Set(planted.map((p) => p.kind))].length, plantedFound: found,
    };
  }
  // (7) the hand-back: an honest update of the full v6.2 token in, apply, notes again, undo; then one drifted return in
  {
    const sent = file(out1, 'full', 'v6.2'), back = join(tmp, 'returned.txt'), drifted = join(tmp, 'drifted.txt');
    const snap = () => Object.fromEntries(readdirSync(mem).sort().map((f) => [f, readFileSync(join(mem, f)).toString('base64')]));
    writeFileSync(back, honestUpdate(readFileSync(sent, 'utf8'), '2026-11-05', '2026-11-05_1230H'));
    const before = snap();
    const plan = cli('in', sent, back, '--now', '2026-11-05_1230H');
    const id = (/apply ([0-9a-f]+)\s*$/.exec(plan.stdout) || [])[1] || '';
    const applied = /^APPLIED /.test(cli('apply', id).stdout);
    const logWritten = existsSync(join(mem, 'symbfer-handoff-log.md'));
    cli('notes', '--now', NOW2);
    const next = existsSync(file(join(home, 'tokens', NOW2), 'full', 'v6.2')) ? readFileSync(file(join(home, 'tokens', NOW2), 'full', 'v6.2'), 'utf8') : '';
    const carried = next.includes('booted·from·the·token·and·did·the·session\'s·work');
    const undone = /^UNDONE /.test(cli('undo', id).stdout);
    const identical = JSON.stringify(snap()) === JSON.stringify(before);
    const plans = () => (existsSync(join(home, 'plans')) ? readdirSync(join(home, 'plans')).length : 0);
    const plansBefore = plans();
    writeFileSync(drifted, driftedCases(readFileSync(sent, 'utf8'))[0].text);
    const d = cli('in', sent, drifted, '--now', '2026-11-05_1240H');
    facts.handback = { plan: id !== '', applied, logWritten, carried, undone, identical, logGone: !existsSync(join(mem, 'symbfer-handoff-log.md')),
      driftRefused: d.status !== 0 && /^REFUSED: drift/.test(d.stdout), driftPlans: plans() - plansBefore };
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }

// N2: 2,000 garbage inputs to every exported function; the witness run from local/n2.json
{
  const r = rng(97), pick = (a) => a[Math.floor(r() * a.length)];
  const toxic = { get name() { throw new Error('toxic'); }, get notes() { throw new Error('toxic'); } };
  const garbage = [null, undefined, 0, -1, NaN, 1e309, '', ' ', '---', '---\nname: x\n---\nNext: y', '2026-11-05_1200H', 'full', 'shareable', 'public', [], [null], {}, toxic,
    { now: '2026-11-05_1200H', notes: [null, { name: 'a', description: 'b', type: 'project', next: [5, 'c'] }, { name: 'u', description: 'v', type: 'user', public: true }] },
    { now: '2026-11-05_1200H', notes: 'x', about: toxic, handoff: { sessions: [toxic], resolved: [5], milestones: [{}], lessons: [null] } }, { privateNames: [toxic], surnames: 'x' },
    () => 1, Symbol.iterator, new Uint8Array([0xff]), 'a'.repeat(5000), Object.create(null), 10n];
  const PER = 2000;
  let functions = 0, inputs = 0, throws = 0;
  for (const fn of Object.values(organ)) {
    if (typeof fn !== 'function') continue;
    functions++;
    for (let k = 0; k < PER; k++) { inputs++; try { fn(pick(garbage), pick(garbage), pick(garbage), pick(garbage)); } catch { throws++; } }
  }
  const n2 = existsSync(join(ROOT, 'local', 'n2.json')) ? JSON.parse(readFileSync(join(ROOT, 'local', 'n2.json'), 'utf8')) : null;
  facts.gate = { fuzzFunctions: functions, fuzzPerFunction: PER, fuzzInputs: inputs, fuzzThrows: throws, witness: n2 ? n2.witness : null };
}

// the rules sealed in claims-notes.json
const f = facts, c = f.content || {}, h = f.handback || {}, w = f.gate.witness, n = SLICES.length * SHAPES.length;
const n1 = !!f.written && f.written.tokens === n && f.written.withheld === 0 && f.verify.verified === n && f.verify.refusedByKar === n && f.copy.keyPinned &&
  f.oracle.v62 === f.oracle.of && f.oracle.v30 === f.oracle.of && c.full === c.notes && c.shareable === c.shareableOf && c.public === c.publicOf && c.otherInPublic === 0 &&
  c.plantedFound.length === 0 && h.plan && h.applied && h.logWritten && h.carried && h.undone && h.identical && h.logGone && h.driftRefused && h.driftPlans === 0;
const verdicts = [
  { id: 'N1', held: n1,
    why: f.written.tokens + ' of ' + n + ' written (' + f.written.withheld + ' withheld); ' + f.verify.verified + ' verified with the pinned key, ' + f.verify.refusedByKar + ' refused against Kar\'s; SYMBEYOND\'s validator ' +
      f.oracle.v62 + '/' + f.oracle.of + ' and teslasolar\'s engine ' + f.oracle.v30 + '/' + f.oracle.of + ' PASS; notes held: full ' + c.full + '/' + c.notes + ', shareable ' + c.shareable + '/' + c.shareableOf +
      ', public ' + c.public + '/' + c.publicOf + ' and ' + c.otherInPublic + ' others; ' + c.plantedFound.length + ' of ' + c.planted + ' planted values found in a token that leaves; hand-back ' +
      (h.plan && h.applied && h.carried && h.undone && h.identical && h.logGone ? 'planned, applied, carried into the next passport and undone byte for byte' : 'NOT closed') + '; the drifted return ' + (h.driftRefused && h.driftPlans === 0 ? 'refused, no plan' : 'NOT refused') },
  { id: 'N2', held: !!w && w.clean === true && w.capped === false && w.baselined === 0 && f.gate.fuzzThrows === 0 && f.gate.fuzzFunctions > 0,
    why: (w ? 'witness ' + w.killed + '/' + w.total + (w.clean ? ' clean' : ' NOT clean') + (w.capped ? ', capped' : '') + ', ' + w.baselined + ' baselined' : 'no witness run recorded') + '; ' +
      f.gate.fuzzInputs + ' fuzz inputs to ' + f.gate.fuzzFunctions + ' functions, ' + f.gate.fuzzThrows + ' throws' },
];
const receipt = { kind: 'kar-passport.receipt.notes', claims: 'claims-notes.json', facts, verdicts, held: verdicts.filter((v) => v.held).length, of: verdicts.length };
for (const v of verdicts) console.log((v.held ? 'HELD   ' : 'FAILED ') + v.id + '  ' + v.why);
const path = join(ROOT, 'receipts', 'notes.json');
if (CHECK) {
  const old = JSON.parse(readFileSync(path, 'utf8'));
  if (JSON.stringify({ facts: old.facts, verdicts: old.verdicts }) !== JSON.stringify({ facts, verdicts })) {
    console.error('the team-notes receipt does not reproduce');
    for (const k of Object.keys(facts)) if (JSON.stringify(old.facts[k]) !== JSON.stringify(facts[k])) console.error('  ' + k + ': ' + JSON.stringify(old.facts[k]) + ' → ' + JSON.stringify(facts[k]));
    process.exit(1);
  }
  console.log('the team-notes receipt reproduces');
} else writeFileSync(path, JSON.stringify(receipt, null, 1) + '\n');
