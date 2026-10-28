// src/drift.test.mjs: claim P7 on the synthetic token (measure.mjs runs it on Kar's full token), and the ingest plan:
// it carries every added line, only grows the log, refuses a token already merged, and reads back into the next slice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driftCheck, ingestPlan, readLog, mergedOf, indexLine, itemsOf } from './drift.mjs';
import { render62 } from './render.mjs';
import { syntheticModel } from '../fixtures/synthetic-model.mjs';
import { honestUpdate, driftedCases } from '../fixtures/drift-cases.mjs';

const sent = render62(syntheticModel());
const H = (c) => c.repeat(64);

test('the honest update is accepted with no drift, and what it added is listed line for line', () => {
  const back = honestUpdate(sent);
  const r = driftCheck(sent, back);
  assert.deepEqual(r.drift, []);
  assert.equal(r.ok, true);
  assert.deepEqual(r.added.session, ['SESSION·2026-10-29 {', '  ACCOMPLISHED {', '    booted·from·the·token·and·did·the·session\'s·work', '  }',
    '  QUEUED·FOR·NEXT·SESSION {', '    merge·the·updated·token·into·memory', '  }', '}']);
  assert.deepEqual(r.added.milestones, ['MILESTONE·LOOP-2026-10-29: the·handoff·loop·closed', 'DATE: 2026-10-29', 'WHAT: a·fresh·session·worked·from·the·token·and·handed·it·back',
    'OUTCOME: merged·into·memory', 'SOURCE: the·returned·token']);
  assert.deepEqual(r.added.lessons, ['L2: a·token·travels·memory·stays·home']);
  assert.equal(r.added.resolved[0], 'RESOLVED·02: a·second·van');
  assert.deepEqual(r.added.threadsClosed, ['a·second·van']);
  assert.ok(r.added.current.includes('AS·OF: 2026-10-29'));
});

test('P7 on the synthetic token: every forbidden change is refused, naming its section and rule', () => {
  const cases = driftedCases(sent);
  assert.ok(cases.length > 40, cases.length + ' cases');
  for (const c of cases) {
    const r = driftCheck(sent, c.text);
    assert.equal(r.ok, false, c.section + ' ' + c.why);
    assert.equal(r.added, null);
    assert.ok(r.drift.some((d) => d.section === c.section || (c.section === 'TRANSFER·MODE' && d.section === c.section)), c.section + ' ' + c.why + ' → ' + JSON.stringify(r.drift));
    for (const d of r.drift) assert.ok(typeof d.rule === 'string' && d.rule.length > 20);
  }
  const sections = new Set(cases.map((c) => c.section));
  for (const s of ['META', 'IDENTITY', 'ETHOS', 'BOOT·PROTOCOL', 'RELATIONAL·RULES', 'REF·ENCODING', 'SESSION·LOG', 'CLOSED·MILESTONES', 'LESSONS·LEARNED', 'RESOLVED', 'OPEN·THREADS']) assert.ok(sections.has(s), s);
});

