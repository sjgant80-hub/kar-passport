#!/usr/bin/env node
// kar/measure-local.mjs: the parts of the sealed claims that need Kar's private tokens, measured on Kar's machine and
// recorded in local/ as counts and hashes only (no private text):
//   K1 local/k1.json  the 15 tokens: SYMBEYOND's validator, the fork's engine, the generator and the tier limit, the seal,
//                      no template field, em dash or CR
//   K2 local/k2.json  the leak gate, every class with the machine's own lists, over the 10 public and shareable tokens
//   P6 local/p6.json  every refusal of P6 over the 10 full and shareable tokens
//   P7 local/p7.json  the drift cases made from Kar's full token
//   G3 local/g3.json  the private and personal-name classes over every committed file (CI cannot read those lists)
//   node kar/measure-local.mjs <tokensDir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runOracle } from '../tools/oracle-corpus.mjs';
import { formatOf, tierBody, codePoints, TIER_LIMITS, withSig, REQUIRED62, CANON30 } from '../src/symbfer.mjs';
import { toModel62, tierFit } from '../src/render.mjs';
import { verify, verifyBytes, parseToken, seal, shaOf } from '../src/seal.mjs';
import { scan, protocolLines } from '../src/leak.mjs';
import { driftCheck } from '../src/drift.mjs';
import { honestUpdate, driftedCases } from '../fixtures/drift-cases.mjs';
import { readLists } from './inputs.mjs';
import { trustList } from './passport.mjs';
import { makeIdentity } from '../vendor/fall-kit-core/identity.mjs';
import { T62 } from '../src/template62.mjs';

const REPO = join(import.meta.dirname, '..');
const dir = process.argv[2];
const enc = new TextEncoder();
const trust = trustList(), lists = readLists();
const SHAPES = ['v6.2', 'v3.0', 'nano', 'core', 'state'];
const toks = [];
for (const target of ['full', 'shareable', 'public']) for (const shape of SHAPES) toks.push({ target, shape, text: readFileSync(join(dir, target + '.' + shape + '.txt'), 'utf8') });
const save = (name, x) => { mkdirSync(join(REPO, 'local'), { recursive: true }); writeFileSync(join(REPO, 'local', name), JSON.stringify(x, null, 1) + '\n'); console.log(name, JSON.stringify(x).slice(0, 300)); };

