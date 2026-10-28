// ════════════════════════════════════════════════════════════════
// src/drift.mjs — organ 4 of Kar's passport: the hand-back. A fresh session returns an updated v6.2 token; this decides
// whether it drifted from the token Kar sent, and turns an honest update into a reviewed, reversible memory write.
//
//   driftCheck(sent, back) → { ok, drift: [{ section, rule, detail }], added } — v6.2's own rules, word for word:
//       §CURRENT·REALITY "is replaced every session" (free);  §SESSION·LOG "append each session, never replace" (the sent
//       lines are a prefix of the returned ones);  §CLOSED·MILESTONES "never remove, only add", §LESSONS·LEARNED "never
//       delete, only add", §RESOLVED "resolved does not mean discarded" (the sent lines, in order, are all still there);
//       §OPEN·THREADS "nothing discarded without intention" (a thread may leave only into §RESOLVED or §CLOSED·MILESTONES);
//       §FINALIZATION and §SIG may change; every other section, the header (but its time) and §META (but GENERATED) are
//       byte for byte what was sent. added: what the session added, line for line, for the ingest plan.
//   ingestPlan(added, log, meta) → { ok, id, after, entry } | refusal: the hand-over log (a memory topic file) with this
//       hand-over appended: the structured items (sessions, milestones, lessons, resolved, closed threads, the new current
//       reality) and every added line verbatim. Never drops: the log only grows; a token already merged is refused by id.
//   indexLine(entries)     → the one MEMORY.md line that points at the log
//   readLog(text)          → the log's entries ([]) from its JSON block
//
// The CLI (kar/passport.mjs) shows the plan, writes it only on --apply <id>, and keeps the before bytes to --undo.
// Pure and total. Powered by the Konomi architecture, created by Thomas Frumkin.
// ════════════════════════════════════════════════════════════════
import { parse, bodyOf, formatOf, validate62, ORDER62 } from './symbfer.mjs';
import { NONE } from './render.mjs';

const fail = (why) => ({ ok: false, why });
const FREE = new Set(['CURRENT·REALITY', 'FINALIZATION', 'SIG']);
const APPEND = new Set(['SESSION·LOG']);
const ONLY_ADD = new Set(['CLOSED·MILESTONES', 'LESSONS·LEARNED', 'RESOLVED']);
const RULE = {
  fixed: 'only §CURRENT·REALITY is replaced; every other section travels as it was sent',
  append: 'append each session, never replace (§SESSION·LOG)',
  onlyAdd: 'never remove, only add',
  threads: 'nothing discarded without intention: a thread leaves §OPEN·THREADS only into §RESOLVED or §CLOSED·MILESTONES',
  shape: 'a returned token is still a SYMB-FER v6.2 token',
};
const trimEnd = (lines) => { const a = lines.slice(); while (a.at(-1) === '') a.pop(); return a; };
const content = (lines) => lines.filter((l) => l !== '' && l !== NONE);
const topLevel = (doc) => doc.sections.filter((s) => s.parent === null).map((s) => s.name);
const threadNames = (lines) => lines.map((l) => /^THREAD·\d+: (.*)$/.exec(l)).filter(Boolean).map((m) => m[1]);
const afterSig = (doc) => { const s = doc.sections.find((x) => x.name === 'SIG'); return s ? doc.lines.slice(s.end + 1) : []; };

function isSubsequence(small, big) {
  let j = 0;
  for (const x of big) if (x === small[j]) j++;
  return j === small.length;
}

