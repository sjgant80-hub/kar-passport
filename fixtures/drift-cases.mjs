// fixtures/drift-cases.mjs: the returned tokens of claim P7, made from a sent v6.2 token: an honest update (what the
// protocol lets a session do) and one drifted token per change it forbids. Used by the tests and by measure.mjs.
import { parse, bodyOf, ORDER62 } from '../src/symbfer.mjs';
import { NONE } from '../src/render.mjs';

const FREE = new Set(['CURRENT·REALITY', 'FINALIZATION', 'SIG']);
const replaceBody = (doc, name, body) => {
  const s = doc.sections.find((x) => x.name === name && x.parent === null) || doc.sections.find((x) => x.name === name);
  return [...doc.lines.slice(0, s.begin + 1), ...body, ...doc.lines.slice(s.end)].join('\n');
};
const contentIdx = (body) => body.map((l, i) => (l !== '' && !l.startsWith('#') && l !== NONE ? i : -1)).filter((i) => i >= 0);

/** What a session may do: replace §CURRENT·REALITY, append a SESSION block, add a milestone, a lesson and a resolved item,
 *  and move the first open thread (if any) into §RESOLVED. */
export function honestUpdate(sent, date = '2026-10-29', stamp = '2026-10-29_0900H') {
  let doc = parse(sent);
  let t = sent.replace(/^(∴SYMB-FER·v6\.2·LIVING·TOKEN·)\[[^\]]+\]/, '$1[' + stamp + ']').replace(/^GENERATED: .*$/m, 'GENERATED: ' + stamp);
  doc = parse(t);
  const cur = bodyOf(doc, 'CURRENT·REALITY');
  t = replaceBody(doc, 'CURRENT·REALITY', [...cur.filter((l) => l.startsWith('#')), 'AS·OF: ' + date, '', 'ACTIVE·NOW:', 'the·handoff·loop·test', '', 'JUST·CHANGED:',
    'a·fresh·session·booted·from·this·token', '', 'WAITING·ON·OTHERS:', NONE, '', 'IN·OUR·HANDS:', 'merge·this·token·back·into·memory']);
  doc = parse(t);
  const log = bodyOf(doc, 'SESSION·LOG');
  const logBody = log.filter((l) => l !== NONE);
  while (logBody.length && logBody[logBody.length - 1] === '') logBody.pop();
  t = replaceBody(doc, 'SESSION·LOG', [...logBody, '', 'SESSION·' + date + ' {', '  ACCOMPLISHED {', '    booted·from·the·token·and·did·the·session\'s·work', '  }',
    '  QUEUED·FOR·NEXT·SESSION {', '    merge·the·updated·token·into·memory', '  }', '}']);
  doc = parse(t);
  const threads = bodyOf(doc, 'OPEN·THREADS');
  const first = threads.map((l) => /^THREAD·\d+: (.*)$/.exec(l)).find(Boolean);
  if (first) {
    const at = threads.findIndex((l) => /^THREAD·\d+: /.test(l));
    const kept = [...threads.slice(0, at), ...threads.slice(at + (threads[at + 4] === '' ? 5 : 4))];
    t = replaceBody(doc, 'OPEN·THREADS', kept.some((l) => /^THREAD·/.test(l)) ? kept : [...kept, NONE]);
    doc = parse(t);
  }
  const res = bodyOf(doc, 'RESOLVED').filter((l) => l !== NONE);
  while (res.length && res[res.length - 1] === '') res.pop();
  const n = res.filter((l) => /^RESOLVED·/.test(l)).length + 1;
  t = replaceBody(doc, 'RESOLVED', [...res, ...(res.some((l) => /^RESOLVED·/.test(l)) ? [''] : []), 'RESOLVED·' + String(n).padStart(2, '0') + ': ' + (first ? first[1] : 'the·loop·test'),
    'DATE: ' + date, 'WHAT: ' + (first ? 'an·open·thread·closed·by·the·session' : 'the·loop·test'), 'OUTCOME: closed·in·the·session', 'LESSON: a·thread·leaves·only·into·RESOLVED']);
  doc = parse(t);
  const ms = bodyOf(doc, 'CLOSED·MILESTONES').filter((l) => l !== NONE);
  while (ms.length && ms[ms.length - 1] === '') ms.pop();
  t = replaceBody(doc, 'CLOSED·MILESTONES', [...ms, ...(ms.some((l) => /^MILESTONE·/.test(l)) ? [''] : []), 'MILESTONE·LOOP-' + date + ': the·handoff·loop·closed', 'DATE: ' + date,
    'WHAT: a·fresh·session·worked·from·the·token·and·handed·it·back', 'OUTCOME: merged·into·memory', 'SOURCE: the·returned·token']);
  doc = parse(t);
  const les = bodyOf(doc, 'LESSONS·LEARNED');
  const at = les.indexOf('');
  const own = les.slice(0, at < 0 ? les.length : at).filter((l) => /^L\d+: /.test(l)).length;
  t = replaceBody(doc, 'LESSONS·LEARNED', [...les.slice(0, at < 0 ? les.length : at), 'L' + (own + 1) + ': a·token·travels·memory·stays·home', ...les.slice(at < 0 ? les.length : at)]);
  return t.replace(/§SIG·BEGIN\n[\s\S]*?\n§SIG·END/, '§SIG·BEGIN\nMODE: STANDARD\nSTATUS: UNVERIFIED\nSHA256: PENDING\n§SIG·END');
}

/** One drifted token per forbidden change, each labelled with the section the check must name. */
export function driftedCases(sent) {
  const out = [];
  const doc = parse(sent);
  for (const name of ORDER62) {
    if (FREE.has(name) || name === 'SESSION·LOG' || name === 'OPEN·THREADS' || ['CLOSED·MILESTONES', 'LESSONS·LEARNED', 'RESOLVED'].includes(name)) continue;
    const body = bodyOf(doc, name);
    if (body === null) continue;
    const idx = contentIdx(body).filter((i) => !(name === 'META' && body[i].startsWith('GENERATED: ')));
    const i = idx.length ? idx[0] : 0;
    const edited = body.slice(); edited[i] = (edited[i] || '') + 'x';
    out.push({ section: name, why: 'one line edited', text: replaceBody(doc, name, edited) });
  }
  const log = bodyOf(doc, 'SESSION·LOG');
  for (const i of contentIdx(log)) {
    const e = log.slice(); e[i] = e[i] + 'x';
    out.push({ section: 'SESSION·LOG', why: 'line ' + (i + 1) + ' edited', text: replaceBody(doc, 'SESSION·LOG', e) });
    const r = log.slice(); r.splice(i, 1);
    out.push({ section: 'SESSION·LOG', why: 'line ' + (i + 1) + ' removed', text: replaceBody(doc, 'SESSION·LOG', r) });
  }
  for (const name of ['CLOSED·MILESTONES', 'LESSONS·LEARNED', 'RESOLVED']) {
    const b = bodyOf(doc, name);
    for (const i of contentIdx(b)) { const r = b.slice(); r.splice(i, 1); out.push({ section: name, why: 'line ' + (i + 1) + ' removed', text: replaceBody(doc, name, r) }); }
  }
  const th = bodyOf(doc, 'OPEN·THREADS');
  th.forEach((l, i) => { if (/^THREAD·\d+: /.test(l)) { const r = th.slice(); r.splice(i, 4); out.push({ section: 'OPEN·THREADS', why: 'thread at line ' + (i + 1) + ' removed unresolved', text: replaceBody(doc, 'OPEN·THREADS', r) }); } });
  return out;
}
