#!/usr/bin/env node
// measure.mjs: the facts behind every sealed claim (claims.json), judged by src/judge.mjs, written to receipts/passport.json.
//   node measure.mjs           on Kar's machine: everything, including the parts that need Kar's private tokens, which are
//                              recorded in local/*.json (counts and hashes only for anything private)
//   node measure.mjs --check   in CI: re-derive every part that runs from the repository (SYMBEYOND's and teslasolar's own
//                              Python as the oracle, the committed public tokens, the synthetic ones), re-judge the local
//                              records, and fail if any fact differs from the receipt
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeIdentity } from './vendor/fall-kit-core/identity.mjs';
import { validate62Bytes, validate30Bytes, parse, write, withSig, sigOf, tierBody, formatOf, codePoints, TIER_LIMITS, TIER_SIG, REQUIRED62, CANON30 } from './src/symbfer.mjs';
import { render62, render30, toModel62, toModel30, tierFit } from './src/render.mjs';
import { seal, verifyBytes, parseToken, shaOf } from './src/seal.mjs';
import { buildSlice } from './src/slice.mjs';
import { scan, protocolLines } from './src/leak.mjs';
import { driftCheck } from './src/drift.mjs';
import { boot, keysOf, answersOf, judgeBoot, IN_TOKEN, NOT_IN_PUBLIC } from './src/boot.mjs';
import { judge, CLAIM_IDS } from './src/judge.mjs';
import { corpus, runOracle } from './tools/oracle-corpus.mjs';
import { baseCorpus } from './tools/corpus.mjs';
import { syntheticModel } from './fixtures/synthetic-model.mjs';
import { fixtureInputs, lists as fixtureLists, plants, CLASSES } from './fixtures/memory-fixture.mjs';
import { honestUpdate, driftedCases } from './fixtures/drift-cases.mjs';
import { rng } from './tools/fuzz.mjs';

const ROOT = import.meta.dirname;
const CHECK = process.argv.includes('--check');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const enc = new TextEncoder();
const local = (name) => (existsSync(join(ROOT, 'local', name)) ? JSON.parse(rd('local/' + name)) : null);
const PY = process.platform === 'win32' ? 'python' : 'python3';
const SHAPES = ['v6.2', 'v3.0', 'nano', 'core', 'state'];

// ── the tokens this build makes that live in the repository ─────────
const trust = [JSON.parse(rd('keys/kar.json')).id];
const publicTokens = SHAPES.map((s) => ({ id: 'public.' + s, text: rd('tokens/public.' + s + '.txt') }));
const testKey = await makeIdentity(new Uint8Array(32).fill(7));           // a PUBLIC TEST KEY: the synthetic tokens' signer
const stranger = await makeIdentity(new Uint8Array(32).fill(9));
const synthetic = [{ id: 'synthetic.model.v6.2', text: await seal(render62(syntheticModel()), testKey) }];
const syntheticSlices = {};
for (const t of ['full', 'shareable', 'public']) {
  const s = buildSlice(fixtureInputs({ clean: true }), fixtureLists, t, {});
  syntheticSlices[t] = s;
  synthetic.push({ id: 'synthetic.' + t + '.v6.2', text: await seal(render62(s.model62), testKey) }, { id: 'synthetic.' + t + '.v3.0', text: await seal(render30(s.model30), testKey) });
  for (const tier of ['nano', 'core', 'state']) synthetic.push({ id: 'synthetic.' + t + '.' + tier, text: await seal(tierFit(s.model62, tier, s.model62.generated).text + TIER_SIG, testKey) });
}
const made = [...publicTokens, ...synthetic];
const trustFor = (id) => (id.startsWith('public.') ? trust : [testKey.id]);

const facts = {};
const py = (items) => runOracle(items.map((x) => ({ kind: x.kind, bytes: enc.encode(x.text) })));

