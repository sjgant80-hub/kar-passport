#!/usr/bin/env node
// kar/passport.mjs: Kar's passport on this machine. Thin I/O around the gated organs; it never sends a token anywhere.
//
//   node kar/passport.mjs key                         make Kar's passport key once (seed kept in ~/.si-didy/passport/,
//                                                     never in the repo); print its public key (keys/kar.json pins it)
//   node kar/passport.mjs generate [--target t] [--out dir] [--now YYYY-MM-DD_HHMMH]
//                                                     the slice(s) from Kar's memory, in every shape, sealed. Default out:
//                                                     ~/.si-didy/passport/tokens/<now>/. A public or shareable token that
//                                                     the leak gate flags is NOT written.
//   node kar/passport.mjs publish <public.v6.2.txt>   copy a public token into the repo's tokens/ after re-running the gate
//   node kar/passport.mjs verify <file>               verify-before-parse against keys/kar.json; print the boot order
//   node kar/passport.mjs in <sent> <returned> [--memory dir]
//                                                     drift check, then the ingest plan, saved for review (nothing written)
//   node kar/passport.mjs apply <id> [--memory dir]   write the reviewed plan; the bytes before are kept
//   node kar/passport.mjs undo <id>                   put those bytes back
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { makeIdentity, hex, unhex } from '../vendor/fall-kit-core/identity.mjs';
import { seal, verify, parseToken, shaOf } from '../src/seal.mjs';
import { render62, render30, tierFit } from '../src/render.mjs';
import { TIER_SIG } from '../src/symbfer.mjs';
import { buildSlice } from '../src/slice.mjs';
import { scan, protocolLines } from '../src/leak.mjs';
import { driftCheck, ingestPlan, readLog } from '../src/drift.mjs';
import { readInputs, readLists, PATHS } from './inputs.mjs';

const REPO = join(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const stampNow = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + 'H'; };
const rd = (p, fb) => { try { return readFileSync(p, 'utf8'); } catch { return fb; } };
export const SHAPES = ['v6.2', 'v3.0', 'nano', 'core', 'state'];

export async function karKey(create = false) {
  const p = join(PATHS.keys, 'kar.seed');
  if (!existsSync(p)) {
    if (!create) throw new Error('no passport key: run `node kar/passport.mjs key` once');
    mkdirSync(PATHS.keys, { recursive: true });
    writeFileSync(p, hex(randomBytes(32)) + '\n', { mode: 0o600 });
  }
  return makeIdentity(unhex(readFileSync(p, 'utf8').trim()));
}

export const trustList = () => [JSON.parse(rd(join(REPO, 'keys', 'kar.json'), '{}')).id].filter(Boolean);

/** Every shape of one slice, sealed. */
export async function tokensOf(slice, id, now) {
  const out = { 'v6.2': await seal(render62(slice.model62), id), 'v3.0': await seal(render30(slice.model30), id) };
  for (const t of ['nano', 'core', 'state']) {
    const f = tierFit(slice.model62, t, now);
    out[t] = f.ok ? await seal(f.text + TIER_SIG, id) : '';
  }
  return out;
}

async function generate() {
  const now = arg('--now', stampNow());
  const id = await karKey();
  const inputs = readInputs(now, arg('--memory', PATHS.memory)), lists = readLists();
  const refsPath = join(PATHS.keys, 'refs.json');
  let refs = JSON.parse(rd(refsPath, '{}'));
  const out = arg('--out', join(PATHS.keys, 'tokens', now));
  mkdirSync(out, { recursive: true });
  const targets = arg('--target') ? [arg('--target')] : ['full', 'shareable', 'public'];
  const summary = [];
  for (const target of targets) {
    const s = buildSlice(inputs, lists, target, refs);
    if (!s.ok) { console.error(target + ': ' + s.why); process.exitCode = 1; continue; }
    if (target !== 'full') refs = { ...refs, ...s.refs };
    const toks = await tokensOf(s, id, now);
    for (const shape of SHAPES) {
      const t = toks[shape];
      if (!t) { summary.push({ target, shape, written: false, why: 'empty' }); continue; }
      if (target !== 'full') {
        const g = scan(t, lists, target, protocolLines());
        if (g.hits.length) { summary.push({ target, shape, written: false, why: 'leak gate: ' + g.hits.map((h) => h.cls + ' line ' + h.n).join(', ') }); process.exitCode = 1; continue; }
      }
      const file = join(out, target + '.' + shape + '.txt');
      writeFileSync(file, t);
      summary.push({ target, shape, written: true, bytes: Buffer.byteLength(t), sha256: shaOf(t), dropped: s.report.dropped });
    }
  }
  writeFileSync(refsPath, JSON.stringify(refs, null, 1) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ now, out, key: id.id, tokens: summary }, null, 1));
}

async function cmdVerify(file) {
  const p = await parseToken(rd(file, ''), { trust: trustList() });
  if (!p.ok) { console.log('REFUSED: ' + p.refused); process.exitCode = 1; return; }
  console.log('VERIFIED ' + p.context.format + ' · signed by ' + p.context.key.slice(0, 16) + '… · sha256 ' + p.context.sha);
  p.context.boot.forEach((s, i) => console.log((i + 1) + '. ' + s));
}

function planDir() { return join(PATHS.keys, 'plans'); }

