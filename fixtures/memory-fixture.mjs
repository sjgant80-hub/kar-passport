// fixtures/memory-fixture.mjs: a made-up memory (Rowan Quill of Vale Joinery, who does not exist) in the exact shapes
// kar/inputs.mjs reads, with one planted item of every leak class in every place the slicer draws from (claim K2).
import { lists, planted } from './leak-fixture.mjs';
export { lists };

export const CLASSES = ['private', 'secret', 'phrase', 'personal', 'pricing', 'economy', 'cosmology', 'plumbing'];
/** The first planted example of each class, and one more for the public-only first name. */
export const plants = Object.fromEntries(CLASSES.map((c) => [c, planted.find(([k]) => k === c)[1]]));

const places = ['working-rule', 'working-good', 'working-pitch', 'digest-build', 'digest-facts', 'digest-next', 'digest-changed', 'digest-decision',
  'index-how', 'index-not-pushed', 'handoff-session', 'handoff-milestone', 'handoff-lesson', 'handoff-resolved', 'retro-check'];
export const PLACES = places;

export function fixtureInputs({ clean = false } = {}) {
  const P = (place) => (clean ? [] : CLASSES.map((c) => plants[c] + ' at ' + place));
  const repos = [{ name: 'vale-site', desc: 'Vale Joinery public site', live: true, private: false }, { name: 'hushbox', desc: 'x', live: true, private: true }];
  const digest = [
    '── KAR\'S BRAIN · working memory ──',
    'ESTATE: 2 repositories',
    'RECENT BUILDS, newest first:',
    '· kitchen-build — KITCHEN 2026-10-28: carcasses built, doors next; LIVE vale-site/kitchen/',
    '   key facts: sealed abc1234',
    '· master-vision-build — MASTER VISION order + homes + status: 1 doors DONE · 2 fitting day · 3 alcove shelving',
    '   key facts: build order',
    ...P('digest-build').map((p, i) => '· planted-' + i + ' — ' + p + ' 2026-10-28; LIVE vale-site/p' + i + '/'),
    ...P('digest-facts').map((p, i) => '· factful-' + i + ' — note 2026-10-27\n   key facts: ' + p).join('\n').split('\n'),
    'CHANGED SINCE THE LAST LOOK (' + (clean ? 0 : 8) + '):' + (clean ? ' nothing' : ''),
    ...P('digest-changed').map((p) => '· ' + p),
    'NEXT BUILD (the order): ' + (clean ? 'door sheet' : P('digest-next').join(' ')) + ' — cut the door sheet',
    'DECISIONS ONLY ROWAN MAKES (' + (clean ? 0 : 8) + '):' + (clean ? ' none waiting' : ''),
    ...P('digest-decision').map((p) => '· ' + p),
  ].join('\n');
  const working = ['Name: Vale Joinery', 'Business door (humans): https://example.com/vale', 'Agent door (machines): https://example.com/vale/agents',
    'Pitch: ' + (clean ? 'fitted furniture that lasts' : P('working-pitch').join(' ')), 'Rowan signs off on anything outward', 'Kar builds every line of code', 'Grok sells only',
    'Every public claim links to a proof', 'Never fake a result', 'Verify, don\'t trust — including each other', 'First real revenue goal', 'Van key pending for deliveries',
    'Kitchens — fitted kitchens, proof on the site', ...P('working-rule').map((p) => 'No ' + p), ...P('working-good').map((p) => p + ' — a good')];
  const index = ['# index', '**How we work — read first:**', '- [measure-twice](measure-twice.md) — measure twice, cut once',
    ...P('index-how').map((p, i) => '- [rule-' + i + '](rule-' + i + '.md) — ' + p), '**Older:**',
    '- [x](x.md) — y · NOT pushed: [van-idea](van-idea.md)' + (clean ? '' : ' · ' + P('index-not-pushed').map((p, i) => '[' + p.replace(/[[\]()]/g, '') + '](n' + i + '.md)').join(' · '))].join('\n');
  const retros = ['## a build', '- CHECK: photograph every site first.', ...P('retro-check').map((p) => '- CHECK: ' + p + '.')].join('\n');
  const handoff = clean ? {} : {
    sessions: [{ date: '2026-10-27', accomplished: P('handoff-session'), queued: ['door sheet'] }],
    milestones: P('handoff-milestone').map((p, i) => ({ id: 'H' + i, name: p, date: '2026-10-27', what: p, outcome: 'done', source: 'the job book' })),
    lessons: P('handoff-lesson'),
    resolved: P('handoff-resolved').map((p) => ({ name: p, date: '2026-10-27', what: p, outcome: 'fixed', lesson: p })),
  };
  return {
    now: '2026-10-28_1600H', today: '2026-10-28', index, topics: [{ name: 'measure-twice', description: 'measure twice, cut once', type: 'feedback' }],
    retros, digest, working, estate: { total: 2, public: 1, private: 1, live: 2, repos }, operator: { first: 'Rowan', fullName: 'Rowan Quill' },
    handoff, workingDirectory: 'C:/Users/rowan/.claude',
  };
}
