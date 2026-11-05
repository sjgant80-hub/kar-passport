// src/notes.test.mjs: organ 8, a team's own notes → one slice (claims-notes.json N2 gates src/notes.mjs with these tests).
// The team is made up (Rowan Vale of Oak and Ash Joinery does not exist); no real person, firm or memory is here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteOf, ordered, listsOf, notesSlice, TARGETS } from './notes.mjs';
import { render62, render30, dot } from './render.mjs';
import { validate62, validate30 } from './symbfer.mjs';

const NOW = '2026-11-05_1200H';
const note = (name, description, type, extra = {}) => ({ name, description, type, public: false, next: [], ...extra });
const NOTES = [
  note('kitchen-job', 'fitted oak kitchen, doors next', 'project', { public: true, next: ['cut the door sheet', 'book the fitting day'] }),
  note('alcove-shelving', 'alcove shelving, timber on order', 'project', { next: ['collect the timber'] }),
  note('quote-first', 'quote in writing before any cut', 'feedback', { public: true }),
  note('cutting-list', 'a sheet means one cutting list', 'reference'),
  note('rowan', 'Rowan Vale owns the workshop', 'user'),
  note('leaky', 'send the drawings', 'project', { public: true, next: ['mail rowan@example.com'] }),
];
const ABOUT = { name: 'Rowan Vale', org: 'Oak and Ash Joinery Ltd', site: 'https://example.com/oak-and-ash' };
const LISTS = listsOf(ABOUT, { privateNames: [], surnames: [], firstNames: [], canaries: [] }, ['hushbox-ledger']);
const input = (over = {}) => ({ now: NOW, about: ABOUT, notes: NOTES, handoff: {}, ...over });
const slice = (target, over = {}, refs = {}) => notesSlice(input(over), LISTS, target, refs);
const text = (s) => render62(s.model62);

test('noteOf reads the header, the public mark and every Next: line of the body', () => {
  const n = noteOf('---\r\nname: kitchen-job  \r\ndescription: "a \\"quoted\\" job"\r\nmetadata:\r\n  type: project\r\npublic: true\r\nnext: not a body line\r\n---\r\nNext: cut the sheet  \r\n- Next: book the day\r\n* next: tell the client\r\nNext:\r\nnot next: no\r\n');
  assert.deepEqual(n, { name: 'kitchen-job', description: 'a "quoted" job', type: 'project', public: true, next: ['cut the sheet', 'book the day', 'tell the client'] });
  assert.equal(noteOf('---\nname: a\npublic: false\n---\n').public, false);
  assert.equal(noteOf('---\nname: a\n---').public, false);
  assert.deepEqual(noteOf('---\nname: a\n---'), { name: 'a', description: '', type: '', public: false, next: [] });
  for (const bad of [5, null, undefined, {}, '', 'no header', '---\ndescription: no name\n---\n', '---\nname:\n---\n']) assert.equal(noteOf(bad), null);
});

test('ordered puts the notes MEMORY.md links first, in its order, then the rest as given', () => {
  const a = note('a', 'x', 'project'), b = note('b', 'y', 'project'), c = note('c', 'z', 'project');
  assert.deepEqual(ordered('- [c](c.md) and [a](a.md), again [c](c.md), and [gone](gone.md)', [a, null, b, { name: 5 }, c]), [c, a, b]);
  assert.deepEqual(ordered(5, [b, a]), [b, a]);
  assert.deepEqual(ordered('[a](a.md)', 'not a list'), []);
});

test('listsOf adds the private names and the operator\'s name to the gate\'s lists, and fails closed', () => {
  const base = { privateNames: ['p1', 5], surnames: ['s1'], firstNames: ['f1'], canaries: ['c1', null] };
  assert.deepEqual(listsOf({ name: ' Rowan J Vale ' }, base, ['hushbox-ledger', 7]), { privateNames: ['p1', 'hushbox-ledger'], surnames: ['s1', 'Vale'], firstNames: ['f1', 'Rowan'], canaries: ['c1'] });
  assert.deepEqual(listsOf(null, base, null), { privateNames: ['p1'], surnames: ['s1'], firstNames: ['f1'], canaries: ['c1'] });
  assert.deepEqual(listsOf({ name: 5 }, null, []), { privateNames: [], surnames: [], firstNames: [], canaries: [] });
  assert.equal(listsOf({ get name() { throw new Error('toxic'); } }, base, []), null);
});

