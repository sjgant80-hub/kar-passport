// ════════════════════════════════════════════════════════════════
// src/notes.mjs — organ 8 of Kar's passport: a team's own notes → the content model of one slice (claims-notes.json N1, N2).
//
//   noteOf(text)                           → { name, description, type, public, next } | null: one note's header and Next: lines
//   ordered(index, notes)                  → the notes MEMORY.md links, in its order, then every other note in the order given
//   listsOf(about, base, privateNames)     → the leak gate's lists: base's, the private names, and the parts of about.name;
//                                            null when they cannot be read (the command then refuses: it fails closed)
//   notesSlice(input, lists, target, refs) → { ok, model62, model30, refs, report } | { ok: false, why }
//
// The notes are the layout Claude Code's memory folder uses: one Markdown file per topic, opening with a header between two
// lines of three hyphens (name, description, and type: user, feedback, project or reference), and an index, MEMORY.md, that
// links them. One header line is ours: `public: true` marks a note as already public. A body line that starts `Next:` is a
// next action. input: { now, about: { name, org, site }, notes (noteOf's, in order), handoff (organ 4's merged log) }.
//
// target 'full' (your own sessions: every note, never scrubbed, private), 'shareable' (a collaborator's AI: every note but
// those of type user, which are about a person), 'public' (anyone: only the notes marked public; the operator is REF-P-001).
// Every value of a shareable or public slice passes the leak gate's scrub(): private names become REF codes, and a value
// that would still leak is dropped and counted in report.dropped by kind. Where each note goes: project → the work lane (the
// first is PRIMARY with its Next: lines, the rest QUEUED with their first) and §CURRENT·REALITY's active list as
// "name: description"; feedback → the rules; user → the boot facts; reference, or any other type → the lexicon. What a
// session handed back (organ 4's merged log) comes back in as the slicer brings back Kar's.
// Nothing is invented: every value is read from the input, cut to a bounded length at a word. Pure and total: garbage in
// gives null, [] or { ok: false, why }, never a throw.
// Powered by the Konomi architecture, created by Thomas Frumkin.
// ════════════════════════════════════════════════════════════════
import { dot } from './render.mjs';
import { scrub } from './leak.mjs';
import { cut } from './slice.mjs';

export const TARGETS = Object.freeze(['full', 'shareable', 'public']);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const strs = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string') : []);
const objs = (x) => (Array.isArray(x) ? x.filter(isObj) : []);
const fail = (why) => ({ ok: false, why });
const STAMP = /^\d{4}-\d{2}-\d{2}_\d{4}H$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEAD = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const NEXT = /^[ \t]*(?:[-*][ \t]+)?next:[ \t]*(\S.*)$/gim;
const NOT = 'not·recorded·in·this·slice';

export function noteOf(text) {
  try { return readNote(text); } catch { return null; }
}
function readNote(text) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/\r\n/g, '\n'), h = HEAD.exec(t);
  if (!h) return null;
  const field = (k) => {
    const m = new RegExp('^[ \\t]*' + k + ':[ \\t]*(.*)$', 'm').exec(h[1]);
    return m ? m[1].trim().replace(/^"(.*)"$/, (q, inner) => inner).replace(/\\"/g, '"') : '';
  };
  const name = field('name');
  if (!name) return null;
  return { name, description: field('description'), type: field('type'), public: field('public') === 'true', next: [...t.slice(h[0].length).matchAll(NEXT)].map((m) => m[1].trim()) };
}

export function ordered(index, notes) {
  try { return inOrder(index, notes); } catch { return []; }
}
function inOrder(index, notes) {
  const list = Array.isArray(notes) ? notes.filter((n) => isObj(n) && typeof n.name === 'string') : [];
  const links = typeof index === 'string' ? [...index.matchAll(/\]\(([^)\s]+)\.md\)/g)].map((m) => m[1]) : [];
  return [...new Set([...links.map((l) => list.find((n) => n.name === l)).filter(Boolean), ...list])];
}

export function listsOf(about, base, privateNames) {
  try { return gateLists(about, base, privateNames); } catch { return null; }
}
function gateLists(about, base, privateNames) {
  const b = isObj(base) ? base : {};
  const parts = isObj(about) && typeof about.name === 'string' ? about.name.split(/\s+/).filter((p) => p.length > 1) : [];
  return { privateNames: [...strs(b.privateNames), ...strs(privateNames)], surnames: [...strs(b.surnames), ...parts.slice(1)], firstNames: [...strs(b.firstNames), ...parts.slice(0, 1)], canaries: strs(b.canaries) };
}

