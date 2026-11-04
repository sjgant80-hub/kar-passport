// page.mjs: the live page. Every check here is the tool's own gated code (src/), run in the tab. Nothing typed here leaves it.
import { parse, formatOf, validate62, REQUIRED62, TIER_LIMITS } from './src/symbfer.mjs';
import { render62, dot } from './src/render.mjs';
import { seal, verify, parseToken, shaOf } from './src/seal.mjs';
import { scan, protocolLines, CLASSES } from './src/leak.mjs';
import { buildSlice } from './src/slice.mjs';
import { driftCheck } from './src/drift.mjs';
import { makeIdentity } from './vendor/fall-kit-core/identity.mjs';
import { syntheticModel } from './fixtures/synthetic-model.mjs';
import { honestUpdate, driftedCases } from './fixtures/drift-cases.mjs';
import { fixtureInputs, lists as fixtureLists } from './fixtures/memory-fixture.mjs';
import { briefOf, timeCase, sourcesOf, DEFAULTS } from './src/timecase.mjs';

window.__kpStarted = true;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>\x22\x27]/g, (c) => '&#' + c.charCodeAt(0) + ';');
const say = (el, ok, text) => { el.className = 'verdict ' + (ok ? 'ok' : 'bad'); el.textContent = text; };
const get = async (p) => { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.text(); };
const getJson = async (p) => { try { return JSON.parse(await get(p)); } catch { return null; } };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fill = (sel, text) => { for (const el of document.querySelectorAll(sel)) el.textContent = text; };
const SHAPES = [['v6.2', 'v6.2 living token'], ['v3.0', 'v3.0 (teslasolar fork)'], ['nano', 'NANO tier'], ['core', 'CORE tier'], ['state', 'STATE tier']];
const NO_LISTS = { privateNames: [], surnames: [], firstNames: [], canaries: [] };

const state = { trust: [], tokens: {}, shape: 'v6.2', shown: '', made: '', tabKey: null };

// ── Kar's public passport ───────────────────────────────────────────
async function loadPublic() {
  state.trust = [JSON.parse(await get('keys/kar.json')).id];
  for (const [s] of SHAPES) state.tokens[s] = await get('tokens/public.' + s + '.txt');
  const tabs = $('shape-tabs');
  for (const [s, label] of SHAPES) {
    const b = document.createElement('button');
    b.textContent = label; b.setAttribute('role', 'tab'); b.dataset.shape = s;
    b.onclick = () => show(s);
    tabs.appendChild(b);
  }
  show('v6.2');
  const g = /^GENERATED: (\d{4})-(\d{2})-(\d{2})_/m.exec(state.tokens['v6.2']);
  if (g) { state.madeOn = Number(g[3]) + ' ' + MONTHS[Number(g[2]) - 1] + ' ' + g[1]; fill('.made-on', state.madeOn); }
  for (const t of ['nano', 'core', 'state']) fill('.tier-' + t, TIER_LIMITS[t].toLocaleString('en-GB'));
  fill('.sections62', String(REQUIRED62.length));
}
function show(s) {
  state.shape = s; state.shown = state.tokens[s];
  $('tok').textContent = state.shown;
  for (const b of $('shape-tabs').children) b.setAttribute('aria-selected', String(b.dataset.shape === s));
  const lines = state.shown.split('\n').length, bytes = new TextEncoder().encode(state.shown).length;
  $('tok-facts').textContent = lines + ' lines · ' + bytes.toLocaleString() + ' bytes · signed by Kar\'s key ' + state.trust[0].slice(0, 16) + '…';
  $('v-out').className = 'verdict'; $('v-out').textContent = 'Press Verify.'; $('v-boot').innerHTML = '';
}
$('b-verify').onclick = async () => {
  const p = await parseToken(state.shown, { trust: state.trust });
  if (!p.ok) { say($('v-out'), false, 'REFUSED · ' + p.refused); $('v-boot').innerHTML = '<p class="muted">Nothing of a refused passport is read: no context was given to anything.</p>'; return; }
  say($('v-out'), true, 'VERIFIED · ' + p.context.format + ' · signed by Kar\'s key ' + p.context.key.slice(0, 16) + '… · SHA-256 ' + p.context.sha.slice(0, 12) + '…');
  $('v-boot').innerHTML = '<p>The order a receiving AI boots in (v6.2 §BOOT·PROTOCOL):</p><ol class="steps">' + p.context.boot.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>';
};
$('b-tamper').onclick = () => {
  const t = state.shown, at = Math.floor(Math.random() * (t.length - 1));
  const ch = t[at] === 'a' ? 'b' : 'a';
  state.shown = t.slice(0, at) + ch + t.slice(at + 1);
  $('tok').textContent = state.shown;
  const line = t.slice(0, at).split('\n').length;
  $('v-out').className = 'verdict'; $('v-out').textContent = 'One character changed on line ' + line + '. Press Verify.'; $('v-boot').innerHTML = '';
};
$('b-reset').onclick = () => show(state.shape);
$('b-copy').onclick = async () => { try { await navigator.clipboard.writeText(state.shown); $('b-copy').textContent = 'Copied'; } catch { $('b-copy').textContent = 'Select the text to copy'; } };

