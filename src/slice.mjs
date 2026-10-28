// ════════════════════════════════════════════════════════════════
// src/slice.mjs — organ 3 of Kar's passport: Kar's memory → the content model of one slice (claims K1, K2).
//
//   parseDigest(text)    → { estate, builds: [{ name, desc, facts }], changed, next, decisions }   (the brain's digest)
//   parseIndex(text)     → { sections: [{ title, entries: [{ name, desc }] }], notPushed: [name] } (MEMORY.md)
//   checksOf(text)       → every "CHECK: …" sentence of the build retrospectives, newest last
//   liveUrl(desc, estate)→ the https URL a "LIVE repo/path" note points at, only when that repo is public and live
//   buildSlice(inputs, lists, target, refs) → { ok, model62, model30, refs, report } | { ok: false, why }
//
// target: 'full' (a new Kar: everything selected, private, never committed), 'shareable' (a collaborator's AI: memory's
// threads scrubbed by the leak gate, private repository names as REF codes), 'public' (Grok, anyone: only facts that are
// already public: the estate's public repositories and their live pages, and the public business facts in Kar's working
// memory; the operator is REF-P-001). Every value of a shareable or public slice passes scrub(); one that would leak is
// dropped and counted in report.dropped by class. Nothing is invented: every value is read from the inputs, cut to a
// bounded length at a word.
// Pure and total. Powered by the Konomi architecture, created by Thomas Frumkin.
// ════════════════════════════════════════════════════════════════
import { dot } from './render.mjs';
import { scrub } from './leak.mjs';

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const strs = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string') : []);
const fail = (why) => ({ ok: false, why });
const DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
export const MAX = 220;

/** One dot value of at most MAX code points, cut at a middle dot, or '' when nothing is left. */
export function cut(text) {
  const d = dot(typeof text === 'string' ? text.replace(/⚑/g, '') : text);
  const cp = [...d];
  if (cp.length <= MAX) return d;
  const head = cp.slice(0, MAX - 1).join('');
  const at = head.lastIndexOf('·');
  return (at > MAX / 2 ? head.slice(0, at) : head) + '…';
}

export function parseDigest(text) {
  const out = { estate: '', builds: [], changed: [], next: '', decisions: [] };
  if (typeof text !== 'string') return out;
  let mode = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('ESTATE: ')) { out.estate = line.slice(8); mode = ''; continue; }
    if (line.startsWith('RECENT BUILDS')) { mode = 'builds'; continue; }
    const ch = /^CHANGED SINCE THE LAST LOOK \((\d+)\):\s*(.*)$/.exec(line);
    if (ch) { mode = 'changed'; if (ch[1] !== '0' && ch[2] && ch[2] !== 'nothing') out.changed.push(ch[2]); continue; }
    const nx = /^NEXT BUILD[^:]*:\s*(.*)$/.exec(line);
    if (nx) { out.next = nx[1]; mode = ''; continue; }
    const de = /^DECISIONS ONLY [A-Z]+ MAKES \((\d+)\):\s*(.*)$/.exec(line);
    if (de) { mode = 'decisions'; if (de[1] !== '0' && de[2] && de[2] !== 'none waiting') out.decisions.push(de[2]); continue; }
    if (mode === 'builds') {
      const b = /^· (\S+) — (.*)$/.exec(line);
      if (b) { out.builds.push({ name: b[1], desc: b[2], facts: '' }); continue; }
      const f = /^\s+key facts: (.*)$/.exec(line);
      if (f && out.builds.length) out.builds[out.builds.length - 1].facts = f[1];
      continue;
    }
    const item = /^· (.*)$/.exec(line);
    if (item && mode === 'changed') out.changed.push(item[1]);
    else if (item && mode === 'decisions') out.decisions.push(item[1]);
  }
  return out;
}

