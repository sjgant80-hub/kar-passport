// src/slice.test.mjs: the slicer on a made-up memory. Claim K2's fixture half: with one planted item of every leak class
// in every place the slicer reads, the public and shareable tokens carry none of them, and the full token carries them
// where it drew them, each named by the gate by its class.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlice, parseDigest, parseIndex, checksOf, liveUrl, cut, MAX } from './slice.mjs';
import { render62, render30, checkModel62, checkModel30, dot } from './render.mjs';
import { validate62, validate30 } from './symbfer.mjs';
import { scan, protocolLines, hitsIn } from './leak.mjs';
import { fixtureInputs, lists, plants, CLASSES, PLACES } from '../fixtures/memory-fixture.mjs';

const slices = (inputs) => Object.fromEntries(['full', 'shareable', 'public'].map((t) => [t, buildSlice(inputs, lists, t, {})]));

test('K2 fixture: no planted item reaches a public or shareable token; the full one carries them, each named by class', () => {
  const s = slices(fixtureInputs());
  for (const t of ['public', 'shareable']) {
    assert.equal(s[t].ok, true);
    const tok = render62(s[t].model62);
    assert.ok(tok.length > 0, t);
    assert.deepEqual(scan(tok, lists, t, protocolLines()).hits, [], t);
    assert.deepEqual(scan(render30(s[t].model30), lists, t, protocolLines()).hits, [], t + ' v3.0');
    for (const c of CLASSES) assert.ok(s[t].report.dropped[c] > 0 || c === 'private', t + ' dropped some ' + c);
  }
  const full = render62(s.full.model62);
  const hits = scan(full, lists, 'public', protocolLines()).hits;
  for (const c of CLASSES) assert.ok(hits.some((h) => h.cls === c), 'the full token carries a planted ' + c);
  for (const [cls, text] of Object.entries(plants)) {
    const lines = full.split('\n').filter((l) => l.includes(dot(text)));
    for (const l of lines) assert.ok(hitsIn(l, lists, 'public').some((h) => h.cls === cls), cls + ' in ' + l);
  }
  assert.deepEqual(s.full.report.dropped, {});
});

test('private repository names become REF codes in a shareable slice, the operator REF-P-001 in a public one', () => {
  const s = slices(fixtureInputs());
  const share = render62(s.shareable.model62), pub = render62(s.public.model62);
  assert.ok(share.includes('REF-T-001'));
  assert.ok(s.shareable.refs['REF-T-001'] === 'secret-garden-repo');
  assert.ok(share.includes('REF-T-001 :: a·private·repository·of·the·estate·named·in·the·private·lookup'));
  assert.ok(share.includes('CALLNAME: Rowan'));
  assert.ok(pub.includes('HUMAN: REF-P-001') && pub.includes('REF-P-001 :: a·person·named·in·the·private·lookup'));
  assert.ok(!/Rowan/i.test(pub.replace(/rowan\.quill/g, '')));
  assert.equal(s.public.refs['REF-P-001'], 'Rowan');
  assert.ok(render62(s.full.model62).includes('FULL·NAME: Rowan·Quill'));
  assert.deepEqual(s.full.model62.refs, []);
});