test('the drift check refuses a broken shape, and the header, the closing and the section list are held', () => {
  assert.equal(driftCheck(sent, 'hello').drift[0].section, 'TOKEN');
  assert.match(driftCheck(sent, sent.replace('\n', '\r\n')).drift[0].detail, /carriage return/);
  assert.equal(driftCheck(sent, sent.replace('§IDENTITY·BEGIN\n', '')).ok, false);
  assert.equal(driftCheck(sent, sent.replace('∴SYMB-FER·v6.2·LIVING·TOKEN·[2026-10-28_1600H]', '∴SYMB-FER·v6.2·LIVING·TOKEN·[2026-10-29_0100H]')).ok, true);
  assert.equal(driftCheck(sent, sent.replace('∴SYMB-FER·v6.2·LIVING·TOKEN·[2026-10-28_1600H]', '∴SYMB-FER·v6.2·LIVING·TOKEN·[tomorrow]')).drift[0].section, 'HEADER');
  assert.equal(driftCheck(sent, sent.replace('SYMBEYOND·AI·LLC·|·symbeyond.ai', 'SYMBEYOND·AI·LLC·|·elsewhere')).drift[0].section, 'HEADER');
  assert.equal(driftCheck(sent, sent.replace(/λ\.collaborator·∧·!λ\.tool·∴\n$/, 'λ.collaborator·∧·!λ.tool·∴·x\n')).drift[0].section, 'CLOSING');
  assert.equal(driftCheck(sent, sent.replace('GENERATED: 2026-10-28_1600H', 'GENERATED: 2026-10-30_0000H')).ok, true);
  assert.equal(driftCheck(sent, sent.replace('GENERATED: 2026-10-28_1600H', 'GENERATED: soon')).drift[0].section, 'META');
  const extra = sent.replace('§TRANSFER·MODE·BEGIN', '§EXTRA·BEGIN\nx\n§EXTRA·END\n\n§TRANSFER·MODE·BEGIN');
  assert.ok(driftCheck(sent, extra).drift.some((d) => d.section === 'TOKEN' || d.section === 'HEADER'));
  assert.equal(driftCheck(sent, sent.replace('STATUS: VERIFIED\nMODE: WORKING', 'STATUS: DONE\nMODE: CLOSED')).ok, true, '§FINALIZATION may change');
  assert.equal(driftCheck('x', sent).ok, false);
  assert.equal(driftCheck(null, sent).ok, false);
  assert.equal(driftCheck(sent, 5).ok, false);
  assert.equal(driftCheck(sent, sent.replace('§META·END', '§META·ENDS')).ok, false);
});

test('the ingest plan carries every added line, only grows the log, and refuses a token already merged', () => {
  const back = honestUpdate(sent);
  const r = driftCheck(sent, back);
  const p = ingestPlan(r.added, '', { sent: H('a'), back: H('b'), at: '2026-10-29_0900H' });
  assert.equal(p.ok, true);
  assert.equal(p.id, 'bbbbbbbbbbbbbbbb');
  for (const k of ['session', 'milestones', 'lessons', 'resolved', 'current']) for (const l of r.added[k]) assert.ok(p.after.includes('    ' + l), l);
  const entries = readLog(p.after);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].items.sessions, [{ date: '2026-10-29', accomplished: ['booted from the token and did the session\'s work'], queued: ['merge the updated token into memory'] }]);
  assert.deepEqual(entries[0].items.milestones, [{ id: 'LOOP-2026-10-29', name: 'the handoff loop closed', date: '2026-10-29', what: 'a fresh session worked from the token and handed it back', outcome: 'merged into memory', source: 'the returned token' }]);
  assert.deepEqual(entries[0].items.lessons, ['a token travels memory stays home']);
  assert.deepEqual(entries[0].items.threadsClosed, ['a second van']);
  assert.match(p.after, /^---\nname: symbfer-handoff-log\n/);
  assert.equal(p.index, indexLine(entries));
  assert.match(p.index, /\(1 so far, last 2026-10-29_0900H\)/);
  const again = ingestPlan(r.added, p.after, { sent: H('a'), back: H('b'), at: '2026-10-29_1000H' });
  assert.match(again.why, /already merged/);
  const second = ingestPlan(r.added, p.after, { sent: H('b'), back: H('c'), at: '2026-10-29_1000H' });
  assert.equal(readLog(second.after).length, 2);
  assert.ok(second.after.includes(p.after.split('```json')[0].split('\n').slice(10).join('\n').trim()), 'the earlier entry is still there, verbatim');
  assert.deepEqual(mergedOf(readLog(second.after)).lessons, ['a token travels memory stays home', 'a token travels memory stays home']);
  assert.match(ingestPlan(r.added, 'a hand-written note', { sent: H('a'), back: H('d'), at: '2026-10-29_0900H' }).why, /refusing to overwrite/);
  for (const bad of [null, { sent: 'x', back: H('b'), at: '2026-10-29_0900H' }, { sent: H('a'), back: 'B', at: '2026-10-29_0900H' }, { sent: H('a'), back: H('b'), at: 'now' }]) {
    assert.equal(ingestPlan(r.added, '', bad).ok, false);
  }
  assert.equal(ingestPlan(null, '', { sent: H('a'), back: H('b'), at: '2026-10-29_0900H' }).ok, false);
});