export function parseIndex(text) {
  const out = { sections: [], notPushed: [] };
  if (typeof text !== 'string') return out;
  let cur = { title: '', entries: [] };
  out.sections.push(cur);
  for (const line of text.split('\n')) {
    const h = /^\*\*(.+?)\*\*\s*$/.exec(line);
    if (h) { cur = { title: h[1].replace(/:$/, ''), entries: [] }; out.sections.push(cur); continue; }
    const e = /^- (?:[⚑\s]*)\[([^\]]+)\]\([^)]+\)\s*—\s*(.*)$/.exec(line);
    if (e) cur.entries.push({ name: e[1], desc: e[2] });
    const np = /NOT pushed:(.*)$/.exec(line);
    if (np) for (const m of np[1].matchAll(/\[([^\]]+)\]\(/g)) out.notPushed.push(m[1]);
  }
  out.sections = out.sections.filter((s) => s.entries.length);
  return out;
}

export function checksOf(text) {
  if (typeof text !== 'string') return [];
  return [...text.matchAll(/CHECK:\s*([^|\n]+?)(?=\s*(?:\||$|\n|\*\*Check))/g)].map((m) => m[1].trim()).filter(Boolean);
}

export function liveUrl(desc, estate) {
  const m = /LIVE\s+(?:https:\/\/sjgant80-hub\.github\.io\/)?([A-Za-z0-9._-]+)(\/[^\s;,)·]*)?/.exec(typeof desc === 'string' ? desc : '');
  if (!m) return null;
  const repos = isObj(estate) && Array.isArray(estate.repos) ? estate.repos : [];
  const repo = repos.find((r) => isObj(r) && r.name === m[1]);
  if (!repo || repo.private !== false || repo.live !== true) return null;
  return 'https://sjgant80-hub.github.io/' + m[1] + (m[2] || '/');
}