// P1 and P3: SYMBEYOND's validator and the fork's engine on every codec-made token here
{
  const v62 = made.filter((x) => formatOf(x.text) === 'v6.2'), v30 = made.filter((x) => formatOf(x.text) === 'v3.0');
  const r62 = py(v62.map((x) => ({ kind: 'v62', text: x.text }))), r30 = py(v30.map((x) => ({ kind: 'v30', text: x.text })));
  const k1 = local('k1.json');
  const k1v62 = k1 ? k1.tokens.filter((t) => t.shape === 'v6.2' && t.target !== 'public') : [];
  const k1v30 = k1 ? k1.tokens.filter((t) => t.shape === 'v3.0' && t.target !== 'public') : [];
  facts.P1 = { tokens: v62.length + k1v62.length, pass: r62.filter((r) => r.status === 'PASS').length + k1v62.filter((t) => t.symbeyond === 'PASS').length, here: v62.length, onKarsMachine: k1v62.length };
  const items = await corpus();
  const res = runOracle(items);
  let same62 = 0, same30 = 0;
  items.forEach((it, i) => {
    const js = it.kind === 'v62' ? validate62Bytes(it.bytes) : validate30Bytes(it.bytes);
    const ok = js.status === res[i].status && JSON.stringify(js.failures) === JSON.stringify(res[i].failures || []) && JSON.stringify(js.warnings) === JSON.stringify(res[i].warnings || []);
    if (ok && it.kind === 'v62') same62++; if (ok && it.kind === 'v30') same30++;
  });
  facts.P2 = { corpus: items.filter((x) => x.kind === 'v62').length, same: same62 };
  facts.P3 = { tokens: v30.length + k1v30.length, pass: r30.filter((r) => r.status === 'PASS').length + k1v30.filter((t) => t.engine === 'PASS').length, corpus: items.filter((x) => x.kind === 'v30').length, same: same30 };
}

// P4: the tiers against SYMBEYOND's generator
{
  const tiers = made.filter((x) => ['nano', 'core', 'state'].includes(formatOf(x.text)));
  const jobs = tiers.map((x) => {
    const src = x.id.startsWith('public.') ? publicTokens[0].text : null;
    const m = src ? toModel62(src).model : syntheticSlices[x.id.split('.')[1]].model62;
    const tier = formatOf(x.text);
    return { kind: 'gen', tier, ts: m.generated, state: tierFit(m, tier, m.generated).state };
  });
  const out = JSON.parse(execFileSync(PY, ['-I', join(ROOT, 'tools', 'oracle.py')], { input: JSON.stringify({ jobs }) }).toString('utf8')).results;
  const k1 = local('k1.json');
  const privateTiers = k1 ? k1.tokens.filter((t) => ['nano', 'core', 'state'].includes(t.shape) && t.target !== 'public') : [];
  facts.P4 = { tokens: tiers.length + privateTiers.length, identical: tiers.filter((x, i) => tierBody(x.text) === out[i].text).length + privateTiers.filter((t) => t.generatorIdentical).length,
    within: tiers.filter((x) => codePoints(tierBody(x.text)) <= TIER_LIMITS[formatOf(x.text)]).length + privateTiers.filter((t) => t.withinTier).length };
}

// P5: round trips
{
  const { v62, v30 } = await baseCorpus();
  const upstream = [...v62, ...v30].map((b) => new TextDecoder().decode(b.bytes));
  const texts = [...made.map((x) => x.text), ...upstream];
  const bytesBack = texts.filter((t) => write(parse(t)) === t).length;
  const codec = made.filter((x) => ['v6.2', 'v3.0'].includes(formatOf(x.text)));
  const sealedBack = codec.filter((x) => { const s = sigOf(x.text); const r = formatOf(x.text) === 'v6.2' ? toModel62(x.text) : toModel30(x.text);
    return r.ok && withSig(formatOf(x.text) === 'v6.2' ? render62(r.model) : render30(r.model), { sha: s.sha, key: s.key, sig: s.sig }) === x.text; }).length;
  const models = [syntheticModel(), ...Object.values(syntheticSlices).map((s) => s.model62)];
  const models30 = Object.values(syntheticSlices).map((s) => s.model30);
  const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((q) => [q, v[q]])) : v));
  const modelsBack = models.filter((m) => canon(toModel62(render62(m)).model) === canon(m)).length + models30.filter((m) => canon(toModel30(render30(m)).model) === canon(m)).length;
  facts.P5 = { tokens: texts.length, bytesBack, sealed: codec.length, sealedBack, models: models.length + models30.length, modelsBack };
}