export function notesSlice(input, lists, target, refs) {
  try { return sliceOf(input, lists, target, refs); } catch { return fail('the input could not be read'); }
}
function sliceOf(input, lists, target, refs) {
  if (!isObj(input) || !TARGETS.includes(target)) return fail('input or target');
  if (typeof input.now !== 'string' || !STAMP.test(input.now)) return fail('now');
  const now = input.now, today = now.slice(0, 10), full = target === 'full', pub = target === 'public';
  const about = isObj(input.about) ? input.about : {}, handoff = isObj(input.handoff) ? input.handoff : {};
  const report = { notes: 0, dropped: {} };
  let R = isObj(refs) ? { ...refs } : {};
  const put = (text) => {
    const c = cut(text);
    if (!c) return null;
    if (full) return c;
    const s = scrub(c, lists, target, R);
    if (s.value === null) { for (const w of s.why) report.dropped[w] = (report.dropped[w] || 0) + 1; return null; }
    R = s.refs;
    return s.value;
  };
  const many = (texts) => texts.map(put).filter(Boolean);
  const pairs = (list) => list.map(([k, v]) => [put(k), put(v)]).filter(([a, b]) => a && b);
  const dated = (x) => isObj(x) && DATE.test(x.date);
  const when = (x) => (DATE.test(x.date) ? x.date : today);

  const notes = (Array.isArray(input.notes) ? input.notes : []).filter((n) => isObj(n) && typeof n.name === 'string' && typeof n.description === 'string')
    .filter((n) => (pub ? n.public === true : full || n.type !== 'user'));
  report.notes = notes.length;
  const ofType = (t) => notes.filter((n) => n.type === t);
  const projects = ofType('project');
  const others = notes.filter((n) => !['project', 'feedback', 'user'].includes(n.type));

  const name = typeof about.name === 'string' ? about.name.trim() : '';
  const first = name.split(/\s+/)[0] || 'the operator';
  if (pub) R['REF-P-001'] = R['REF-P-001'] || first;
  const op = pub ? 'REF-P-001' : dot(full && name ? name : first), call = pub ? 'the·operator' : dot(first);
  const org = put(typeof about.org === 'string' ? about.org : '') || 'not·recorded';
  const site = typeof about.site === 'string' ? about.site : '', door = put(site) || 'not·recorded';

  const live = projects.map((p) => ({ p, thread: put(p.name) })).filter((x) => x.thread);
  const lanes = live.slice(0, 1).map(({ p, thread }) => ({
    name: 'Work', primary: { thread, score: 'unscored', status: put(p.description) || 'see·its·note', next: many(strs(p.next)) },
    queued: live.slice(1).map((q) => ({ thread: q.thread, score: 'unscored', first: put(strs(q.p.next)[0]) || 'see·its·note' })),
  }));

  const m = {
    generated: now, mode: 'VERIFIED',
    meta: { human: op, callname: call, org, contact: door, website: door, origin: NOT },
    ethos: [],
    lexicon: pairs(others.map((n) => [n.name, n.description])),
    identity: { fullName: op, callname: call, role: NOT, function: NOT, nature: NOT, communication: NOT, location: NOT },
    relationships: [['SYMBEYOND·AI·LLC', 'origin·of·the·SYMB-FER·protocol·this·token·follows·(John·DuCrest;·MIT)']],
    bootFacts: [['boot·date·reference', today], ['token·slice', target], ['notes·in·this·slice', String(notes.length)], ...pairs(ofType('user').map((n) => [n.name, n.description]))],
    bootEthos: [],
    sovereign: op,
    retrieve: many([site]),
    rules: many(ofType('feedback').map((n) => n.description)),
    refs: [], constants: [], dates: [],
    credits: [['SYMBEYOND·AI·LLC', 'SYMB-FER,·SYMBEYOND·AI·LLC,·2026·(MIT)']],
    lanes,
    current: { asOf: today, active: many(projects.map((p) => p.name + ': ' + p.description)), changed: [], waiting: [], hands: lanes.flatMap((l) => l.primary.next.slice(0, 1)) },
    threads: [],
    sessions: (Array.isArray(handoff.sessions) ? handoff.sessions : []).filter(dated).map((s) => ({ date: s.date, accomplished: many(strs(s.accomplished)), queued: many(strs(s.queued)) })),
    resolved: objs(handoff.resolved).map((x) => ({ name: put(x.name), date: when(x), what: put(x.what), outcome: put(x.outcome), lesson: put(x.lesson) }))
      .filter((r) => [r.name, r.what, r.outcome, r.lesson].every(Boolean)),
    milestones: objs(handoff.milestones).map((x) => ({ id: put(x.id), name: put(x.name), date: when(x), what: put(x.what), outcome: put(x.outcome), source: put(x.source) }))
      .filter((r) => [r.id, r.name, r.what, r.outcome, r.source].every(Boolean)),
    lessons: many(strs(handoff.lessons)).map((t, i) => ['L' + (i + 1), t]),
    finalization: { status: 'VERIFIED', mode: 'WORKING' },
  };
  m.refs = full ? [] : Object.keys(R).sort().map((c) => [c, c.startsWith('REF-P-') ? 'a·person·named·in·the·private·lookup' : 'a·private·name·in·the·private·lookup']);

  const model30 = {
    generated: now, mode: 'VERIFIED',
    meta: { purpose: 'session·continuity·context·transfer', human: op, org, contact: door },
    facts: [...m.bootFacts, ...m.lexicon],
    session: {
      workingDirectory: NOT,
      activePaths: m.retrieve.map((x) => x.replace(/\|/g, '/')),
      recentActions: m.current.active.slice(0, 3).map((x) => x.replace(/\|/g, '/')),
      nextStep: [...m.current.hands, ...lanes.map((l) => l.primary.thread), 'ask·the·operator'][0],
      notes: 'the·full·context·of·this·slice·is·its·v6.2·token',
    },
    ethos: m.rules, lessons: m.lessons, trace: 'kar-passport·notes·' + target,
  };
  return { ok: true, model62: m, model30, refs: R, report };
}

export default { TARGETS, noteOf, ordered, listsOf, notesSlice };