const statementsOf = (working) => strs(working).map((l) => l.trim()).filter(Boolean);
const kvOf = (working) => {
  const kv = new Map();
  for (const l of statementsOf(working)) { const m = /^([A-Za-z][A-Za-z ()]*?):\s+(.+)$/.exec(l); if (m && !kv.has(m[1])) kv.set(m[1], m[2]); }
  return kv;
};
const rulesOf = (working) => statementsOf(working).filter((l) => /^(Never|NEVER|No |Every |Verify|Don't|Only |Plain language|One link|The number)/.test(l) && !/\.md\b/.test(l));
const goodsOf = (working) => statementsOf(working).filter((l) => / — /.test(l) && !/^(Name|Contact|Pitch|Business door|Agent door|Verify)/.test(l) && !rulesOf([l]).length);

export function buildSlice(inputs, lists, target, refs) {
  if (!isObj(inputs) || !['full', 'shareable', 'public'].includes(target)) return fail('inputs or target');
  const now = inputs.now, today = inputs.today;
  if (typeof now !== 'string' || !/^\d{4}-\d{2}-\d{2}_\d{4}H$/.test(now) || typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return fail('now or today');
  const full = target === 'full', pub = target === 'public';
  const report = { drawn: 0, dropped: {} };
  let R = isObj(refs) ? { ...refs } : {};
  const put = (text) => {
    const c = cut(text);
    if (!c) return null;
    report.drawn++;
    if (full) return c;
    const s = scrub(c, lists, target, R);
    if (s.value === null) { for (const w of s.why) report.dropped[w] = (report.dropped[w] || 0) + 1; return null; }
    R = s.refs;
    return s.value;
  };
  const many = (texts, max) => texts.map(put).filter((x) => x !== null).slice(0, max);
  const pairOf = (k, v) => { const a = put(k), b = put(v); return a !== null && b !== null ? [a, b] : null; };
  const pairs = (list, max) => list.map(([k, v]) => pairOf(k, v)).filter(Boolean).slice(0, max);

  const digest = parseDigest(inputs.digest), index = parseIndex(inputs.index), kv = kvOf(inputs.working);
  const estate = isObj(inputs.estate) ? inputs.estate : { repos: [] };
  const topics = Array.isArray(inputs.topics) ? inputs.topics.filter((t) => isObj(t) && typeof t.name === 'string') : [];
  const topic = (n) => topics.find((t) => t.name === n);
  const op = isObj(inputs.operator) ? inputs.operator : {};
  const first = typeof op.first === 'string' && op.first ? op.first : 'the operator';
  const handoff = isObj(inputs.handoff) ? inputs.handoff : {};

  const org = put(kv.get('Name') || 'not recorded');
  const site = kv.get('Business door (humans)') || '';
  const agentDoor = kv.get('Agent door (machines)') || '';
  const opName = pub ? 'REF-P-001' : dot(first);
  if (pub) R['REF-P-001'] = R['REF-P-001'] || first;

  // the recent builds: names, descriptions, the public live page each points at
  const builds = digest.builds.map((b) => ({ ...b, url: liveUrl(b.desc, estate), date: (DATE.exec(b.desc) || DATE.exec(b.facts) || [])[1] || null }));
  const publicBuilds = builds.filter((b) => b.url);
  const repoOf = (url) => estate.repos.find((r) => url.startsWith('https://sjgant80-hub.github.io/' + r.name + '/'));

  const how = (index.sections.find((s) => /^How we work/i.test(s.title)) || { entries: [] }).entries;
  const income = (index.sections.find((s) => /INCOME/.test(s.title)) || { entries: [] }).entries;
  const vision = digest.builds.find((b) => b.name === 'master-vision-build');
  const steps = vision ? vision.desc.replace(/^.*?status:\s*/, '').split(/\s+·\s+/).map((x) => x.trim()).filter(Boolean) : [];
  const openStep = steps.find((s) => !/DONE/.test(s));
  const goods = goodsOf(inputs.working);
  const pending = statementsOf(inputs.working).filter((l) => /pending/i.test(l));

  const m = {
    generated: now, mode: 'VERIFIED',
    meta: { human: pub ? 'REF-P-001' : dot(full && op.fullName ? op.fullName : first), callname: pub ? 'the·operator' : dot(first), org,
      contact: put(site) || 'not·recorded', website: put(site) || 'not·recorded', origin: 'not·recorded·in·this·slice' },
    ethos: many(rulesOf(inputs.working).filter((l) => /proof|fake|Verify/.test(l)), 4),
    lexicon: pub || !how.length
      ? pairs([['business door', site], ['agent door', agentDoor ? agentDoor + ' catalog.json and agents.md' : ''], ['pitch', kv.get('Pitch') || '']].filter(([, v]) => v.trim()), 6)
      : pairs(how.slice(0, 10).map((e) => [e.name, e.desc]), 10),
    identity: {
      fullName: pub ? 'REF-P-001' : dot(full && op.fullName ? op.fullName : first), callname: pub ? 'the·operator' : dot(first),
      role: put(statementsOf(inputs.working).find((l) => /signs off/i.test(l)) || 'not recorded'),
      function: 'oversees·the·estate·and·is·the·final·gate', nature: 'not·recorded·in·this·slice',
      communication: full ? (put((topic('page-explains-itself') || {}).description || '') || 'not·recorded') : 'not·recorded·in·this·slice',
      location: 'not·recorded·in·this·slice',
    },
    relationships: pairs([
      ['Kar', statementsOf(inputs.working).find((l) => /^Kar builds/.test(l)) || ''],
      ['Grok', statementsOf(inputs.working).find((l) => /^Grok sells/.test(l)) || ''],
      ['Thomas Frumkin', 'creator of the Konomi architecture; every product carries the credit Powered by the Konomi architecture, created by Thomas Frumkin'],
      ['SYMBEYOND AI LLC', 'origin of the SYMB-FER protocol this token follows (John DuCrest; MIT)'],
      ...(pub ? [] : [['Gary W. Floyd', (topic('gary-floyd-papers') || {}).description || '']]),
    ].filter(([, v]) => v), 6),
    bootFacts: pairs([
      ['boot·date·reference', today], ['token·slice', target],
      ['estate', full ? digest.estate : (typeof estate.public === 'number' ? estate.public + ' public repositories, ' + estate.live + ' live pages' : '')],
      ['business door', site], ['agent door', agentDoor], ['next build', digest.next.split(' — ')[0]],
    ].filter(([, v]) => v), 8),
    bootEthos: many(rulesOf(inputs.working).filter((l) => !/proof|fake|Verify/.test(l)), 6),
    sovereign: opName,
    // a full slice's retrieval lines name Kar's own tools and folders: they come from the machine (inputs.retrieve), not from here
    retrieve: full ? many(strs(inputs.retrieve), 6) : many([site, agentDoor, ...publicBuilds.map((b) => b.url)].filter(Boolean), 8),
    rules: full ? many(how.slice(0, 8).map((e) => e.desc), 8) : many(rulesOf(inputs.working), 10),
    refs: [], constants: [], dates: [],
    credits: pairs([
      ['Thomas Frumkin', 'the Konomi architecture and LIGHT, used with permission'],
      ['Gary W. Floyd', 'papers published as Open Defensive Prior Art (Lumiea Systems Research Division, ThunderStruck Service, LLC)'],
      ['SYMBEYOND AI LLC', 'SYMB-FER, SYMBEYOND AI LLC, 2026 (MIT)'],
    ], 4),
    lanes: [],
    current: {
      asOf: today,
      active: pub ? many(goods.map((g) => g.split(' — ')[0]), 6) : many(builds.slice(0, 4).map((b) => b.name + ' — ' + b.desc), 4),
      changed: pub ? many(publicBuilds.slice(0, 4).map((b) => b.name + ' live ' + b.url), 4) : many(digest.changed, 4),
      waiting: many([...digest.decisions, ...pending], 4),
      hands: digest.next ? many([digest.next.split(' — ')[0]], 1) : [],
    },
    threads: pub ? [] : index.notPushed.slice(0, 6).map((n) => ({ name: put(n), status: 'not·pushed', nature: 'build', action: put('see memory topic ' + n) })).filter((t) => t.name && t.action),
    sessions: [],
    resolved: [],
    // a milestone is confirmed closed (§CLOSED·MILESTONES): here, a build whose page is live on a public repository
    milestones: publicBuilds.slice(0, 6).map((b) => {
      const repo = repoOf(b.url);
      const what = put(pub ? (repo && repo.desc) || b.name : b.desc);
      return { id: put(b.name), name: put(b.name), date: b.date || today, what, outcome: 'live', source: b.url };
    }).filter((x) => x.id && x.name && x.what && x.source),
    lessons: pub ? [] : many(checksOf(inputs.retros).slice(-6), 6).map((t, i) => ['L' + (i + 1), t]),
    finalization: { status: 'VERIFIED', mode: 'WORKING' },
  };

  // the lanes: what is in flight, and what the operator's approved order says comes next
  if (pub) {
    const goal = statementsOf(inputs.working).find((l) => /revenue/i.test(l));
    const p = goal && put(goal);
    if (p) m.lanes.push({ name: 'Revenue', primary: { thread: p, score: 'unscored', status: put(pending[0] || 'in progress'), next: many(pending, 2) },
      queued: goods.map((g) => put(g.split(' — ')[0])).filter(Boolean).slice(0, 6).map((t) => ({ thread: t, score: 'unscored', first: 'link·its·proof' })) });
  } else {
    const t1 = openStep && put(openStep);
    if (t1) m.lanes.push({ name: 'Master·Vision', primary: { thread: t1, score: 'unscored', status: 'in·flight', next: many([openStep], 1) },
      queued: steps.filter((s) => s !== openStep && !/DONE/.test(s)).map(put).filter(Boolean).slice(0, 6).map((t) => ({ thread: t, score: 'unscored', first: 'see·master-vision-build' })) });
    const t2 = digest.next && put(digest.next.split(' — ')[0]);
    if (t2) m.lanes.push({ name: 'Approved·order', primary: { thread: t2, score: 'unscored', status: 'next', next: many([digest.next.split(' — ')[1] || digest.next], 1) },
      queued: income.slice(0, 4).map((e) => put(e.name)).filter(Boolean).map((t) => ({ thread: t, score: 'unscored', first: 'see·memory·topic' })) });
  }

  // the session: today's work, then whatever earlier sessions handed back (organ 4 merges those into memory)
  const todays = publicBuilds.filter((b) => b.date === today).map((b) => (pub ? b.name + ' live ' + b.url : b.name + ' — ' + b.desc));
  const inFlight = pub ? [] : builds.filter((b) => b.date === today && !b.url).map((b) => b.name + ' — ' + b.desc);
  const sessions = Array.isArray(handoff.sessions) ? handoff.sessions.filter((s) => isObj(s) && DATE.test(s.date)) : [];
  for (const s of sessions) m.sessions.push({ date: s.date, accomplished: many(strs(s.accomplished), 12), queued: many(strs(s.queued), 12) });
  m.sessions.push({ date: today, accomplished: many(todays, 6), queued: many([...inFlight, digest.next.split(' — ')[0]].filter(Boolean), 6) });
  for (const x of Array.isArray(handoff.milestones) ? handoff.milestones : []) {
    const r = isObj(x) ? { id: put(x.id), name: put(x.name), date: DATE.test(x.date) ? x.date : today, what: put(x.what), outcome: put(x.outcome), source: put(x.source) } : null;
    if (r && r.id && r.name && r.what && r.outcome && r.source) m.milestones.push(r);
  }
  for (const x of Array.isArray(handoff.lessons) ? handoff.lessons : []) { const t = put(x); if (t) m.lessons.push(['L' + (m.lessons.length + 1), t]); }
  for (const x of Array.isArray(handoff.resolved) ? handoff.resolved : []) {
    const r = isObj(x) ? { name: put(x.name), date: DATE.test(x.date) ? x.date : today, what: put(x.what), outcome: put(x.outcome), lesson: put(x.lesson) } : null;
    if (r && r.name && r.what && r.outcome && r.lesson) m.resolved.push(r);
  }

  m.refs = Object.keys(R).sort().map((c) => [c, c.startsWith('REF-P-') ? 'a·person·named·in·the·private·lookup' : 'a·private·repository·of·the·estate·named·in·the·private·lookup']);
  if (full) m.refs = [];

  const model30 = {
    generated: now, mode: 'VERIFIED',
    meta: { purpose: 'session·continuity·context·transfer', human: m.identity.fullName, org: m.meta.org, contact: m.meta.contact },
    facts: [...m.bootFacts, ...m.relationships.map(([n, r]) => ['relationship·' + n, r])],
    session: {
      workingDirectory: full ? dot(inputs.workingDirectory || 'not recorded') || 'not·recorded' : 'not·shared·in·this·slice',
      activePaths: (full ? m.retrieve.slice(0, 3) : m.retrieve.slice(0, 3)).map((x) => x.replace(/\|/g, '/')),
      recentActions: m.current.changed.concat(m.current.active).slice(0, 3).map((x) => x.replace(/\|/g, '/')),
      nextStep: (m.current.hands[0] || (m.lanes[0] && m.lanes[0].primary.thread) || 'ask·the·operator'),
      notes: 'the·full·context·of·this·slice·is·its·v6.2·token',
    },
    ethos: m.bootEthos, lessons: m.lessons, trace: 'kar-passport·slice·' + target,
  };
  return { ok: true, model62: m, model30, refs: full ? (isObj(refs) ? { ...refs } : {}) : R, report };
}
