#!/usr/bin/env node
// kar/passport.mjs: Kar's passport on this machine. Thin I/O around the gated organs; it never sends a token anywhere.
//
//   node kar/passport.mjs key                         make Kar's passport key once (seed kept in ~/.kar-passport/,
//                                                     never in the repo); print its public key (keys/kar.json pins it)
//   node kar/passport.mjs generate [--target t] [--out dir] [--now YYYY-MM-DD_HHMMH]
//                                                     the slice(s) from Kar's memory, in every shape, sealed. Default out:
//                                                     ~/.kar-passport/tokens/<now>/. A public or shareable token that
//                                                     the leak gate flags is NOT written.
//   node kar/passport.mjs notes [--target t] [--out dir] [--now YYYY-MM-DD_HHMMH]
//                                                     the same, from a team's own notes folder (src/notes.mjs): the folder
//                                                     config.json names as memory, with its about and private fields
//   node kar/passport.mjs publish <public.v6.2.txt>   copy a public token into the repo's tokens/ after re-running the gate
//   node kar/passport.mjs verify <file>               verify-before-parse against the pinned keys (keys/kar.json, yours,
//                                                     and keys/trusted/*.json, colleagues'); say whose key; print the boot order
//   node kar/passport.mjs trust <key file> <name>     pin a colleague's public key (the JSON their `key` printed) as
//                                                     keys/trusted/<name>.json, so their passports verify
//   node kar/passport.mjs untrust <name>              remove it: the passports that key sealed are refused again
//   node kar/passport.mjs in <sent> <returned> [--memory dir]
//                                                     drift check, then the ingest plan, saved for review (nothing written)
//   node kar/passport.mjs apply <id> [--memory dir]   write the reviewed plan; the bytes before are kept
//   node kar/passport.mjs undo <id>                   put those bytes back
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { makeIdentity, hex, unhex } from '../vendor/fall-kit-core/identity.mjs';
import { seal, verify, parseToken, shaOf } from '../src/seal.mjs';
import { render62, render30, tierFit } from '../src/render.mjs';
import { TIER_SIG } from '../src/symbfer.mjs';
import { buildSlice } from '../src/slice.mjs';
import { notesSlice, listsOf } from '../src/notes.mjs';
import { scan, protocolLines } from '../src/leak.mjs';
import { driftCheck, ingestPlan, readLog } from '../src/drift.mjs';
import { readInputs, readLists, teamInput, PATHS, CONFIG, CONFIG_FILE, CONFIG_PROBLEM } from './inputs.mjs';
import { textOf, jsonOf } from './text.mjs';
import { keyOf, nameOk, trustOf } from './trust.mjs';

const REPO = join(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const stampNow = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + 'H'; };
const rd = (p, fb) => { try { return textOf(readFileSync(p)); } catch { return fb; } };
export const SHAPES = ['v6.2', 'v3.0', 'nano', 'core', 'state'];

export async function karKey(create = false) {
  const p = join(PATHS.keys, 'kar.seed');
  if (!existsSync(p)) {
    if (!create) throw new Error('no passport key: run `node kar/passport.mjs key > keys/kar.json` once');
    mkdirSync(PATHS.keys, { recursive: true });
    writeFileSync(p, hex(randomBytes(32)) + '\n', { mode: 0o600 });
  }
  return makeIdentity(unhex(rd(p, '').trim()));
}

/** The keys this clone trusts (kar/trust.mjs): yours, pinned in keys/kar.json, then each colleague's in keys/trusted/. */
const TRUSTED = join(REPO, 'keys', 'trusted');
const pinnedOthers = () => { try { return readdirSync(TRUSTED).filter((f) => f.endsWith('.json')).sort().map((f) => [f.slice(0, -5), rd(join(TRUSTED, f), '')]); } catch { return []; } };
export const trusted = () => trustOf(rd(join(REPO, 'keys', 'kar.json'), ''), pinnedOthers());
export const trustList = () => trusted().ids;
const NO_PIN = 'no key is pinned: run `node kar/passport.mjs key > keys/kar.json` once';

/** Every shape of one slice, sealed. */
export async function tokensOf(slice, id, now) {
  const out = { 'v6.2': await seal(render62(slice.model62), id), 'v3.0': await seal(render30(slice.model30), id) };
  for (const t of ['nano', 'core', 'state']) {
    const f = tierFit(slice.model62, t, now);
    out[t] = f.ok ? await seal(f.text + TIER_SIG, id) : '';
  }
  return out;
}

