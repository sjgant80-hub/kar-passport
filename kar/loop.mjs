#!/usr/bin/env node
// kar/loop.mjs: claim L1, on a byte-copy of Kar's memory directory. The sent token, the token a fresh session returned,
// the drift check, the ingest plan, the plan applied to the copy, the full token generated again from the copy, and the
// plan undone; every file of the copy hashed before and after. Writes local/l1.json (facts, hashes, counts: nothing private).
//   node kar/loop.mjs <memoryCopyDir> <sent.v6.2.txt> <returned.v6.2.txt>
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { driftCheck, ingestPlan } from '../src/drift.mjs';
import { verify, shaOf } from '../src/seal.mjs';
import { validate62 } from '../src/symbfer.mjs';
import { trustList } from './passport.mjs';

const REPO = join(import.meta.dirname, '..');
const [mem, sentFile, backFile] = process.argv.slice(2);
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const hashes = () => Object.fromEntries(walk(mem).sort().map((p) => [relative(mem, p), createHash('sha256').update(readFileSync(p)).digest('hex')]));
const sent = readFileSync(sentFile, 'utf8'), back = readFileSync(backFile, 'utf8');
const facts = {};
const before = hashes();
facts.sentVerified = (await verify(sent, { trust: trustList() })).ok;
const d = driftCheck(sent, back);
facts.accepted = d.ok;
facts.drift = d.drift.map((x) => x.section + ': ' + x.detail);
if (d.ok) {
  const now = '2026-10-28_1745H';
  const logPath = join(mem, 'symbfer-handoff-log.md'), idx = join(mem, 'MEMORY.md');
  const logBefore = existsSync(logPath) ? readFileSync(logPath, 'utf8') : null, idxBefore = readFileSync(idx, 'utf8');
  const plan = ingestPlan(d.added, logBefore || '', { sent: shaOf(sent), back: shaOf(back), at: now });
  const added = ['session', 'milestones', 'lessons', 'resolved', 'current'].flatMap((k) => d.added[k]);
  facts.addedLines = added.length;
  facts.allLinesInPlan = plan.ok && added.every((l) => plan.after.includes('    ' + l));
  // apply (the CLI's apply does exactly these two writes), then generate again from the copy
  writeFileSync(logPath, plan.after);
  writeFileSync(idx, idxBefore.replace(/\n*$/, '\n') + plan.index + '\n');
  const out = join(mem, '..', 'regenerated');
  rmSync(out, { recursive: true, force: true });
  execFileSync(process.execPath, [join(REPO, 'kar', 'passport.mjs'), 'generate', '--target', 'full', '--memory', mem, '--out', out, '--now', '2026-10-28_1750H'], { stdio: 'ignore' });
  const again = readFileSync(join(out, 'full.v6.2.txt'), 'utf8');
  facts.regeneratedPass = validate62(again).status === 'PASS' && (await verify(again, { trust: trustList() })).ok;
  const sessionItems = d.added.session.filter((l) => /^ {4}\S/.test(l)).map((l) => l.trim());
  facts.carriesSession = sessionItems.length > 0 && sessionItems.every((x) => again.includes(x));
  const ms = d.added.milestones.find((l) => l.startsWith('MILESTONE·'));
  facts.carriesMilestone = !!ms && again.includes(ms.split(': ')[1]);
  const lesson = d.added.lessons[0];
  facts.carriesLesson = !!lesson && again.includes(lesson.split(': ').slice(1).join(': '));
  // undo: the bytes before
  if (logBefore === null) rmSync(logPath, { force: true }); else writeFileSync(logPath, logBefore);
  writeFileSync(idx, idxBefore);
  rmSync(out, { recursive: true, force: true });
  const after = hashes();
  facts.undoIdentical = JSON.stringify(after) === JSON.stringify(before);
  facts.files = Object.keys(before).length;
}
mkdirSync(join(REPO, 'local'), { recursive: true });
writeFileSync(join(REPO, 'local', 'l1.json'), JSON.stringify({ claim: 'L1', sent: shaOf(sent), returned: shaOf(back), session: 'a fresh Claude session (a new Kar), given only the token file and the written task', facts }, null, 1) + '\n');
console.log(JSON.stringify(facts, null, 1));