async function cmdIn(sentFile, backFile) {
  const sent = rd(sentFile, ''), back = rd(backFile, '');
  const v = await verify(sent, { trust: trustList() });
  if (!v.ok) { console.log('REFUSED: the sent token does not verify as Kar\'s: ' + v.why); process.exitCode = 1; return; }
  const d = driftCheck(sent, back);
  if (!d.ok) { console.log('REFUSED: drift\n' + d.drift.map((x) => '  §' + x.section + ': ' + x.detail + ' (' + x.rule + ')').join('\n')); process.exitCode = 1; return; }
  const mem = arg('--memory', PATHS.memory);
  const logPath = join(mem, 'symbfer-handoff-log.md'), idxPath = join(mem, 'MEMORY.md');
  const before = { log: existsSync(logPath) ? rd(logPath, '') : null, index: rd(idxPath, '') };
  const plan = ingestPlan(d.added, before.log || '', { sent: shaOf(sent), back: shaOf(back), at: arg('--now', stampNow()) });
  if (!plan.ok) { console.log('REFUSED: ' + plan.why); process.exitCode = 1; return; }
  const lines = before.index.split('\n');
  const at = lines.findIndex((l) => l.startsWith('- [symbfer-handoff-log]('));
  const index = at >= 0 ? [...lines.slice(0, at), plan.index, ...lines.slice(at + 1)].join('\n') : before.index.replace(/\n*$/, '\n') + plan.index + '\n';
  mkdirSync(planDir(), { recursive: true });
  writeFileSync(join(planDir(), plan.id + '.json'), JSON.stringify({ id: plan.id, memory: mem, before, after: { log: plan.after, index }, entry: plan.entry, applied: false }, null, 1));
  console.log('PLAN ' + plan.id + ' (nothing written yet). It appends to ' + logPath + ':');
  for (const l of plan.entry.lines) console.log('  + ' + l);
  console.log('and sets the MEMORY.md line: ' + plan.index + '\nApply with: node kar/passport.mjs apply ' + plan.id);
}

function cmdApply(id) {
  const p = JSON.parse(rd(join(planDir(), id + '.json'), 'null'));
  if (!p) { console.log('no plan ' + id); process.exitCode = 1; return; }
  const logPath = join(p.memory, 'symbfer-handoff-log.md'), idxPath = join(p.memory, 'MEMORY.md');
  if ((existsSync(logPath) ? rd(logPath, '') : null) !== p.before.log || rd(idxPath, '') !== p.before.index) { console.log('REFUSED: memory changed since the plan was made; make the plan again'); process.exitCode = 1; return; }
  writeFileSync(logPath, p.after.log);
  writeFileSync(idxPath, p.after.index);
  p.applied = true;
  writeFileSync(join(planDir(), id + '.json'), JSON.stringify(p, null, 1));
  console.log('APPLIED ' + id + ': ' + readLog(p.after.log).length + ' hand-over(s) in the log. Undo with: node kar/passport.mjs undo ' + id);
}

function cmdUndo(id) {
  const p = JSON.parse(rd(join(planDir(), id + '.json'), 'null'));
  if (!p || !p.applied) { console.log('no applied plan ' + id); process.exitCode = 1; return; }
  const logPath = join(p.memory, 'symbfer-handoff-log.md'), idxPath = join(p.memory, 'MEMORY.md');
  if (p.before.log === null) rmSync(logPath, { force: true }); else writeFileSync(logPath, p.before.log);
  writeFileSync(idxPath, p.before.index);
  p.applied = false;
  writeFileSync(join(planDir(), id + '.json'), JSON.stringify(p, null, 1));
  console.log('UNDONE ' + id + ': the memory files are back to their bytes before the plan');
}

async function cmdPublish(file) {
  const t = rd(file, '');
  const v = await verify(t, { trust: trustList() });
  if (!v.ok) { console.log('REFUSED: ' + v.why); process.exitCode = 1; return; }
  if (!/^public\./.test(basename(file))) { console.log('REFUSED: only a public slice is ever committed'); process.exitCode = 1; return; }
  const g = scan(t, readLists(), 'public', protocolLines());
  if (g.hits.length) { console.log('REFUSED: leak gate: ' + JSON.stringify(g.hits)); process.exitCode = 1; return; }
  mkdirSync(join(REPO, 'tokens'), { recursive: true });
  writeFileSync(join(REPO, 'tokens', basename(file)), t);
  console.log('published tokens/' + basename(file) + ' (' + g.scanned + ' lines scanned, ' + g.exempt + ' protocol lines, 0 hits)');
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'key') {
    const id = await karKey(true);
    console.log(JSON.stringify({ kind: 'kar-passport.key', id: id.id, note: 'Kar\'s passport key: the public half. The seed stays on Kar\'s machine; every token Kar seals verifies against this.' }, null, 1));
  } else if (cmd === 'generate') await generate();
  else if (cmd === 'verify') await cmdVerify(a);
  else if (cmd === 'publish') await cmdPublish(a);
  else if (cmd === 'in') await cmdIn(a, b);
  else if (cmd === 'apply') cmdApply(a);
  else if (cmd === 'undo') cmdUndo(a);
  else { console.error('usage: node kar/passport.mjs key | generate [--target t] | publish <file> | verify <file> | in <sent> <returned> | apply <id> | undo <id>'); process.exitCode = 2; }
}