test('every slice of a clean memory is a model SYMBEYOND\'s and the fork\'s rules accept', () => {
  const s = slices(fixtureInputs({ clean: true }));
  for (const [t, x] of Object.entries(s)) {
    assert.deepEqual(checkModel62(x.model62), { ok: true }, t);
    assert.deepEqual(checkModel30(x.model30), { ok: true }, t);
    assert.deepEqual(validate62(render62(x.model62)).failures, [], t);
    assert.deepEqual(validate30(render30(x.model30)).failures, [], t);
    assert.equal(x.model62.bootFacts[1][1], t);
    assert.equal(x.model62.current.asOf, '2026-10-28');
    assert.deepEqual(x.report.dropped, {}, t);
  }
  const pub = s.public.model62;
  assert.equal(pub.lanes[0].name, 'Revenue');
  assert.equal(pub.lanes[0].primary.thread, 'First·real·revenue·goal');
  assert.deepEqual(pub.lanes[0].primary.next, ['Van·key·pending·for·deliveries']);
  assert.deepEqual(pub.lanes[0].queued.map((q) => q.thread), ['Kitchens']);
  assert.deepEqual(pub.milestones.map((x) => [x.id, x.source, x.what]), [['kitchen-build', 'https://sjgant80-hub.github.io/vale-site/kitchen/', 'Vale·Joinery·public·site']]);
  assert.deepEqual(pub.sessions, [{ date: '2026-10-28', accomplished: ['kitchen-build·live·https://sjgant80-hub.github.io/vale-site/kitchen/'], queued: ['door·sheet'] }]);
  assert.deepEqual(pub.retrieve, ['https://example.com/vale', 'https://example.com/vale/agents', 'https://sjgant80-hub.github.io/vale-site/kitchen/']);
  assert.deepEqual(pub.ethos, ['Every·public·claim·links·to·a·proof', 'Never·fake·a·result', 'Verify,·don\'t·trust·-·including·each·other']);
  assert.deepEqual(pub.threads, []);
  assert.deepEqual(pub.lessons, []);
  const full = s.full.model62;
  assert.deepEqual(full.lanes.map((l) => [l.name, l.primary.thread]), [['Master·Vision', '2·fitting·day'], ['Approved·order', 'door·sheet']]);
  assert.deepEqual(full.lanes[0].queued.map((q) => q.thread), ['3·alcove·shelving']);
  assert.deepEqual(full.threads.map((t) => t.name), ['van-idea']);
  assert.deepEqual(full.lessons, [['L1', 'photograph·every·site·first.']]);
  assert.deepEqual(full.lexicon, [['measure-twice', 'measure·twice,·cut·once']]);
  assert.equal(s.full.model30.session.workingDirectory, 'C:/Users/rowan/.claude');
  assert.equal(s.public.model30.session.workingDirectory, 'not·shared·in·this·slice');
  assert.deepEqual(full.sessions, [{ date: '2026-10-28', accomplished: ['kitchen-build·-·KITCHEN·2026-10-28:·carcasses·built,·doors·next;·LIVE·vale-site/kitchen/'], queued: ['door·sheet'] }]);
  const inFlight = fixtureInputs({ clean: true });
  inFlight.digest = inFlight.digest.replace('· master-vision-build — MASTER', '· master-vision-build — 2026-10-28 MASTER');
  assert.deepEqual(buildSlice(inFlight, lists, 'full', {}).model62.sessions[0].queued.length, 2, 'a build of today with no live page is queued, not accomplished');
});

test('a hand-over merged into memory comes back in the next slice', () => {
  const inp = fixtureInputs({ clean: true });
  inp.handoff = { sessions: [{ date: '2026-10-28', accomplished: ['booted from the token'], queued: ['next job'] }],
    milestones: [{ id: 'H1', name: 'loop closed', date: '2026-10-28', what: 'a fresh session worked', outcome: 'merged', source: 'the returned token' }],
    lessons: ['tokens travel, memory stays'], resolved: [{ name: 'old item', date: '2026-10-27', what: 'w', outcome: 'o', lesson: 'l' }] };
  const m = buildSlice(inp, lists, 'full', {}).model62;
  assert.deepEqual(m.sessions[0], { date: '2026-10-28', accomplished: ['booted·from·the·token'], queued: ['next·job'] });
  assert.equal(m.sessions.length, 2, 'the hand-over\'s session, then this generation\'s own');
  assert.deepEqual(m.milestones.at(-1), { id: 'H1', name: 'loop·closed', date: '2026-10-28', what: 'a·fresh·session·worked', outcome: 'merged', source: 'the·returned·token' });
  assert.deepEqual(m.lessons.at(-1), ['L2', 'tokens·travel,·memory·stays']);
  assert.deepEqual(m.resolved, [{ name: 'old·item', date: '2026-10-27', what: 'w', outcome: 'o', lesson: 'l' }]);
  inp.handoff = { sessions: [{ date: 'x' }, 3], milestones: [{ id: 'a' }, null], lessons: [5], resolved: [{}] };
  const m2 = buildSlice(inp, lists, 'full', {}).model62;
  assert.equal(m2.sessions.length, 1);
  assert.equal(m2.resolved.length, 0);
  assert.equal(checkModel62(m2).ok, true);
});