test('the log readers are total', () => {
  assert.deepEqual(readLog(null), []);
  assert.deepEqual(readLog('no block'), []);
  assert.deepEqual(readLog('```json\n{bad\n```'), []);
  assert.deepEqual(readLog('```json\n{"entries":3}\n```'), []);
  assert.deepEqual(mergedOf(null), { sessions: [], milestones: [], lessons: [], resolved: [] });
  assert.deepEqual(mergedOf([{}, { items: { lessons: ['x'], sessions: 'no' } }]).lessons, ['x']);
  assert.match(indexLine([]), /\(0 so far, last never\)/);
  assert.deepEqual(itemsOf({}), { sessions: [], milestones: [], lessons: [], resolved: [], threadsClosed: [], current: [] });
  assert.deepEqual(itemsOf({ session: ['SESSION·bad {'], milestones: ['MILESTONE·x'], lessons: ['no colon'], resolved: ['RESOLVED·x'] }).sessions, []);
});

test('a section added or removed on the way back is named; FINALIZATION may change beside an honest update; a sealed passport sent, an unsealed one returned', async () => {
  const { seal } = await import('./seal.mjs');
  const { makeIdentity } = await import('../vendor/fall-kit-core/identity.mjs');
  const notation = '§SYMB·NOTATION·BEGIN\n# OPTIONAL SECTION.\n§SYMB·NOTATION·END\n\n§INTEGRITY·BEGIN';
  const added = driftCheck(sent, sent.replace('§INTEGRITY·BEGIN', notation));
  assert.equal(added.ok, false);
  assert.ok(added.drift.some((d) => d.section === 'SYMB·NOTATION' && d.detail === 'added'), JSON.stringify(added.drift));
  const withIt = sent.replace('§INTEGRITY·BEGIN', notation);
  const removed = driftCheck(withIt, sent);
  assert.ok(removed.drift.some((d) => d.section === 'SYMB·NOTATION' && d.detail === 'removed'), JSON.stringify(removed.drift));
  const fin = honestUpdate(sent).replace('STATUS: VERIFIED\nMODE: WORKING', 'STATUS: DONE\nMODE: CLOSED');
  const r = driftCheck(sent, fin);
  assert.equal(r.ok, true);
  assert.ok(r.added.current.includes('AS·OF: 2026-10-29') && !r.added.current.includes('STATUS: DONE'));
  const id = await makeIdentity(new Uint8Array(32).fill(7));
  const sealed = await seal(sent, id);
  const back = driftCheck(sealed, honestUpdate(sealed));
  assert.equal(back.ok, true, JSON.stringify(back.drift));
  assert.equal(driftCheck(sealed, sealed.replace(/λ\.collaborator·∧·!λ\.tool·∴\n$/, 'x\n')).drift[0].section, 'CLOSING');
  assert.equal(driftCheck(sent, 'x\n§SIG·BEGIN').ok, false);
  assert.deepEqual(itemsOf('a string'), { sessions: [], milestones: [], lessons: [], resolved: [], threadsClosed: [], current: [] });
  assert.deepEqual(itemsOf({ session: ['SESSION·2026-10-29 {', '  ACCOMPLISHED {', '    a', '  }', '}'] }).sessions, [{ date: '2026-10-29', accomplished: ['a'], queued: [] }]);
});