// ── make one ────────────────────────────────────────────────────────
$('b-make').onclick = async () => {
  if (!state.tabKey) state.tabKey = await makeIdentity();
  const m = syntheticModel(stamp());
  const v = (id) => $(id).value.trim();
  const name = v('f-name'), org = v('f-org'), site = v('f-site'), thread = v('f-thread'), next = v('f-next'), rule = v('f-rule');
  if (name) { m.meta.human = dot(name); m.identity.fullName = dot(name); m.meta.callname = dot(name.split(/\s+/)[0]); m.identity.callname = m.meta.callname; m.sovereign = m.meta.callname; }
  if (org) m.meta.org = dot(org);
  if (site) { m.meta.website = dot(site); m.meta.contact = dot(site); }
  if (thread) m.lanes[0].primary.thread = dot(thread);
  if (next) m.lanes[0].primary.next = [dot(next)];
  if (rule) m.rules = [dot(rule), ...m.rules.slice(1)];
  m.bootFacts = m.bootFacts.map(([k, x]) => (k === 'token·slice' ? [k, 'made·in·a·browser·tab'] : [k, x]));
  const unsealed = render62(m);
  if (!unsealed) { say($('m-out'), false, 'Those values cannot be written as a SYMB-FER value (no brackets, and nothing starting with § or #). Try again.'); return; }
  state.made = await seal(unsealed, state.tabKey);
  const r = validate62(state.made), ok = await verify(state.made, { trust: [state.tabKey.id] });
  say($('m-out'), r.status === 'PASS' && ok.ok, 'SYMB-FER v6.2 rules: ' + r.status + ' · signed with this tab\'s key ' + state.tabKey.id.slice(0, 16) + '… · ' + (ok.ok ? 'verifies' : 'does not verify: ' + ok.why));
  $('m-tok').textContent = state.made;
  for (const id of ['b-dl', 'b-honest', 'b-drift', 'b-check']) $(id).disabled = false;
};
$('b-dl').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([state.made], { type: 'text/plain' }));
  a.download = 'SYMB-FER_v6.2_' + stamp() + '.txt';
  a.click();
};
function stamp() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + 'H'; }