test('the readers of the digest, the index and the retrospectives', () => {
  const d = parseDigest(fixtureInputs({ clean: true }).digest);
  assert.equal(d.estate, '2 repositories');
  assert.deepEqual(d.builds.map((b) => b.name), ['kitchen-build', 'master-vision-build']);
  assert.equal(d.builds[0].facts, 'sealed abc1234');
  assert.deepEqual(d.changed, []);
  assert.deepEqual(d.decisions, []);
  assert.equal(d.next, 'door sheet — cut the door sheet');
  const d2 = parseDigest('CHANGED SINCE THE LAST LOOK (2): one\n· two\nDECISIONS ONLY ROWAN MAKES (1): sign it\n· and this');
  assert.deepEqual(d2.changed, ['one', 'two']);
  assert.deepEqual(d2.decisions, ['sign it', 'and this']);
  assert.deepEqual(parseDigest(null), { estate: '', builds: [], changed: [], next: '', decisions: [] });
  const ix = parseIndex(fixtureInputs({ clean: true }).index);
  assert.deepEqual(ix.sections.map((s) => s.title), ['How we work — read first', 'Older']);
  assert.deepEqual(ix.notPushed, ['van-idea']);
  assert.deepEqual(parseIndex(4), { sections: [], notPushed: [] });
  assert.deepEqual(checksOf('a CHECK: one thing. | b\nCHECK: two\n**Check that now** x'), ['one thing.', 'two']);
  assert.deepEqual(checksOf(null), []);
  const estate = fixtureInputs().estate;
  assert.equal(liveUrl('LIVE vale-site/kitchen/', estate), 'https://sjgant80-hub.github.io/vale-site/kitchen/');
  assert.equal(liveUrl('LIVE https://sjgant80-hub.github.io/vale-site/', estate), 'https://sjgant80-hub.github.io/vale-site/');
  assert.equal(liveUrl('LIVE vale-site', estate), 'https://sjgant80-hub.github.io/vale-site/');
  assert.equal(liveUrl('LIVE hushbox/x', estate), null, 'a private repository is never linked');
  assert.equal(liveUrl('LIVE nowhere/', estate), null);
  assert.equal(liveUrl('no link', estate), null);
  assert.equal(liveUrl(null, estate), null);
  assert.equal(liveUrl('LIVE vale-site', {}), null);
});

test('cut bounds a value at a middle dot, and slices refuse what they cannot read', () => {
  assert.equal(cut('⚑⚑ a  b'), 'a·b');
  const long = cut(Array.from({ length: 80 }, (_, i) => 'word' + i).join(' '));
  assert.ok([...long].length <= MAX && long.endsWith('…') && !long.includes('·…'));
  const solid = cut('x'.repeat(300));
  assert.equal([...solid].length, MAX);
  assert.equal(cut(''), '');
  assert.equal(buildSlice(null, lists, 'full').ok, false);
  assert.equal(buildSlice(fixtureInputs(), lists, 'secret').ok, false);
  assert.equal(buildSlice({ ...fixtureInputs(), now: '2026-10-28' }, lists, 'full').ok, false);
  assert.equal(buildSlice({ ...fixtureInputs(), today: 'x' }, lists, 'full').ok, false);
  const bare = buildSlice({ now: '2026-10-28_1600H', today: '2026-10-28' }, null, 'public', null);
  assert.equal(bare.ok, true);
  assert.equal(checkModel62(bare.model62).ok, true);
  assert.equal(bare.model62.meta.org, 'not·recorded');
  assert.equal(PLACES.length, 15);
});

test('cut keeps exactly MAX code points, and cuts at a middle dot only past half way', () => {
  assert.equal(cut('x'.repeat(MAX)), 'x'.repeat(MAX));
  assert.equal([...cut('x'.repeat(MAX + 1))].length, MAX);
  const atHalf = cut('a'.repeat(MAX / 2) + '·' + 'b'.repeat(200));
  assert.equal([...atHalf].length, MAX, 'a dot at exactly half way is not used');
  const pastHalf = cut('a'.repeat(MAX / 2 + 1) + '·' + 'b'.repeat(200));
  assert.equal(pastHalf, 'a'.repeat(MAX / 2 + 1) + '…');
});