async function generate(team = false) {
  if (CONFIG_PROBLEM) { console.error('REFUSED: ' + CONFIG_FILE + ' could not be read: ' + CONFIG_PROBLEM); process.exitCode = 1; return; }
  const now = arg('--now', stampNow());
  const id = await karKey();
  const mem = arg('--memory', PATHS.memory);
  if (!mem || !existsSync(mem)) { console.error('REFUSED: no notes folder ' + (mem ? 'at ' + mem : 'named') + ': set "memory" in ' + CONFIG_FILE + ' to your notes folder'); process.exitCode = 1; return; }
  const base = readLists();
  const lists = team ? listsOf(CONFIG.about, base, CONFIG.private) : base;
  if (!lists) { console.error('REFUSED: the leak gate lists could not be read from config.json'); process.exitCode = 1; return; }
  const input = team ? teamInput(now, mem) : readInputs(now, mem);
  const make = team ? (target, refs) => notesSlice(input, lists, target, refs) : (target, refs) => buildSlice(input, lists, target, refs);
  const refsPath = join(PATHS.keys, 'refs.json');
  let refs = JSON.parse(rd(refsPath, '{}'));
  const out = arg('--out', join(PATHS.keys, 'tokens', now));
  mkdirSync(out, { recursive: true });
  const targets = arg('--target') ? [arg('--target')] : ['full', 'shareable', 'public'];
  const summary = [];
  for (const target of targets) {
    const s = make(target, refs);
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
  const t = trusted();
  if (!t.ids.length) { console.log('REFUSED: ' + NO_PIN); process.exitCode = 1; return; }
  const p = await parseToken(rd(file, ''), { trust: t.ids });
  if (!p.ok) { console.log('REFUSED: ' + p.refused); process.exitCode = 1; return; }
  console.log('VERIFIED ' + p.context.format + ' · signed by ' + t.names[p.context.key] + ' (key ' + p.context.key.slice(0, 16) + '…) · sha256 ' + p.context.sha);
  p.context.boot.forEach((s, i) => console.log((i + 1) + '. ' + s));
}

function planDir() { return join(PATHS.keys, 'plans'); }

async function cmdIn(sentFile, backFile) {
  const sent = rd(sentFile, ''), back = rd(backFile, '');
  if (!trustList().length) { console.log('REFUSED: ' + NO_PIN); process.exitCode = 1; return; }
  const v = await verify(sent, { trust: trustList() });
  if (!v.ok) { console.log('REFUSED: the sent token does not verify against the pinned keys: ' + v.why); process.exitCode = 1; return; }
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

/** Pin a colleague's public key under a name; refuse, changing nothing, anything that is not a new key under a new plain name. */
function cmdTrust(file, name) {
  const refuse = (why) => { console.log('REFUSED: ' + why); process.exitCode = 1; };
  if (!nameOk(name)) return refuse('"' + (name || '') + '" is not a name a key can be pinned under: use letters, digits and . _ - (a letter or digit first), at most 64 characters');
  if (!file || !existsSync(file) || !statSync(file).isFile()) return refuse('no key file at ' + (file || '(none given)') + ': give the file your colleague\'s `node kar/passport.mjs key` printed');
  const k = keyOf(rd(file, ''));
  if (!k.ok) return refuse(file + ' is ' + k.why);
  if (existsSync(join(TRUSTED, name + '.json'))) return refuse('a key is already pinned as ' + name + ': untrust it first, or choose another name');
  const t = trusted();
  if (Object.hasOwn(t.names, k.id)) return refuse(t.names[k.id] === 'you' ? 'that is your own key, already pinned in keys/kar.json' : 'that key is already pinned, as ' + t.names[k.id]);
  mkdirSync(TRUSTED, { recursive: true });
  writeFileSync(join(TRUSTED, name + '.json'), JSON.stringify({ kind: 'kar-passport.key', id: k.id, note: 'A colleague\'s passport key, pinned as ' + name + ' by node kar/passport.mjs trust. Remove it with node kar/passport.mjs untrust ' + name + '.' }, null, 1) + '\n');
  console.log('TRUSTED ' + name + ' (key ' + k.id.slice(0, 16) + '…): verify and in now accept the passports it seals. Remove it with: node kar/passport.mjs untrust ' + name);
}

function cmdUntrust(name) {
  if (!nameOk(name) || !existsSync(join(TRUSTED, name + '.json'))) { console.log('REFUSED: no key is pinned as ' + (name || '(none given)') + ': the pinned names are the files in keys/trusted/'); process.exitCode = 1; return; }
  rmSync(join(TRUSTED, name + '.json'));
  console.log('UNTRUSTED ' + name + ': the passports its key sealed are refused again');
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
  try {
    if (cmd === 'key') {
      const id = await karKey(true);
      console.log(JSON.stringify({ kind: 'kar-passport.key', id: id.id, note: 'A passport key: the public half. Its seed stays on the machine that made it; every passport it seals verifies against this.' }, null, 1));
    } else if (cmd === 'generate') await generate();
    else if (cmd === 'notes') await generate(true);
    else if (cmd === 'verify') await cmdVerify(a);
    else if (cmd === 'trust') cmdTrust(a, b);
    else if (cmd === 'untrust') cmdUntrust(a);
    else if (cmd === 'publish') await cmdPublish(a);
    else if (cmd === 'in') await cmdIn(a, b);
    else if (cmd === 'apply') cmdApply(a);
    else if (cmd === 'undo') cmdUndo(a);
    else { console.error('usage: node kar/passport.mjs key | generate [--target t] | notes [--target t] | publish <file> | verify <file> | trust <key file> <name> | untrust <name> | in <sent> <returned> | apply <id> | undo <id>'); process.exitCode = 2; }
  } catch (e) { console.error('REFUSED: ' + (e && e.message ? e.message : String(e))); process.exitCode = 1; }
}