// ── hand-back ───────────────────────────────────────────────────────
$('b-honest').onclick = () => { $('h-back').value = honestUpdate(state.made, stamp().slice(0, 10), stamp()); $('h-out').className = 'verdict'; $('h-out').textContent = 'An honest update is in the box. Press Check what came back.'; };
$('b-drift').onclick = () => {
  const cases = driftedCases(state.made);
  const c = cases[Math.floor(Math.random() * cases.length)];
  $('h-back').value = c.text; $('h-out').className = 'verdict'; $('h-out').textContent = 'A drifted one is in the box (somewhere in §' + c.section + '). Press Check what came back.';
};
$('b-check').onclick = () => {
  const r = driftCheck(state.made, $('h-back').value);
  if (!r.ok) {
    say($('h-out'), false, 'REFUSED · drift');
    $('h-added').innerHTML = '<ul>' + (r.drift || []).map((d) => '<li><b>§' + esc(d.section) + '</b>: ' + esc(d.detail) + ' <span class="muted">(' + esc(d.rule) + ')</span></li>').join('') + (r.why ? '<li>' + esc(r.why) + '</li>' : '') + '</ul>';
    return;
  }
  say($('h-out'), true, 'ACCEPTED · no drift · these lines would be merged into memory, by a reviewed plan that can be undone:');
  const a = r.added, rows = [['Session log', a.session], ['Milestones', a.milestones], ['Lessons', a.lessons], ['Resolved', a.resolved], ['Threads closed', a.threadsClosed], ['Current reality (replaced)', a.current]];
  $('h-added').innerHTML = rows.filter(([, l]) => l.length).map(([k, l]) => '<h3>' + k + '</h3><pre>' + esc(l.join('\n')) + '</pre>').join('');
};

// ── the leak gate, on a made-up memory with one planted leak of every kind in every place ─
$('b-leak').onclick = () => {
  const inputs = fixtureInputs();
  const rows = [];
  for (const target of ['public', 'shareable', 'full']) {
    const s = buildSlice(inputs, fixtureLists, target, {});
    const tok = render62(s.model62);
    const r = scan(tok, fixtureLists, target === 'full' ? 'public' : target, protocolLines());
    const by = {}; for (const h of r.hits) by[h.cls] = (by[h.cls] || 0) + 1;
    const dropped = Object.entries(s.report.dropped).map(([c, n]) => c + ' ' + n).join(', ') || 'none';
    rows.push('<tr><td><b>' + target + '</b></td><td>' + (target === 'full' ? 'kept: the full slice is private and never leaves' : dropped) + '</td><td class="' + (target === 'full' ? '' : r.hits.length ? 'failed' : 'held') + '">' +
      (target === 'full' ? CLASSES.map((c) => c + ' ' + (by[c] || 0)).join(', ') : r.hits.length + ' leaks') + '</td></tr>');
  }
  $('l-out').innerHTML = '<table><thead><tr><th>Slice</th><th>Lines the slicer dropped, by kind</th><th>The gate on the finished passport</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
    '<p class="muted">The planted values are not shown. The full slice keeps every planted item it drew, and the gate names each one by its kind. That is how we know the gate can see them. The public and shareable passports carry none.</p>';
};