// P6: every byte flipped, a stranger's seal, unsealed, each required BEGIN removed
async function refusals(text, trustList) {
  let tried = 0, refused = 0, contextOnRefusal = 0;
  const bytes = enc.encode(text);
  const one = async (p) => { tried++; if (!p.ok) { refused++; if (p.context !== null) contextOnRefusal++; } };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes.slice(); b[i] ^= 1;
    const v = await verifyBytes(b, { trust: trustList });
    await one(v.ok ? await parseToken(new TextDecoder().decode(b), { trust: trustList }) : { ok: false, context: null });
  }
  await one(await parseToken(await seal(text, stranger), { trust: trustList }));
  await one(await parseToken(withSig(text, null), { trust: trustList }));
  const names = formatOf(text) === 'v6.2' ? REQUIRED62 : formatOf(text) === 'v3.0' ? CANON30 : ['SIG'];
  for (const name of names) await one(await parseToken(text.split('\n').filter((l) => l !== '§' + name + '·BEGIN').join('\n'), { trust: trustList }));
  return { tried, refused, contextOnRefusal };
}
{
  const f = { tokens: 0, tried: 0, refused: 0, contextOnRefusal: 0, untouchedOk: 0 };
  for (const x of made) {
    const r = await refusals(x.text, trustFor(x.id));
    f.tokens++; f.tried += r.tried; f.refused += r.refused; f.contextOnRefusal += r.contextOnRefusal;
    if ((await parseToken(x.text, { trust: trustFor(x.id) })).ok) f.untouchedOk++;
  }
  const p6 = local('p6.json');
  if (p6) { f.tokens += p6.tokens; f.tried += p6.tried; f.refused += p6.refused; f.contextOnRefusal += p6.contextOnRefusal; f.untouchedOk += p6.untouchedOk; f.onKarsMachine = p6.tokens; }
  facts.P6 = f;
}

// P7: drift, on Kar's full token (local/p7.json) and here on the public and synthetic ones
{
  const p7 = local('p7.json');
  const sent = [publicTokens[0].text, synthetic[0].text];
  let drifted = 0, refusedNamed = 0, honestAccepted = true;
  for (const s of sent) {
    for (const c of driftedCases(s)) { drifted++; const r = driftCheck(s, c.text); if (!r.ok && r.drift.some((d) => d.section === c.section)) refusedNamed++; }
    if (!driftCheck(s, honestUpdate(s)).ok) honestAccepted = false;
  }
  facts.P7 = { drifted: drifted + (p7 ? p7.drifted : 0), refusedNamed: refusedNamed + (p7 ? p7.refusedNamed : 0), honestAccepted: honestAccepted && (p7 ? p7.honestAccepted : false), onKarsFullToken: p7 ? p7.drifted : 0 };
}

// K1: the 15 real tokens (local/k1.json), the public five re-checked here
{
  const k1 = local('k1.json');
  const reCheck = publicTokens.every((x, i) => k1 && k1.tokens.find((t) => t.target === 'public' && t.shape === SHAPES[i] && t.sha256 === shaOf(x.text)));
  facts.K1 = { tokens: k1 ? k1.tokens.length : 0, ok: k1 && reCheck ? k1.tokens.filter((t) => t.ok).length : 0, publicReChecked: reCheck };
}

// K2: the fixture first, then the real tokens (local/k2.json; here the public five on every class CI can read)
{
  const s = { full: buildSlice(fixtureInputs(), fixtureLists, 'full', {}), shareable: buildSlice(fixtureInputs(), fixtureLists, 'shareable', {}), public: buildSlice(fixtureInputs(), fixtureLists, 'public', {}) };
  const fixtureClean = ['public', 'shareable'].every((t) => scan(render62(s[t].model62), fixtureLists, t, protocolLines()).hits.length === 0 && scan(render30(s[t].model30), fixtureLists, t, protocolLines()).hits.length === 0);
  const fullHits = scan(render62(s.full.model62), fixtureLists, 'public', protocolLines()).hits;
  const fixtureNamed = CLASSES.every((c) => fullHits.some((h) => h.cls === c)) && Object.keys(plants).length === CLASSES.length;
  const k2 = local('k2.json');
  const here = publicTokens.reduce((n, x) => n + scan(x.text, { privateNames: [], surnames: [], firstNames: [], canaries: [] }, 'public', protocolLines()).hits.length, 0);
  facts.K2 = { fixtureClean, fixtureNamed, tokens: k2 ? k2.tokens : 0, hits: (k2 ? k2.hits : 0) + here, exempt: k2 ? k2.exempt : 0, publicHitsHere: here };
}

// B1, B2: the cold boots, recorded on Kar's machine; B1's answers are public and re-judged here
{
  const b1 = local('b1.json');
  if (b1) {
    const keys = keysOf(toModel62(publicTokens[0].text).model);
    const v = judgeBoot(b1.answers, keys, NOT_IN_PUBLIC.map(() => []), { right: 8, declined: 4, leaked: 0 });
    facts.B1 = { right: v.right, declined: v.declined, leaked: b1.leaked, tokenIsCommitted: b1.tokenSha256 === shaOf(publicTokens[0].text), model: b1.model };
  }
  const b2 = local('b2.json');
  if (b2) facts.B2 = { right: b2.right, declined: b2.declined, leaked: b2.leaked, model: b2.model };
}