export function driftCheck(sent, back) {
  if (formatOf(sent) !== 'v6.2') return fail('the sent token is not v6.2');
  const drift = [];
  if (formatOf(back) !== 'v6.2' || back.includes('\r') || validate62(back).status === 'FAIL') {
    return { ok: false, drift: [{ section: 'TOKEN', rule: RULE.shape, detail: formatOf(back) !== 'v6.2' ? 'not a v6.2 header' : back.includes('\r') ? 'carriage return' : validate62(back).failures.join('; ') }], added: null };
  }
  const a = parse(sent), b = parse(back);
  const ta = topLevel(a), tb = topLevel(b);
  if (ta.join('|') !== tb.join('|')) drift.push({ section: 'TOKEN', rule: RULE.fixed, detail: 'the sections are not the ones sent, in the order sent' });
  const stamp = /^(∴SYMB-FER·v6\.2·LIVING·TOKEN·)\[\d{4}-\d{2}-\d{2}_\d{4}H\]$/;
  const head = (doc) => doc.lines.slice(0, doc.sections.length ? doc.sections[0].begin : 0);
  const ha = head(a), hb = head(b);
  if (!stamp.test(hb[0] || '') || ha.length !== hb.length || ha.some((l, i) => i > 0 && l !== hb[i])) drift.push({ section: 'HEADER', rule: RULE.fixed, detail: 'the lines before §TRANSFER·MODE changed' });
  if (afterSig(a).join('\n') !== afterSig(b).join('\n')) drift.push({ section: 'CLOSING', rule: RULE.fixed, detail: 'the lines after §SIG changed' });
  const added = { session: [], milestones: [], lessons: [], resolved: [], threadsClosed: [], current: [] };
  for (const name of ORDER62) {
    const sa = bodyOf(a, name), sb = bodyOf(b, name);
    if (sa === null && sb === null) continue;
    if (sa === null || sb === null) { drift.push({ section: name, rule: RULE.fixed, detail: sa === null ? 'added' : 'removed' }); continue; }
    if (FREE.has(name)) { if (name === 'CURRENT·REALITY' && sa.join('\n') !== sb.join('\n')) added.current = content(sb).filter((l) => !l.startsWith('#')); continue; }
    if (name === 'META') {
      const diff = sa.length !== sb.length || sa.some((l, i) => l !== sb[i] && !(l.startsWith('GENERATED: ') && /^GENERATED: \d{4}-\d{2}-\d{2}_\d{4}H$/.test(sb[i])));
      if (diff) drift.push({ section: name, rule: RULE.fixed, detail: 'a line other than GENERATED changed' });
      continue;
    }
    if (APPEND.has(name)) {
      const x = trimEnd(sa).filter((l) => l !== NONE), y = trimEnd(sb);
      const prefix = x.length <= y.length && x.every((l, i) => l === y[i]);
      if (!prefix) drift.push({ section: name, rule: RULE.append, detail: 'a line that was sent is changed or gone' });
      else added.session = content(y.slice(x.length));
      continue;
    }
    if (ONLY_ADD.has(name)) {
      const x = content(sa), y = content(sb);
      if (!isSubsequence(x, y)) { drift.push({ section: name, rule: RULE.onlyAdd, detail: 'a line that was sent is changed or gone' }); continue; }
      const extra = []; let j = 0;
      for (const l of y) { if (l === x[j]) j++; else extra.push(l); }
      if (name === 'CLOSED·MILESTONES') added.milestones = extra; else if (name === 'LESSONS·LEARNED') added.lessons = extra; else added.resolved = extra;
      continue;
    }
    if (name === 'OPEN·THREADS') {
      const kept = new Set(threadNames(sb));
      const closedText = [...(bodyOf(b, 'RESOLVED') ?? []), ...(bodyOf(b, 'CLOSED·MILESTONES') ?? [])].join('\n');
      for (const t of threadNames(sa)) {
        if (kept.has(t)) continue;
        if (closedText.includes(t)) added.threadsClosed.push(t);
        else drift.push({ section: name, rule: RULE.threads, detail: 'THREAD ' + t + ' left without being resolved' });
      }
      continue;
    }
    if (sa.join('\n') !== sb.join('\n')) drift.push({ section: name, rule: RULE.fixed, detail: 'changed' });
  }
  return drift.length ? { ok: false, drift, added: null } : { ok: true, drift: [], added };
}

// ── the hand-over log, a memory topic file ─────────────────────────
const words = (s) => s.replace(/·/g, ' ');
const blocks = (lines) => { const out = [[]]; for (const l of lines) { if (/^(SESSION·|MILESTONE·|RESOLVED·)/.test(l) && out[out.length - 1].length) out.push([]); out[out.length - 1].push(l); } return out.filter((x) => x.length); };
const field = (b, k) => { const l = b.find((x) => x.startsWith(k + ': ')); return l ? words(l.slice(k.length + 2)) : ''; };