// ── how it works, traced from the real passport and the proof file ─
async function trace() {
  const t = state.tokens['v6.2'];
  const d = parse(t), r = scan(t, NO_LISTS, 'public', protocolLines()), v = await verify(t, { trust: state.trust });
  let receipt = null; try { receipt = JSON.parse(await get('receipts/passport.json')); } catch {}
  const f = receipt ? receipt.facts : {};
  const steps = [
    'Kar\'s memory: ' + (f.K1 ? f.K1.tokens + ' tokens were made from it' + (state.madeOn ? ' on ' + state.madeOn : '') + ' (three slices, five shapes each)' : 'the memory index, its topic files and the brain\'s working memory') + '.',
    'The slicer picked the public slice: only facts already public. The operator became REF-P-001.',
    'The leak gate read the ' + r.scanned + ' lines Kar\'s memory added (the ' + r.exempt + ' lines of the protocol\'s own text are exempt) and found <span class="num">' + r.hits.length + '</span> leaks of the kinds this page can check' +
      (f.K2 ? ', and on Kar\'s machine, with the private lists, <span class="num">' + f.K2.hits + '</span> across all ' + f.K2.tokens + ' public and shareable tokens' : '') + '.',
    'The writer built ' + d.sections.length + ' sections in v6.2 order, ' + t.split('\n').length + ' lines; SYMBEYOND\'s rules (as ported here) say <span class="num">' + validate62(t).status + '</span>.',
    'The seal: SHA-256 ' + (v.sha || '').slice(0, 12) + '… over every line outside §SIG, signed with Kar\'s key ' + state.trust[0].slice(0, 12) + '…. Verified here: <span class="num">' + (v.ok ? 'yes' : 'no') + '</span>.',
    f.P6 ? 'Tampering: <span class="num">' + f.P6.refused.toLocaleString() + '</span> of ' + f.P6.tried.toLocaleString() + ' changed copies (every byte flipped, a stranger\'s key, unsealed, sections removed) were refused, with nothing read.' : 'Tampering: every changed copy is refused before it is read.',
    f.B1 ? 'A cold local model (qwen2.5:7b, nothing else in its context) was booted from this passport: <span class="num">' + f.B1.right + '/10</span> of what it says answered right, <span class="num">' + f.B1.declined + '/5</span> of what it does not say declined.' : 'A cold model is booted from it and questioned.',
    f.L1 ? 'The hand-back closed the loop: a fresh session returned an update, accepted with no drift, merged, carried into the next passport, and undone byte for byte.' : 'A fresh session hands back an update; it is checked and merged.',
  ];
  $('trace').innerHTML = steps.map((s) => '<li>' + s + '</li>').join('');
  if (receipt) renderReceipt(receipt);
  else $('receipt').textContent = 'The receipt is not published yet.';
  const [basis, typing, tc, k1, walked, walk] = await Promise.all(['vendor/basis/basis.json', 'data/typing-basis.json', 'receipts/timecase.json', 'local/k1.json', 'local/personas-answered.json', 'local/walk-2026-11-04.json'].map(getJson));
  state.basis = basis; state.typing = typing; state.brief = briefOf(state.tokens.state);
  setupCalc();
  renderGates(receipt, tc);
  renderReceiptTc(tc);
  renderWalks(walked, walk);
  renderSizes(k1);
}
function renderReceipt(rc) {
  $('receipt').innerHTML = '<p><b>' + rc.held + ' of ' + rc.of + ' claims held.</b> <a href="receipts/passport.json">The receipt</a> · <a href="claims.json">the sealed claims</a></p><table><thead><tr><th>Claim</th><th>Verdict</th><th>What was measured</th></tr></thead><tbody>' +
    rc.verdicts.map((v) => '<tr><td>' + esc(v.id) + '</td><td class="' + (v.held ? 'held">HELD' : 'failed">FAILED') + '</td><td class="why">' + esc(v.why) + '</td></tr>').join('') + '</tbody></table>';
}

