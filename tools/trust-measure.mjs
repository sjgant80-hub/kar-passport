#!/usr/bin/env node
// tools/trust-measure.mjs: the facts behind claims-trust.json (R1 a colleague's passport checked once their key is
// pinned, R2 the trust organ gated), judged by the rules sealed there, written to receipts/trust.json.
//   node tools/trust-measure.mjs           measure and write the receipt (R2's witness run is read from local/r2.json)
//   node tools/trust-measure.mjs --check   in CI: re-derive every fact here and fail if any differs from the receipt
// R1 runs the handover as three people would, each with the command line itself in a fresh copy of the committed
// repository (git archive of HEAD) and a fresh home folder, on a copy of the made-up team's notes in fixtures/team-notes/.
// The witness itself runs as its own CI step on every push and fails the build on any survivor; local/r2.json records
// the first run.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as organ from '../kar/trust.mjs';
import { rng } from './fuzz.mjs';

const ROOT = join(import.meta.dirname, '..');
const FIX = join(ROOT, 'fixtures', 'team-notes');
const NOW = '2026-11-06_1200H';

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

async function measure() {
  const facts = {};
  const tmp = mkdtempSync(join(tmpdir(), 'kp-trust-'));
  try {
    const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD'], { cwd: ROOT, maxBuffer: 1 << 28 });
    const fx = JSON.parse(readFileSync(join(FIX, 'config.json'), 'utf8'));
    const person = (who) => {
      const dir = join(tmp, who), copy = join(dir, 'repo'), home = join(dir, 'home'), mem = join(dir, 'notes');
      mkdirSync(copy, { recursive: true }); mkdirSync(home);
      const copied = extract(tar, copy);
      cpSync(FIX, mem, { recursive: true });
      writeFileSync(join(home, 'config.json'), JSON.stringify({ memory: mem, about: fx.about, private: fx.private }, null, 1) + '\n');
      const env = { ...process.env, KAR_PASSPORT_DIR: home };
      const cli = (...a) => spawnSync(process.execPath, [join(copy, 'kar', 'passport.mjs'), ...a], { cwd: copy, env, encoding: 'utf8', maxBuffer: 1 << 26 });
      // (1) the key, its output written to their own keys/kar.json; then the notes command
      writeFileSync(join(copy, 'keys', 'kar.json'), cli('key').stdout);
      cli('notes', '--now', NOW);
      const out = join(home, 'tokens', NOW);
      const passports = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith('.txt')).sort().map((f) => join(out, f)) : [];
      return { who, copy, keyFile: join(copy, 'keys', 'kar.json'), cli, passports, copied };
    };
    const A = person('a'), B = person('b'), C = person('c');
    const trustedDir = join(B.copy, 'keys', 'trusted');
    const snap = () => (existsSync(trustedDir) ? JSON.stringify(readdirSync(trustedDir).sort().map((f) => [f, readFileSync(join(trustedDir, f), 'utf8')])) : '[]');
    const checks = (who, files) => {
      let verified = 0, refused = 0, namedA = 0;
      for (const f of files) {
        const r = who.cli('verify', f);
        if (r.status === 0 && /^VERIFIED /.test(r.stdout)) verified++;
        if (r.status !== 0 && /^REFUSED: /.test(r.stdout)) refused++;
        if (/^VERIFIED [^\n]* · signed by a \(key /.test(r.stdout)) namedA++;
      }
      return { of: files.length, verified, refused, namedA };
    };
    facts.copies = { fromHead: [A, B, C].every((p) => p.copied > 0), written: [A, B, C].map((p) => p.passports.length) };
    // (2) B checks A's passports, nothing of A's pinned
    facts.before = checks(B, A.passports);
    // (3) B pins A's key as a, then checks A's and B's own
    const t = B.cli('trust', A.keyFile, 'a');
    facts.trust = { exit: t.status, said: /^TRUSTED a \(key /.test(t.stdout), pinned: existsSync(join(trustedDir, 'a.json')) };
    facts.pinnedA = checks(B, A.passports);
    facts.ownWhilePinned = checks(B, B.passports);
    // (4) C's key is never pinned
    facts.stranger = checks(B, C.passports);
    // (5) four bad pins, each refused with a reason, each leaving keys/trusted as it was
    {
      const notKey = join(tmp, 'not-a-key.json');
      writeFileSync(notKey, readFileSync(join(FIX, 'MEMORY.md')));
      const tries = [['not a key file', notKey, 'x'], ['a name already used', C.keyFile, 'a'], ['B\'s own key', B.keyFile, 'me'], ['not a plain file name', C.keyFile, '../c']];
      facts.badPins = tries.map(([what, file, name]) => {
        const before = snap(), r = B.cli('trust', file, name);
        return { what, exit: r.status, reason: /^REFUSED: \S/.test(r.stdout), unchanged: snap() === before };
      });
    }
    // (6) B unpins a, then checks A's and B's own again
    const u = B.cli('untrust', 'a');
    facts.untrust = { exit: u.status, said: /^UNTRUSTED a: /.test(u.stdout), gone: !existsSync(join(trustedDir, 'a.json')) };
    facts.afterUnpin = checks(B, A.passports);
    facts.ownAfterUnpin = checks(B, B.passports);
  } finally { rmSync(tmp, { recursive: true, force: true }); }

  // R2: 2,000 garbage inputs to every exported function; the witness run from local/r2.json
  {
    const r = rng(61), pick = (a) => a[Math.floor(r() * a.length)];
    const toxic = { get id() { throw new Error('toxic'); }, toString() { throw new Error('toxic'); }, get 0() { throw new Error('toxic'); } };
    const thrower = [null]; Object.defineProperty(thrower, 0, { get() { throw new Error('toxic'); } });
    const garbage = [null, undefined, 0, -1, NaN, 1e309, '', ' ', 'con', '../a', 'a', 'x'.repeat(65), '{', '{}', 'null', '{"id":5}', '{"id":"' + 'ab'.repeat(32) + '"}',
      [], [null], [[]], [['a', '{}']], [[toxic, toxic]], [['b', '{"id":"' + 'cd'.repeat(32) + '"}'], 'z'], thrower, {}, toxic, () => 1, Symbol.iterator, new Uint8Array([0xff]), 'a'.repeat(5000), Object.create(null), 10n];
    const PER = 2000;
    let functions = 0, inputs = 0, throws = 0;
    for (const fn of Object.values(organ)) {
      if (typeof fn !== 'function') continue;
      functions++;
      for (let k = 0; k < PER; k++) { inputs++; try { fn(pick(garbage), pick(garbage), pick(garbage), pick(garbage)); } catch { throws++; } }
    }
    const r2 = existsSync(join(ROOT, 'local', 'r2.json')) ? JSON.parse(readFileSync(join(ROOT, 'local', 'r2.json'), 'utf8')) : null;
    facts.gate = { fuzzFunctions: functions, fuzzPerFunction: PER, fuzzInputs: inputs, fuzzThrows: throws, witness: r2 ? r2.witness : null };
  }
  return facts;
}

// the rules sealed in claims-trust.json
export function verdictsOf(f) {
  const N = 15, all = (c, k) => !!c && c.of === N && c[k] === N;
  const w = f.gate.witness;
  const r1 = f.copies.fromHead && f.copies.written.every((n) => n === N) && all(f.before, 'refused') &&
    f.trust.exit === 0 && f.trust.said && f.trust.pinned && all(f.pinnedA, 'verified') && all(f.pinnedA, 'namedA') && all(f.ownWhilePinned, 'verified') &&
    all(f.stranger, 'refused') && f.badPins.length === 4 && f.badPins.every((b) => b.exit !== 0 && b.reason && b.unchanged) &&
    f.untrust.exit === 0 && f.untrust.said && f.untrust.gone && all(f.afterUnpin, 'refused') && all(f.ownAfterUnpin, 'verified');
  const said = (c) => c.verified + ' verified, ' + c.refused + ' refused of ' + c.of;
  return [
    { id: 'R1', held: r1,
      why: 'passports written: ' + f.copies.written.join(', ') + '; A\'s before pinning: ' + said(f.before) + '; pinned as a: ' + (f.trust.exit === 0 && f.trust.pinned ? 'yes' : 'NO') +
        '; A\'s then: ' + said(f.pinnedA) + ', ' + f.pinnedA.namedA + ' naming a; B\'s own: ' + said(f.ownWhilePinned) + '; C\'s, never pinned: ' + said(f.stranger) +
        '; bad pins refused with a reason and nothing changed: ' + f.badPins.filter((b) => b.exit !== 0 && b.reason && b.unchanged).length + ' of ' + f.badPins.length +
        '; after untrust a: A\'s ' + said(f.afterUnpin) + ', B\'s own ' + said(f.ownAfterUnpin) },
    { id: 'R2', held: !!w && w.clean === true && w.capped === false && w.baselined === 0 && f.gate.fuzzThrows === 0 && f.gate.fuzzFunctions > 0,
      why: (w ? 'witness ' + w.killed + '/' + w.total + (w.clean ? ' clean' : ' NOT clean') + (w.capped ? ', capped' : '') + ', ' + w.baselined + ' baselined' : 'no witness run recorded') + '; ' +
        f.gate.fuzzInputs + ' fuzz inputs to ' + f.gate.fuzzFunctions + ' functions, ' + f.gate.fuzzThrows + ' throws' },
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const CHECK = process.argv.includes('--check');
  const facts = await measure(), verdicts = verdictsOf(facts);
  const receipt = { kind: 'kar-passport.receipt.trust', claims: 'claims-trust.json', facts, verdicts, held: verdicts.filter((v) => v.held).length, of: verdicts.length };
  for (const v of verdicts) console.log((v.held ? 'HELD   ' : 'FAILED ') + v.id + '  ' + v.why);
  const path = join(ROOT, 'receipts', 'trust.json');
  if (CHECK) {
    const old = JSON.parse(readFileSync(path, 'utf8'));
    if (JSON.stringify({ facts: old.facts, verdicts: old.verdicts }) !== JSON.stringify({ facts, verdicts })) {
      console.error('the trust receipt does not reproduce');
      for (const k of Object.keys(facts)) if (JSON.stringify(old.facts[k]) !== JSON.stringify(facts[k])) console.error('  ' + k + ': ' + JSON.stringify(old.facts[k]) + ' → ' + JSON.stringify(facts[k]));
      process.exit(1);
    }
    console.log('the trust receipt reproduces');
  } else writeFileSync(path, JSON.stringify(receipt, null, 1) + '\n');
}