test('notesSlice refuses what it cannot read', () => {
  for (const bad of [null, [], 'x', 5]) assert.deepEqual(notesSlice(bad, LISTS, 'full', {}), { ok: false, why: 'input or target' });
  assert.deepEqual(notesSlice(input(), LISTS, 'nope', {}), { ok: false, why: 'input or target' });
  for (const now of [undefined, 5, 'garbage', '2026-11-05']) assert.deepEqual(notesSlice(input({ now }), LISTS, 'full', {}), { ok: false, why: 'now' });
  assert.deepEqual(notesSlice({ now: NOW, get notes() { throw new Error('toxic'); } }, LISTS, 'full', {}), { ok: false, why: 'the input could not be read' });
  assert.deepEqual(TARGETS, ['full', 'shareable', 'public']);
});

test('the full slice carries every note, unscrubbed, each where its type puts it', () => {
  const s = slice('full'), m = s.model62, t = text(s);
  assert.ok(s.ok && t, 'renders');
  assert.deepEqual(validate62(t).failures, []);
  for (const n of NOTES) assert.ok(t.includes(dot(n.description)), n.name);
  assert.equal(s.report.notes, 6);
  assert.deepEqual([m.meta.human, m.meta.callname, m.identity.fullName, m.sovereign, m.meta.org, m.meta.website], ['Rowan·Vale', 'Rowan', 'Rowan·Vale', 'Rowan·Vale', 'Oak·and·Ash·Joinery·Ltd', 'https://example.com/oak-and-ash']);
  assert.deepEqual(m.lanes, [{ name: 'Work', primary: { thread: 'kitchen-job', score: 'unscored', status: 'fitted·oak·kitchen,·doors·next', next: ['cut·the·door·sheet', 'book·the·fitting·day'] },
    queued: [{ thread: 'alcove-shelving', score: 'unscored', first: 'collect·the·timber' }, { thread: 'leaky', score: 'unscored', first: 'mail·rowan@example.com' }] }]);
  assert.deepEqual(m.current.active, ['kitchen-job:·fitted·oak·kitchen,·doors·next', 'alcove-shelving:·alcove·shelving,·timber·on·order', 'leaky:·send·the·drawings']);
  assert.deepEqual(m.current.hands, ['cut·the·door·sheet']);
  assert.deepEqual(m.rules, ['quote·in·writing·before·any·cut']);
  assert.deepEqual(m.lexicon, [['cutting-list', 'a·sheet·means·one·cutting·list']]);
  assert.deepEqual(m.bootFacts, [['boot·date·reference', '2026-11-05'], ['token·slice', 'full'], ['notes·in·this·slice', '6'], ['rowan', 'Rowan·Vale·owns·the·workshop']]);
  assert.deepEqual(m.retrieve, ['https://example.com/oak-and-ash']);
  assert.deepEqual(m.refs, []);
  assert.deepEqual(s.report.dropped, {});
  assert.equal(s.model30.session.nextStep, 'cut·the·door·sheet');
  assert.equal(s.model30.trace, 'kar-passport·notes·full');
  const t30 = render30(s.model30);
  assert.ok(t30, 'v3.0 renders');
  assert.deepEqual(validate30(t30).failures, []);
});

test('the shareable slice leaves out notes about a person and every value the gate flags', () => {
  const s = slice('shareable'), m = s.model62, t = text(s);
  assert.ok(s.ok && t);
  assert.deepEqual(validate62(t).failures, []);
  for (const n of NOTES.filter((x) => x.type !== 'user')) assert.ok(t.includes(dot(n.description)), n.name);
  assert.ok(!t.includes('Rowan·Vale') && !t.includes('rowan@example.com'));
  assert.equal(s.report.notes, 5);
  assert.deepEqual(s.report.dropped, { personal: 1 });
  assert.deepEqual([m.meta.human, m.meta.callname, m.identity.fullName], ['Rowan', 'Rowan', 'Rowan']);
  assert.deepEqual(m.lanes[0].queued[1], { thread: 'leaky', score: 'unscored', first: 'see·its·note' });
  assert.deepEqual(m.bootFacts.map(([k]) => k), ['boot·date·reference', 'token·slice', 'notes·in·this·slice']);
  const p = slice('shareable', { notes: [note('move', 'move the job book', 'project', { next: ['move it into hushbox-ledger', 'then a second step'] })] });
  assert.deepEqual(p.model62.lanes[0].primary.next, ['move·it·into·REF-T-001', 'then·a·second·step']);
  assert.deepEqual(p.refs, { 'REF-T-001': 'hushbox-ledger' });
  assert.deepEqual(p.model62.refs, [['REF-T-001', 'a·private·name·in·the·private·lookup']]);
  const two = slice('shareable', { notes: [note('a', 'x', 'project', { next: ['mail a@example.com'] }), note('b', 'y', 'project', { next: ['mail b@example.com'] }), note('c', 'z', 'project', { next: ['quote £40'] })] });
  assert.deepEqual(two.report.dropped, { personal: 2, pricing: 1 });
});