test('every fallback of the slicer, exercised', () => {
  const base = () => fixtureInputs({ clean: true });
  const full = (inp) => buildSlice(inp, lists, 'full', {}).model62;
  // the topics a full slice draws on, and only those with a name
  let inp = base();
  inp.topics = [null, 3, { description: 'nameless' }, { name: 'page-explains-itself', description: 'reads the live link' }, { name: 'gary-floyd-papers', description: 'credit in full' }];
  let m = full(inp);
  assert.equal(m.identity.communication, 'reads·the·live·link');
  assert.deepEqual(m.relationships.find(([n]) => n === 'Gary·W.·Floyd'), ['Gary·W.·Floyd', 'credit·in·full']);
  assert.equal(buildSlice(inp, lists, 'public', {}).model62.relationships.some(([n]) => n === 'Gary·W.·Floyd'), false);
  inp.topics = [];
  m = full(inp);
  assert.equal(m.identity.communication, 'not·recorded');
  assert.equal(m.relationships.some(([n]) => n === 'Gary·W.·Floyd'), false);
  // working memory without its facts
  inp = base();
  inp.working = ['First real revenue goal'];
  const pub = buildSlice(inp, lists, 'public', {}).model62;
  assert.equal(pub.meta.org, 'not·recorded');
  assert.equal(pub.identity.role, 'not·recorded');
  assert.equal(pub.relationships.some(([n]) => n === 'Kar' || n === 'Grok'), false);
  assert.equal(pub.lanes[0].primary.status, 'in·progress');
  assert.deepEqual(pub.lexicon, []);
  assert.deepEqual(buildSlice(base(), lists, 'public', {}).model62.lexicon.map(([t]) => t), ['business·door', 'agent·door', 'pitch']);
  // the estate line, a build with no date, a next build with no detail, the operator unnamed
  inp = base();
  inp.estate = { ...inp.estate, public: 'many' };
  assert.equal(buildSlice(inp, lists, 'public', {}).model62.bootFacts.some(([k]) => k === 'estate'), false);
  inp = base();
  inp.digest = inp.digest.replace('KITCHEN 2026-10-28: carcasses built', 'KITCHEN: carcasses built');
  assert.equal(buildSlice(inp, lists, 'public', {}).model62.milestones[0].date, '2026-10-28');
  inp = base();
  inp.digest = inp.digest.replace('door sheet — cut the door sheet', 'door sheet');
  assert.deepEqual(full(inp).lanes[1].primary.next, ['door·sheet']);
  inp = base(); inp.operator = { first: '' };
  assert.equal(buildSlice(inp, lists, 'shareable', {}).model62.identity.callname, 'the·operator');
  // the v3.0 next step: the next build, else lane 1's thread, else ask
  inp = base();
  assert.equal(buildSlice(inp, lists, 'full', {}).model30.session.nextStep, 'door·sheet');
  inp.digest = inp.digest.replace(/^NEXT BUILD.*$/m, '');
  assert.equal(buildSlice(inp, lists, 'full', {}).model30.session.nextStep, '2·fitting·day');
  inp.digest = inp.digest.replace(/^· master-vision-build.*$/m, '');
  assert.equal(buildSlice(inp, lists, 'full', {}).model30.session.nextStep, 'ask·the·operator');
  // a hand-over resolved item missing any field is not carried
  for (const k of ['name', 'what', 'outcome', 'lesson']) {
    inp = base();
    const r = { name: 'n', date: '2026-10-27', what: 'w', outcome: 'o', lesson: 'l' }; delete r[k];
    inp.handoff = { resolved: [r] };
    assert.deepEqual(full(inp).resolved, [], k);
  }
  // a not-pushed thread that would leak is not carried in a shareable slice
  inp = fixtureInputs();
  assert.equal(buildSlice(inp, lists, 'shareable', {}).model62.threads.some((t) => /hushbox|κ/.test(t.name)), false);
});

test('the digest reader: counts of zero, empty and placeholder lines, and items under each heading', () => {
  assert.deepEqual(parseDigest('CHANGED SINCE THE LAST LOOK (0): something').changed, []);
  assert.deepEqual(parseDigest('CHANGED SINCE THE LAST LOOK (2): nothing').changed, []);
  assert.deepEqual(parseDigest('CHANGED SINCE THE LAST LOOK (1):').changed, []);
  assert.deepEqual(parseDigest('DECISIONS ONLY ROWAN MAKES (0): sign').decisions, []);
  assert.deepEqual(parseDigest('DECISIONS ONLY ROWAN MAKES (3): none waiting').decisions, []);
  assert.deepEqual(parseDigest('DECISIONS ONLY ROWAN MAKES (1):\nnot an item\n· an item').decisions, ['an item']);
  assert.deepEqual(parseDigest('NEXT BUILD: x\n· stray').changed, []);
  assert.deepEqual(liveUrl('LIVE vale-site', { repos: 'no' }), null);
  assert.deepEqual(liveUrl('LIVE vale-site', null), null);
  assert.deepEqual(liveUrl('LIVE vale-site', { repos: [null, { name: 'vale-site', private: false, live: false }] }), null);
});
