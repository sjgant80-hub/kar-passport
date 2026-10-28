// fixtures/synthetic-model.mjs: a made-up operator (Rowan Vale of Vale Joinery, who does not exist) as a v6.2 content
// model. The page's demo and the tests use it; no real person, firm or memory is in it.
import { dot } from '../src/render.mjs';
const d = (s) => dot(s);
export function syntheticModel(generated = '2026-10-28_1600H') {
  return {
    generated, mode: 'VERIFIED',
    meta: { human: d('Rowan Vale'), callname: 'Rowan', org: d('Vale Joinery Ltd (synthetic)'), contact: d('via the website'), website: 'https://example.com/vale-joinery', origin: '2019' },
    ethos: [d('Make it once, make it right, make it last.')],
    lexicon: [[d('the shop'), d('the workshop floor and its bench schedule')], [d('a sheet'), d('one cutting list for one job')]],
    identity: { fullName: d('Rowan Vale'), callname: 'Rowan', role: d('owner and lead joiner'), function: d('quotes, designs and builds fitted furniture'),
      nature: d('plain-spoken, practical'), communication: d('short typed messages'), location: d('not stated') },
    relationships: [[d('Sam'), d('apprentice, runs the saw bench')], [d('Pat'), d('bookkeeper, two days a week')]],
    bootFacts: [['boot·date·reference', '2026-10-28'], ['token·slice', 'synthetic·demo'], [d('jobs in hand'), '3']],
    bootEthos: [d('Measure twice, cut once.')],
    sovereign: 'Rowan',
    retrieve: [d('ask Rowan for any job sheet not in this token'), 'https://example.com/vale-joinery'],
    rules: [d('quote in writing before any cut'), d('never promise a fitting date the shop schedule does not show')],
    refs: [['REF-P-001', d('a client named in the private job book')]],
    constants: [], dates: [['2019', d('the workshop opened')]],
    credits: [[d('SYMBEYOND AI LLC'), d('the SYMB-FER protocol this token follows')]],
    lanes: [
      { name: d('Client work'), primary: { thread: d('kitchen for REF-P-001'), score: 'unscored', status: d('carcasses built, doors next'), next: [d('cut the door sheet'), d('book the fitting day')] },
        queued: [{ thread: d('alcove shelving'), score: 'unscored', first: d('measure on site') }] },
      { name: d('The shop'), primary: { thread: d('dust extraction'), score: 'unscored', status: d('quote received'), next: [d('compare two quotes')] }, queued: [] },
    ],
    current: { asOf: '2026-10-28', active: [d('kitchen doors')], changed: [d('door timber arrived')], waiting: [d('client to choose handles')], hands: [d('cut the door sheet')] },
    threads: [{ name: d('a second van'), status: d('idea'), nature: d('purchase'), action: d('look again in spring') }],
    sessions: [{ date: '2026-10-27', accomplished: [d('carcasses built')], queued: [d('door sheet')] }],
    resolved: [{ name: d('the warped panel'), date: '2026-10-20', what: d('a panel bowed after glue-up'), outcome: d('remade from quarter-sawn oak'), lesson: d('let boards acclimatise a week') }],
    milestones: [{ id: 'M01', name: d('workshop insured'), date: '2026-09-01', what: d('cover renewed'), outcome: d('policy issued'), source: d('the insurer email') }],
    lessons: [['L1', d('photograph every site before measuring')]],
    finalization: { status: 'VERIFIED', mode: 'WORKING' },
  };
}