test('the public slice carries only the notes marked public, and the operator as REF-P-001', () => {
  const s = slice('public'), m = s.model62, t = text(s);
  assert.ok(s.ok && t);
  assert.deepEqual(validate62(t).failures, []);
  for (const n of NOTES) assert.equal(t.includes(dot(n.description)), n.public, n.name);
  assert.equal(s.report.notes, 3);
  assert.deepEqual([m.meta.human, m.meta.callname, m.identity.fullName, m.sovereign], ['REF-P-001', 'the·operator', 'REF-P-001', 'REF-P-001']);
  assert.deepEqual(s.refs, { 'REF-P-001': 'Rowan' });
  assert.deepEqual(m.refs, [['REF-P-001', 'a·person·named·in·the·private·lookup']]);
  assert.deepEqual(slice('public', {}, { 'REF-P-001': 'kept' }).refs, { 'REF-P-001': 'kept' });
  const named = slice('public', { notes: [note('call', 'call Rowan back', 'project', { public: true })] });
  assert.deepEqual(named.model62.lanes[0].primary.status, 'call·REF-P-001·back');
  assert.ok(!text(named).includes('Rowan'));
});

test('missing or unreadable parts fall back to what the protocol allows, never to an invented value', () => {
  const s = slice('full', { about: { name: 5, org: 7, site: 9 }, notes: [note('p', '', 'project'), note('r', '', 'reference'), null, { name: 5, description: 'ghost-project', type: 'project' }, { name: 'n', description: 3, type: 'project' }] });
  assert.ok(s.ok && text(s));
  const m = s.model62;
  assert.deepEqual([m.meta.human, m.meta.callname, m.meta.org, m.meta.website, m.meta.contact], ['the·operator', 'the·operator', 'not·recorded', 'not·recorded', 'not·recorded']);
  assert.deepEqual(m.lanes, [{ name: 'Work', primary: { thread: 'p', score: 'unscored', status: 'see·its·note', next: [] }, queued: [] }]);
  assert.deepEqual(m.lexicon, []);
  assert.deepEqual(m.retrieve, []);
  assert.ok(!text(s).includes('ghost-project'));
  assert.equal(s.report.notes, 2);
  const none = slice('full', { about: null, notes: 'x', handoff: 'x' });
  assert.ok(none.ok && text(none));
  assert.deepEqual([none.model62.lanes, none.model62.current.hands, none.model30.session.nextStep], [[], [], 'ask·the·operator']);
  const lane = slice('full', { notes: [note('only', 'one job', 'project')] });
  assert.equal(lane.model30.session.nextStep, 'only');
});

test('what a session handed back comes back in: sessions, resolved items, milestones and numbered lessons', () => {
  const handoff = {
    sessions: [null, { date: 'bad' }, { date: '2026-11-04', accomplished: ['built the carcasses', 5], queued: ['doors'] }],
    resolved: [null, { name: 'warped panel', what: 'it bowed', outcome: 'remade', lesson: 'let boards settle' }, { name: 'x', date: '2026-11-01', what: 'y', outcome: 'z', lesson: 'w' }, { name: 'half', what: 'no outcome' }],
    milestones: [{ id: 'M01', name: 'insured', what: 'cover renewed', outcome: 'issued', source: 'the email' }, { id: 'M02', name: 'no source', what: 'w', outcome: 'o' }],
    lessons: ['photograph every site', 7, 'measure twice'],
  };
  const m = slice('full', { handoff }).model62;
  assert.deepEqual(m.sessions, [{ date: '2026-11-04', accomplished: ['built·the·carcasses'], queued: ['doors'] }]);
  assert.deepEqual(m.resolved, [{ name: 'warped·panel', date: '2026-11-05', what: 'it·bowed', outcome: 'remade', lesson: 'let·boards·settle' }, { name: 'x', date: '2026-11-01', what: 'y', outcome: 'z', lesson: 'w' }]);
  assert.deepEqual(m.milestones, [{ id: 'M01', name: 'insured', date: '2026-11-05', what: 'cover·renewed', outcome: 'issued', source: 'the·email' }]);
  assert.deepEqual(m.lessons, [['L1', 'photograph·every·site'], ['L2', 'measure·twice']]);
  assert.ok(text(slice('full', { handoff })));
});