// ── the time case: the buyer's numbers, the kernel's arithmetic (src/timecase.mjs), the sourced bases ─
const money = (x) => '£' + Number(x).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
function setupCalc() {
  const base = timeCase(state.basis, state.typing, { chars: state.brief.chars });
  if (!base.ok) { $('c-out').textContent = 'The case cannot be computed here: ' + (base.why || 'the sourced basis did not load') + '.'; return; }
  $('c-people').value = DEFAULTS.people; $('c-sessions').value = DEFAULTS.chatsPerWeek; $('c-years').value = DEFAULTS.years;
  $('c-weeks').value = base.inputs.weeks;
  $('c-cost').placeholder = 'blank: ' + base.inputs.hourly + ', the UK median wage';
  for (const id of ['c-people', 'c-sessions', 'c-weeks', 'c-cost', 'c-years']) $(id).oninput = calc;
  const USE = { wageMedianHourly: 'the value of an hour when you give no cost of your own', cpi: 'the rise in pay each year after the first', wordsPerMinute: 'the typing speed',
    charsPerWord: 'the word that speed is counted in', leaveWeeks: 'taken off the year for the default working weeks', weeksInYear: 'the year the leave is taken from' };
  $('c-sources').innerHTML = sourcesOf(state.basis, state.typing).map((x) => '<li><b>' + esc(x.value) + '</b>, ' + esc(USE[x.key] || x.key) + '. The basis says: ' + esc(x.what) + (x.source ? ' · <a href="' + esc(x.source) + '">source</a>' : '') + '</li>').join('') +
    '<li>The estate\'s basis is <a href="vendor/basis/basis.json">vendor/basis/basis.json</a>, a byte-for-byte copy pinned by SHA-256; the typing figures are <a href="data/typing-basis.json">data/typing-basis.json</a>.</li>';
  calc();
}
function calc() {
  const num = (id) => { const v = $(id).value.trim(); return v === '' ? undefined : Number(v); };
  const r = timeCase(state.basis, state.typing, { chars: state.brief.chars, people: num('c-people'), chatsPerWeek: num('c-sessions'), weeks: num('c-weeks'), hourly: num('c-cost'), years: num('c-years') });
  if (!r.ok) { $('c-out').textContent = 'Check the figures: ' + r.why + '.'; return; }
  const t = state.typing, i = r.inputs;
  $('c-out').innerHTML = 'About <span class="num">' + Math.round(r.hoursPerYear).toLocaleString('en-GB') + ' hours a year</span> of re-typing context, worth <span class="num">' + money(r.valuePerYear) + ' a year</span>' +
    (r.ownHourly ? ' at your hourly cost' : ' at the UK median wage') + ', and <span class="num">' + money(r.valueOver) + '</span> over ' + i.years + (i.years === 1 ? ' year' : ' years') + (i.years > 1 ? ' as pay rises with CPI' : '') + '.';
  $('c-basis').textContent = 'How it is counted: one re-brief is the ' + state.brief.chars.toLocaleString('en-GB') + ' characters of memory in ' + state.brief.lines + ' lines that Kar\'s STATE-tier passport carries (its list items and vocabulary), which is ' +
    (state.brief.chars / t.charsPerWord.value).toFixed(0) + ' words of ' + t.charsPerWord.value + ' characters, and takes about ' + r.minutesPerBrief + ' minutes at the average measured typing speed of ' + t.wordsPerMinute.value + ' words a minute (' +
    t.participants.value.toLocaleString('en-GB') + ' typists; Dhakal, Feit, Kristensson and Oulasvirta, CHI 2018). That is a copying speed, and writing a brief from scratch is slower, so the minutes are a floor. It is multiplied by ' + i.people + ' people, ' + i.chatsPerWeek +
    ' new chats a week each and ' + i.weeks + ' working weeks (' + t.weeksInYear.value + ' weeks less the ' + t.leaveWeeks.value + ' weeks of UK statutory paid leave). With no hourly cost of yours, an hour is valued at the UK median hourly wage, on-costs left out. Your own figures replace every default.';
}

// ── the gate record: every organ's mutation gate, from the receipts ──
const ROLES = { 'src/symbfer.mjs': 'the codec: v6.2 and v3.0 readers, the tier writer', 'src/render.mjs': 'the writers, from the template\'s own lines', 'src/seal.mjs': 'the seal and verify-before-parse',
  'src/leak.mjs': 'the leak gate', 'src/slice.mjs': 'the slicer', 'src/drift.mjs': 'the drift check and the ingest plan', 'src/boot.mjs': 'the boot of a cold model', 'src/judge.mjs': 'the sealed rules', 'src/timecase.mjs': 'the time case' };
