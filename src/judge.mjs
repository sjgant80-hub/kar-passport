// ════════════════════════════════════════════════════════════════
// src/judge.mjs — the sealed rules of claims.json, as code: facts in, HELD or FAILED out. measure.mjs gathers the facts
// (some here, some recorded on Kar's machine in local/*.json); this decides, and CI decides again on every push.
//   judge(id, facts) → { id, held, why }   ·   CLAIM_IDS: the order claims.json seals them in
// Pure and total. Powered by the Konomi architecture, created by Thomas Frumkin.
// ════════════════════════════════════════════════════════════════
export const CLAIM_IDS = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'K1', 'K2', 'B1', 'B2', 'B3', 'L1', 'G1', 'G2', 'G3']);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const n = (x) => (Number.isInteger(x) ? x : -1);
const all = (x) => Array.isArray(x) && x.length > 0 && x.every(Boolean);

// what each verdict says: chosen by the verdict HELD reached, never by a second copy of its condition
const RULES = {
  P1: (f, h) => (h ? 'every one of ' + f.tokens + ' is PASS' : f.pass + ' of ' + f.tokens + ' PASS'),
  P2: (f, h) => (h ? 'the same status and messages on all 615' : f.same + ' of ' + f.corpus + ' agree'),
  P3: (f, h) => (h ? f.tokens + ' codec v3.0 tokens PASS; the engine agrees on all 404' : 'PASS ' + f.pass + '/' + f.tokens + ', agree ' + f.same + '/' + f.corpus),
  P4: (f, h) => (h ? 'all ' + f.tokens + ' byte-identical and within their tier' : f.identical + ' identical, ' + f.within + ' within, of ' + f.tokens),
  P5: (f, h) => (h ? f.tokens + ' tokens and ' + f.models + ' models round-trip' : JSON.stringify(f)),
  P6: (f, h) => (h ? f.refused + ' of ' + f.tried + ' changed tokens refused, no context given' : JSON.stringify(f)),
  P7: (f, h) => (h ? f.drifted + ' drifted tokens refused by name; the honest update accepted' : JSON.stringify(f)),
  K1: (f, h) => (h ? '15 tokens from Kar\'s memory: valid, sealed, clean' : f.ok + ' of ' + f.tokens + ' good'),
  K2: (f, h) => (h ? 'fixture caught by class; 0 hits in the 10 tokens' : JSON.stringify(f)),
  B1: (f) => f.right + '/10 right, ' + f.declined + '/5 declined, ' + f.leaked + ' leaked',
  B2: (f) => f.right + '/10 right, ' + f.declined + '/3 declined, ' + f.leaked + ' leaked',
  B3: (f, h) => (h ? '4 refusals, 0 model calls' : JSON.stringify(f)),
  L1: (f, h) => (h ? 'accepted, merged, regenerated with the session, undone byte for byte' : JSON.stringify(f)),
  G1: (f, h) => (h ? 'every module clean; ' + f.fuzzInputs + ' fuzz inputs, 0 throws' : JSON.stringify(f)),
  G2: (f, h) => (h ? 'verified, refused and generated in a real tab' : JSON.stringify(f)),
  G3: (f, h) => (h ? f.files + ' files and the live page: 0 hits' : f.hits + ' hits: ' + (Array.isArray(f.where) ? f.where.join('; ') : '')),
};
const HELD = {
  P1: (f) => n(f.tokens) > 0 && n(f.pass) === n(f.tokens), P2: (f) => n(f.corpus) === 615 && n(f.same) === 615,
  P3: (f) => n(f.tokens) > 0 && n(f.pass) === n(f.tokens) && n(f.corpus) === 404 && n(f.same) === 404,
  P4: (f) => n(f.tokens) > 0 && n(f.identical) === n(f.tokens) && n(f.within) === n(f.tokens),
  P5: (f) => n(f.tokens) > 0 && n(f.bytesBack) === n(f.tokens) && n(f.models) > 0 && n(f.modelsBack) === n(f.models) && n(f.sealedBack) === n(f.sealed),
  P6: (f) => n(f.tokens) > 0 && n(f.tried) > 0 && n(f.refused) === n(f.tried) && n(f.contextOnRefusal) === 0 && n(f.untouchedOk) === n(f.tokens),
  P7: (f) => n(f.drifted) > 0 && n(f.refusedNamed) === n(f.drifted) && f.honestAccepted === true,
  K1: (f) => n(f.tokens) === 15 && n(f.ok) === 15,
  K2: (f) => f.fixtureClean === true && f.fixtureNamed === true && n(f.tokens) === 10 && n(f.hits) === 0,
  B1: (f) => n(f.right) >= 8 && n(f.leaked) === 0 && n(f.declined) >= 4, B2: (f) => n(f.right) >= 8 && n(f.leaked) === 0 && n(f.declined) >= 2,
  B3: (f) => n(f.refusals) === 4 && n(f.calls) === 0,
  L1: (f) => ['accepted', 'allLinesInPlan', 'regeneratedPass', 'carriesSession', 'carriesMilestone', 'undoIdentical'].every((k) => f[k] === true),
  G1: (f) => all(f.clean) && n(f.fuzzThrows) === 0 && n(f.fuzzInputs) >= 2000,
  G2: (f) => ['publicVerified', 'changedRefused', 'syntheticPass', 'syntheticVerified'].every((k) => f[k] === true),
  G3: (f) => n(f.files) > 0 && n(f.hits) === 0 && f.pageScanned === true,
};

export function judge(id, facts) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(HELD, id)) return { id: String(typeof id === 'string' ? id : ''), held: false, why: 'no such claim' };
  if (!isObj(facts)) return { id, held: false, why: 'not measured' };
  const held = HELD[id](facts) === true;
  let why;
  try { why = RULES[id](facts, held); } catch { why = 'facts that cannot be read'; }
  return { id, held, why };
}