// K1
const FIELDS = [...new Set(T62.join('\n').match(/\[[^\]\n]*\]/g))].filter((b) => !['[MUST·REMAIN·FALSE]', '[highest·authority]'].includes(b));
const v62 = runOracle(toks.filter((t) => t.shape === 'v6.2').map((t) => ({ kind: 'v62', bytes: enc.encode(t.text) })));
const v30 = runOracle(toks.filter((t) => t.shape === 'v3.0').map((t) => ({ kind: 'v30', bytes: enc.encode(t.text) })));
const fullModel = (target) => toModel62(toks.find((t) => t.target === target && t.shape === 'v6.2').text).model;
const genJobs = toks.filter((t) => ['nano', 'core', 'state'].includes(t.shape)).map((t) => { const m = fullModel(t.target); return { kind: 'gen', tier: t.shape, ts: m.generated, state: tierFit(m, t.shape, m.generated).state }; });
const gen = JSON.parse(execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-I', join(REPO, 'tools', 'oracle.py')], { input: JSON.stringify({ jobs: genJobs }) }).toString('utf8')).results;
let i62 = 0, i30 = 0, ig = 0;
const k1 = [];
for (const t of toks) {
  const row = { target: t.target, shape: t.shape, bytes: Buffer.byteLength(t.text), sha256: shaOf(t.text) };
  row.verified = (await verify(t.text, { trust })).ok;
  row.noField = !FIELDS.some((f) => t.text.includes(f));
  row.noEmDash = !t.text.includes('—');
  row.noCR = !t.text.includes('\r');
  if (t.shape === 'v6.2') row.symbeyond = v62[i62++].status;
  else if (t.shape === 'v3.0') row.engine = v30[i30++].status;
  else { row.generatorIdentical = tierBody(t.text) === gen[ig++].text; row.withinTier = codePoints(tierBody(t.text)) <= TIER_LIMITS[t.shape]; row.codePoints = codePoints(tierBody(t.text)); }
  row.ok = row.verified && row.noField && row.noEmDash && row.noCR && (row.symbeyond ? row.symbeyond === 'PASS' : row.engine ? row.engine === 'PASS' : row.generatorIdentical && row.withinTier);
  k1.push(row);
}
save('k1.json', { claim: 'K1', key: trust[0], tokens: k1 });

// K2
let hits = 0, exempt = 0, scanned = 0;
const byClass = {};
for (const t of toks.filter((x) => x.target !== 'full')) {
  const r = scan(t.text, lists, t.target, protocolLines());
  hits += r.hits.length; exempt += r.exempt; scanned += r.scanned;
  for (const h of r.hits) byClass[h.cls] = (byClass[h.cls] || 0) + 1;
}
save('k2.json', { claim: 'K2', tokens: toks.filter((x) => x.target !== 'full').length, hits, byClass, scanned, exempt, lists: { privateNames: lists.privateNames.length, surnames: lists.surnames.length, firstNames: lists.firstNames.length } });

// P6 on the private ones (full, shareable)
const stranger = await makeIdentity(new Uint8Array(32).fill(9));
const p6 = { tokens: 0, tried: 0, refused: 0, contextOnRefusal: 0, untouchedOk: 0 };
for (const t of toks.filter((x) => x.target !== 'public')) {
  const bytes = enc.encode(t.text);
  const one = (p) => { p6.tried++; if (!p.ok) { p6.refused++; if (p.context !== null) p6.contextOnRefusal++; } };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes.slice(); b[i] ^= 1;
    const v = await verifyBytes(b, { trust });
    one(v.ok ? await parseToken(new TextDecoder().decode(b), { trust }) : { ok: false, context: null });
  }
  one(await parseToken(await seal(t.text, stranger), { trust }));
  one(await parseToken(withSig(t.text, null), { trust }));
  const names = formatOf(t.text) === 'v6.2' ? REQUIRED62 : formatOf(t.text) === 'v3.0' ? CANON30 : ['SIG'];
  for (const name of names) one(await parseToken(t.text.split('\n').filter((l) => l !== '§' + name + '·BEGIN').join('\n'), { trust }));
  p6.tokens++;
  if ((await parseToken(t.text, { trust })).ok) p6.untouchedOk++;
}
save('p6.json', { claim: 'P6', ...p6 });

// P7 on Kar's full token
const sent = toks.find((t) => t.target === 'full' && t.shape === 'v6.2').text;
let drifted = 0, refusedNamed = 0;
const bySection = {};
for (const c of driftedCases(sent)) {
  drifted++;
  const r = driftCheck(sent, c.text);
  if (!r.ok && r.drift.some((d) => d.section === c.section)) { refusedNamed++; bySection[c.section] = (bySection[c.section] || 0) + 1; }
}
save('p7.json', { claim: 'P7', token: shaOf(sent), drifted, refusedNamed, bySection, honestAccepted: driftCheck(sent, honestUpdate(sent)).ok });

// G3: the private and personal-name classes over every committed file
const files = execFileSync('git', ['ls-files'], { cwd: REPO }).toString().split('\n').filter(Boolean)
  .filter((f) => !/^(vendor|fixtures)\//.test(f) && !['claims.json', 'src/leak.mjs', 'src/leak.test.mjs', 'receipts/passport.json'].includes(f));
let g3 = 0; const g3where = [];
for (const f of files) {
  const r = scan(readFileSync(join(REPO, f), 'utf8'), { privateNames: lists.privateNames, surnames: lists.surnames, firstNames: lists.firstNames, canaries: [] }, 'public', protocolLines());
  const mine = r.hits.filter((h) => h.cls === 'private' || (h.cls === 'personal' && /name/.test(h.what)));
  g3 += mine.length; if (mine.length) g3where.push(f + ': ' + mine.map((h) => h.what.replace(/./g, '*') + '@' + h.n).join(','));
}
const prev = (() => { try { return JSON.parse(readFileSync(join(REPO, 'local', 'g3.json'), 'utf8')); } catch { return {}; } })();
save('g3.json', { claim: 'G3', files: files.length, hits: g3, where: g3where, pageScanned: prev.pageScanned === true, pageHits: prev.pageHits || 0 });