function renderGates(rc, tc) {
  const mods = rc && rc.facts && rc.facts.G1 ? rc.facts.G1.modules.map((m) => ({ ...m, claim: 'G1' })) : [];
  const w = tc && tc.facts && tc.facts.gate ? tc.facts.gate.witness : null;
  if (w) mods.push({ name: w.module, killed: w.killed, total: w.total, clean: w.clean, capped: w.capped, claim: 'T2' });
  if (!mods.length) { $('gates').textContent = 'The gate record is not published yet.'; return; }
  const g1 = rc && rc.facts ? rc.facts.G1 : null, g2 = tc && tc.facts ? tc.facts.gate : null;
  $('gates').innerHTML = '<div class="scroll"><table><thead><tr><th>Organ</th><th class="hide-narrow">What it does</th><th>Mutants caught</th><th>Gate</th><th>Claim</th></tr></thead><tbody>' +
    mods.map((m) => '<tr><td><code>' + esc(m.name.replace(/^src\//, '')) + '</code></td><td class="hide-narrow">' + esc(ROLES[m.name] || '') + '</td><td class="num">' + m.killed + ' of ' + m.total + '</td><td class="' + (m.clean && !m.capped ? 'held">CLEAN' : 'failed">NOT CLEAN') + '</td><td>' + m.claim + '</td></tr>').join('') +
    '</tbody></table></div><p class="muted">Every organ is in <code>src/</code>. Fuzz: ' + (g1 ? g1.fuzzInputs.toLocaleString('en-GB') + ' garbage inputs to the ' + g1.fuzzFunctions + ' functions of the first eight organs, ' + g1.fuzzThrows + ' throws' : 'see the receipts') +
    (g2 ? '; ' + g2.fuzzInputs.toLocaleString('en-GB') + ' to the ' + g2.fuzzFunctions + ' of the time case, ' + g2.fuzzThrows + ' throws' : '') + '. The tests of every organ, the page and the receipts run on every push in <a href="https://github.com/sjgant80-hub/kar-passport/actions">CI</a>.</p>';
}
function renderReceiptTc(tc) {
  if (!tc) { $('receipt-tc').textContent = 'The time case receipt is not published yet.'; return; }
  $('receipt-tc').innerHTML = '<p><b>' + tc.held + ' of ' + tc.of + ' claims held.</b> <a href="receipts/timecase.json">The receipt</a> · <a href="claims-timecase.json">the sealed claims</a></p><table><thead><tr><th>Claim</th><th>Verdict</th><th>What was measured</th></tr></thead><tbody>' +
    tc.verdicts.map((v) => '<tr><td>' + esc(v.id) + '</td><td class="' + (v.held ? 'held">HELD' : 'failed">FAILED') + '</td><td class="why">' + esc(v.why) + '</td></tr>').join('') + '</tbody></table>';
}

// ── the buyer walkthroughs, from their records ──────────────────────
function renderWalks(walked, walk) {
  const parts = [];
  if (walk && Array.isArray(walk.walks)) {
    parts.push('<p><b>' + esc(walk.when) + ' · ' + esc(walk.by) + '</b>: the served page read cold as ' + walk.walks.map((w) => esc(w.role)).join(', ') + '.</p><table><thead><tr><th>Buyer</th><th>What the page left open</th><th>Where it is answered now</th></tr></thead><tbody>' +
      walk.walks.flatMap((w) => w.gaps.map((g) => '<tr><td>' + esc(w.role) + '</td><td>' + esc(g.gap) + '</td><td>' + esc(g.answered) + '</td></tr>')).join('') + '</tbody></table>' +
      (walk.open && walk.open.length ? '<p class="muted">Open, and why: ' + walk.open.map((o) => esc(o)).join(' · ') + '</p>' : ''));
  }
  if (walked && Array.isArray(walked.answered)) {
    parts.push('<p><b>Earlier</b>: ' + esc(walked.walk) + '.</p><table><thead><tr><th>What they asked</th><th>Where it is answered</th></tr></thead><tbody>' +
      walked.answered.map((a) => '<tr><td>' + esc(a.gap) + '</td><td>' + esc(a.where) + '</td></tr>').join('') + '</tbody></table>');
  }
  $('walks').innerHTML = parts.length ? parts.join('') : 'The walkthrough records are not published yet.';
}
function renderSizes(k1) {
  const b = k1 && Array.isArray(k1.tokens) ? k1.tokens.filter((t) => t.shape === 'v6.2').map((t) => t.bytes) : [];
  if (b.length) $('sizes').textContent = 'Kar\'s three v6.2 passports are ' + (Math.min(...b) / 1000).toFixed(1) + ' to ' + (Math.max(...b) / 1000).toFixed(1) + ' KB (' + REQUIRED62.length + ' sections)';
}

// ── where the protocol is silent (from the sealed claims) ───────────
async function silent() {
  try { const c = JSON.parse(await get('claims.json')); $('silent').innerHTML = c.silent.map((s) => '<li>' + esc(s) + '</li>').join(''); } catch { $('silent').innerHTML = '<li>See claims.json.</li>'; }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadPublic().then(trace).catch((e) => { $('tok').textContent = 'Could not load the public passport: ' + e.message; });
silent();