// B3: refused tokens never reach a model
{
  let calls = 0;
  const ask = async () => { calls++; return ''; };
  const t = publicTokens[0].text, b = enc.encode(t); b[500] ^= 1;
  const refused = [new TextDecoder().decode(b), await seal(t, stranger), withSig(t, null), t.replace('§META·BEGIN\n', '')];
  let refusals = 0;
  for (const r of refused) if (!(await boot(r, { trust, questions: [...IN_TOKEN, ...NOT_IN_PUBLIC] }, ask)).ok) refusals++;
  facts.B3 = { refusals, calls };
}

// L1: the loop, recorded on Kar's machine
{ const l1 = local('l1.json'); if (l1) facts.L1 = l1.facts; }

// G1: the fuzz here (the witness runs as its own CI step and is recorded in local/g1.json and the CI log)
{
  const mods = await Promise.all(['symbfer', 'render', 'seal', 'slice', 'leak', 'drift', 'boot', 'judge'].map((m) => import('./src/' + m + '.mjs')));
  const r = rng(77), pick = (a) => a[Math.floor(r() * a.length)];
  const garbage = [null, undefined, 0, -1, NaN, 1e309, '', ' ', '§', '∴SYMB-FER·v6.2·LIVING·TOKEN·[x]', '§SIG·BEGIN\n§SIG·END', [], [null], {}, { lines: 3 }, () => 1, Symbol.iterator, new Uint8Array([0xff, 0xfe]), 'a'.repeat(5000), Object.create(null)];
  let inputs = 0, throws = 0;
  for (const m of mods) for (const [name, fn] of Object.entries(m)) {
    if (typeof fn !== 'function') continue;
    for (let k = 0; k < 2000 / 40; k++) {
      inputs++;
      try { const out = fn(pick(garbage), pick(garbage), pick(garbage), pick(garbage)); if (out && typeof out.then === 'function') await out.catch(() => { throws++; }); } catch { throws++; }
    }
  }
  const g1 = local('g1.json');
  facts.G1 = { clean: g1 ? g1.modules.map((x) => x.clean) : [], modules: g1 ? g1.modules : [], fuzzInputs: inputs, fuzzThrows: throws };
}

// G2: the live page in a real tab (local/g2.json)
{ const g2 = local('g2.json'); if (g2) facts.G2 = g2.facts; }

// G3: every committed file but vendor/, fixtures, claims.json and the gate's own lists; the live page's text (local/g2.json)
{
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT }).toString().split('\n').filter(Boolean)
    .filter((f) => !/^(vendor|fixtures)\//.test(f) && !['claims.json', 'src/leak.mjs', 'src/leak.test.mjs'].includes(f));
  const L = { privateNames: [], surnames: [], firstNames: [], canaries: [] };
  let hits = 0; const where = [];
  for (const f of tracked) { const h = scan(rd(f), L, 'shareable', protocolLines()).hits; hits += h.length; if (h.length) where.push(f + ': ' + h.map((x) => x.cls + '@' + x.n).join(',')); }
  const g3 = local('g3.json');
  facts.G3 = { files: tracked.length, hits: hits + (g3 ? g3.hits : 0), where, pageScanned: !!(g3 && g3.pageScanned), privateClassesOnKarsMachine: g3 ? g3.files : 0 };
}

const verdicts = CLAIM_IDS.map((id) => judge(id, facts[id]));
const receipt = { kind: 'kar-passport.receipt', claims: 'claims.json', facts, verdicts, held: verdicts.filter((v) => v.held).length, of: verdicts.length };
for (const v of verdicts) console.log((v.held ? 'HELD   ' : 'FAILED ') + v.id + '  ' + v.why);
console.log(receipt.held + ' of ' + receipt.of + ' held');
const path = join(ROOT, 'receipts', 'passport.json');
if (CHECK) {
  const old = JSON.parse(readFileSync(path, 'utf8'));
  const a = JSON.stringify({ facts: old.facts, verdicts: old.verdicts }), b = JSON.stringify({ facts, verdicts });
  if (a !== b) { console.error('the receipt does not reproduce'); for (const id of CLAIM_IDS) if (JSON.stringify(old.facts[id]) !== JSON.stringify(facts[id])) console.error('  ' + id + ': ' + JSON.stringify(old.facts[id]) + ' → ' + JSON.stringify(facts[id])); process.exit(1); }
  console.log('the receipt reproduces');
} else { mkdirSync(join(ROOT, 'receipts'), { recursive: true }); writeFileSync(path, JSON.stringify(receipt, null, 1) + '\n'); }
