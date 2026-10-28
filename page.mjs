// page.mjs: the live page. Every check here is the tool's own gated code (src/), run in the tab. Nothing typed here leaves it.
import { parse, formatOf, validate62 } from './src/symbfer.mjs';
import { render62, dot } from './src/render.mjs';
import { seal, verify, parseToken, shaOf } from './src/seal.mjs';
import { scan, protocolLines, CLASSES } from './src/leak.mjs';
import { buildSlice } from './src/slice.mjs';
import { driftCheck } from './src/drift.mjs';
import { makeIdentity } from './vendor/fall-kit-core/identity.mjs';
import { syntheticModel } from './fixtures/synthetic-model.mjs';
import { honestUpdate, driftedCases } from './fixtures/drift-cases.mjs';
import { fixtureInputs, lists as fixtureLists } from './fixtures/memory-fixture.mjs';

window.__kpStarted = true;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>\x22\x27]/g, (c) => '&#' + c.charCodeAt(0) + ';');
const say = (el, ok, text) => { el.className = 'verdict ' + (ok ? 'ok' : 'bad'); el.textContent = text; };
const get = async (p) => { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.text(); };
const SHAPES = [['v6.2', 'v6.2 living token'], ['v3.0', 'v3.0 (teslasolar fork)'], ['nano', 'NANO tier'], ['core', 'CORE tier'], ['state', 'STATE tier']];
const NO_LISTS = { privateNames: [], surnames: [], firstNames: [], canaries: [] };
const WPM = 51.56;   // average typing speed of 168,000 volunteers: Dhakal, Feit, Kristensson and Oulasvirta, CHI 2018

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
  const words = (state.tokens.state.split('\n\n§SIG·BEGIN')[0].match(/\S+/g) || []).length;
  const steps = [
    'Kar\'s memory: ' + (f.K1 ? f.K1.tokens + ' tokens were made from it today (three slices, five shapes each)' : 'the memory index, its topic files and the brain\'s working memory') + '.',
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
  calc(words);
  if (receipt) renderReceipt(receipt);
  else $('receipt').textContent = 'The receipt is not published yet.';
}
function renderReceipt(rc) {
  $('receipt').innerHTML = '<p><b>' + rc.held + ' of ' + rc.of + ' claims held.</b> <a href="receipts/passport.json">The receipt</a> · <a href="claims.json">the sealed claims</a></p><table><thead><tr><th>Claim</th><th>Verdict</th><th>What was measured</th></tr></thead><tbody>' +
    rc.verdicts.map((v) => '<tr><td>' + esc(v.id) + '</td><td class="' + (v.held ? 'held">HELD' : 'failed">FAILED') + '</td><td>' + esc(v.why) + '</td></tr>').join('') + '</tbody></table>';
}

// ── the time case: the buyer's numbers, one sourced rate ────────────
function calc(words) {
  const n = (id) => Math.max(0, Number($(id).value) || 0);
  const minutes = words / WPM;
  const hours = n('c-people') * n('c-sessions') * n('c-weeks') * minutes / 60;
  const cost = n('c-cost');
  $('c-out').innerHTML = 'About <span class="num">' + Math.round(hours).toLocaleString() + ' hours a year</span> of re-typing context' + (cost ? ', worth <span class="num">' + Math.round(hours * cost).toLocaleString() + '</span> in your own currency' : '') + '.';
  $('c-basis').textContent = 'How it is counted: re-briefing a fresh AI with what Kar\'s STATE-tier passport carries means typing about ' + words + ' words, which takes about ' + minutes.toFixed(1) +
    ' minutes at the average measured typing speed of ' + WPM + ' words a minute (Dhakal, Feit, Kristensson and Oulasvirta, CHI 2018, 168,000 typists). That is multiplied by your people, their new chats a week and your working weeks (46.4 = 52 less the 5.6 weeks of UK statutory leave, gov.uk). Your own figures replace every default.';
  for (const id of ['c-people', 'c-sessions', 'c-weeks', 'c-cost']) $(id).oninput = () => calc(words);
}

// ── where the protocol is silent (from the sealed claims) ───────────
async function silent() {
  try { const c = JSON.parse(await get('claims.json')); $('silent').innerHTML = c.silent.map((s) => '<li>' + esc(s) + '</li>').join(''); } catch { $('silent').innerHTML = '<li>See claims.json.</li>'; }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadPublic().then(trace).catch((e) => { $('tok').textContent = 'Could not load the public passport: ' + e.message; });
silent();