/** The structured items of what a session added. Every added line is also kept verbatim in the entry. */
export function itemsOf(given) {
  const added = { ...given };
  const sessions = blocks(added.session || []).map((b) => {
    const d = /^SESSION·(\d{4}-\d{2}-\d{2}) \{$/.exec(b[0] ?? '');
    if (!d) return null;
    const q = b.indexOf('  QUEUED·FOR·NEXT·SESSION {');
    const items = (from, to) => b.slice(from, to).filter((l) => /^ {4}\S/.test(l)).map((l) => words(l.trim()));
    return { date: d[1], accomplished: items(1, q === -1 ? b.length : q), queued: q === -1 ? [] : items(q, b.length) };
  }).filter(Boolean);
  const milestones = blocks(added.milestones || []).map((b) => {
    const h = /^MILESTONE·(\S+?): (.*)$/.exec(b[0] ?? '');
    return h ? { id: h[1], name: words(h[2]), date: field(b, 'DATE'), what: field(b, 'WHAT'), outcome: field(b, 'OUTCOME'), source: field(b, 'SOURCE') } : null;
  }).filter(Boolean);
  const lessons = (added.lessons || []).map((l) => /^L[^:\s]*: (.*)$/.exec(l)).filter(Boolean).map((m) => words(m[1]));
  const resolved = blocks(added.resolved || []).map((b) => {
    const h = /^RESOLVED·\d+: (.*)$/.exec(b[0] ?? '');
    return h ? { name: words(h[1]), date: field(b, 'DATE'), what: field(b, 'WHAT'), outcome: field(b, 'OUTCOME'), lesson: field(b, 'LESSON') } : null;
  }).filter(Boolean);
  return { sessions, milestones, lessons, resolved, threadsClosed: (added.threadsClosed || []).map(words), current: (added.current || []).map(words) };
}

export function readLog(text) {
  if (typeof text !== 'string') return [];
  const m = /```json\n([\s\S]*?)\n```/.exec(text);
  if (!m) return [];
  try { const j = JSON.parse(m[1]); return Array.isArray(j.entries) ? j.entries : []; } catch { return []; }
}

/** The merged view the slicer reads back: every entry's items, oldest first. */
export function mergedOf(entries) {
  const out = { sessions: [], milestones: [], lessons: [], resolved: [] };
  for (const e of Array.isArray(entries) ? entries : []) {
    const it = e && e.items;
    if (!it) continue;
    for (const k of Object.keys(out)) if (Array.isArray(it[k])) out[k].push(...it[k]);
  }
  return out;
}

export function indexLine(entries) {
  const n = Array.isArray(entries) ? entries.length : 0;
  const lastEntry = n ? entries.at(-1) : null;
  const last = lastEntry && typeof lastEntry.at === 'string' ? lastEntry.at : 'never';
  return '- [symbfer-handoff-log](symbfer-handoff-log.md) — SYMB-FER hand-overs merged back into memory by Kar\'s passport (' + n + ' so far, last ' + last + '); kar-passport repo';
}

export function ingestPlan(added, log, meta) {
  if (!added || typeof added !== 'object' || !meta || typeof meta.back !== 'string' || !/^[0-9a-f]{64}$/.test(meta.back) ||
    typeof meta.sent !== 'string' || !/^[0-9a-f]{64}$/.test(meta.sent) || typeof meta.at !== 'string' || !/^\d{4}-\d{2}-\d{2}_\d{4}H$/.test(meta.at)) return fail('added or meta');
  const entries = readLog(log);
  if (typeof log === 'string' && log.length && !/```json\n/.test(log)) return fail('the log exists but has no JSON block: refusing to overwrite it');
  if (entries.some((e) => e && e.back === meta.back)) return fail('this returned token is already merged (' + meta.back.slice(0, 12) + '…)');
  const lines = ['session', 'milestones', 'lessons', 'resolved', 'current'].flatMap((k) => (Array.isArray(added[k]) ? added[k] : []));
  const entry = { at: meta.at, sent: meta.sent, back: meta.back, items: itemsOf(added), lines };
  const all = [...entries, entry];
  const after = [
    '---', 'name: symbfer-handoff-log',
    'description: "SYMB-FER hand-overs merged back into memory: what each fresh session added to its token, structured and verbatim (' + all.length + ' so far, last ' + meta.at + ')"',
    'metadata:', '  type: project', '---', '',
    'Written only by Kar\'s passport (kar-passport, organ 4) after a returned token passed the drift check and the plan was',
    'reviewed and applied; every apply keeps the bytes before it, so `node kar/passport.mjs undo <id>` restores them.',
    'The next slice reads this log back into its §SESSION·LOG, §CLOSED·MILESTONES, §LESSONS·LEARNED and §RESOLVED.', '',
    ...all.flatMap((e) => ['## ' + e.at + ' · returned token ' + e.back.slice(0, 12) + '… (sent ' + e.sent.slice(0, 12) + '…)', '', ...e.lines.map((l) => '    ' + l), '']),
    '```json', JSON.stringify({ entries: all }, null, 1), '```', '',
  ].join('\n');
  return { ok: true, id: meta.back.slice(0, 16), after, entry, index: indexLine(all) };
}
